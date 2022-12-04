import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { ImageminBinary } from 'app/common/adapter/binary/ImageminBinary';
import binaries from 'config/binaries';
import { TestUtil } from 'test/TestUtil';

describe('test/common/adapter/binary/ImageminBinary.test.ts', () => {
  let ctx: Context;

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  it('should fetch jpegtran-bin', async () => {
    app.mockHttpclient('https://registry.npmjs.com/jpegtran-bin', 'GET', {
      data: await TestUtil.readFixturesFile('registry.npmjs.com/jpegtran-bin.json'),
    });
    const binary = new ImageminBinary(ctx.httpclient, ctx.logger, binaries['jpegtran-bin'], 'jpegtran-bin');
    let result = await binary.fetch('/');
    assert(result);
    assert(result.items.length > 0);
    let matchDir1 = false;
    let matchDir2 = false;
    for (const item of result.items) {
      if (item.name === 'v4.0.0/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir1 = true;
      }
      if (item.name === 'v6.0.1/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir2 = true;
      }
    }
    assert(matchDir1);
    assert(matchDir2);

    // https://github.com/imagemin/jpegtran-bin/blob/v4.0.0/lib/index.js
    result = await binary.fetch('/v4.0.0/');
    assert(result);
    assert(result.items.length === 1);
    assert(result.items[0].name === 'vendor/');
    assert(result.items[0].isDir === true);

    result = await binary.fetch('/v4.0.0/vendor/');
    assert(result);
    assert(result.items.length === 5);
    assert(result.items[0].name === 'macos/');
    assert(result.items[0].isDir === true);
    assert(result.items[1].name === 'linux/');
    assert(result.items[1].isDir === true);
    assert(result.items[2].name === 'freebsd/');
    assert(result.items[2].isDir === true);
    assert(result.items[3].name === 'sunos/');
    assert(result.items[3].isDir === true);
    assert(result.items[4].name === 'win/');
    assert(result.items[4].isDir === true);

    result = await binary.fetch('/v4.0.0/vendor/win/');
    assert(result);
    assert(result.items.length === 2);
    assert(result.items[0].name === 'x86/');
    assert(result.items[0].isDir === true);
    assert(result.items[1].name === 'x64/');
    assert(result.items[1].isDir === true);

    result = await binary.fetch('/v4.0.0/vendor/win/x86/');
    assert(result);
    // console.log(result.items);
    assert(result.items.length === 2);
    assert(result.items[0].name === 'jpegtran.exe');
    assert(result.items[0].url === 'https://raw.githubusercontent.com/imagemin/jpegtran-bin/v4.0.0/vendor/win/x86/jpegtran.exe');
    assert(result.items[0].isDir === false);
    assert(result.items[1].name === 'libjpeg-62.dll');
    assert(result.items[1].isDir === false);
    assert(result.items[1].url === 'https://raw.githubusercontent.com/imagemin/jpegtran-bin/v4.0.0/vendor/win/x86/libjpeg-62.dll');
  });

  it('should fetch advpng-bin', async () => {
    app.mockHttpclient('https://registry.npmjs.com/advpng-bin', 'GET', {
      data: await TestUtil.readFixturesFile('registry.npmjs.com/advpng-bin.json'),
    });
    const binary = new ImageminBinary(ctx.httpclient, ctx.logger, binaries['advpng-bin'], 'advpng-bin');
    let result = await binary.fetch('/');
    assert(result);
    assert(result.items.length > 0);
    let matchDir1 = false;
    let matchDir2 = false;
    for (const item of result.items) {
      if (item.name === 'v4.0.0/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir1 = true;
      }
      if (item.name === 'v6.0.1/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir2 = true;
      }
    }
    assert(matchDir1);
    assert(matchDir2);

    // https://github.com/imagemin/advpng-bin/blob/v4.0.0/lib/index.js
    result = await binary.fetch('/v4.0.0/');
    assert(result);
    assert(result.items.length === 1);
    assert(result.items[0].name === 'vendor/');
    assert(result.items[0].isDir === true);

    result = await binary.fetch('/v4.0.0/vendor/');
    assert(result);
    assert(result.items.length === 3);
    assert(result.items[0].name === 'osx/');
    assert(result.items[0].isDir === true);
    assert(result.items[1].name === 'linux/');
    assert(result.items[1].isDir === true);
    assert(result.items[2].name === 'win32/');
    assert(result.items[2].isDir === true);

    result = await binary.fetch('/v4.0.0/vendor/osx/');
    assert(result);
    // console.log(result.items);
    assert(result.items.length === 1);
    assert(result.items[0].name === 'advpng');
    assert(result.items[0].url === 'https://raw.githubusercontent.com/imagemin/advpng-bin/v4.0.0/vendor/osx/advpng');
    assert(result.items[0].isDir === false);
  });

  it('should fetch mozjpeg-bin', async () => {
    app.mockHttpclient('https://registry.npmjs.com/mozjpeg', 'GET', {
      data: await TestUtil.readFixturesFile('registry.npmjs.com/mozjpeg.json'),
    });
    const binary = new ImageminBinary(ctx.httpclient, ctx.logger, binaries['mozjpeg-bin'], 'mozjpeg-bin');
    let result = await binary.fetch('/');
    assert(result);
    // console.log(result.items);
    assert(result.items.length > 0);
    let matchDir1 = false;
    let matchDir2 = false;
    for (const item of result.items) {
      if (item.name === 'v4.0.0/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir1 = true;
      }
      if (item.name === 'v6.0.1/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir2 = true;
      }
    }
    assert(matchDir1);
    assert(matchDir2);

    // https://github.com/imagemin/mozjpeg-bin/blob/v4.0.0/lib/index.js
    result = await binary.fetch('/v4.0.0/');
    assert(result);
    assert(result.items.length === 1);
    assert(result.items[0].name === 'vendor/');
    assert(result.items[0].isDir === true);

    result = await binary.fetch('/v4.0.0/vendor/');
    assert(result);
    assert(result.items.length === 4);
    assert(result.items[0].name === 'osx/');
    assert(result.items[0].isDir === true);
    assert(result.items[1].name === 'macos/');
    assert(result.items[1].isDir === true);
    assert(result.items[2].name === 'linux/');
    assert(result.items[2].isDir === true);
    assert(result.items[3].name === 'win/');
    assert(result.items[3].isDir === true);

    result = await binary.fetch('/v4.0.0/vendor/osx/');
    assert(result);
    // console.log(result.items);
    assert(result.items.length === 1);
    assert(result.items[0].name === 'cjpeg');
    assert(result.items[0].url === 'https://raw.githubusercontent.com/imagemin/mozjpeg-bin/v4.0.0/vendor/osx/cjpeg');
    assert(result.items[0].isDir === false);

    result = await binary.fetch('/v8.0.0/vendor/macos/');
    assert(result);
    // console.log(result.items);
    assert(result.items.length === 1);
    assert(result.items[0].name === 'cjpeg');
    assert(result.items[0].url === 'https://raw.githubusercontent.com/imagemin/mozjpeg-bin/v8.0.0/vendor/macos/cjpeg');
    assert(result.items[0].isDir === false);
  });

  it('should fetch gifsicle-bin', async () => {
    app.mockHttpclient('https://registry.npmjs.com/gifsicle', 'GET', {
      data: await TestUtil.readFixturesFile('registry.npmjs.com/gifsicle.json'),
    });
    const binary = new ImageminBinary(ctx.httpclient, ctx.logger, binaries['gifsicle-bin'], 'gifsicle-bin');
    const result = await binary.fetch('/');
    assert(result);
    // console.log(result.items);
    assert(result.items.length > 0);
    let matchDir1 = false;
    let matchDir2 = false;
    for (const item of result.items) {
      if (item.name === 'v4.0.0/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir1 = true;
      }
      if (item.name === 'v6.0.1/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir2 = true;
      }
    }
    assert(matchDir1);
    assert(matchDir2);
  });

  it('should fetch optipng-bin', async () => {
    app.mockHttpclient('https://registry.npmjs.com/optipng-bin', 'GET', {
      data: await TestUtil.readFixturesFile('registry.npmjs.com/optipng-bin.json'),
    });
    const binary = new ImageminBinary(ctx.httpclient, ctx.logger, binaries['optipng-bin'], 'optipng-bin');
    const result = await binary.fetch('/');
    assert(result);
    // console.log(result.items);
    assert(result.items.length > 0);
    let matchDir1 = false;
    let matchDir2 = false;
    for (const item of result.items) {
      if (item.name === 'v4.0.0/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir1 = true;
      }
      if (item.name === 'v6.0.0/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir2 = true;
      }
    }
    assert(matchDir1);
    assert(matchDir2);
  });

  it('should fetch zopflipng-bin', async () => {
    app.mockHttpclient('https://registry.npmjs.com/zopflipng-bin', 'GET', {
      data: await TestUtil.readFixturesFile('registry.npmjs.com/zopflipng-bin.json'),
    });
    const binary = new ImageminBinary(ctx.httpclient, ctx.logger, binaries['zopflipng-bin'], 'zopflipng-bin');
    const result = await binary.fetch('/');
    assert(result);
    // console.log(result.items);
    assert(result.items.length > 0);
    let matchDir1 = false;
    let matchDir2 = false;
    for (const item of result.items) {
      if (item.name === 'v4.0.0/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir1 = true;
      }
      if (item.name === 'v6.0.1/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir2 = true;
      }
    }
    assert(matchDir1);
    assert(matchDir2);
  });

  it('should fetch jpegoptim-bin', async () => {
    app.mockHttpclient('https://registry.npmjs.com/jpegoptim-bin', 'GET', {
      data: await TestUtil.readFixturesFile('registry.npmjs.com/jpegoptim-bin.json'),
    });
    const binary = new ImageminBinary(ctx.httpclient, ctx.logger, binaries['jpegoptim-bin'], 'jpegoptim-bin');
    const result = await binary.fetch('/');
    assert(result);
    // console.log(result.items);
    assert(result.items.length > 0);
    let matchDir1 = false;
    let matchDir2 = false;
    for (const item of result.items) {
      if (item.name === 'v4.0.0/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir1 = true;
      }
      if (item.name === 'v6.0.1/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir2 = true;
      }
    }
    assert(matchDir1);
    assert(matchDir2);
  });

  it('should fetch guetzli-bin', async () => {
    app.mockHttpclient('https://registry.npmjs.com/guetzli', 'GET', {
      data: await TestUtil.readFixturesFile('registry.npmjs.com/guetzli.json'),
    });
    const binary = new ImageminBinary(ctx.httpclient, ctx.logger, binaries['guetzli-bin'], 'guetzli-bin');
    const result = await binary.fetch('/');
    assert(result);
    // console.log(result.items);
    assert(result.items.length > 0);
    let matchDir1 = false;
    let matchDir2 = false;
    for (const item of result.items) {
      if (item.name === 'v4.0.0/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir1 = true;
      }
      if (item.name === 'v4.0.2/') {
        assert(item.date);
        assert(item.isDir === true);
        assert(item.size === '-');
        matchDir2 = true;
      }
    }
    assert(matchDir1);
    assert(matchDir2);
  });
});
