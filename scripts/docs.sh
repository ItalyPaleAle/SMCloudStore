#!/bin/sh

# Run TypeDoc

#  --excludePrivate \
#  --excludeProtected \

./node_modules/.bin/typedoc \
  --name SMCloudStore \
  --out docs/ \
  --readme README.md \
  --target ES6 \
  --module commonjs \
  --plugin typedoc-plugin-monorepo \
  --external-modulemap  ".*\/packages\/([\\w\\-_]+)\/" \
  --mode modules \
    packages/*/src

# Fix for GitHub pages
touch docs/.nojekyll
