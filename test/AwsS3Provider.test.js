/*eslint-env mocha */

'use strict'

const assert = require('assert')
const TestSuite = require('./lib/test-suite')

// Execute the test suite
const testSuiteOptions = {
    containerNamePrefix: 'smcloudstoreawstest',
    region: 'us-east-1'
}
TestSuite('aws-s3', testSuiteOptions)

// Add custom, provider-specific tests
describe('Provider-specific tests for aws-s3', function() {
    const Provider = require('../packages/aws-s3')

    it('constructor', function() {
        assert.throws(() => {
            // Empty connection
            new Provider({})
        }, /connection argument/i)
    })
})
