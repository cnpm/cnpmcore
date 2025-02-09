import { EggPlugin } from 'egg';

const plugin: EggPlugin = {
  tegg: {
    enable: true,
    package: '@eggjs/tegg-plugin',
  },
  teggConfig: {
    enable: true,
    package: '@eggjs/tegg-config',
  },
  teggController: {
    enable: true,
    package: '@eggjs/tegg-controller-plugin',
  },
  teggSchedule: {
    enable: true,
    package: '@eggjs/tegg-schedule-plugin',
  },
  teggOrm: {
    enable: true,
    package: '@eggjs/tegg-orm-plugin',
  },
  eventbusModule: {
    enable: true,
    package: '@eggjs/tegg-eventbus-plugin',
  },
  aopModule: {
    enable: true,
    package: '@eggjs/tegg-aop-plugin',
  },
  view: {
    enable: true,
  },
  nunjucks: {
    enable: true,
    package: 'egg-view-nunjucks',
  },
  tracer: {
    enable: true,
    package: '@eggjs/tracer',
  },
  typeboxValidate: {
    enable: true,
    package: 'egg-typebox-validate-fengmk2',
  },
  redis: {
    enable: true,
    package: '@eggjs/redis',
  },
  cors: {
    enable: true,
    package: 'egg-cors',
  },
  status: {
    enable: true,
    package: 'egg-status',
  },
  elasticsearch: {
    enable: true,
    package: 'eggjs-elasticsearch',
  },
};

export default plugin;
