/*eslint-env mocha */

'use strict'

const assert = require('assert')
const SMCloudStore = require('../packages/smcloudstore')
const authData = require('./data/auth')

describe('SMCloudStore', function() {
    it('SMCloudStore should export an object', function() {
        assert(typeof SMCloudStore == 'object')
        assert(typeof SMCloudStore.Create == 'function')
        assert(typeof SMCloudStore.Providers == 'function')
    })
    
    it('SMCloudStore.Create', function() {
        // Fail on invalid/empty provider
        assert.throws(() => {
            SMCloudStore.Create()
        })
        assert.throws(() => {
            SMCloudStore.Create('invalid-provider')
        })

        // Fail on empty connection data
        assert.throws(() => {
            SMCloudStore.Create('minio', null)
        })

        // Successfully create an object
        assert(SMCloudStore.Create('minio', authData.minio))
    })

    it('SMCloudStore.Providers', function() {
        // Ensure the list is complete
        assert.deepEqual(SMCloudStore.Providers(), [
            'aws-s3',
            'azure-storage',
            'backblaze-b2',
            'generic-s3',
            'google-cloud-storage',
            'minio'
        ])
    })
})
