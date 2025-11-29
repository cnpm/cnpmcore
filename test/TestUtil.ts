// oxlint-disable typescript-eslint/no-explicit-any
import fs from 'node:fs/promises';
// 统一通过 coffee 执行 child_process，获取运行时的一些环境信息
import coffee from 'coffee';
import { tmpdir } from 'node:os';
import { mkdtempSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Readable } from 'node:stream';
import mysql from 'mysql2/promise';
import { Client } from 'pg';
import path from 'node:path';
import crypto from 'node:crypto';
import semver from 'semver';
import { app as globalApp } from '@eggjs/mock/bootstrap';

import { cleanUserPrefix, getScopeAndName } from '../app/common/PackageUtil.ts';
import type { PackageJSONType } from '../app/repository/PackageRepository.ts';
import { DATABASE_TYPE, database } from '../config/database.ts';
import { Package as PackageModel } from '../app/repository/model/Package.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PackageOptions {
  name?: string;
  version?: string;
  versionObject?: object;
  attachment?: object;
  dist?: object;
  config?: object;
  readme?: string | null;
  distTags?: object | null;
  isPrivate?: boolean;
  libc?: string[];
  description?: string;
  registryId?: string;
  main?: string;
}

interface UserOptions {
  name?: string;
  password?: string;
  email?: string;
  tokenOptions?: {
    automation?: boolean;
    readonly?: boolean;
    cidr_whitelist?: string[];
  };
}

export interface TestUser {
  name: string;
  displayName: string;
  password: string;
  email: string;
  token: string;
  authorization: string;
  ua: string;
}

export class TestUtil {
  private static connection: any;
  private static tables: any;
  private static _app: any;
  private static ua = 'npm/7.0.0 cnpmcore-unittest/1.0.0';

  static getDatabaseConfig() {
    return {
      ...database,
      database: database.name ?? 'cnpmcore_unittest',
      multipleStatements: true,
    };
  }

  // 不同的 npm 版本 cli 命令不同
  // 通过 coffee 运行时获取对应版本号
  static async getNpmVersion() {
    const res = await coffee.spawn('npm', ['-v']).end();
    return semver.clean(res.stdout);
  }

  static async query(sql: string): Promise<any[]> {
    const conn = await this.getConnection();
    try {
      const result = await conn.query(sql);
      if (result.rows) {
        // pg: { rows }
        return result.rows;
      }
      // mysql: [ RowDataPacket[], others ]
      return result[0];
    } catch (err) {
      // oxlint-disable-next-line no-console
      console.error('[TestUtil] query %o error: %s', sql, err);
      throw err;
    }
  }

  static async getConnection() {
    if (!this.connection) {
      const config = this.getDatabaseConfig();
      if (process.env.CI) {
        // oxlint-disable-next-line no-console
        console.log('[TestUtil] connection to database: %j', config);
      }
      if (config.type === DATABASE_TYPE.MySQL) {
        this.connection = await mysql.createConnection(config as any);
      } else if (config.type === DATABASE_TYPE.PostgreSQL) {
        this.connection = new Client(config as any);
      }
      await this.connection.connect();
    }
    return this.connection;
  }

  static destroyConnection() {
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
  }

  static async getTableNames() {
    if (!this.tables) {
      const config = this.getDatabaseConfig();
      if (config.type === DATABASE_TYPE.MySQL) {
        const sql = `
          SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${config.database}';`;
        // [
        //     { TABLE_NAME: 'binaries' },
        //     { TABLE_NAME: 'changes' },
        //     { TABLE_NAME: 'dists' },
        //     { TABLE_NAME: 'history_tasks' },
        //     { TABLE_NAME: 'hooks' },
        // ...
        //     { TABLE_NAME: 'token_packages' },
        //     { TABLE_NAME: 'tokens' },
        //     { TABLE_NAME: 'total' },
        //     { TABLE_NAME: 'users' },
        //     { TABLE_NAME: 'webauthn_credentials' }
        // ]
        const rows: { TABLE_NAME: string }[] = await this.query(sql);
        this.tables = rows.map(row => row.TABLE_NAME);
      } else if (config.type === DATABASE_TYPE.PostgreSQL) {
        const sql =
          "SELECT * FROM pg_catalog.pg_tables where schemaname = 'public';";
        const rows: { tablename: string }[] = await this.query(sql);
        this.tables = rows.map(row => row.tablename);
      }
    }
    return this.tables;
  }

  static async truncateDatabase() {
    const tables = await this.getTableNames();
    await Promise.all(
      tables.map(async (table: string) => {
        await this.query(`TRUNCATE TABLE ${table};`);
      })
    );
  }

  static get app() {
    if (!this._app) {
      this._app = globalApp;
    }
    return this._app;
  }

  static allowPublicRegistration() {
    this.app.config.cnpmcore.allowPublicRegistration = true;
  }

  static async rm(filepath: string) {
    try {
      await fs.unlink(filepath);
    } catch {
      // ignore
    }
  }

  static mkdtemp() {
    return mkdtempSync(path.join(tmpdir(), 'cnpmcore-unittest-'));
  }

  static getFixtures(name?: string): string {
    return path.join(__dirname, 'fixtures', name ?? '');
  }

  static async readFixturesFile(name?: string): Promise<Buffer> {
    return await fs.readFile(this.getFixtures(name));
  }

  static readFixturesFileSync(name?: string): Buffer {
    return readFileSync(this.getFixtures(name));
  }

