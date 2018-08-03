/*eslint-env mocha */

'use strict'

const TestSuite = require('./lib/test-suite')

// Execute the test suite
const testSuiteOptions = {
    listObjects: ['includeContentType', 'includeContentMD5', 'includeCreationTime']
}
TestSuite('AzureStorage', testSuiteOptions)

// Add custom, provider-specific tests
describe('Provider-specific tests for AzureStorage', function() {
})
