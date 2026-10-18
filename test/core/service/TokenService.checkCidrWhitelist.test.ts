import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { Token, TokenType } from '../../../app/core/entity/Token.ts';
import { TokenService } from '../../../app/core/service/TokenService.ts';

describe('test/core/service/TokenService.checkCidrWhitelist.test.ts', () => {
  let tokenService: TokenService;
  const createToken = (cidrWhitelist: string[]) =>
    Token.create({
      tokenMark: 'mock',
      tokenKey: 'mock-key',
      userId: 'mock-user',
      isReadonly: false,
      type: TokenType.classic,
      cidrWhitelist,
    });

  beforeEach(async () => {
    tokenService = await app.getEggObject(TokenService);
  });

  it('should allow any ip when whitelist is empty', () => {
    assert.equal(tokenService.checkCidrWhitelist(createToken([]), '8.8.8.8'), true);
    assert.equal(tokenService.checkCidrWhitelist(createToken([]), ''), true);
  });

  it('should match ipv4 subnets and addresses', () => {
    const token = createToken(['10.0.0.0/8', '192.168.1.5']);
    assert.equal(tokenService.checkCidrWhitelist(token, '10.1.2.3'), true);
    assert.equal(tokenService.checkCidrWhitelist(token, '192.168.1.5'), true);
    assert.equal(tokenService.checkCidrWhitelist(token, '192.168.1.6'), false);
    // ipv4-mapped ipv6 client address, dotted and hex notation
    assert.equal(tokenService.checkCidrWhitelist(token, '::ffff:10.9.9.9'), true);
    assert.equal(tokenService.checkCidrWhitelist(createToken(['192.0.2.0/24']), '::ffff:c000:201'), true);
    assert.equal(tokenService.checkCidrWhitelist(createToken(['192.0.2.0/24']), '::ffff:c000:301'), false);
  });

  it('should match ipv6 subnets', () => {
    const token = createToken(['2001:db8::/32']);
    assert.equal(tokenService.checkCidrWhitelist(token, '2001:db8::1'), true);
    assert.equal(tokenService.checkCidrWhitelist(token, '2001:db9::1'), false);
  });

  it('should not let ipv6 entries match ipv4 clients (and vice versa)', () => {
    for (const entry of ['::/0', '::/64', '::ffff:0:0/96']) {
      const token = createToken([entry]);
      assert.equal(tokenService.checkCidrWhitelist(token, '8.8.8.8'), false, entry);
      assert.equal(tokenService.checkCidrWhitelist(token, '::ffff:8.8.8.8'), false, entry);
      assert.equal(tokenService.checkCidrWhitelist(token, '::ffff:808:808'), false, entry);
    }
    assert.equal(tokenService.checkCidrWhitelist(createToken(['::/0']), '2001:db8::1'), true);
    assert.equal(tokenService.checkCidrWhitelist(createToken(['0.0.0.0/0']), '2001:db8::1'), false);
    assert.equal(tokenService.checkCidrWhitelist(createToken(['0.0.0.0/0']), '::1'), false);
    assert.equal(tokenService.checkCidrWhitelist(createToken(['::1']), '::1'), true);
  });

  it('should fail closed for missing/invalid client ip and ignore invalid entries', () => {
    const token = createToken(['not-an-ip', '10.0.0.0/abc', 'bad/8', '10.0.0.0/8']);
    assert.equal(tokenService.checkCidrWhitelist(token, ''), false);
    assert.equal(tokenService.checkCidrWhitelist(token, 'garbage'), false);
    assert.equal(tokenService.checkCidrWhitelist(token, '10.0.0.1'), true);
    assert.equal(tokenService.checkCidrWhitelist(createToken(['not-an-ip']), '10.0.0.1'), false);
    // malformed prefixes must not fail open as /0
    for (const entry of ['10.0.0.0/', '10.0.0.0/33', '10.0.0.0/-1', '10.0.0.0/8/8', '10.0.0.0/ 8', '::/129']) {
      assert.equal(tokenService.checkCidrWhitelist(createToken([entry]), '8.8.8.8'), false, entry);
    }
  });
});
