#!/bin/sh

node -v && npm -v \
  && npm install -g npminstall --registry=https://registry.npmmirror.com \
  && npminstall -c \
  && npm run tsc \
  && npmupdate -c --production
