import path from 'path';
import { readFile } from 'fs/promises';
import { Application, Context } from 'egg';
import {
  HttpClient as RawHttpClient,
  RequestURL as HttpClientRequestURL,
  RequestOptions,
} from 'urllib';
import ms from 'ms';
import { ChangesStreamService } from './app/core/service/ChangesStreamService';

declare module 'egg' {
  interface Application {
    binaryHTML: string;
  }
}

interface HttpClientRequestOptions extends RequestOptions {
  ctx?: Context;
  tracer?: unknown;
}

const SSRF_HTTPCLIENT = Symbol('SSRF_HTTPCLIENT');

class HttpClient extends RawHttpClient {
  readonly #app: Application & { tracer?: unknown };

  constructor(app: Application, options?: any) {
    normalizeConfig(app);
    options = {
      ...app.config.httpclient,
      ...options,
    };
    super({
      app,
      defaultArgs: options.request,
      allowH2: options.allowH2,
      // use on egg-security ssrf
      // https://github.com/eggjs/egg-security/blob/master/lib/extend/safe_curl.js#L11
      checkAddress: options.checkAddress,
    } as any);
    this.#app = app;
  }

  async request<T = any>(url: HttpClientRequestURL, options?: HttpClientRequestOptions) {
    options = options ?? {};
    if (options.ctx?.tracer) {
      options.tracer = options.ctx.tracer;
    } else {
      options.tracer = options.tracer ?? this.#app.tracer;
    }
    return await super.request<T>(url, options);
  }

  async curl<T = any>(url: HttpClientRequestURL, options?: HttpClientRequestOptions) {
    return await this.request<T>(url, options);
  }

  async safeCurl<T = any>(url: HttpClientRequestURL, options: any = {}) {
    if (!this[SSRF_HTTPCLIENT]) {
      const ssrfConfig = this.#app.config.security.ssrf;
      if (ssrfConfig?.checkAddress) {
        options.checkAddress = ssrfConfig.checkAddress;
      } else {
        this.#app.logger.warn('[egg-security] please configure `config.security.ssrf` first');
      }
      this[SSRF_HTTPCLIENT] = new HttpClient(this.#app, {
        checkAddress: ssrfConfig.checkAddress,
      });
    }
    return await this[SSRF_HTTPCLIENT].request<T>(url, options);
  }
}

function normalizeConfig(app: Application) {
  const config = app.config.httpclient;
  if (typeof config.request?.timeout === 'string') {
    config.request.timeout = ms(config.request.timeout as string);
  }
}

export default class CnpmcoreAppHook {
  private readonly app: Application;

  constructor(app: Application) {
    this.app = app;
    this.app.binaryHTML = '';
    Reflect.set(app, 'HttpClient', HttpClient);
    Reflect.set(app, 'HttpClientNext', HttpClient);
  }

  async configWillLoad() {
    const app = this.app;
    // https://github.com/eggjs/tegg/blob/master/plugin/orm/app.ts#L37
    // store query sql to log
    app.config.orm.logger = {
      ...app.config.orm.logger,
      logQuery(sql: string, duration: number) {
        app.getLogger('sqlLogger').info('[%s] %s', duration, sql);
      },
    };
  }

  // https://eggjs.org/zh-cn/basics/app-start.html
  async didReady() {
    // ready binary.html and replace registry
    const filepath = path.join(this.app.baseDir, 'app/port/binary.html');
    const text = await readFile(filepath, 'utf-8');
    this.app.binaryHTML = text.replace('{{registry}}', this.app.config.cnpmcore.registry);
  }

  // 应用退出时执行
  // 需要暂停当前执行的 changesStream task
  async beforeClose() {
    const changesStreamService = await this.app.getEggObject(ChangesStreamService);
    await changesStreamService.suspendSync(true);
  }
}
