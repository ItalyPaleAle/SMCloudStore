/*eslint-env mocha */

'use strict'

// The Backblaze B2 provider requires Node.js 10 or higher
const semver = require('semver')
if (semver.gte(process.version, '10.0.0')) {
    const TestSuite = require('./lib/test-suite')
    const B2Upload = require('../packages/backblaze-b2/dist/B2Upload')

    // Execute the test suite
    const testSuiteOptions = {
        containerNamePrefix: 'smcloudstoreb2test',
        createContainerOptions: {
            access: 'public'
        },
        listObjects: ['includeContentType'],
        testLargeFiles: true,
        beforeTests: () => {
            // Before all tests, set the chunkSize to 5MB, so we can use smaller files during test
            B2Upload.chunkSize = 5 * 1024 * 1024
        },
        skipPresignedUrlTests: true
    }
    TestSuite('backblaze-b2', testSuiteOptions)

    // Add custom, provider-specific tests
    describe('Provider-specific tests for backblaze-b2', function() {
    })
}
else {
    // eslint-disable-next-line no-console
    console.log('INFO: Node.js 10 is required for Backblaze B2 provider; skipping tests')
}
