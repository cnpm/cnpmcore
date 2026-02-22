import path from 'node:path';
import util from 'node:util';

import { SingletonProto } from 'egg';

import { BinaryType } from '../../enum/Binary.ts';
import { AbstractBinary, BinaryAdapter, type BinaryItem, type FetchResult } from './AbstractBinary.ts';

const PACKAGE_URL = 'https://registry.npmjs.com/playwright-core';
const DOWNLOAD_HOST = 'https://playwright.azureedge.net/';
// https://github.com/playwright-community/playwright-go/blob/56e30d60f8b42785982469eaca6ad969bc2e1946/run.go#L341-L374
const PLAYWRIGHT_DRIVER_ARCHS = ['win32_x64', 'mac-arm64', 'mac', 'linux-arm64', 'linux'];

// https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/registry/index.ts
/* eslint-disable quote-props */
const DOWNLOAD_PATHS = {
  chromium: {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/chromium/%s/chromium-linux.zip',
    'ubuntu22.04-x64': 'builds/chromium/%s/chromium-linux.zip',
    'ubuntu24.04-x64': 'builds/chromium/%s/chromium-linux.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/chromium/%s/chromium-linux-arm64.zip',
    'ubuntu22.04-arm64': 'builds/chromium/%s/chromium-linux-arm64.zip',
    'ubuntu24.04-arm64': 'builds/chromium/%s/chromium-linux-arm64.zip',
    'debian11-x64': 'builds/chromium/%s/chromium-linux.zip',
    'debian11-arm64': 'builds/chromium/%s/chromium-linux-arm64.zip',
    'debian12-x64': 'builds/chromium/%s/chromium-linux.zip',
    'debian12-arm64': 'builds/chromium/%s/chromium-linux-arm64.zip',
    'mac10.13': 'builds/chromium/%s/chromium-mac.zip',
    'mac10.14': 'builds/chromium/%s/chromium-mac.zip',
    'mac10.15': 'builds/chromium/%s/chromium-mac.zip',
    mac11: 'builds/chromium/%s/chromium-mac.zip',
    'mac11-arm64': 'builds/chromium/%s/chromium-mac-arm64.zip',
    mac12: 'builds/chromium/%s/chromium-mac.zip',
    'mac12-arm64': 'builds/chromium/%s/chromium-mac-arm64.zip',
    mac13: 'builds/chromium/%s/chromium-mac.zip',
    'mac13-arm64': 'builds/chromium/%s/chromium-mac-arm64.zip',
    mac14: 'builds/chromium/%s/chromium-mac.zip',
    'mac14-arm64': 'builds/chromium/%s/chromium-mac-arm64.zip',
    mac15: 'builds/chromium/%s/chromium-mac.zip',
    'mac15-arm64': 'builds/chromium/%s/chromium-mac-arm64.zip',
    win64: 'builds/chromium/%s/chromium-win64.zip',
  },
  'chromium-headless-shell': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/chromium/%s/chromium-headless-shell-linux.zip',
    'ubuntu22.04-x64': 'builds/chromium/%s/chromium-headless-shell-linux.zip',
    'ubuntu24.04-x64': 'builds/chromium/%s/chromium-headless-shell-linux.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/chromium/%s/chromium-headless-shell-linux-arm64.zip',
    'ubuntu22.04-arm64': 'builds/chromium/%s/chromium-headless-shell-linux-arm64.zip',
    'ubuntu24.04-arm64': 'builds/chromium/%s/chromium-headless-shell-linux-arm64.zip',
    'debian11-x64': 'builds/chromium/%s/chromium-headless-shell-linux.zip',
    'debian11-arm64': 'builds/chromium/%s/chromium-headless-shell-linux-arm64.zip',
    'debian12-x64': 'builds/chromium/%s/chromium-headless-shell-linux.zip',
    'debian12-arm64': 'builds/chromium/%s/chromium-headless-shell-linux-arm64.zip',
    'mac10.13': undefined,
    'mac10.14': undefined,
    'mac10.15': undefined,
    mac11: 'builds/chromium/%s/chromium-headless-shell-mac.zip',
    'mac11-arm64': 'builds/chromium/%s/chromium-headless-shell-mac-arm64.zip',
    mac12: 'builds/chromium/%s/chromium-headless-shell-mac.zip',
    'mac12-arm64': 'builds/chromium/%s/chromium-headless-shell-mac-arm64.zip',
    mac13: 'builds/chromium/%s/chromium-headless-shell-mac.zip',
    'mac13-arm64': 'builds/chromium/%s/chromium-headless-shell-mac-arm64.zip',
    mac14: 'builds/chromium/%s/chromium-headless-shell-mac.zip',
    'mac14-arm64': 'builds/chromium/%s/chromium-headless-shell-mac-arm64.zip',
    mac15: 'builds/chromium/%s/chromium-headless-shell-mac.zip',
    'mac15-arm64': 'builds/chromium/%s/chromium-headless-shell-mac-arm64.zip',
    win64: 'builds/chromium/%s/chromium-headless-shell-win64.zip',
  },
  'chromium-tip-of-tree': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux.zip',
    'ubuntu22.04-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux.zip',
    'ubuntu24.04-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux-arm64.zip',
    'ubuntu22.04-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux-arm64.zip',
    'ubuntu24.04-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux-arm64.zip',
    'debian11-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux.zip',
    'debian11-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux-arm64.zip',
    'debian12-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux.zip',
    'debian12-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-linux-arm64.zip',
    'mac10.13': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac10.14': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac10.15': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    mac11: 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac11-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac-arm64.zip',
    mac12: 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac12-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac-arm64.zip',
    mac13: 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac13-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac-arm64.zip',
    mac14: 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac14-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac-arm64.zip',
    mac15: 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac.zip',
    'mac15-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-mac-arm64.zip',
    win64: 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-win64.zip',
  },
  'chromium-tip-of-tree-headless-shell': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-linux.zip',
    'ubuntu22.04-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-linux.zip',
    'ubuntu24.04-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-linux.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-linux-arm64.zip',
    'ubuntu22.04-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-linux-arm64.zip',
    'ubuntu24.04-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-linux-arm64.zip',
    'debian11-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-linux.zip',
    'debian11-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-linux-arm64.zip',
    'debian12-x64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-linux.zip',
    'debian12-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-linux-arm64.zip',
    'mac10.13': undefined,
    'mac10.14': undefined,
    'mac10.15': undefined,
    mac11: 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-mac.zip',
    'mac11-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-mac-arm64.zip',
    mac12: 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-mac.zip',
    'mac12-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-mac-arm64.zip',
    mac13: 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-mac.zip',
    'mac13-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-mac-arm64.zip',
    mac14: 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-mac.zip',
    'mac14-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-mac-arm64.zip',
    mac15: 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-mac.zip',
    'mac15-arm64': 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-mac-arm64.zip',
    win64: 'builds/chromium-tip-of-tree/%s/chromium-tip-of-tree-headless-shell-win64.zip',
  },
  firefox: {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/firefox/%s/firefox-ubuntu-20.04.zip',
    'ubuntu22.04-x64': 'builds/firefox/%s/firefox-ubuntu-22.04.zip',
    'ubuntu24.04-x64': 'builds/firefox/%s/firefox-ubuntu-24.04.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/firefox/%s/firefox-ubuntu-20.04-arm64.zip',
    'ubuntu22.04-arm64': 'builds/firefox/%s/firefox-ubuntu-22.04-arm64.zip',
    'ubuntu24.04-arm64': 'builds/firefox/%s/firefox-ubuntu-24.04-arm64.zip',
    'debian11-x64': 'builds/firefox/%s/firefox-debian-11.zip',
    'debian11-arm64': 'builds/firefox/%s/firefox-debian-11-arm64.zip',
    'debian12-x64': 'builds/firefox/%s/firefox-debian-12.zip',
    'debian12-arm64': 'builds/firefox/%s/firefox-debian-12-arm64.zip',
    'mac10.13': 'builds/firefox/%s/firefox-mac.zip',
    'mac10.14': 'builds/firefox/%s/firefox-mac.zip',
    'mac10.15': 'builds/firefox/%s/firefox-mac.zip',
    mac11: 'builds/firefox/%s/firefox-mac.zip',
    'mac11-arm64': 'builds/firefox/%s/firefox-mac-arm64.zip',
    mac12: 'builds/firefox/%s/firefox-mac.zip',
    'mac12-arm64': 'builds/firefox/%s/firefox-mac-arm64.zip',
    mac13: 'builds/firefox/%s/firefox-mac.zip',
    'mac13-arm64': 'builds/firefox/%s/firefox-mac-arm64.zip',
    mac14: 'builds/firefox/%s/firefox-mac.zip',
    'mac14-arm64': 'builds/firefox/%s/firefox-mac-arm64.zip',
    mac15: 'builds/firefox/%s/firefox-mac.zip',
    'mac15-arm64': 'builds/firefox/%s/firefox-mac-arm64.zip',
    win64: 'builds/firefox/%s/firefox-win64.zip',
  },
  'firefox-beta': {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/firefox-beta/%s/firefox-beta-ubuntu-20.04.zip',
    'ubuntu22.04-x64': 'builds/firefox-beta/%s/firefox-beta-ubuntu-22.04.zip',
    'ubuntu24.04-x64': 'builds/firefox-beta/%s/firefox-beta-ubuntu-24.04.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': undefined,
    'ubuntu22.04-arm64': 'builds/firefox-beta/%s/firefox-beta-ubuntu-22.04-arm64.zip',
    'ubuntu24.04-arm64': 'builds/firefox-beta/%s/firefox-beta-ubuntu-24.04-arm64.zip',
    'debian11-x64': 'builds/firefox-beta/%s/firefox-beta-debian-11.zip',
    'debian11-arm64': 'builds/firefox-beta/%s/firefox-beta-debian-11-arm64.zip',
    'debian12-x64': 'builds/firefox-beta/%s/firefox-beta-debian-12.zip',
    'debian12-arm64': 'builds/firefox-beta/%s/firefox-beta-debian-12-arm64.zip',
    'mac10.13': 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac10.14': 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac10.15': 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    mac11: 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac11-arm64': 'builds/firefox-beta/%s/firefox-beta-mac-arm64.zip',
    mac12: 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac12-arm64': 'builds/firefox-beta/%s/firefox-beta-mac-arm64.zip',
    mac13: 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac13-arm64': 'builds/firefox-beta/%s/firefox-beta-mac-arm64.zip',
    mac14: 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac14-arm64': 'builds/firefox-beta/%s/firefox-beta-mac-arm64.zip',
    mac15: 'builds/firefox-beta/%s/firefox-beta-mac.zip',
    'mac15-arm64': 'builds/firefox-beta/%s/firefox-beta-mac-arm64.zip',
    win64: 'builds/firefox-beta/%s/firefox-beta-win64.zip',
  },
  webkit: {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/webkit/%s/webkit-ubuntu-20.04.zip',
    'ubuntu22.04-x64': 'builds/webkit/%s/webkit-ubuntu-22.04.zip',
    'ubuntu24.04-x64': 'builds/webkit/%s/webkit-ubuntu-24.04.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/webkit/%s/webkit-ubuntu-20.04-arm64.zip',
    'ubuntu22.04-arm64': 'builds/webkit/%s/webkit-ubuntu-22.04-arm64.zip',
    'ubuntu24.04-arm64': 'builds/webkit/%s/webkit-ubuntu-24.04-arm64.zip',
    'debian11-x64': 'builds/webkit/%s/webkit-debian-11.zip',
    'debian11-arm64': 'builds/webkit/%s/webkit-debian-11-arm64.zip',
    'debian12-x64': 'builds/webkit/%s/webkit-debian-12.zip',
    'debian12-arm64': 'builds/webkit/%s/webkit-debian-12-arm64.zip',
    'mac10.13': undefined,
    'mac10.14': 'builds/deprecated-webkit-mac-10.14/%s/deprecated-webkit-mac-10.14.zip',
    'mac10.15': 'builds/deprecated-webkit-mac-10.15/%s/deprecated-webkit-mac-10.15.zip',
    mac11: 'builds/webkit/%s/webkit-mac-11.zip',
    'mac11-arm64': 'builds/webkit/%s/webkit-mac-11-arm64.zip',
    mac12: 'builds/webkit/%s/webkit-mac-12.zip',
    'mac12-arm64': 'builds/webkit/%s/webkit-mac-12-arm64.zip',
    mac13: 'builds/webkit/%s/webkit-mac-13.zip',
    'mac13-arm64': 'builds/webkit/%s/webkit-mac-13-arm64.zip',
    mac14: 'builds/webkit/%s/webkit-mac-14.zip',
    'mac14-arm64': 'builds/webkit/%s/webkit-mac-14-arm64.zip',
    mac15: 'builds/webkit/%s/webkit-mac-15.zip',
    'mac15-arm64': 'builds/webkit/%s/webkit-mac-15-arm64.zip',
    win64: 'builds/webkit/%s/webkit-win64.zip',
  },
  ffmpeg: {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'ubuntu22.04-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'ubuntu24.04-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'ubuntu22.04-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'ubuntu24.04-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'debian11-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'debian11-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'debian12-x64': 'builds/ffmpeg/%s/ffmpeg-linux.zip',
    'debian12-arm64': 'builds/ffmpeg/%s/ffmpeg-linux-arm64.zip',
    'mac10.13': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac10.14': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac10.15': 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    mac11: 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac11-arm64': 'builds/ffmpeg/%s/ffmpeg-mac-arm64.zip',
    mac12: 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac12-arm64': 'builds/ffmpeg/%s/ffmpeg-mac-arm64.zip',
    mac13: 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac13-arm64': 'builds/ffmpeg/%s/ffmpeg-mac-arm64.zip',
    mac14: 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac14-arm64': 'builds/ffmpeg/%s/ffmpeg-mac-arm64.zip',
    mac15: 'builds/ffmpeg/%s/ffmpeg-mac.zip',
    'mac15-arm64': 'builds/ffmpeg/%s/ffmpeg-mac-arm64.zip',
    win64: 'builds/ffmpeg/%s/ffmpeg-win64.zip',
  },
  winldd: {
    '<unknown>': undefined,
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': undefined,
    'ubuntu22.04-x64': undefined,
    'ubuntu24.04-x64': undefined,
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': undefined,
    'ubuntu22.04-arm64': undefined,
    'ubuntu24.04-arm64': undefined,
    'debian11-x64': undefined,
    'debian11-arm64': undefined,
    'debian12-x64': undefined,
    'debian12-arm64': undefined,
    'mac10.13': undefined,
    'mac10.14': undefined,
    'mac10.15': undefined,
    mac11: undefined,
    'mac11-arm64': undefined,
    mac12: undefined,
    'mac12-arm64': undefined,
    mac13: undefined,
    'mac13-arm64': undefined,
    mac14: undefined,
    'mac14-arm64': undefined,
    mac15: undefined,
    'mac15-arm64': undefined,
    win64: 'builds/winldd/%s/winldd-win64.zip',
  },
  android: {
    '<unknown>': 'builds/android/%s/android.zip',
    'ubuntu18.04-x64': undefined,
    'ubuntu20.04-x64': 'builds/android/%s/android.zip',
    'ubuntu22.04-x64': 'builds/android/%s/android.zip',
    'ubuntu24.04-x64': 'builds/android/%s/android.zip',
    'ubuntu18.04-arm64': undefined,
    'ubuntu20.04-arm64': 'builds/android/%s/android.zip',
    'ubuntu22.04-arm64': 'builds/android/%s/android.zip',
    'ubuntu24.04-arm64': 'builds/android/%s/android.zip',
    'debian11-x64': 'builds/android/%s/android.zip',
    'debian11-arm64': 'builds/android/%s/android.zip',
    'debian12-x64': 'builds/android/%s/android.zip',
    'debian12-arm64': 'builds/android/%s/android.zip',
    'mac10.13': 'builds/android/%s/android.zip',
    'mac10.14': 'builds/android/%s/android.zip',
    'mac10.15': 'builds/android/%s/android.zip',
    mac11: 'builds/android/%s/android.zip',
    'mac11-arm64': 'builds/android/%s/android.zip',
    mac12: 'builds/android/%s/android.zip',
    'mac12-arm64': 'builds/android/%s/android.zip',
    mac13: 'builds/android/%s/android.zip',
    'mac13-arm64': 'builds/android/%s/android.zip',
    mac14: 'builds/android/%s/android.zip',
    'mac14-arm64': 'builds/android/%s/android.zip',
    mac15: 'builds/android/%s/android.zip',
    'mac15-arm64': 'builds/android/%s/android.zip',
    win64: 'builds/android/%s/android.zip',
  },
} as const;

