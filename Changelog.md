# SMCloudStore Changelog

## @smcloudstore/backblaze-b2: Version 0.2.1 (2019-01-28)

**Fixes:**

- **@smcloudstore/backblaze-b2:** Updated `backblaze-b2` dependency to version 1.1.0, to leverage Backblaze B2 APIs version 2.

## @smcloudstore/google-cloud-sotrage: Version 0.2.1 (2019-01-16)

**Fixes:**

- **@smcloudstore/google-cloud-sotrage:** Updated Google Cloud Storage SDK to version 2.3

## @smcloudstore/aws-s3: Version 0.2.1 (2019-01-16)

**Fixes:**

- **@smcloudstore/aws-s3:** Updated AWS SDK

## smcloudstore: Version 0.2.1 (2019-01-16)

**Fixes:**

- **smcloudstore**: No longer throw error for the supported B2 provider (#8)

## All packages: Version 0.2.0 (2018-09-12)

**Breaking changes:**

- **All:** Method `containerExists` has been renamed to `isContainer`, for consistency with other method names.

**New features:**

- **All:** Added methods `presignedGetUrl` and `presignedPutUrl` to get pre-signed URLs for GET and PUT requests, for using with clients like web browsers.
- **All:** Headers that are parsed by the library in `options.metadata`, such as "Content-Type", are now case-insensitive.

**Fixes:**

- **All:** Fixed tests on Node.js 8.
- **All:** Updated `engines` in `package.json`, making it explicit we require 8.9.1 for all modules, and Backblaze B2 requires 10.
- **All:** Updated dependencies.

## All packages: Version 0.1.0 (2018-08-22)

First public release for SMCloudStore
