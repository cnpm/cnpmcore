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

**Do not report security vulnerabilities in public GitHub issues, discussions, or pull requests.**

### Preferred: GitHub Security Advisories

Send your report with GitHub private vulnerability reporting:

https://github.com/cnpm/cnpmcore/security/advisories/new

A private report has these advantages:

- Only you and the maintainers can read the report.
- All of the discussion stays in one place.
- We can give you credit in the advisory when we publish it.
- We can request a CVE when we release the fix.

Give as much of this information as you can:

- The type of the issue.
- The version or the commit that has the issue.
- The full path of each source file that relates to the issue.
- The steps to reproduce the issue.
- The proof-of-concept code or the exploit code, if you have it.
- The impact of the issue.
- The method that an attacker can use to exploit the issue.

### Alternative: email

If you cannot use GitHub Security Advisories, send an email to the cnpmcore security team:

```
fengmk2+cnpmcoresecurity@gmail.com
killa07071201@gmail.com
smith3816@gmail.com
elrrrrrrr@gmail.com
```

We will confirm that we received your report.
We will process the report as soon as possible.
We will then tell you the next steps.
The security team will tell you about the progress of the fix and the announcement.
The team can also ask you for more information.

Report security vulnerabilities in third-party modules to the person or team maintaining the module.

## Disclosure Policy

When the security team receives a security bug report, they will assign it
to a primary handler. This person will coordinate the fix and release
process, involving the following steps:

- Confirm the problem and determine the affected versions.
- Audit code to find any potential similar problems.
- Prepare fixes for all releases still under maintenance. These fixes
  will be released as fast as possible to NPM.
- Publish a GitHub Security Advisory after we release the fix.
  Give credit to the reporter, unless the reporter asks to stay anonymous.
