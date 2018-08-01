/*eslint-env mocha */

'use strict'

const assert = require('assert')
const TestSuite = require('./lib/test-suite')
const SMCloud = require('../index')
const authData = require('./data/auth')

// Execute the test suite
TestSuite('minio')

// Add custom, provider-specific tests
describe('Provider specific tests for minio', function() {
    it('constructor', function() {
        assert.throws(() => {
            // Empty connection
            SMCloud.Create('minio', {})
        }, /connection argument/i)
        
        assert.throws(() => {
            // Missing endPoint
            SMCloud.Create('minio', {
                accessKey: authData.minio.accessKey,
                secretKey: authData.minio.secretKey
            })
        }, /invalid endpoint/i)
    })
})
