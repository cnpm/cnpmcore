import * as fs from 'fs/promises';
import { setTimeout as sleep } from 'timers/promises';
import mysql from 'mysql';
import path from 'path';
import { JsonObject } from 'type-fest';

export class TestUtil {
  static async getMySqlConfig(): Promise<object> {
    // TODO use env
    return {
      host: '127.0.0.1',
      port: 3306,
      password: '',
      user: 'root',
      multipleStatements: true,
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
    const connection = mysql.createConnection(config);
    connection.connect();
    const sqls = await this.getTableSqls();
    // no need to create database on GitHub Action CI env
    if (!process.env.CI) {
      await this.query(connection, 'DROP DATABASE IF EXISTS cnpmcore;');
      await this.query(connection, 'CREATE DATABASE IF NOT EXISTS cnpmcore CHARACTER SET utf8;');
    }
    await this.query(connection, 'USE cnpmcore;');
    await this.query(connection, sqls);
    connection.destroy();
  }

  static getFixtures(name?: string): string {
    return path.join(__dirname, 'fixtures', name ?? '');
  }

  static async getFullPackage(options?: {
    name?: string;
    version?: string;
    attachment?: object;
    dist?: object;
  }): Promise<JsonObject> {
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
    }
    return pkg;
  }
}
