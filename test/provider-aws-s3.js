/*eslint-env mocha */

'use strict'

const assert = require('assert')
const TestSuite = require('./lib/test-suite')
const SMCloudStore = require('../index')

// Execute the test suite
const testSuiteOptions = {
    containerNamePrefix: 'smcloudstoreawstest',
    region: 'us-east-1'
}
TestSuite('aws-s3', testSuiteOptions)

// Add custom, provider-specific tests
describe('Provider specific tests for aws-s3', function() {
    it('constructor', function() {
        assert.throws(() => {
            // Empty connection
            SMCloudStore.Create('aws-s3', {})
        }, /connection argument/i)
    })
})
