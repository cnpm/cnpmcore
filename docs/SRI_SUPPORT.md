# Enhanced SRI Support for UNPKG Files

This document explains the enhanced Subresource Integrity (SRI) support implemented for the unpkg files functionality.

## Overview

The enhanced SRI implementation provides multiple cryptographic hashes (SHA-256, SHA-384, SHA-512) for files served through the unpkg functionality, following W3C SRI specifications.

## Features

### 1. Multiple Hash Algorithms
- **SHA-256**: Fastest, commonly used for performance-critical scenarios
- **SHA-384**: Recommended for CDN usage, good balance of security and performance  
- **SHA-512**: Highest security, backwards compatible with existing implementation

### 2. Enhanced File Metadata

When requesting file metadata with `?meta`, you now get enhanced SRI information:

```json
{
  "path": "/package.json",
  "type": "file",
  "contentType": "application/json",
  "integrity": "sha512-N015SpXNz9izWZMYX++bo2jxYNja9DLQi6nx7R5avmzGkpHg+i/gAGpSVw7xjBne9OYXwzzlLvCm5fvjGMsDhw==",
  "sri": {
    "sha256": "sha256-3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8=",
    "sha384": "sha384-VIXMmzNltDBd+06DN+ClmKV0+CQr8XKJ4N1sIKPNRKCJ3harSrMI9j5EsRcOtfUV",
    "sha512": "sha512-N015SpXNz9izWZMYX++bo2jxYNja9DLQi6nx7R5avmzGkpHg+i/gAGpSVw7xjBne9OYXwzzlLvCm5fvjGMsDhw==",
    "combined": "sha256-3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8= sha384-VIXMmzNltDBd+06DN+ClmKV0+CQr8XKJ4N1sIKPNRKCJ3harSrMI9j5EsRcOtfUV sha512-N015SpXNz9izWZMYX++bo2jxYNja9DLQi6nx7R5avmzGkpHg+i/gAGpSVw7xjBne9OYXwzzlLvCm5fvjGMsDhw=="
  },
  "lastModified": "2023-01-01T00:00:00.000Z",
  "size": 209
}
```

### 3. HTTP Headers

When serving actual file content, additional SRI headers are included:

```
X-SRI-SHA256: sha256-3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8=
X-SRI-SHA384: sha384-VIXMmzNltDBd+06DN+ClmKV0+CQr8XKJ4N1sIKPNRKCJ3harSrMI9j5EsRcOtfUV
X-SRI-SHA512: sha512-N015SpXNz9izWZMYX++bo2jxYNja9DLQi6nx7R5avmzGkpHg+i/gAGpSVw7xjBne9OYXwzzlLvCm5fvjGMsDhw==
X-SRI-Integrity: sha256-3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8= sha384-VIXMmzNltDBd+06DN+ClmKV0+CQr8XKJ4N1sIKPNRKCJ3harSrMI9j5EsRcOtfUV sha512-N015SpXNz9izWZMYX++bo2jxYNja9DLQi6nx7R5avmzGkpHg+i/gAGpSVw7xjBne9OYXwzzlLvCm5fvjGMsDhw==
```

## HTML Integration Examples

### Script Tags
```html
<!-- Using SHA-384 (recommended for CDN) -->
<script src="https://your-registry.com/package/1.0.0/files/dist/bundle.js" 
        integrity="sha384-VIXMmzNltDBd+06DN+ClmKV0+CQr8XKJ4N1sIKPNRKCJ3harSrMI9j5EsRcOtfUV" 
        crossorigin="anonymous"></script>

<!-- Using multiple algorithms for better security -->
<script src="https://your-registry.com/package/1.0.0/files/dist/bundle.js" 
        integrity="sha256-3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8= sha384-VIXMmzNltDBd+06DN+ClmKV0+CQr8XKJ4N1sIKPNRKCJ3harSrMI9j5EsRcOtfUV sha512-N015SpXNz9izWZMYX++bo2jxYNja9DLQi6nx7R5avmzGkpHg+i/gAGpSVw7xjBne9OYXwzzlLvCm5fvjGMsDhw==" 
        crossorigin="anonymous"></script>
```

### CSS Link Tags
```html
<link rel="stylesheet" 
      href="https://your-registry.com/package/1.0.0/files/dist/styles.css" 
      integrity="sha384-VIXMmzNltDBd+06DN+ClmKV0+CQr8XKJ4N1sIKPNRKCJ3harSrMI9j5EsRcOtfUV" 
      crossorigin="anonymous">
```

## API Usage

### Get File Metadata with SRI
```bash
GET /package/1.0.0/files/dist/bundle.js?meta
```

### Get File with SRI Headers
```bash
GET /package/1.0.0/files/dist/bundle.js
```

## Backwards Compatibility

- Existing `integrity` field remains unchanged (SHA-512)
- Existing API consumers continue to work without modification
- Enhanced SRI data is provided as optional additional metadata

## Configuration

SRI functionality is automatically enabled when:
- `enableUnpkg` is true
- `enableSyncUnpkgFiles` is true

No additional configuration required.

## Security Benefits

1. **Multi-algorithm verification**: Browsers can verify files using any supported algorithm
2. **Future-proof**: Support for new algorithms can be added without breaking existing implementations
3. **Performance options**: Choose algorithm based on performance vs security requirements
4. **Standard compliance**: Follows W3C SRI specification completely