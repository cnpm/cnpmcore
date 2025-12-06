# cnpmcore Benchmarks

This directory contains performance benchmarks for cnpmcore using [autocannon](https://github.com/mcollina/autocannon).

## ShowPackageController Benchmark

Benchmarks the performance of the `GET /:fullname` endpoint implemented in `app/port/controller/package/ShowPackageController.ts`.

### Prerequisites

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Publish at least one package to benchmark:**
   ```bash
   # Register/login first
   npm login --registry=http://127.0.0.1:7001
   
   # Publish a package to test with
   npm publish --registry=http://127.0.0.1:7001
   ```

### Usage

**Basic usage with default package (cnpmcore):**
```bash
npm run benchmark:show-package
```

**Benchmark a specific package:**
```bash
npm run benchmark:show-package -- --package=your-package-name
```

**Benchmark a scoped package:**
```bash
npm run benchmark:show-package -- --package=@scope/package-name
```

**Custom duration (seconds):**
```bash
npm run benchmark:show-package -- --package=cnpmcore --duration=30
```

**Custom number of connections:**
```bash
npm run benchmark:show-package -- --package=cnpmcore --connections=20
```

**Custom registry URL:**
```bash
npm run benchmark:show-package -- --package=cnpmcore --url=http://localhost:7001
```

**Multiple options:**
```bash
npm run benchmark:show-package -- --package=@cnpm/test --duration=30 --connections=20
```

### Benchmark Options

| Option | Default | Description |
|--------|---------|-------------|
| `--package` | `cnpmcore` | Package name to benchmark |
| `--duration` | `10` | Benchmark duration in seconds |
| `--connections` | `10` | Number of concurrent connections |
| `--url` | `http://127.0.0.1:7001` | Base URL of the registry |

### Understanding the Results

The benchmark will display:

- **Requests**: Total number of requests, average requests per second
- **Latency**: Response time statistics (avg, min, max)
- **Throughput**: Data transfer rate
- **Errors**: Number of failed requests
- **Non-2xx responses**: HTTP errors

### Example Output

```
================================================================================
ShowPackageController Benchmark
================================================================================
Target URL: http://127.0.0.1:7001/cnpmcore
Duration: 10 seconds
Connections: 10
Pipelining: 1
Workers: 0
================================================================================

Running 10s test @ http://127.0.0.1:7001/cnpmcore
10 connections

┌─────────┬──────┬──────┬───────┬──────┬─────────┬─────────┬──────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%  │ Avg     │ Stdev   │ Max  │
├─────────┼──────┼──────┼───────┼──────┼─────────┼─────────┼──────┤
│ Latency │ 1 ms │ 2 ms │ 5 ms  │ 7 ms │ 2.1 ms  │ 1.2 ms  │ 15ms │
└─────────┴──────┴──────┴───────┴──────┴─────────┴─────────┴──────┘

================================================================================
Benchmark Results Summary
================================================================================

Requests:
  Total: 47850
  Sent: 47850
  Average: 4785 req/sec
  ...
```

## Tips

1. **Ensure packages exist**: Make sure to benchmark packages that actually exist in your registry to avoid 404 errors.
2. **Cold vs Hot cache**: Run the benchmark multiple times to see the difference between cold cache (first run) and hot cache (subsequent runs).
3. **Production-like environment**: For realistic results, run benchmarks in an environment similar to your production setup.
4. **Baseline metrics**: Record baseline performance metrics to track improvements or regressions over time.

## Adding More Benchmarks

To add benchmarks for other controllers:

1. Create a new TypeScript file in this directory (e.g., `benchmark/your-controller.ts`)
2. Follow the pattern used in `show-package-controller.ts`
3. Add a corresponding npm script in `package.json`
4. Document the usage in this README
