import { BlockList, isIP } from 'node:net';

import dayjs from 'dayjs';
import { AccessLevel, Inject, SingletonProto } from 'egg';
import { ForbiddenError, UnauthorizedError } from 'egg/errors';
import { isEmpty } from 'lodash-es';

import { getScopeAndName } from '../../../app/common/PackageUtil.ts';
import { sha512 } from '../../../app/common/UserUtil.ts';
import type { Package as PackageModel } from '../../../app/repository/model/Package.ts';
import type { TokenPackage as TokenPackageModel } from '../../../app/repository/model/TokenPackage.ts';
import type { UserRepository } from '../../../app/repository/UserRepository.ts';
import { ModelConvertor } from '../../../app/repository/util/ModelConvertor.ts';
import { AbstractService } from '../../common/AbstractService.ts';
import { Package as PackageEntity } from '../entity/Package.ts';
import { isGranularToken, type Token } from '../entity/Token.ts';

const BEARER_TOKEN_RE = /^Bearer ([\w.]+?)$/;

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class TokenService extends AbstractService {
  @Inject()
  private readonly TokenPackage: typeof TokenPackageModel;
  @Inject()
  private readonly Package: typeof PackageModel;
  @Inject()
  private readonly userRepository: UserRepository;

  public async listTokenPackages(token: Token) {
    if (isGranularToken(token)) {
      const models = await this.TokenPackage.find({ tokenId: token.tokenId });
      const packages = await this.Package.find({
        packageId: models.map((m) => m.packageId),
      });
      return packages.map((pkg) => ModelConvertor.convertModelToEntity(pkg, PackageEntity));
    }
    return null;
  }

  public async checkTokenStatus(token: Token) {
    // check for expires
    if (isGranularToken(token) && dayjs(token.expiredAt).isBefore(new Date())) {
      throw new UnauthorizedError('Token expired');
    }

    token.lastUsedAt = new Date();
    await this.userRepository.saveToken(token);
  }

  public async checkGranularTokenAccess(token: Token, fullname: string) {
    // check for scope whitelist
    const [scope, name] = getScopeAndName(fullname);
    // check for packages whitelist
    const allowedPackages = await this.listTokenPackages(token);

    // check for scope & packages access
    if (isEmpty(allowedPackages) && isEmpty(token.allowedScopes)) {
      return true;
    }

    const existPkgConfig = allowedPackages?.find((pkg) => pkg.scope === scope && pkg.name === name);
    if (existPkgConfig) {
      return true;
    }

    const existScopeConfig = token.allowedScopes?.find((s) => s === scope);
    if (existScopeConfig) {
      return true;
    }

    throw new ForbiddenError(`can't access package "${fullname}"`);
  }

  /**
   * Return true when the token has no CIDR whitelist, or clientIp matches an entry.
   * Entries may be bare addresses or CIDR prefixes (e.g. 10.0.0.0/8).
   * Uses ctx.ip / client IP so egg proxy / X-Forwarded-For config applies upstream.
   */
  public checkCidrWhitelist(token: Token, clientIp: string): boolean {
    const whitelist = token.cidrWhitelist || [];
    if (whitelist.length === 0) {
      return true;
    }
    if (!clientIp) {
      return false;
    }
    // Normalize IPv4-mapped IPv6 (::ffff:a.b.c.d)
    let ip = clientIp;
    if (ip.startsWith('::ffff:')) {
      ip = ip.slice(7);
    }
    const ipVersion = isIP(ip);
    if (!ipVersion) {
      return false;
    }
    const family = ipVersion === 6 ? 'ipv6' : 'ipv4';
    const blockList = new BlockList();
    for (const entry of whitelist) {
      try {
        if (entry.includes('/')) {
          const [addr, prefixStr] = entry.split('/');
          const addrVersion = isIP(addr);
          if (!addrVersion) continue;
          const entryFamily = addrVersion === 6 ? 'ipv6' : 'ipv4';
          blockList.addSubnet(addr, Number(prefixStr), entryFamily);
        } else {
          const addrVersion = isIP(entry);
          if (!addrVersion) continue;
          blockList.addAddress(entry, addrVersion === 6 ? 'ipv6' : 'ipv4');
        }
      } catch {
        // ignore invalid whitelist entries
      }
    }
    return blockList.check(ip, family);
  }

  async getUserAndToken(authorization: string) {
    if (!authorization) return null;
    const matchs = BEARER_TOKEN_RE.exec(authorization);
    if (!matchs) return null;
    const tokenValue = matchs[1];
    const tokenKey = sha512(tokenValue);
    const authorizedUserAndToken = await this.userRepository.findUserAndTokenByTokenKey(tokenKey);
    return authorizedUserAndToken;
  }
}
