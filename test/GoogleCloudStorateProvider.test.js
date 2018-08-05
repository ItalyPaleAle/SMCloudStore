/*eslint-env mocha */

'use strict'

const assert = require('assert')
const TestSuite = require('./lib/test-suite')
const SMCloudStore = require('../index')

// Execute the test suite
const testSuiteOptions = {
    containerNamePrefix: 'smcloudstoregcstest',
    region: 'us-central1',
    listObjects: ['includeContentType', 'includeContentMD5', 'includeCreationTime']
}
TestSuite('GoogleCloudStorage', testSuiteOptions)

// Add custom, provider-specific tests
describe('Provider-specific tests for GoogleCloudStorage', function() {
    it('constructor', function() {
        assert.throws(() => {
            // Empty connection
            SMCloudStore.Create('GoogleCloudStorage', {})
        }, /connection argument/i)
    })
})
