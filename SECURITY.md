# Security Policy

## Supported Versions

Currently being supported with security updates.

| Version  | Supported          |
| -------- | ------------------ |
| >= 3.0.0 | :white_check_mark: |

## Reporting a Vulnerability

The cnpmcore OSS team and community take all security vulnerabilities seriously.
Thank you for improving the security of our open source software.
We appreciate your efforts and responsible disclosure and will make every effort to acknowledge your contributions.

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

### Preferred: GitHub Security Advisories

Report vulnerabilities through GitHub's private vulnerability reporting:

https://github.com/cnpm/cnpmcore/security/advisories/new

The report stays private between you and the maintainers, keeps the whole discussion in one place,
and lets us credit you on the published advisory and request a CVE when the fix ships.

Include as much of the following as you can:

- The type of issue, and the affected version or commit.
- Full paths of the source files related to the issue.
- Step-by-step instructions to reproduce it, including any proof-of-concept or exploit code.
- The impact of the issue, and how an attacker might exploit it.

### Alternative: email

If you cannot use GitHub Security Advisories, email the cnpmcore security team at:

```
fengmk2+cnpmcoresecurity@gmail.com
killa07071201@gmail.com
smith3816@gmail.com
elrrrrrrr@gmail.com
```

We will acknowledge your report within 48 hours,
and will send a more detailed response within 72 hours indicating the next steps in handling it.
After that first reply,
the security team will keep you informed of the progress towards a fix and full announcement,
and may ask for additional information or guidance.

Report security vulnerabilities in third-party modules to the person or team maintaining the module.

## Disclosure Policy

When the security team receives a security bug report, they will assign it
to a primary handler. This person will coordinate the fix and release
process, involving the following steps:

- Confirm the problem and determine the affected versions.
- Audit code to find any potential similar problems.
- Prepare fixes for all releases still under maintenance. These fixes
  will be released as fast as possible to NPM.
- Publish a GitHub Security Advisory once the fix is out, crediting the reporter
  unless they ask to stay anonymous.
