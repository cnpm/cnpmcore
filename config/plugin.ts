import type { EggPlugin } from 'egg';

import tracer from '@eggjs/tracer';

const plugin: EggPlugin = {
  view: {
    enable: true,
  },
  nunjucks: {
    enable: true,
    package: 'egg-view-nunjucks',
  },
  ...tracer,
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
