import { TestUtil } from './TestUtil';

async function main() {
  await TestUtil.createDatabase();
  console.log('prepare database done, tables: %s', await TestUtil.getTableNames());
  TestUtil.destroyConnection();
}
main().catch(console.error);
