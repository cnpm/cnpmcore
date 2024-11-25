#!/bin/bash

pnpm i
socat TCP4-LISTEN:8080,reuseaddr,fork TCP:adminer:8080 &
