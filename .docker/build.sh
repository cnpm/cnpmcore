#!/bin/sh

npm install -g npminstall --registry=https://registry.npmmirror.com \
  && npminstall -c \
  && npm run tsc \
  && npmupdate -c --production
