/*eslint-env mocha */

'use strict'

const assert = require('assert')
const TestSuite = require('./lib/test-suite')
const SMCloud = require('../index')
const authData = require('./data/auth')

// Execute the test suite
TestSuite('azure')

// Add custom, provider-specific tests
describe('Provider specific tests for azure', function() {
})
