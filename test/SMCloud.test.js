/*eslint-env mocha */

'use strict'

require('should')
const SMCloud = require('../index')

describe('SMCloud', function() {

    it('SMCloud should export an object', function() {
        SMCloud.should.be.type('object')
        SMCloud.Create.should.be.type('function')
        SMCloud.Providers.should.be.type('function')
    })
    
})