@SingletonProto()
@BinaryAdapter(BinaryType.Playwright)
export class PlaywrightBinary extends AbstractBinary {
  private dirItems?: Record<string, BinaryItem[]>;
  async initFetch() {
    this.dirItems = undefined;
  }

  async fetch(dir: string): Promise<FetchResult | undefined> {
    if (!this.dirItems) {
      const packageData = await this.requestJSON(PACKAGE_URL);
      const nowDateISO = new Date().toISOString();
      const buildDirs: BinaryItem[] = [];
      for (const browserName of Object.keys(DOWNLOAD_PATHS)) {
        if (browserName === 'chromium-headless-shell' || browserName === 'chromium-tip-of-tree-headless-shell') {
          continue;
        }
        buildDirs.push({
          name: `${browserName}/`,
          isDir: true,
          url: '',
          size: '-',
          date: nowDateISO,
        });
      }
      buildDirs.push({
        name: 'driver/',
        isDir: true,
        url: '',
        size: '-',
        date: nowDateISO,
      });
      this.dirItems = {
        '/': [
          {
            name: 'builds/',
            isDir: true,
            url: '',
            size: '-',
            date: nowDateISO,
          },
        ],
        '/builds/': buildDirs,
      };
      for (const browserName of Object.keys(DOWNLOAD_PATHS)) {
        if (browserName === 'chromium-headless-shell' || browserName === 'chromium-tip-of-tree-headless-shell') {
          continue;
        }
        this.dirItems[`/builds/${browserName}/`] = [];
      }

      // Only download beta and release versions of packages to reduce amount of request
      const packageVersions = Object.keys(packageData.versions)
        .filter((version) => version.match(/^(?:\d+\.\d+\.\d+)(?:-beta-\d+)?$/))
        // select recently update 20 items
        .slice(-20);
      // Add driver to dirItems
      this.dirItems['/builds/driver/'] = [];
      const hasBetaVersions = packageVersions.some((version) => version.includes('-beta-'));
      if (hasBetaVersions) {
        this.dirItems['/builds/driver/'].push({
          name: 'next/',
          isDir: true,
          url: '',
          size: '-',
          date: 'next',
        });
        this.dirItems['/builds/driver/next/'] = [];
      }
      for (const version of packageVersions) {
        for (const arch of PLAYWRIGHT_DRIVER_ARCHS) {
          const isBetaVersion = version.includes('-beta-');
          const driverFileName = `playwright-${version}-${arch}.zip`;
          const driverURL = isBetaVersion
            ? DOWNLOAD_HOST + `builds/driver/next/${driverFileName}`
            : DOWNLOAD_HOST + `builds/driver/${driverFileName}`;
          const driverItem = {
            name: driverFileName,
            isDir: false,
            url: driverURL,
            size: '-',
            date: version,
          };
          const targetDir = isBetaVersion ? '/builds/driver/next/' : '/builds/driver/';
          this.dirItems[targetDir].push(driverItem);
        }
      }

      const browsers: {
        name: keyof typeof DOWNLOAD_PATHS;
        revision: string;
        browserVersion: string;
        revisionOverrides?: Record<string, string>;
      }[] = [];
      await Promise.all(
        packageVersions.map((version) =>
          this.requestJSON(`https://unpkg.com/playwright-core@${version}/browsers.json`)
            .then((data) => {
              // browsers: [
              //   {
              //     "name": "chromium",
              //     "revision": "1005",
              //     "installByDefault": true,
              //     "browserVersion": "102.0.5005.40",
              //     "revisionOverrides": {}
              //   },
              // ]
              browsers.push(...data.browsers);
              return data;
            })
            .catch((err) => {
              /* c8 ignore next 2 */
              this.logger.warn(
                '[PlaywrightBinary.fetch:error] Playwright version %s browser data request failed: %s',
                version,
                err,
              );
            }),
        ),
      );
      // if chromium-headless-shell not exists on browsers, copy chromium to chromium-headless-shell
      if (!browsers.some((browser) => browser.name === 'chromium-headless-shell')) {
        const chromium = browsers.find((browser) => browser.name === 'chromium');
        // {
        //   "name": "chromium",
        //   "revision": "1155",
        //   "installByDefault": true,
        //   "browserVersion": "133.0.6943.16"
        // }
        if (chromium) {
          browsers.push({
            ...chromium,
            name: 'chromium-headless-shell',
          });
        }
      }
      // if chromium-tip-of-tree-headless-shell not exists on browsers, copy chromium-tip-of-tree to chromium-tip-of-tree-headless-shell
      if (!browsers.some((browser) => browser.name === 'chromium-tip-of-tree-headless-shell')) {
        const chromiumTipOfTree = browsers.find((browser) => browser.name === 'chromium-tip-of-tree');
        if (chromiumTipOfTree) {
          browsers.push({
            ...chromiumTipOfTree,
            name: 'chromium-tip-of-tree-headless-shell',
          });
        }
      }

      for (const browser of browsers) {
        const downloadPaths = DOWNLOAD_PATHS[browser.name];
        if (!downloadPaths) continue;
        let browserDirname = browser.name;
        if (browser.name === 'chromium-headless-shell') {
          // chromium-headless-shell should be under chromium
          // https://playwright.azureedge.net/builds/chromium/1155/chromium-headless-shell-mac-arm64.zip
          browserDirname = 'chromium';
        } else if (browser.name === 'chromium-tip-of-tree-headless-shell') {
          // chromium-tip-of-tree-headless-shell should be under chromium-tip-of-tree
          // https://playwright.azureedge.net/builds/chromium-tip-of-tree/1293/chromium-tip-of-tree-headless-shell-mac-arm64.zip
          browserDirname = 'chromium-tip-of-tree';
        }
        for (const [platform, remotePath] of Object.entries(downloadPaths)) {
          if (typeof remotePath !== 'string') continue;
          const revision = browser.revisionOverrides?.[platform] ?? browser.revision;
          const itemDate = browser.browserVersion || revision;
          const url = DOWNLOAD_HOST + util.format(remotePath, revision);
          const name = path.basename(remotePath);
          const dir = `/builds/${browserDirname}/${revision}/`;
          if (!this.dirItems[dir]) {
            this.dirItems[`/builds/${browserDirname}/`].push({
              name: `${revision}/`,
              isDir: true,
              url: '',
              size: '-',
              date: revision,
            });
            this.dirItems[dir] = [];
          }
          if (!this.dirItems[dir].some((item) => item.name === name)) {
            this.dirItems[dir].push({
              name,
              isDir: false,
              url,
              size: '-',
              date: itemDate,
            });
          }
        }
      }
    }

    return { items: this.dirItems[dir] ?? [], nextParams: null };
  }
}
