export enum DATABASE_TYPE {
  MySQL = 'MySQL',
  PostgreSQL = 'PostgreSQL',
  SQLite = 'SQLite',
}

const dbType = process.env.CNPMCORE_DATABASE_TYPE ?? DATABASE_TYPE.MySQL;
let dbName = process.env.CNPMCORE_DATABASE_NAME;
let dbHost = process.env.CNPMCORE_DATABASE_HOST;
let dbPort = process.env.CNPMCORE_DATABASE_PORT;
let dbUser = process.env.CNPMCORE_DATABASE_USER;
let dbPassword = process.env.CNPMCORE_DATABASE_PASSWORD;
let dialect = 'mysql';
let dbClient = 'mysql2';
if (dbType === DATABASE_TYPE.MySQL) {
  // Compatible mysql configurations
  dbName = dbName ?? process.env.CNPMCORE_MYSQL_DATABASE ?? process.env.MYSQL_DATABASE;
  dbHost = dbHost ?? process.env.CNPMCORE_MYSQL_HOST ?? process.env.MYSQL_HOST ?? '127.0.0.1';
  dbPort = dbPort ?? process.env.CNPMCORE_MYSQL_PORT ?? process.env.MYSQL_PORT ?? '3306';
  dbUser = dbUser ?? process.env.CNPMCORE_MYSQL_USER ?? process.env.MYSQL_USER ?? 'root';
  dbPassword = dbPassword ?? process.env.CNPMCORE_MYSQL_PASSWORD ?? process.env.MYSQL_PASSWORD;
} else if (dbType === DATABASE_TYPE.PostgreSQL) {
  dbClient = 'pg';
  dialect = 'postgres';
  dbHost = dbHost ?? process.env.CNPMCORE_POSTGRES_HOST ?? process.env.POSTGRES_HOST;
  dbPort = dbPort ?? process.env.CNPMCORE_POSTGRES_PORT ?? process.env.POSTGRES_PORT ?? '5432';
  dbUser = dbUser ?? process.env.CNPMCORE_POSTGRES_USER ?? process.env.POSTGRES_USER;
  dbPassword = dbPassword ?? process.env.CNPMCORE_POSTGRES_PASSWORD ?? process.env.POSTGRES_PASSWORD;
} else if (dbType === DATABASE_TYPE.SQLite) {
  // TODO
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
