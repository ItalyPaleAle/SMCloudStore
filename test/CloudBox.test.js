/*eslint-env mocha */

'use strict'

const CloudBox = require('../index')
const assert = require('assert')

describe('CloudBox', function() {

    it('CloudBox should export an object', function() {
        assert(typeof CloudBox == 'object')
        assert(typeof CloudBox.Create == 'function')
        assert(typeof CloudBox.Providers == 'function')
    })
    
})
