#!/bin/sh

# Run TSC inside all packages

# Start with the base package
./node_modules/.bin/tsc --sourceMap -p packages/core/

# Compile all packages
./node_modules/.bin/tsc --sourceMap -p packages/generic-s3/ # Must be before minio
./node_modules/.bin/tsc --sourceMap -p packages/aws-s3/
./node_modules/.bin/tsc --sourceMap -p packages/azure-storage/
./node_modules/.bin/tsc --sourceMap -p packages/backblaze-b2/
./node_modules/.bin/tsc --sourceMap -p packages/google-cloud-storage/
./node_modules/.bin/tsc --sourceMap -p packages/minio/

# Compile the smcloudstore package
./node_modules/.bin/tsc --sourceMap -p packages/smcloudstore/
