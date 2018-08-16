'use strict'

import {Stream, Readable} from 'stream'

/**
 * Returns a boolean indicating whether a value is a Stream 
 * 
 * @param val - Value to test
 */
export function IsStream(val: any): boolean {
    return (typeof val == 'object' && typeof val.pipe == 'function')
}

/**
 * Returns a Buffer with data read from the stream.
 * 
 * @param stream - Stream to read data from
 * @returns Promise that resolves to a Buffer containing the data from the stream
 * @async
 */
export function StreamToBuffer(stream: Stream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const buffersCache = []
        stream.on('data', (data: Buffer) => {
            buffersCache.push(data)
        })
        stream.on('end', () => {
            resolve(Buffer.concat(buffersCache))
        })
        stream.on('error', (error) => {
            reject(error)
        })
    })
}

/**
 * Returns a string with data read from the stream.
 * 
 * @param stream - Stream to read data from
 * @param encoding - String encoding to use; defaults to utf8
 * @returns Promise that resolves to a string containing the data from the stream
 * @async
 */
export function StreamToString(stream: Stream, encoding?: string): Promise<string> {
    return StreamToBuffer(stream)
        .then((buffer) => {
            return buffer.toString(encoding || 'utf8')
        })
}

/**
 * Reads a certain amount of bytes from a Stream, returning a Buffer.
 * The amount of data read might be smaller if the stream contains less data than size, and it ends.
 * 
 * @param stream - Readable Stream to read data from
 * @param size - Amount of data to read
 * @returns Promise that resolves to a Buffer with a length of at most `size`
 * @async
 */
export function ExtractFromStream(stream: Readable, size: number): Promise<Buffer> {
    // Return an error if there's no Readable Stream
    if (!stream || !IsStream(stream) || typeof stream.read !== 'function') {
        throw Error('Argument stream must be a Readable Stream')
    }

    // Ensure the stream isn't flowing
    stream.pause()

    // Test if the stream has ended, so we don't keep the method hanging forever
    // This is using a non-public API, so we can't assume it exists
    const readableState = (stream as any)._readableState
    if (readableState && readableState.ended === true) {
        throw Error('Stream has ended already')
    }

    // Returns a promise that resolves when we have read enough data from the stream.
    return new Promise((resolve, reject) => {
        // Callbacks on events
        const errorEvent = (err) => reject(err)
        const readableEvent = () => {
            // If we don't have enough data, and the stream hasn't ended, this will return null
            const data = stream.read(size)
            if (data) {
                // Put the data we read back into the stream
                stream.unshift(data)

                // Stop listening on callbacks
                stream.off('error', errorEvent)

                // Return the data
                resolve(data)   
            }
            else {
                // We need to wait longer for more data
                stream.once('readable', readableEvent)
            }
        }

        // Listen to the readable event and in case of error
        stream.once('readable', readableEvent)
        stream.on('error', errorEvent)
    })
}
