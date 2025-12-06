#!/bin/bash

# start dev server and enable sync mode

CNPMCORE_CONFIG_SYNC_MODE=all npm run dev &

# sync debug package first
# cnpm sync debug --registry=http://localhost:7001

echo ""
echo "## JSON.parse"

sleep 10

# full manifest
echo ""
echo "### full manifest"
npx autocannon -H "Accept: application/json" http://localhost:7001/debug

echo ""

# abbreviated manifest
echo ""
echo "### abbreviated manifest"
npx autocannon -H "Accept: application/vnd.npm.install-v1+json" http://localhost:7001/debug

echo ""

kill $(pgrep -f "npm run dev") || true

sleep 5

echo ""
echo "## JSONBuilder"

CNPMCORE_CONFIG_ENABLE_JSON_BUILDER=true npm run dev &

sleep 10

echo ""
echo "### full manifest"
npx autocannon -H "Accept: application/json" http://localhost:7001/debug

echo ""

# abbreviated manifest
echo ""
echo "### abbreviated manifest"
npx autocannon -H "Accept: application/vnd.npm.install-v1+json" http://localhost:7001/debug

echo ""

kill $(pgrep -f "npm run dev")
