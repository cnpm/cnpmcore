import tracerPlugin from '@eggjs/tracer';
import type { EggPlugin } from 'egg';

const plugin: EggPlugin = {
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
    package: '@eggjs/status',
  },
  elasticsearch: {
    enable: true,
    package: 'eggjs-elasticsearch',
  },
};

export default plugin;
