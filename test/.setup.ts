import { TestUtil } from './TestUtil';

before(async () => {
  await TestUtil.createDatabase();
  console.log('create table done!!!');
});
