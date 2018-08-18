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
        assert(typeof StreamUtils.ReadChunkFromStream == 'function')
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

    it('ReadChunkFromStream should extract the first N bytes from a stream', function() {
        const buffer = testFiles[3].buffer

        // Test with a stream that will be used more than once, to ensure that data is put back in the stream
        const reusableStream = fs.createReadStream(testFiles[3].originalPath)

        // Function that tests for output
        const testOutput = (size) => {
            return (out) => {
                assert(Buffer.isBuffer(out))
                assert(out.byteLength == size)
                assert(out.equals(buffer.slice(0, size)))
            }
        }

        // Run multiple tests
        return Promise.all([
            // 100 bytes
            Promise.resolve()
                .then(() => {
                    const stream = fs.createReadStream(testFiles[3].originalPath)
                    return StreamUtils.ReadChunkFromStream(stream, 100)
                })
                .then(testOutput(100)),
            // 1000 bytes
            Promise.resolve()
                .then(() => {
                    const stream = fs.createReadStream(testFiles[3].originalPath)
                    return StreamUtils.ReadChunkFromStream(stream, 1000)
                })
                .then(testOutput(1000)),
            // Longer than buffer
            Promise.resolve()
                .then(() => {
                    const stream = fs.createReadStream(testFiles[3].originalPath)
                    return StreamUtils.ReadChunkFromStream(stream, buffer.byteLength + 100)
                })
                .then(testOutput(buffer.byteLength)),
            // Peeking stream - part 1
            Promise.resolve()
                .then(() => StreamUtils.ReadChunkFromStream(reusableStream, 100, true))
                .then(testOutput(100)),
            // Peeking stream - part 2
            Promise.resolve()
                .then(() => StreamUtils.ReadChunkFromStream(reusableStream, 200, true))
                .then(testOutput(200)),
            // Peeking stream - part 3
            Promise.resolve()
                .then(() => StreamUtils.ReadChunkFromStream(reusableStream, buffer.byteLength + 100, true))
                .then(testOutput(buffer.byteLength)),
            // Peeking stream - part 4
            Promise.resolve()
                .then(() => StreamUtils.ReadChunkFromStream(reusableStream, buffer.byteLength + 100, true))
                .then(testOutput(buffer.byteLength))
        ])
    })

    
})
