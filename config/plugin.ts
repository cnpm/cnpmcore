import type { EggPlugin } from 'egg';

import '@eggjs/tracer';

const plugin: EggPlugin = {
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
    package: '@eggjs/typebox-validate',
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
