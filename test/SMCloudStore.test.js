/*eslint-env mocha */

'use strict'

const SMCloudStore = require('../index')
const assert = require('assert')

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
            SMCloudStore.Create('Minio', null)
        })
    })
})