  static async readFixturesJSONFile(name?: string) {
    return TestUtil.readJSONFile(this.getFixtures(name));
  }

  static async readJSONFile(filepath: string) {
    const bytes = await fs.readFile(filepath);
    return JSON.parse(bytes.toString());
  }

  static async getFullPackage(
    options?: PackageOptions
  ): Promise<PackageJSONType & { versions: Record<string, PackageJSONType> }> {
    const pkg = await this.readFixturesJSONFile('exampleFullPackage.json');
    if (options) {
      const attachs = pkg._attachments || {};
      const firstFilename = Object.keys(attachs)[0];
      const attach = attachs[firstFilename];
      const versions = pkg.versions || {};
      const firstVersion = Object.keys(versions)[0];
      const version = versions[firstVersion];
      let updateAttach = false;
      if (options.name) {
        pkg.name = options.name;
        version.name = options.name;
        updateAttach = true;
      }
      if (options.version) {
        version.version = options.version;
        updateAttach = true;
      }
      if (options.libc) {
        version.libc = options.libc;
      }
      if (options.versionObject) {
        Object.assign(version, options.versionObject);
      }
      if (options.attachment) {
        Object.assign(attach, options.attachment);
      }
      if (options.dist) {
        Object.assign(version.dist, options.dist);
      }
      if (updateAttach) {
        attachs[`${version.name}-${version.version}.tgz`] = attach;
        // eslint-disable-next-line typescript-eslint/no-dynamic-delete
        delete attachs[firstFilename];
      }
      if (options.readme === null) {
        delete pkg.readme;
        delete version.readme;
      } else if (options.readme) {
        pkg.readme = options.readme;
        version.readme = options.readme;
      }
      if (options.description) {
        version.description = options.description;
      }
      if ('distTags' in options) {
        pkg['dist-tags'] = options.distTags;
      } else {
        pkg['dist-tags'].latest = version.version;
      }
      if ('main' in options) {
        version.main = options.main;
      }
    }
    return pkg;
  }

  static async createPackage(
    options?: PackageOptions,
    userOptions?: UserOptions
  ) {
    const pkg = await this.getFullPackage(options);
    const user = await this.createUser(userOptions);
    const res = await this.app
      .httpRequest()
      .put(`/${pkg.name}`)
      .set('authorization', user.authorization)
      .set('user-agent', user.ua)
      .send(pkg);
    if (res.status !== 201) {
      throw new Error(`Failed to create package: ${JSON.stringify(res.body)}`);
    }

    if (options?.isPrivate === false) {
      const [scope, name] = getScopeAndName(pkg.name);
      await PackageModel.update(
        { scope, name },
        { isPrivate: false, registryId: options?.registryId }
      );
    }
    return { user, pkg };
  }

  static async createUser(user?: UserOptions): Promise<TestUser> {
    if (!user) {
      user = {};
    }
    if (!user.name) {
      user.name = `testuser-${crypto.randomBytes(20).toString('hex')}`;
    }
    const password = user.password ?? 'password-is-here';
    const email = cleanUserPrefix(user.email ?? `${user.name}@example.com`);
    let res = await this.app
      .httpRequest()
      .put(`/-/user/org.couchdb.user:${user.name}`)
      .send({
        name: user.name,
        password,
        type: 'user',
        email,
      })
      .expect(201);
    let token: string = res.body.token;
    if (user.tokenOptions) {
      res = await this.app
        .httpRequest()
        .post('/-/npm/v1/tokens')
        .set('authorization', `Bearer ${token}`)
        .send({
          password,
          ...user.tokenOptions,
        })
        .expect(200);
      token = res.body.token;
    }
    return {
      name: user.name,
      displayName: cleanUserPrefix(user.name),
      token,
      authorization: `Bearer ${token}`,
      password,
      email,
      ua: this.ua,
    };
  }

  static async createTokenByUser(user: {
    password: string;
    token: string;
    readonly?: true;
    automation?: true;
    cidr_whitelist?: string[];
  }) {
    const res = await this.app
      .httpRequest()
      .post('/-/npm/v1/tokens')
      .set('authorization', `Bearer ${user.token}`)
      .set('user-agent', this.ua)
      .send(user)
      .expect(200);
    const token = res.body.token;
    return {
      token,
      authorization: `Bearer ${token}`,
    };
  }

  static async createAdmin() {
    const adminName = Object.keys(this.app.config.cnpmcore.admins)[0];
    return await this.createUser({
      name: adminName,
    });
  }

  static async createRegistryAndScope() {
    // create success
    const adminUser = await this.createAdmin();
    await this.app
      .httpRequest()
      .post('/-/registry')
      .set('authorization', adminUser.authorization)
      .send({
        name: 'custom6',
        host: 'https://r.cnpmjs.org/',
        changeStream: 'https://r.cnpmjs.org/_changes',
        type: 'cnpmcore',
      });
  }

  static async readStreamToLog(urlOrStream: any) {
    let stream: Readable;
    if (typeof urlOrStream === 'string') {
      const { res } = await this.app.curl(urlOrStream, { streaming: true });
      stream = res;
    } else {
      stream = urlOrStream;
    }
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString();
  }

  static pickKeys(obj: any[], keys: any) {
    const d: Record<string, any>[] = [];
    for (const item of obj) {
      const newItem: Record<string, any> = {};
      for (const key of keys) {
        newItem[key] = item[key];
      }

      d.push(newItem);
    }
    return d;
  }
}
