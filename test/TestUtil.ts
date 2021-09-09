import { promises as fs } from 'fs';
import mysql from 'mysql';
import path from 'path';

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
    await this.query(connection, 'DROP DATABASE IF EXISTS cnpmcore;');
    await this.query(connection, 'CREATE DATABASE IF NOT EXISTS cnpmcore;');
    await this.query(connection, 'USE cnpmcore;');
    await this.query(connection, sqls);
    connection.destroy();
  }
}
