# Private NPM Registry for Enterprise

[![Node.js CI](https://github.com/cnpm/cnpmcore/actions/workflows/nodejs.yml/badge.svg?branch=master)](https://github.com/cnpm/cnpmcore/actions/workflows/nodejs.yml)
[![codecov](https://codecov.io/gh/cnpm/cnpmcore/master/main/graph/badge.svg)](https://app.codecov.io/gh/cnpm/cnpmcore/tree/master)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fcnpm%2Fcnpmcore.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fcnpm%2Fcnpmcore?ref=badge_shield)
[![Node.js Version](https://img.shields.io/node/v/cnpmcore.svg?style=flat)](https://nodejs.org/en/download/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://makeapullrequest.com)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/cnpm/cnpmcore)
[![NPM Version](https://img.shields.io/npm/v/cnpmcore)](https://www.npmjs.com/package/cnpmcore)
[![NPM Downloads](https://img.shields.io/npm/dm/cnpmcore)](https://www.npmjs.com/package/cnpmcore)
[![NPM License](https://img.shields.io/npm/l/cnpmcore)](https://github.com/cnpm/cnpmcore/blob/master/LICENSE)

Reimplement based on [cnpmjs.org](https://github.com/cnpm/cnpmjs.org) with TypeScript.

## Registry HTTP API

See [registry-api.md](docs/registry-api.md)

## Internal API for Direct HTTP Requests

See [internal-api.md](docs/internal-api.md) for comprehensive documentation of cnpmcore's internal APIs that allow direct HTTP requests for package synchronization, administration, and other advanced operations.

## How to contribute

See [DEVELOPER.md](DEVELOPER.md)

The quickest way to get a ready-to-code environment (MySQL + Redis + dev database preconfigured) is GitHub Codespaces:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/cnpm/cnpmcore)

You can also open the repo locally with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension. See [.devcontainer/README.md](.devcontainer/README.md) for details.

## How to integrate

See [INTEGRATE.md](INTEGRATE.md)

## npmmirror.com

[npmmirror.com](https://npmmirror.com) is the China NPM mirror hosted by cnpmcore, sponsored by [Alibaba Cloud / 阿里云](https://www.aliyun.com/).

npmmirror.com 是由 cnpmcore 驱动的中国 NPM 镜像，由[阿里云](https://www.aliyun.com/)提供基础设施赞助。

### Usage Policy

To provide a more stable and reliable service:

- Do not abuse the registry with excessive crawling or scraping.
- Automated access that generates unusually high traffic may be rate-limited without notice.
- If you have large-scale usage needs or are affected by rate limiting, please open a [GitHub Issue](https://github.com/cnpm/cnpmcore/issues) to contact us.

### 使用须知

为了提供更加稳定可靠的服务：

- 请勿滥用 registry，禁止过度爬取或抓取数据。
- 产生异常高流量的自动化访问可能会被限流，恕不另行通知。
- 如果您有大规模使用需求，或受到限流策略影响，请通过 [GitHub Issue](https://github.com/cnpm/cnpmcore/issues) 与我们联系。

## License

[MIT](LICENSE)

## Contributors

[![Contributors](https://contrib.rocks/image?repo=cnpm/cnpmcore)](https://github.com/cnpm/cnpmcore/graphs/contributors)

Made with [contributors-img](https://contrib.rocks).

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fcnpm%2Fcnpmcore.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fcnpm%2Fcnpmcore?ref=badge_large)
