# SMCloudStore Changelog

## All packages: Version 0.2.0 (2018-09-12)

**Breaking changes:**

- **All:** Method `containerExists` has been renamed to `isContainer`, for consistency with other method names.

**New features:**

- **All:** Added methods `presignedGetUrl` and `presignedPutUrl` to get pre-signed URLs for GET and PUT requests, for using with clients like web browsers.
- **All:** Headers that are parsed by the library in `options.metadata`, such as "Content-Type", are now case-insensitive.

**Fixes:**

- **All:** Updated dependencies.

## All packages: Version 0.1.0 (2018-08-22)

First public release for SMCloudStore
