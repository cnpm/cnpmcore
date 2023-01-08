const path = require('path');

module.exports = ctxMocha;

/**
 * Monkey patch the mocha instance init ctx for every runner.
 *
 * @param {Function} mocha -
 */
function ctxMocha(mocha) {
  // Avoid loading `ctx register` twice.
  if (!mocha || mocha._ctxScopeLoaded) {
    return;
  }

  const Runnable = mocha.Runnable;
  const run = Runnable.prototype.run;

  Runnable.prototype.run = function (fn) {
    const oldFn = this.fn;

    this.fn = async function () {
      const { app } = require('egg-mock/bootstrap');
      await app.ready();
      await app.mockModuleContextScope(async function () {
        return oldFn.apply(this, arguments);
      });
    };

    // Replace `toString` to output the original function contents.
    this.fn.toString = function () {
      // https://github.com/mochajs/mocha/blob/7493bca76662318183e55294e906a4107433e20e/lib/utils.js#L251
      return Function.prototype.toString.call(oldFn);
    };

    return run.call(this, fn);
  };

  mocha._ctxScopeLoaded = true;
}

/**
 * Find active node mocha instances.
 *
 * @return {Array}
 */
function findNodeJSMocha() {
  const mochaPath = require.resolve('mocha', {
    paths: [
      path.dirname(require.resolve('egg-bin/package.json')),
    ],
  });

  require(mochaPath);

  const children = require.cache || {};

  return Object.keys(children)
    .filter(child => {
      const val = children[child].exports;
      return typeof val === 'function' && val.name === 'Mocha';
    })
    .map(child => {
      return children[child].exports;
    });
}

// Attempt to automatically monkey patch available mocha instances.
const modules = typeof window === 'undefined' ? findNodeJSMocha() : [window.Mocha];

modules.forEach(ctxMocha);
