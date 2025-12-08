#!/bin/bash
# CPU Profile Analysis Script for cnpmcore v4.12.0
# Usage: ./run-analysis.sh <cpuprofile-file>

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_FILE="${1:-$HOME/Downloads/cnpmcore/4.12.0/registry-npmmirror-x-cpuprofile-1546418-20251208-0.cpuprofile}"

if [ ! -f "$PROFILE_FILE" ]; then
    echo "Error: Profile file not found: $PROFILE_FILE"
    echo "Usage: $0 <cpuprofile-file>"
    exit 1
fi

echo "Analyzing CPU profile: $PROFILE_FILE"
echo "Output directory: $SCRIPT_DIR"
echo ""

# Run basic analysis
echo "==> Running basic analysis..."
node "$SCRIPT_DIR/analyze-profile.js" "$PROFILE_FILE" > "$SCRIPT_DIR/basic-analysis.md"
echo "    Output: basic-analysis.md"

# Find top 30 hotspots
echo "==> Finding top 30 hotspots..."
node "$SCRIPT_DIR/hotspot-finder.js" "$PROFILE_FILE" --top=30 > "$SCRIPT_DIR/hotspots.md"
echo "    Output: hotspots.md"

# Find application code hotspots
echo "==> Finding application code hotspots..."
node "$SCRIPT_DIR/hotspot-finder.js" "$PROFILE_FILE" --filter=application --top=30 > "$SCRIPT_DIR/app-hotspots.md"
echo "    Output: app-hotspots.md"

# Find Leoric ORM hotspots
echo "==> Finding Leoric ORM hotspots..."
node "$SCRIPT_DIR/hotspot-finder.js" "$PROFILE_FILE" --filter=leoric --top=30 > "$SCRIPT_DIR/leoric-hotspots.md"
echo "    Output: leoric-hotspots.md"

# Analyze Bone constructor callers
echo "==> Analyzing Bone constructor callers..."
node "$SCRIPT_DIR/call-tree-analyzer.js" "$PROFILE_FILE" --target=Bone > "$SCRIPT_DIR/bone-callers.md"
echo "    Output: bone-callers.md"

# Analyze Tegg framework hotspots
echo "==> Finding Tegg framework hotspots..."
node "$SCRIPT_DIR/hotspot-finder.js" "$PROFILE_FILE" --filter=tegg --top=30 > "$SCRIPT_DIR/tegg-hotspots.md"
echo "    Output: tegg-hotspots.md"

# Analyze mysql2 hotspots
echo "==> Finding mysql2 driver hotspots..."
node "$SCRIPT_DIR/hotspot-finder.js" "$PROFILE_FILE" --filter=mysql2 --top=30 > "$SCRIPT_DIR/mysql2-hotspots.md"
echo "    Output: mysql2-hotspots.md"

# Generate flamegraph stacks
echo "==> Generating flamegraph stacks..."
node "$SCRIPT_DIR/flamegraph-convert.js" "$PROFILE_FILE" > "$SCRIPT_DIR/stacks.txt"
echo "    Output: stacks.txt"
echo "    To generate SVG: cat stacks.txt | flamegraph.pl > flamegraph.svg"

echo ""
echo "Analysis complete! Generated files:"
ls -la "$SCRIPT_DIR"/*.md "$SCRIPT_DIR"/stacks.txt 2>/dev/null

echo ""
echo "View the summary report: $SCRIPT_DIR/REPORT.md"
