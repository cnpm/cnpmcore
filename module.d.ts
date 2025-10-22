import type { ContextCnpmcore } from './app/core/typing';

declare module 'egg' {
  export interface EggContextModule {
    cnpmcoreCore: ContextCnpmcore;
  }
}

// tmp fix types
import "egg";
import "@eggjs/tegg-config";
import "@eggjs/tegg-controller-plugin";
import "@eggjs/tegg-schedule-plugin";
import "@eggjs/tegg-eventbus-plugin";
import "@eggjs/tegg-aop-plugin";
import "@eggjs/tegg-background-task";
import "@eggjs/tegg-plugin";
import "@eggjs/tegg-orm-plugin";
import "@eggjs/tracer";
