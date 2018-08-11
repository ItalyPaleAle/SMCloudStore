/*eslint-env mocha */

'use strict'

const assert = require('assert')
const TestSuite = require('./lib/test-suite')
const authData = require('./data/auth')

// Execute the test suite
TestSuite('minio')

// Add custom, provider-specific tests
describe('Provider-specific tests for minio', function() {
    const Provider = require('../packages/minio')

    it('constructor', function() {
        assert.throws(() => {
            // Empty connection
            new Provider({})
        }, /connection argument/i)
        
        assert.throws(() => {
            // Missing endPoint
            new Provider({
                accessKey: authData.minio.accessKey,
                secretKey: authData.minio.secretKey
            })
        }, /invalid endpoint/i)
    })
})
