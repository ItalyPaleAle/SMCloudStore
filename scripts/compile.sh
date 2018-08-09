#!/bin/sh

# Run TSC inside all packages

# Start with the base package
npx tsc -p packages/smcloudstore-core/

# Compile all packages
npx tsc -p packages/smcloudstore-generic-s3/ # Must be before aws-s3 and minio
npx tsc -p packages/smcloudstore-aws-s3/
npx tsc -p packages/smcloudstore-azure-storage/
npx tsc -p packages/smcloudstore-google-cloud-storage/
npx tsc -p packages/smcloudstore-minio/
