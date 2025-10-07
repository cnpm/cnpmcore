#!/bin/sh

node -v && npm -v \
  && npm install -g npminstall --registry=https://registry.npmmirror.com \
  && NODE_DEBUG=egg-bin*,egg/bin* npminstall -c --foreground-scripts \
  && npm run tsc \
  && npmupdate -c --production
