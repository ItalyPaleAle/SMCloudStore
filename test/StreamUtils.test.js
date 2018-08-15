/*eslint-env mocha */

'use strict'

const assert = require('assert')
const StreamUtils = require('../packages/core/dist/StreamUtils')

describe('StreamUtils', function() {
    it('StreamUtils should export an object', function() {
        assert(typeof StreamUtils == 'object')
        assert(typeof StreamUtils.StreamToBuffer == 'function')
        assert(typeof StreamUtils.ExtractFromBuffer == 'function')
    })
})
