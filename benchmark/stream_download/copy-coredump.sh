#!/bin/bash

# Copy coredump and heap snapshot files from Docker container
set -e

CONTAINER_NAME="nginx-benchmark-server"
OUTPUT_DIR="$(pwd)/coredumps"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Copy Coredump and Heap Snapshots ===${NC}"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if container is running
if ! docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}Error: Container $CONTAINER_NAME not found${NC}"
    exit 1
fi

# Copy heap snapshots
echo -e "${YELLOW}Looking for heap snapshots...${NC}"
HEAP_FILES=$(docker exec "$CONTAINER_NAME" bash -c "find /root/workspace -name '*.heapsnapshot' 2>/dev/null" || true)
if [ -n "$HEAP_FILES" ]; then
    echo "$HEAP_FILES" | while read -r file; do
        if [ -n "$file" ]; then
            FILENAME=$(basename "$file")
            docker cp "$CONTAINER_NAME:$file" "$OUTPUT_DIR/$FILENAME"
            echo -e "${GREEN}Copied heap snapshot: $FILENAME${NC}"
        fi
    done
else
    echo "No heap snapshots found"
fi

# Copy core dumps from /tmp
echo -e "${YELLOW}Looking for core dumps in /tmp...${NC}"
CORE_FILES=$(docker exec "$CONTAINER_NAME" bash -c "find /tmp -name 'core*' -type f 2>/dev/null" || true)
if [ -n "$CORE_FILES" ]; then
    echo "$CORE_FILES" | while read -r file; do
        if [ -n "$file" ]; then
            FILENAME=$(basename "$file")
            echo -e "${GREEN}Found core dump: $file${NC}"
            docker cp "$CONTAINER_NAME:$file" "$OUTPUT_DIR/$FILENAME"
            echo -e "${GREEN}Copied: $FILENAME${NC}"
        fi
    done
else
    echo "No core dumps found in /tmp"
fi

# Copy core dumps from /tmp/cores
echo -e "${YELLOW}Looking for core dumps in /tmp/cores...${NC}"
CORE_FILES=$(docker exec "$CONTAINER_NAME" bash -c "find /tmp/cores -name 'core*' -type f 2>/dev/null" || true)
if [ -n "$CORE_FILES" ]; then
    echo "$CORE_FILES" | while read -r file; do
        if [ -n "$file" ]; then
            FILENAME=$(basename "$file")
            echo -e "${GREEN}Found core dump: $file${NC}"
            docker cp "$CONTAINER_NAME:$file" "$OUTPUT_DIR/$FILENAME"
            echo -e "${GREEN}Copied: $FILENAME${NC}"
        fi
    done
else
    echo "No core dumps found in /tmp/cores"
fi

# Copy core dumps from workspace
echo -e "${YELLOW}Looking for core dumps in /root/workspace...${NC}"
CORE_FILES=$(docker exec "$CONTAINER_NAME" bash -c "find /root/workspace -name 'core*' -type f 2>/dev/null" || true)
if [ -n "$CORE_FILES" ]; then
    echo "$CORE_FILES" | while read -r file; do
        if [ -n "$file" ]; then
            FILENAME=$(basename "$file")
            echo -e "${GREEN}Found core dump: $file${NC}"
            docker cp "$CONTAINER_NAME:$file" "$OUTPUT_DIR/$FILENAME"
            echo -e "${GREEN}Copied: $FILENAME${NC}"
        fi
    done
else
    echo "No core dumps found in /root/workspace"
fi

# Copy benchmark log if exists
if docker exec "$CONTAINER_NAME" test -f /tmp/benchmark.log 2>/dev/null; then
    docker cp "$CONTAINER_NAME:/tmp/benchmark.log" "$OUTPUT_DIR/benchmark.log"
    echo -e "${GREEN}Copied benchmark.log${NC}"
fi

echo ""
echo -e "${GREEN}=== Copy Complete ===${NC}"
echo "Output files are in: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR" 2>/dev/null || echo "No files copied"

echo ""
echo -e "${YELLOW}To analyze heap snapshot:${NC}"
echo "  1. Open Chrome DevTools -> Memory tab"
echo "  2. Click 'Load' and select the .heapsnapshot file"
echo ""
echo -e "${YELLOW}To analyze core dump with gdb:${NC}"
echo "  docker exec -it $CONTAINER_NAME gdb /usr/local/bin/node /tmp/core.*"
