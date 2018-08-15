/*eslint-env mocha */

'use strict'

const assert = require('assert')
const fs = require('fs')
const StreamUtils = require('../packages/core/dist/StreamUtils')
const testFiles = require('./data/test-files')

describe('StreamUtils', function() {
    it('StreamUtils should export an object', function() {
        assert(typeof StreamUtils == 'object')
        assert(typeof StreamUtils.StreamToBuffer == 'function')
        assert(typeof StreamUtils.StreamToString == 'function')
        assert(typeof StreamUtils.ExtractFromBuffer == 'function')
    })

    it('StreamToBuffer should convert a stream to Buffer', function() {
        const buffer = testFiles[3].buffer
        const stream = fs.createReadStream(testFiles[3].originalPath)

        // Convert stream to buffer
        return StreamUtils.StreamToBuffer(stream)
            .then((out) => {
                assert(Buffer.isBuffer(out))
                assert(buffer.equals(out))
            })
    })

    it('StreamToString should convert a stream to string', function() {
        const buffer = testFiles[3].buffer
        const stream = fs.createReadStream(testFiles[3].originalPath)

        // Run multiple tests
        return Promise.all([
            // utf8
            Promise.resolve()
                .then(() => StreamUtils.StreamToString(stream))
                .then((out) => {
                    assert(typeof out == 'string')
                    assert(out == buffer.toString('utf8'))
                }),
            // base64
            Promise.resolve()
                .then(() => StreamUtils.StreamToString(stream, 'base64'))
                .then((out) => {
                    assert(typeof out == 'string')
                    assert(out == buffer.toString('base64'))
                })
        ])
    })

    it('ExtractFromBuffer should extract the first N bytes from a stream', function() {
        const buffer = testFiles[3].buffer
        const first100 = buffer.slice(0, 100)
        const first1000 = buffer.slice(0, 1000)

        // Run multiple tests
        return Promise.all([
            // 100 bytes
            Promise.resolve()
                .then(() => {
                    const stream = fs.createReadStream(testFiles[3].originalPath)
                    return StreamUtils.ExtractFromBuffer(stream, 100)
                })
                .then((out) => {
                    assert(Buffer.isBuffer(out))
                    assert(out.byteLength == 100)
                    assert(first100.equals(out))
                }),
            // 1000 bytes
            Promise.resolve()
                .then(() => {
                    const stream = fs.createReadStream(testFiles[3].originalPath)
                    return StreamUtils.ExtractFromBuffer(stream, 1000)
                })
                .then((out) => {
                    assert(Buffer.isBuffer(out))
                    assert(out.byteLength == 1000)
                    assert(first1000.equals(out))
                }),
            // Longer than buffer
            Promise.resolve()
                .then(() => {
                    const stream = fs.createReadStream(testFiles[3].originalPath)
                    return StreamUtils.ExtractFromBuffer(stream, buffer.byteLength + 100)
                })
                .then((out) => {
                    assert(Buffer.isBuffer(out))
                    // Should have been truncated to the size of the file
                    assert(out.byteLength == buffer.byteLength)
                    assert(buffer.equals(out))
                })
        ])
    })

    
})
