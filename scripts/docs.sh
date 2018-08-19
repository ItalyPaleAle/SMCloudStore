#!/bin/sh

# Run TypeDoc

./node_modules/.bin/typedoc \
  --name SMCloudStore \
  --out docs/ \
  --readme README.md \
  --target ES6 \
  --module commonjs \
  --mode file \
    packages/core/src \
    packages/smcloudstore/src
