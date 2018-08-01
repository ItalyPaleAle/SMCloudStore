/*eslint-env mocha */

'use strict'

const SMCloud = require('../index')
const assert = require('assert')

describe('SMCloud', function() {

    it('SMCloud should export an object', function() {
        assert(typeof SMCloud == 'object')
        assert(typeof SMCloud.Create == 'function')
        assert(typeof SMCloud.Providers == 'function')
    })
    
})
