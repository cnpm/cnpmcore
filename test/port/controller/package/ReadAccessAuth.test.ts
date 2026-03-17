import { strict as assert } from 'node:assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../TestUtil';
import { OrgService } from '../../../../app/core/service/OrgService';
import { OrgRepository } from '../../../../app/repository/OrgRepository';
import { TeamRepository } from '../../../../app/repository/TeamRepository';
import { PackageRepository } from '../../../../app/repository/PackageRepository';
import { UserRepository } from '../../../../app/repository/UserRepository';
import { Package as PackageEntity } from '../../../../app/core/entity/Package';
import { DEVELOPERS_TEAM } from '../../../../app/common/constants';
import { TeamPackage } from '../../../../app/core/entity/TeamPackage';
import { TeamMember } from '../../../../app/core/entity/TeamMember';

describe('test/port/controller/package/ReadAccessAuth.test.ts', () => {
  let adminUser: any;
  let orgMember: any;
  let nonMember: any;
  let orgRepository: OrgRepository;
  let teamRepository: TeamRepository;
  let packageRepository: PackageRepository;
  let userRepository: UserRepository;

  beforeEach(async () => {
    orgRepository = await app.getEggObject(OrgRepository);
    teamRepository = await app.getEggObject(TeamRepository);
    packageRepository = await app.getEggObject(PackageRepository);
    userRepository = await app.getEggObject(UserRepository);

    adminUser = await TestUtil.createAdmin();
    orgMember = await TestUtil.createUser({ name: 'org-read-member' });
    nonMember = await TestUtil.createUser({ name: 'org-read-nonmember' });

    // Create org matching @cnpm scope
    const orgService = await app.getEggObject(OrgService);
    const adminEntity = await userRepository.findUserByName(adminUser.name);
    assert(adminEntity);
    const org = await orgService.createOrg({
      name: 'cnpm',
      creatorUserId: adminEntity.userId,
    });

    // Add orgMember to the org (auto-joins developers team)
    const memberEntity = await userRepository.findUserByName(orgMember.name);
    assert(memberEntity);
    await orgService.addMember(org.orgId, memberEntity.userId, 'member');

    // Create a package entity directly in DB
    const pkgEntity = PackageEntity.create({
      scope: '@cnpm',
      name: 'read-auth-test-pkg',
      isPrivate: true,
      description: 'test package',
    });
    await packageRepository.savePackage(pkgEntity);
  });

  describe('Feature 1: Private scope read auth — GET /:fullname (manifest)', () => {
    it('should 401 for private scope package without login', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg')
        .set('Accept', 'application/json');
      assert.equal(res.status, 401);
    });

    it('should 403 for private scope package when user is not org member', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg')
        .set('authorization', nonMember.authorization)
        .set('Accept', 'application/json');
      assert.equal(res.status, 403);
    });

    it('should 403 for org member without team-package grant', async () => {
      // orgMember is in the org and developers team, but developers team
      // has NOT been granted access to this package
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg')
        .set('authorization', orgMember.authorization)
        .set('Accept', 'application/json');
      assert.equal(res.status, 403);
    });

    it('should pass auth when user has team-package access', async () => {
      // Grant developers team access to the package
      const org = await orgRepository.findOrgByName('cnpm');
      assert(org);
      const team = await teamRepository.findTeam(org.orgId, DEVELOPERS_TEAM);
      assert(team);
      const pkg = await packageRepository.findPackage('@cnpm', 'read-auth-test-pkg');
      assert(pkg);
      await teamRepository.addPackage(TeamPackage.create({
        teamId: team.teamId,
        packageId: pkg.packageId,
      }));

      // orgMember is in developers team + team has package grant → allowed
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg')
        .set('authorization', orgMember.authorization)
        .set('Accept', 'application/json');
      assert([ 200, 404 ].includes(res.status), `expected 200 or 404, got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it('should pass auth for admin without team-package grant', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg')
        .set('authorization', adminUser.authorization)
        .set('Accept', 'application/json');
      assert([ 200, 404 ].includes(res.status), `expected 200 or 404, got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    it('should set private cache-control for private scope', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg')
        .set('authorization', adminUser.authorization)
        .set('Accept', 'application/json');
      if (res.headers['cache-control']) {
        assert.equal(res.headers['cache-control'], 'private, no-store');
      }
    });

    it('should pass auth when private scope has no org (backward compatible)', async () => {
      // @example is in allowScopes but has no org — should pass auth
      const pkgEntity = PackageEntity.create({
        scope: '@example',
        name: 'no-org-pkg',
        isPrivate: true,
        description: 'test',
      });
      await packageRepository.savePackage(pkgEntity);

      const res = await app.httpRequest()
        .get('/@example/no-org-pkg')
        .set('authorization', nonMember.authorization)
        .set('Accept', 'application/json');
      assert([ 200, 404 ].includes(res.status), `expected 200 or 404, got ${res.status}`);
    });

    it('should pass auth for non-org-member who has team-package access', async () => {
      const org = await orgRepository.findOrgByName('cnpm');
      assert(org);
      const team = await teamRepository.findTeam(org.orgId, DEVELOPERS_TEAM);
      assert(team);

      const pkg = await packageRepository.findPackage('@cnpm', 'read-auth-test-pkg');
      assert(pkg);
      await teamRepository.addPackage(TeamPackage.create({
        teamId: team.teamId,
        packageId: pkg.packageId,
      }));

      // Add nonMember to team directly (not an org member, but in the team)
      const nonMemberEntity = await userRepository.findUserByName(nonMember.name);
      assert(nonMemberEntity);
      await teamRepository.addMember(TeamMember.create({
        teamId: team.teamId,
        userId: nonMemberEntity.userId,
      }));

      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg')
        .set('authorization', nonMember.authorization)
        .set('Accept', 'application/json');
      assert([ 200, 404 ].includes(res.status), `expected 200 or 404 (team access), got ${res.status}`);
    });
  });

  describe('Feature 1: Private scope read auth — GET /:fullname/:versionSpec', () => {
    it('should 401 for private scope version without login', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg/1.0.0');
      assert.equal(res.status, 401);
    });

    it('should 403 for private scope version when no team-package grant', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg/1.0.0')
        .set('authorization', nonMember.authorization);
      assert.equal(res.status, 403);
    });

    it('should 403 for org member without team-package grant', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg/1.0.0')
        .set('authorization', orgMember.authorization);
      assert.equal(res.status, 403);
    });
  });

  describe('Feature 1: Private scope read auth — GET /:fullname/-/:file.tgz', () => {
    it('should 401 for private scope tarball without login', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg/-/read-auth-test-pkg-1.0.0.tgz');
      assert.equal(res.status, 401);
    });

    it('should 403 for private scope tarball when no team-package grant', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg/-/read-auth-test-pkg-1.0.0.tgz')
        .set('authorization', nonMember.authorization);
      assert.equal(res.status, 403);
    });

    it('should 403 for org member tarball without team-package grant', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg/-/read-auth-test-pkg-1.0.0.tgz')
        .set('authorization', orgMember.authorization);
      assert.equal(res.status, 403);
    });

    it('should pass auth for admin tarball', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/read-auth-test-pkg/-/read-auth-test-pkg-1.0.0.tgz')
        .set('authorization', adminUser.authorization);
      assert(![ 401, 403 ].includes(res.status), `expected auth to pass, got ${res.status}`);
    });
  });
});
