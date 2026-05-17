# Node.js Coredump Analysis Guide

This document describes how to analyze Node.js coredump files for memory leak detection.

## Prerequisites

- Docker container with `gdb` and `procps` installed
- Core dump file generated with `ulimit -c unlimited`
- Node.js built with debug symbols (optional but helpful)

## Generating Coredump

```bash
# Run benchmark and generate coredump
./run-benchmark-with-coredump.sh 60

# Or manually:
# 1. Start benchmark
docker exec -d nginx-benchmark-server bash -c "cd /root/workspace && node --expose-gc --heapsnapshot-signal=SIGUSR2 benchmark.js"

# 2. Get PID
docker exec nginx-benchmark-server cat /tmp/benchmark.pid

# 3. Generate heap snapshot (optional)
docker exec nginx-benchmark-server kill -SIGUSR2 <PID>

# 4. Generate coredump
docker exec nginx-benchmark-server kill -SIGABRT <PID>

# 5. Copy coredump
./copy-coredump.sh
```

## Analysis Methods

### Method 1: Benchmark Log Analysis

Extract memory stats from benchmark log:

```bash
# Get memory trend
grep -E "(rss:|heapUsed:|external:|arrayBuffers:)" benchmark.log | paste - - - - | awk '{
  gsub(/,/,"",$0);
  printf "RSS=%3.0fMB, heapUsed=%2.0fMB, external=%2.0fMB, arrayBuffers=%2.0fMB\n",
    $2/1024/1024, $4/1024/1024, $6/1024/1024, $8/1024/1024;
}'

# Calculate statistics
grep "rss:" benchmark.log | awk '{gsub(/,/,"",$2); print $2}' | sort -n | tail -5
```

### Method 2: String Extraction from Coredump

```bash
# Find error patterns
strings core.58 | grep -E "(Error|ENOMEM|EMFILE|leak)" | head -50

# Find memory stats captured in core
strings core.58 | grep -E "(heapTotal|heapUsed|external|arrayBuffers|rss):" | tail -20

# Count object references (e.g., temp files by UUID)
strings core.58 | grep -oE "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" | wc -l

# Find connection/socket patterns
strings core.58 | grep -E "(Socket|Stream|Pool|Agent|keepAlive)" | sort | uniq -c | sort -rn | head -20

# Find error codes
strings core.58 | grep -E "(ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EPIPE)" | head -20

# Find loaded modules
strings core.58 | grep -E "node_modules/.+\.js" | sort | uniq -c | sort -rn | head -30
```

### Method 3: LLDB Analysis (macOS)

```bash
# Load coredump
lldb -c core.58

# Commands in lldb:
(lldb) bt all                    # Backtrace all threads
(lldb) thread list               # List all threads
(lldb) memory region --all       # Show memory regions
(lldb) process status            # Process state
```

### Method 4: GDB Analysis (Linux/Docker)

```bash
# Copy coredump to container
docker cp core.58 nginx-benchmark-server:/tmp/core.58

# Analyze with GDB
docker exec -it nginx-benchmark-server gdb /usr/local/bin/node /tmp/core.58

# GDB commands:
(gdb) bt                         # Backtrace
(gdb) info threads               # List threads
(gdb) thread apply all bt        # Backtrace all threads
(gdb) info registers             # Register state
```

### Method 5: llnode (Node.js LLDB Plugin)

```bash
# Install llnode
npm install -g llnode

# Analyze V8 heap
lldb -c core.58
(lldb) plugin load /path/to/llnode.dylib
(lldb) v8 bt                     # V8-aware backtrace
(lldb) v8 findjsobjects          # Find JS objects by type
(lldb) v8 findjsinstances Array  # Find Array instances
```

## Memory Metrics Reference

| Metric         | Description                              | Normal Range                 |
| -------------- | ---------------------------------------- | ---------------------------- |
| `rss`          | Resident Set Size (total process memory) | Varies, should stabilize     |
| `heapTotal`    | V8 heap allocated                        | Grows then stabilizes        |
| `heapUsed`     | V8 heap actually used                    | Should not continuously grow |
| `external`     | Memory for C++ objects bound to JS       | Fluctuates with I/O          |
| `arrayBuffers` | Memory for ArrayBuffer/TypedArray        | Fluctuates with I/O          |

## Memory Leak Indicators

### Leak Detected:

- `heapUsed` continuously growing without returning to baseline
- `rss` continuously growing over time
- ENOMEM errors in strings output
- EMFILE (too many open files) errors
- Thousands of duplicate object references

### No Leak (Healthy):

- `heapUsed` fluctuates but returns to baseline
- `rss` stabilizes after initial growth
- `external` and `arrayBuffers` fluctuate with I/O operations
- GC running regularly (check GC stats in log)

## Example Analysis Report

```
=== Memory Analysis Report ===

Sample count: 147
Duration: 60 seconds
Operations: 9200 download/upload cycles

Memory State:
- Initial RSS: 235 MB
- Final RSS: 328 MB
- Max RSS: 360 MB
- Growth: 93 MB (40%) - NORMAL (initial allocation)

V8 Heap (heapUsed): 12-20 MB - STABLE (no leak)
External Memory: 5-85 MB - FLUCTUATING (normal for I/O)
ArrayBuffers: 0-74 MB - FLUCTUATING (normal for file ops)

Conclusion: NO MEMORY LEAK DETECTED
```

## Troubleshooting

### Coredump not generated

```bash
# Check ulimit
docker exec container ulimit -c

# Set unlimited
docker run --ulimit core=-1 --privileged ...
```

### Architecture mismatch (Rosetta)

If running on Apple Silicon with x86_64 container:

- Use `strings` extraction method
- Or run native ARM64 container: `--platform linux/arm64`

### Missing symbols in GDB/LLDB

- Use Node.js debug build
- Or rely on string extraction methods
