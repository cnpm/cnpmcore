import fs from 'fs/promises';
// 统一通过 coffee 执行 child_process，获取运行时的一些环境信息
import coffee from 'coffee';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';
import { Readable } from 'stream';
import mysql from 'mysql';
import path from 'path';
import crypto from 'crypto';
import { cleanUserPrefix, getScopeAndName } from '../app/common/PackageUtil';
import semver from 'semver';
import { PackageJSONType } from '../app/repository/PackageRepository';

type PackageOptions = {
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
};

type UserOptions = {
  name?: string;
  password?: string;
  email?: string;
  tokenOptions?: {
    automation?: boolean;
    readonly?: boolean;
    cidr_whitelist?: string[];
  };
};

export class TestUtil {
  private static connection;
  private static tables;
  private static _app;
  private static ua = 'npm/7.0.0 cnpmcore-unittest/1.0.0';

  static getMySqlConfig() {
    return {
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD,
      multipleStatements: true,
    };
  }

  static getDatabase() {
    return process.env.MYSQL_DATABASE || 'cnpmcore_unittest';
  }

  // 不同的 npm 版本 cli 命令不同
  // 通过 coffee 运行时获取对应版本号
  static async getNpmVersion() {
    const res = await coffee.spawn('npm', [ '-v' ]).end();
    return semver.clean(res.stdout);
  }

  // 获取当前所有 sql 脚本内容
  // 目前统一放置在 ../sql 文件夹中
  // 默认根据版本号排序，确保向后兼容
  static async getTableSqls(): Promise<string> {
    const dirents = await fs.readdir(path.join(__dirname, '../sql'));
    let versions = dirents.filter(t => path.extname(t) === '.sql').map(t => path.basename(t, '.sql'));
    versions = semver.sort(versions);
    const sqls = await Promise.all(versions.map(version => {
      return fs.readFile(path.join(__dirname, '../sql', `${version}.sql`), 'utf8');
    }));
    return sqls.join('\n');
  }

  static async query(sql: string): Promise<any[]> {
    const conn = this.getConnection();
    return new Promise((resolve, reject) => {
      conn.query(sql, (err: Error, rows: any[]) => {
        if (err) {
          return reject(err);
        }
        return resolve(rows);
      });
    });
  }

  static getConnection() {
    if (!this.connection) {
      const config: any = this.getMySqlConfig();
      if (process.env.CI) {
        console.log('[TestUtil] connection to mysql: %j', config);
      }
      this.connection = mysql.createConnection(config);
      this.connection.connect();
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
      const database = this.getDatabase();
      const sql = `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${database}';`;
      const rows = await this.query(sql);
      this.tables = rows.map(row => row.TABLE_NAME);
    }
    return this.tables;
  }

  static async truncateDatabase() {
    const database = this.getDatabase();
    const tables = await this.getTableNames();
    await Promise.all(tables.map((table: string) => this.query(`TRUNCATE TABLE ${database}.${table};`)));
  }

  static get app() {
    if (!this._app) {
      /* eslint @typescript-eslint/no-var-requires: "off" */
      const bootstrap = require('egg-mock/bootstrap');
      this._app = bootstrap.app;
    }
    return this._app;
  }

  static async rm(filepath: string) {
    try {
      await fs.unlink(filepath);
    } catch (e) {
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

  static async readJSONFile(filepath: string) {
    const bytes = await fs.readFile(filepath);
    return JSON.parse(bytes.toString());
  }

  static async getFullPackage(options?: PackageOptions): Promise<PackageJSONType & { versions: PackageJSONType[] }> {
    const fullJSONFile = this.getFixtures('exampleFullPackage.json');
    const pkg = JSON.parse((await fs.readFile(fullJSONFile)).toString());
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
        delete attachs[firstFilename];
      }
      if (options.readme === null) {
        delete pkg.readme;
        delete version.readme;
      } else if (options.readme) {
        version.readme = pkg.readme = options.readme;
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

  static async createPackage(options?: PackageOptions, userOptions?: UserOptions) {
    const pkg = await this.getFullPackage(options);
    const user = await this.createUser(userOptions);
    await this.app.httpRequest()
      .put(`/${pkg.name}`)
      .set('authorization', user.authorization)
      .set('user-agent', user.ua)
      .send(pkg)
      .expect(201);

    if (options?.isPrivate === false) {
      const [ scope, name ] = getScopeAndName(pkg.name);
      const { Package: PackageModel } = require('../app/repository/model/Package');
      await PackageModel.update({ scope, name }, { isPrivate: false, registryId: options?.registryId });
    }
    return { user, pkg };
  }

  static async createUser(user?: UserOptions) {
    if (!user) {
      user = {};
    }
    if (!user.name) {
      user.name = `testuser-${crypto.randomBytes(20).toString('hex')}`;
    }
    const password = user.password ?? 'password-is-here';
    const email = cleanUserPrefix(user.email ?? `${user.name}@example.com`);
    let res = await this.app.httpRequest()
      .put(`/-/user/org.couchdb.user:${user.name}`)
      .send({
        name: user.name,
        password,
        type: 'user',
        email,
      })
      .expect(201);
    let token = res.body.token;
    if (user.tokenOptions) {
      res = await this.app.httpRequest()
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
    const res = await this.app.httpRequest()
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
    await this.app.httpRequest()
      .post('/-/registry')
      .set('authorization', adminUser.authorization)
      .send(
        {
          name: 'custom6',
          host: 'https://r.cnpmjs.org/',
          changeStream: 'https://r.cnpmjs.org/_changes',
          type: 'cnpmcore',
        });
  }

  static async readStreamToLog(urlOrStream) {
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

  static pickKeys(obj, keys) {
    const d: Record<string, any> = [];
    obj.forEach(item => {
      const newItem = {};
      for (const key of keys) {
        newItem[key] = item[key];
      }

      d.push(newItem);
    });
    return d;
  }
}
