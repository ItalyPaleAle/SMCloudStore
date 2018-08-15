/*eslint-env mocha */

'use strict'

const TestSuite = require('./lib/test-suite')

// Execute the test suite
const testSuiteOptions = {
    containerNamePrefix: 'smcloudstoreb2test',
    createContainerOptions: {
        access: 'public'
    }
}
TestSuite('backblaze-b2', testSuiteOptions)

// Add custom, provider-specific tests
describe('Provider-specific tests for backblaze-b2', function() {
})
