// oxlint-disable eslint/no-console
import autocannon from 'autocannon';
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
async function runBenchmark(options = {}) {
    const { url = 'http://127.0.0.1:7001', duration = 10, connections = 10, pipelining = 1, workers = 0, } = options;
    // Parse command line arguments
    const args = process.argv.slice(2);
    let packageName = 'cnpmcore';
    for (const arg of args) {
        if (arg.startsWith('--package=')) {
            packageName = arg.split('=')[1];
        }
        else if (arg.startsWith('--duration=')) {
            const customDuration = parseInt(arg.split('=')[1], 10);
            if (!isNaN(customDuration)) {
                options.duration = customDuration;
            }
        }
        else if (arg.startsWith('--connections=')) {
            const customConnections = parseInt(arg.split('=')[1], 10);
            if (!isNaN(customConnections)) {
                options.connections = customConnections;
            }
        }
        else if (arg.startsWith('--url=')) {
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
        }
        else {
            console.log('Benchmark completed successfully!');
            return results;
        }
    }
    catch (err) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hvdy1wYWNrYWdlLWNvbnRyb2xsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzaG93LXBhY2thZ2UtY29udHJvbGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxtQ0FBbUM7QUFDbkMsT0FBTyxVQUFVLE1BQU0sWUFBWSxDQUFDO0FBVXBDOzs7Ozs7Ozs7Ozs7Ozs7R0FlRztBQUNILEtBQUssVUFBVSxZQUFZLENBQUMsVUFBNEIsRUFBRTtJQUN4RCxNQUFNLEVBQ0osR0FBRyxHQUFHLHVCQUF1QixFQUM3QixRQUFRLEdBQUcsRUFBRSxFQUNiLFdBQVcsR0FBRyxFQUFFLEVBQ2hCLFVBQVUsR0FBRyxDQUFDLEVBQ2QsT0FBTyxHQUFHLENBQUMsR0FDWixHQUFHLE9BQU8sQ0FBQztJQUVaLCtCQUErQjtJQUMvQixNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuQyxJQUFJLFdBQVcsR0FBRyxVQUFVLENBQUM7SUFFN0IsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUN2QixJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztZQUNqQyxXQUFXLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsQyxDQUFDO2FBQU0sSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7WUFDekMsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDdkQsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO2dCQUMzQixPQUFPLENBQUMsUUFBUSxHQUFHLGNBQWMsQ0FBQztZQUNwQyxDQUFDO1FBQ0gsQ0FBQzthQUFN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