import { env } from '../app/common/EnvUtil';

export enum DATABASE_TYPE {
  MySQL = 'MySQL',
  PostgreSQL = 'PostgreSQL',
  SQLite = 'SQLite',
}

const dbType = env('CNPMCORE_DATABASE_TYPE', 'string', DATABASE_TYPE.MySQL);
let dbName = env('CNPMCORE_DATABASE_NAME', 'string', '');
let dbHost = env('CNPMCORE_DATABASE_HOST', 'string', '');
let dbPort = env('CNPMCORE_DATABASE_PORT', 'number', 0);
let dbUser = env('CNPMCORE_DATABASE_USER', 'string', '');
let dbPassword = env('CNPMCORE_DATABASE_PASSWORD', 'string', '');
let dialect = 'mysql';
let dbClient = 'mysql2';
if (dbType === DATABASE_TYPE.MySQL) {
  // Compatible mysql configurations
  dbName = dbName || env('CNPMCORE_MYSQL_DATABASE', 'string', '') || env('MYSQL_DATABASE', 'string', '') || '';
  dbHost = dbHost || env('CNPMCORE_MYSQL_HOST', 'string', '') || env('MYSQL_HOST', 'string', '') || '127.0.0.1';
  dbPort = dbPort || env('CNPMCORE_MYSQL_PORT', 'number', 0) || env('MYSQL_PORT', 'number', 0) || 3306;
  dbUser = dbUser || env('CNPMCORE_MYSQL_USER', 'string', '') || env('MYSQL_USER', 'string', '') || 'root';
  dbPassword = dbPassword || env('CNPMCORE_MYSQL_PASSWORD', 'string', '') || env('MYSQL_PASSWORD', 'string', '');
} else if (dbType === DATABASE_TYPE.PostgreSQL) {
  dbClient = 'pg';
  dialect = 'postgres';
  dbHost = dbHost || env('CNPMCORE_POSTGRES_HOST', 'string', '') || env('POSTGRES_HOST', 'string', '') || '127.0.0.1';
  dbPort = dbPort || env('CNPMCORE_POSTGRES_PORT', 'number', 0) || env('POSTGRES_PORT', 'number', 0) || 5432;
  dbUser = dbUser || env('CNPMCORE_POSTGRES_USER', 'string', '') || env('POSTGRES_USER', 'string', '') || 'postgres';
  dbPassword = dbPassword || env('CNPMCORE_POSTGRES_PASSWORD', 'string', '') || env('POSTGRES_PASSWORD', 'string', '') || 'postgres';
} else if (dbType === DATABASE_TYPE.SQLite) {
  // TODO: Implement SQLite
  dbClient = 'sqlite';
  dialect = 'sqlite';
}

export const database = {
  type: dbType,
  dialect,
  client: dbClient,
  name: dbName,
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
};
