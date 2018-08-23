/*eslint-env mocha */

'use strict'

const assert = require('assert')
const TestSuite = require('./lib/test-suite')
const authData = require('./data/auth')

// Execute the test suite
const testSuiteOptions = {
    containerNamePrefix: 'smcloudstoregenerics3test'
}
TestSuite('generic-s3', testSuiteOptions)

// Add custom, provider-specific tests
describe('Provider-specific tests for generic-s3', function() {
    const Provider = require('../packages/generic-s3')

    it('constructor', function() {
        assert.throws(() => {
            // Empty connection
            new Provider({})
        }, /connection argument/i)
        
        assert.throws(() => {
            // Missing endPoint
            new Provider({
                accessKey: authData['generic-s3'].accessKey,
                secretKey: authData['generic-s3'].secretKey
            })
        }, /invalid endpoint/i)
    })
})
