/*eslint-env mocha */

'use strict'

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
    }
}
TestSuite('backblaze-b2', testSuiteOptions)

// Add custom, provider-specific tests
describe('Provider-specific tests for backblaze-b2', function() {
})
