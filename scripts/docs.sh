#!/bin/sh

# Run TypeDoc

./node_modules/.bin/typedoc \
  --name SMCloudStore \
  --out docs/ \
  --readme README.md \
  --target ES6 \
  --module commonjs \
  --excludePrivate \
  --excludeProtected \
  --plugin typedoc-plugin-monorepo \
  --external-modulemap  ".*\/packages\/([\\w\\-_]+)\/" \
  --mode modules \
    packages/*/src
