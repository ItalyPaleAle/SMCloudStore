#!/bin/sh

# Run TSC inside all packages

# Start with the base package
npx tsc -p packages/core/

# Compile all packages
npx tsc -p packages/generic-s3/ # Must be before aws-s3 and minio
npx tsc -p packages/aws-s3/
npx tsc -p packages/azure-storage/
npx tsc -p packages/google-cloud-storage/
npx tsc -p packages/minio/

# Compile the smcloudstore package
npx tsc -p packages/smcloudstore/
