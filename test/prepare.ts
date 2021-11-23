import { TestUtil } from './TestUtil';

async function main() {
  await TestUtil.createDatabase();
  console.log('prepare database done.');
}
main();
