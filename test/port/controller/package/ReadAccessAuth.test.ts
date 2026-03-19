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
  let normalUser: any;
  let teamMember: any;
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
    normalUser = await TestUtil.createUser({ name: 'org-read-normaluser' });
    teamMember = await TestUtil.createUser({ name: 'org-read-teammember' });
  });

  describe('self scope + no team binding = everyone can read', () => {
    beforeEach(async () => {
      // Create a package in @cnpm scope with NO team binding
      const pkgEntity = PackageEntity.create({
        scope: '@cnpm',
        name: 'public-pkg',
        isPrivate: true,
        description: 'test package without team binding',
      });
      await packageRepository.savePackage(pkgEntity);
    });

    it('should allow read without login (GET /:fullname)', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/public-pkg')
        .set('Accept', 'application/json');
      // Should not be 401 or 403
      assert(![ 401, 403 ].includes(res.status), `expected no auth error, got ${res.status}`);
    });

    it('should allow read without login (GET /:fullname/:version)', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/public-pkg/1.0.0');
      assert(![ 401, 403 ].includes(res.status), `expected no auth error, got ${res.status}`);
    });

    it('should allow read without login (GET /:fullname/-/:file.tgz)', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/public-pkg/-/public-pkg-1.0.0.tgz');
      assert(![ 401, 403 ].includes(res.status), `expected no auth error, got ${res.status}`);
    });

    it('should not set private cache-control when no team binding', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/public-pkg')
        .set('Accept', 'application/json');
      // no team binding = normal CDN behavior, not private
      assert.notEqual(res.headers['cache-control'], 'private, no-store');
    });
  });

  describe('self scope + team binding = only team members can read', () => {
    beforeEach(async () => {
      // Create org and team
      const orgService = await app.getEggObject(OrgService);
      const adminEntity = await userRepository.findUserByName(adminUser.name);
      assert(adminEntity);
      await orgService.createOrg({
        name: 'cnpm',
        creatorUserId: adminEntity.userId,
      });

      const org = await orgRepository.findOrgByName('cnpm');
      assert(org);
      const team = await teamRepository.findTeam(org.orgId, DEVELOPERS_TEAM);
      assert(team);

      // Create package and bind to team
      const pkgEntity = PackageEntity.create({
        scope: '@cnpm',
        name: 'private-pkg',
        isPrivate: true,
        description: 'test package with team binding',
      });
      await packageRepository.savePackage(pkgEntity);
      const pkg = await packageRepository.findPackage('@cnpm', 'private-pkg');
      assert(pkg);
      await teamRepository.addPackage(TeamPackage.create({
        teamId: team.teamId,
        packageId: pkg.packageId,
      }));

      // Add teamMember to the team
      const teamMemberEntity = await userRepository.findUserByName(teamMember.name);
      assert(teamMemberEntity);
      await teamRepository.addMember(TeamMember.create({
        teamId: team.teamId,
        userId: teamMemberEntity.userId,
      }));
    });

    it('should 401 without login (GET /:fullname)', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/private-pkg')
        .set('Accept', 'application/json');
      assert.equal(res.status, 401);
    });

    it('should 403 for user not in team (GET /:fullname)', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/private-pkg')
        .set('authorization', normalUser.authorization)
        .set('Accept', 'application/json');
      assert.equal(res.status, 403);
    });

    it('should pass for team member (GET /:fullname)', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/private-pkg')
        .set('authorization', teamMember.authorization)
        .set('Accept', 'application/json');
      assert([ 200, 404 ].includes(res.status), `expected 200 or 404, got ${res.status}`);
    });

    it('should pass for admin (GET /:fullname)', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/private-pkg')
        .set('authorization', adminUser.authorization)
        .set('Accept', 'application/json');
      assert([ 200, 404 ].includes(res.status), `expected 200 or 404, got ${res.status}`);
    });

    it('should 401 without login (GET /:fullname/:version)', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/private-pkg/1.0.0');
      assert.equal(res.status, 401);
    });

    it('should 403 for user not in team (GET /:fullname/:version)', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/private-pkg/1.0.0')
        .set('authorization', normalUser.authorization);
      assert.equal(res.status, 403);
    });

    it('should 401 without login (GET /:fullname/-/:file.tgz)', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/private-pkg/-/private-pkg-1.0.0.tgz');
      assert.equal(res.status, 401);
    });

    it('should 403 for user not in team (GET /:fullname/-/:file.tgz)', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/private-pkg/-/private-pkg-1.0.0.tgz')
        .set('authorization', normalUser.authorization);
      assert.equal(res.status, 403);
    });

    it('should pass for admin (GET /:fullname/-/:file.tgz)', async () => {
      const res = await app.httpRequest()
        .get('/@cnpm/private-pkg/-/private-pkg-1.0.0.tgz')
        .set('authorization', adminUser.authorization);
      assert(![ 401, 403 ].includes(res.status), `expected auth to pass, got ${res.status}`);
    });
  });
});
