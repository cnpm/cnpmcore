import tracerPlugin from '@eggjs/tracer';
import type { EggPlugin } from 'egg';

const plugin: EggPlugin = {
  view: {
    enable: true,
  },
  nunjucks: {
    enable: true,
    package: 'egg-view-nunjucks',
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
