/*eslint-env mocha */

'use strict'

const assert = require('assert')
const TestSuite = require('./lib/test-suite')

// Execute the test suite
const testSuiteOptions = {
    containerNamePrefix: 'smcloudstoregcstest',
    region: 'us-central1',
    listObjects: ['includeContentType', 'includeContentMD5', 'includeCreationTime']
}
TestSuite('google-cloud-storage', testSuiteOptions)

// Add custom, provider-specific tests
describe('Provider-specific tests for google-cloud-storage', function() {
    const Provider = require('../packages/smcloudstore-google-cloud-storage')

    it('constructor', function() {
        assert.throws(() => {
            // Empty connection
            new Provider({})
        }, /connection argument/i)
    })
})
