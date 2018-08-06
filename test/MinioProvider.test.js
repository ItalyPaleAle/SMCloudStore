/*eslint-env mocha */

'use strict'

const assert = require('assert')
const TestSuite = require('./lib/test-suite')
const SMCloudStore = require('../dist/index')
const authData = require('./data/auth')

// Execute the test suite
TestSuite('Minio')

// Add custom, provider-specific tests
describe('Provider-specific tests for Minio', function() {
    it('constructor', function() {
        assert.throws(() => {
            // Empty connection
            SMCloudStore.Create('Minio', {})
        }, /connection argument/i)
        
        assert.throws(() => {
            // Missing endPoint
            SMCloudStore.Create('Minio', {
                accessKey: authData.Minio.accessKey,
                secretKey: authData.Minio.secretKey
            })
        }, /invalid endpoint/i)
    })
})
