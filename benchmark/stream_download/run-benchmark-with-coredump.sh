#!/bin/bash

# Run benchmark for 60 seconds and generate coredump + heap dump for memory analysis
set -e

CONTAINER_NAME="nginx-benchmark-server"
BENCHMARK_DURATION=${1:-60}  # Default 60 seconds
OUTPUT_DIR="$(pwd)/coredumps"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Run Benchmark with Coredump ===${NC}"
echo "Duration: ${BENCHMARK_DURATION} seconds"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Cleanup old files
echo -e "${YELLOW}Cleaning up old core files and heap snapshots...${NC}"
rm -f "$OUTPUT_DIR"/core.* "$OUTPUT_DIR"/*.heapsnapshot "$OUTPUT_DIR"/benchmark.log 2>/dev/null || true
echo "Local cleanup done"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}Error: Container $CONTAINER_NAME is not running${NC}"
    echo "Please run ./start-docker.sh first"
    exit 1
fi

# Cleanup old files in container
echo -e "${YELLOW}Cleaning up old files in container...${NC}"
docker exec "$CONTAINER_NAME" bash -c "rm -f /tmp/core.* /tmp/benchmark.log /tmp/benchmark.pid /root/workspace/*.heapsnapshot /root/workspace/tmp/*.txt 2>/dev/null || true"
echo "Container cleanup done"

# Enable core dumps in the container
echo -e "${YELLOW}Enabling core dumps in container...${NC}"
docker exec "$CONTAINER_NAME" bash -c "ulimit -c unlimited && echo '/tmp/core.%p' > /proc/sys/kernel/core_pattern 2>/dev/null || true"

# Start the benchmark with --expose-gc and --heapsnapshot-signal flags
echo -e "${GREEN}Starting benchmark...${NC}"
docker exec -d "$CONTAINER_NAME" bash -c "cd /root/workspace && ulimit -c unlimited && exec node --expose-gc --heapsnapshot-signal=SIGUSR2 benchmark.js http://127.0.0.1 > /tmp/benchmark.log 2>&1"

# Wait for process to start
sleep 2

# Get the PID using pgrep to find the actual node process running benchmark.js
BENCHMARK_PID=$(docker exec "$CONTAINER_NAME" pgrep -f "node.*benchmark.js" 2>/dev/null | head -1 || echo "")
if [ -z "$BENCHMARK_PID" ]; then
    echo -e "${RED}Error: Failed to get benchmark PID${NC}"
    echo "Checking running processes..."
    docker exec "$CONTAINER_NAME" ps aux | grep -E "(node|benchmark)" || true
    exit 1
fi
# Save PID for other scripts to use
docker exec "$CONTAINER_NAME" bash -c "echo $BENCHMARK_PID > /tmp/benchmark.pid"
echo -e "${GREEN}Benchmark started with PID: $BENCHMARK_PID${NC}"

# Monitor memory usage while running
echo -e "${YELLOW}Running benchmark for $BENCHMARK_DURATION seconds...${NC}"
ELAPSED=0
while [ $ELAPSED -lt $BENCHMARK_DURATION ]; do
    sleep 10
    ELAPSED=$((ELAPSED + 10))
    echo -e "${GREEN}[$ELAPSED/$BENCHMARK_DURATION seconds]${NC} Checking memory..."
    docker exec "$CONTAINER_NAME" bash -c "ps -o pid,rss,vsz,comm -p $BENCHMARK_PID 2>/dev/null || echo 'Process info not available'"

    # Show last few lines of benchmark log
    docker exec "$CONTAINER_NAME" tail -5 /tmp/benchmark.log 2>/dev/null || true
done

echo -e "${YELLOW}Benchmark duration complete. Generating heap snapshot...${NC}"

# Generate heap snapshot by sending SIGUSR2
docker exec "$CONTAINER_NAME" kill -SIGUSR2 $BENCHMARK_PID 2>/dev/null || true
sleep 3

# Copy any heap snapshots generated
echo -e "${YELLOW}Copying heap snapshots...${NC}"
docker exec "$CONTAINER_NAME" bash -c "find /root/workspace -name 'Heap.*.heapsnapshot' -o -name '*.heapsnapshot'" 2>/dev/null | while read -r file; do
    if [ -n "$file" ]; then
        FILENAME=$(basename "$file")
        docker cp "$CONTAINER_NAME:$file" "$OUTPUT_DIR/$FILENAME"
        echo -e "${GREEN}Copied heap snapshot: $FILENAME${NC}"
    fi
done

# Generate coredump by sending SIGABRT
echo -e "${YELLOW}Generating coredump (SIGABRT)...${NC}"
docker exec "$CONTAINER_NAME" kill -SIGABRT $BENCHMARK_PID 2>/dev/null || true
sleep 2

# Copy benchmark log
echo -e "${YELLOW}Copying benchmark log...${NC}"
docker cp "$CONTAINER_NAME:/tmp/benchmark.log" "$OUTPUT_DIR/benchmark.log" 2>/dev/null || true

# Try to find and copy core dump files
echo -e "${YELLOW}Looking for core dumps...${NC}"
docker exec "$CONTAINER_NAME" bash -c "find /tmp -name 'core*' -type f 2>/dev/null" | while read -r corefile; do
    if [ -n "$corefile" ]; then
        FILENAME=$(basename "$corefile")
        echo -e "${GREEN}Found core dump: $corefile${NC}"
        docker cp "$CONTAINER_NAME:$corefile" "$OUTPUT_DIR/$FILENAME"
        echo -e "${GREEN}Copied: $FILENAME${NC}"
    fi
done

# Also check for core files in workspace
docker exec "$CONTAINER_NAME" bash -c "find /root/workspace -name 'core*' -type f 2>/dev/null" | while read -r corefile; do
    if [ -n "$corefile" ]; then
        FILENAME=$(basename "$corefile")
        echo -e "${GREEN}Found core dump: $corefile${NC}"
        docker cp "$CONTAINER_NAME:$corefile" "$OUTPUT_DIR/$FILENAME"
        echo -e "${GREEN}Copied: $FILENAME${NC}"
    fi
done

echo ""
echo -e "${GREEN}=== Benchmark Complete ===${NC}"
echo "Output files are in: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"

echo ""
echo -e "${YELLOW}To analyze heap snapshot:${NC}"
echo "  1. Open Chrome DevTools -> Memory tab"
echo "  2. Click 'Load' and select the .heapsnapshot file"
echo ""
echo -e "${YELLOW}To analyze core dump:${NC}"
echo "  lldb -c $OUTPUT_DIR/core.* -- \$(which node)"
