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

const CIDR_PREFIX_RE = /^\d{1,3}$/;
const IPV4_MAPPED_IPV6 = new BlockList();
IPV4_MAPPED_IPV6.addSubnet('::ffff:0:0', 96, 'ipv6');

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
    const ipVersion = isIP(clientIp);
    if (!ipVersion) {
      return false;
    }
    // Keep families apart: BlockList maps IPv4 into IPv6 when checking, so a broad IPv6 rule
    // (e.g. ::/0) would otherwise accept every IPv4 client. IPv4 and IPv4-mapped IPv6 clients
    // (any notation) are matched against IPv4 entries only, native IPv6 clients against IPv6 entries.
    const ipv4List = new BlockList();
    const ipv6List = new BlockList();
    for (const entry of whitelist) {
      const [addr, prefix, ...rest] = entry.split('/');
      const addrVersion = isIP(addr);
      if (!addrVersion || rest.length > 0) continue;
      const list = addrVersion === 6 ? ipv6List : ipv4List;
      const entryFamily = addrVersion === 6 ? 'ipv6' : 'ipv4';
      if (prefix === undefined) {
        list.addAddress(addr, entryFamily);
        continue;
      }
      // reject empty / non-numeric / out-of-range prefixes instead of treating them as /0
      const maxPrefix = addrVersion === 6 ? 128 : 32;
      if (!CIDR_PREFIX_RE.test(prefix) || Number(prefix) > maxPrefix) continue;
      list.addSubnet(addr, Number(prefix), entryFamily);
    }
    if (ipVersion === 4) {
      return ipv4List.check(clientIp, 'ipv4');
    }
    if (IPV4_MAPPED_IPV6.check(clientIp, 'ipv6')) {
      return ipv4List.check(clientIp, 'ipv6');
    }
    return ipv6List.check(clientIp, 'ipv6');
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
