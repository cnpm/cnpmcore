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
  teggOrm: {
    enable: true,
    package: '@eggjs/tegg-orm-plugin',
  },
  eventbusModule: {
    enable: true,
    package: '@eggjs/tegg-eventbus-plugin',
  },
  view: {
    enable: false,
  },
  opentracing: {
    enable: true,
    package: 'egg-opentracing',
  },
  typeboxValidate: {
    enable: true,
    package: 'egg-typebox-validate',
  },
};

export default plugin;
