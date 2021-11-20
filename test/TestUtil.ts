import * as fs from 'fs/promises';
import mysql from 'mysql';
import path from 'path';
import { app } from 'egg-mock/bootstrap';

export class TestUtil {
  static async getMySqlConfig(): Promise<any> {
    // TODO use env
    return {
      host: '127.0.0.1',
      port: 3306,
      password: '',
      user: 'root',
      multipleStatements: true,
      ...app.config.orm,
    };
  }

  static async getTableSqls(): Promise<string> {
    return await fs.readFile(path.join(__dirname, '../sql/init.sql'), 'utf8');
  }

  static async query(conn, sql) {
    return new Promise((resolve, reject) => {
      conn.query(sql, (err, res) => {
        if (err) {
          return reject(err);
        }
        return resolve(res);
      });
    });
  }

  static async createDatabase() {
    // TODO use leoric sync
    const config = await this.getMySqlConfig();
    if (process.env.CI) {
      console.log('[TestUtil] connection to mysql: %j', config);
    }
    const connection = mysql.createConnection(config);
    connection.connect();
    const sqls = await this.getTableSqls();
    // no need to create database on GitHub Action CI env
    if (!process.env.CI) {
      await this.query(connection, `DROP DATABASE IF EXISTS ${config.database};`);
      await this.query(connection, `CREATE DATABASE IF NOT EXISTS ${config.database} CHARACTER SET utf8;`);
    }
    await this.query(connection, `USE ${config.database};`);
    await this.query(connection, sqls);
    connection.destroy();
  }

  static getFixtures(name?: string): string {
    return path.join(__dirname, 'fixtures', name ?? '');
  }

  static async getFullPackage(options?: {
    name?: string;
    version?: string;
    versionObject?: object;
    attachment?: object;
    dist?: object;
    readme?: string | null;
  }): Promise<any> {
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
      }
    }
    return pkg;
  }
}
