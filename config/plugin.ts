import { EggPlugin } from 'egg';
import tracerPlugin from '@eggjs/tracer';

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
    package: '@eggjs/controller-plugin',
  },
  teggSchedule: {
    enable: true,
    package: '@eggjs/schedule-plugin',
  },
  teggOrm: {
    enable: true,
    package: '@eggjs/orm-plugin',
  },
  teggEventbus: {
    enable: true,
    package: '@eggjs/eventbus-plugin',
  },
  teggAop: {
    enable: true,
    package: '@eggjs/aop-plugin',
  },
  view: {
    enable: true,
  },
  nunjucks: {
    enable: true,
    package: '@eggjs/view-nunjucks',
  },
  ...tracerPlugin(),
  typeboxValidate: {
    enable: true,
    package: '@eggjs/typebox-validate',
  },
  redis: {
    enable: true,
    package: '@eggjs/redis',
  },
  cors: {
    enable: true,
    package: '@eggjs/cors',
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
