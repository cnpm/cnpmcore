// oxlint-disable eslint/no-console
import autocannon from 'autocannon';

interface BenchmarkOptions {
  url?: string;
  duration?: number;
  connections?: number;
  pipelining?: number;
  workers?: number;
}

/**
 * Benchmark the ShowPackageController endpoint
 * 
 * This benchmark tests the performance of the GET /:fullname endpoint
 * which is implemented in app/port/controller/package/ShowPackageController.ts
 * 
 * Prerequisites:
 * 1. Start the development server: npm run dev
 * 2. Publish at least one package to test with
 * 
 * Usage:
 * npm run benchmark:show-package
 * 
 * Or with custom options:
 * node benchmark/show-package-controller.js --package=@cnpm/test --duration=30
 */
async function runBenchmark(options: BenchmarkOptions = {}) {
  const {
    url = 'http://127.0.0.1:7001',
    duration = 10,
    connections = 10,
    pipelining = 1,
    workers = 0,
  } = options;

  // Parse command line arguments
  const args = process.argv.slice(2);
  let packageName = 'cnpmcore';
  
  for (const arg of args) {
    if (arg.startsWith('--package=')) {
      packageName = arg.split('=')[1];
    } else if (arg.startsWith('--duration=')) {
      const customDuration = parseInt(arg.split('=')[1], 10);
      if (!isNaN(customDuration)) {
        options.duration = customDuration;
      }
    } else if (arg.startsWith('--connections=')) {
      const customConnections = parseInt(arg.split('=')[1], 10);
      if (!isNaN(customConnections)) {
        options.connections = customConnections;
      }
    } else if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1];
    }
  }

  const targetUrl = `${options.url || url}/${packageName}`;

  console.log('='.repeat(80));
  console.log('ShowPackageController Benchmark');
  console.log('='.repeat(80));
  console.log('Target URL:', targetUrl);
  console.log('Duration:', options.duration || duration, 'seconds');
  console.log('Connections:', options.connections || connections);
  console.log('Pipelining:', pipelining);
  console.log('Workers:', workers);
  console.log('='.repeat(80));
  console.log('');

  try {
    const results = await autocannon({
      url: targetUrl,
      duration: options.duration || duration,
      connections: options.connections || connections,
      pipelining,
      workers,
      headers: {
        'user-agent': 'autocannon-benchmark/1.0.0',
        'accept': 'application/json',
      },
    });

    console.log('');
    console.log('='.repeat(80));
    console.log('Benchmark Results Summary');
    console.log('='.repeat(80));
    console.log('');
    console.log('Requests:');
    console.log(`  Total: ${results.requests.total}`);
    console.log(`  Sent: ${results.requests.sent}`);
    console.log(`  Average: ${results.requests.average} req/sec`);
    console.log(`  Mean: ${results.requests.mean} req/sec`);
    console.log(`  Stddev: ${results.requests.stddev}`);
    console.log(`  Min: ${results.requests.min}`);
    console.log(`  Max: ${results.requests.max}`);
    console.log('');
    console.log('Latency:');
    console.log(`  Average: ${results.latency.mean} ms`);
    console.log(`  Mean: ${results.latency.mean} ms`);
    console.log(`  Stddev: ${results.latency.stddev} ms`);
    console.log(`  Min: ${results.latency.min} ms`);
    console.log(`  Max: ${results.latency.max} ms`);
    console.log('');
    console.log('Throughput:');
    console.log(`  Average: ${results.throughput.average} bytes/sec`);
    console.log(`  Mean: ${results.throughput.mean} bytes/sec`);
    console.log(`  Stddev: ${results.throughput.stddev}`);
    console.log(`  Min: ${results.throughput.min}`);
    console.log(`  Max: ${results.throughput.max}`);
    console.log('');
    console.log('Errors:', results.errors);
    console.log('Timeouts:', results.timeouts);
    console.log('Non-2xx responses:', results.non2xx);
    console.log('');
    console.log('='.repeat(80));
    
    // Exit with error code if there were errors
    if (results.errors > 0 || results.non2xx > 0) {
      console.error('Benchmark completed with errors!');
      throw new Error('Benchmark failed');
    } else {
      console.log('Benchmark completed successfully!');
      return results;
    }
  } catch (err: unknown) {
    console.error('');
    console.error('='.repeat(80));
    console.error('Benchmark Error');
    console.error('='.repeat(80));
    console.error('');
    console.error('Failed to run benchmark:', err instanceof Error ? err.message : String(err));
    console.error('');
    console.error('Make sure:');
    console.error('1. The development server is running (npm run dev)');
    console.error('2. The package exists in your registry');
    console.error('3. The URL is correct');
    console.error('');
    throw err;
  }
}

// Run the benchmark if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmark().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { runBenchmark };
