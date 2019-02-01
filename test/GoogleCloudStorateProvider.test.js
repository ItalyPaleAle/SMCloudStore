/*eslint-env mocha */

'use strict'

const assert = require('assert')
const TestSuite = require('./lib/test-suite')

// Execute the test suite
const testSuiteOptions = {
    containerNamePrefix: 'smcloudstoregcstest',
    createContainerOptions: {
        class: 'regional',
        region: 'us-central1',
    },
    listObjects: ['includeContentType', 'includeContentMD5', 'includeCreationTime']
}
TestSuite('google-cloud-storage', testSuiteOptions)

// Add custom, provider-specific tests
describe('Provider-specific tests for google-cloud-storage', function() {
    const Provider = require('../packages/google-cloud-storage')

    it('constructor', function() {
        // If the env vars are set, need to temporarily unset them
        let envVarBak
        if (process.env.GCLOUD_PROJECT) {
            envVarBak = process.env.GCLOUD_PROJECT
            process.env.GCLOUD_PROJECT = ''
        }

        assert.throws(() => {
            // Empty connection
            new Provider({})
        }, /connection argument/i)

        // Restore env var
        if (envVarBak) {
            process.env.GCLOUD_PROJECT = envVarBak
        }
    })
})
