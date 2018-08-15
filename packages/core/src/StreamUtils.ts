'use strict'

import {Stream, Duplex} from 'stream'

/**
 * Returns a Buffer with data read from the stream.
 * 
 * @param stream - Readable Stream to read data from
 * @returns Promise that resolves to a Buffer containing the data from the stream
 */
export function StreamToBuffer(stream: Stream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const buffersCache = []
        stream.on('data', (data) => {
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
 * @param stream - Readable Stream to read data from
 * @param encoding - String encoding to use; defaults to utf8
 */
export function StreamToString(stream: Stream, encoding?: string): Promise<string> {
    return StreamToBuffer(stream)
        .then((buffer) => {
            return buffer.toString(encoding || 'utf8')
        })
}

/**
 * Reads a certain amount of bytes from a Stream, returning a Buffer.
 * 
 * @param stream - Readable Stream to read data from
 * @param size - Amount of data to read
 * @returns Promise that resolves to a Buffer with a length of at most `size`
 */
export function ExtractFromBuffer(stream: Stream, size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        let buffer = Buffer.alloc(size)
        let contentSize = 0

        // Callbacks on events
        const endEvent = () => {
            // If we didn't fill the buffer, truncate it
            if (contentSize < size) {
                buffer = buffer.slice(0, contentSize)
            }
            resolve(buffer)
        }
        const errorEvent = (error) => {
            reject(error)
        }
        const dataEvent = (data: string|Buffer) => {
            if (typeof data == 'string') {
                data = Buffer.from(data as string, 'utf8')
            }
            
            // Read data so to fille the Buffer at most
            const readLength = size - contentSize
            if (readLength > 0) {
                contentSize += data.copy(buffer, contentSize, 0, readLength)
                if (contentSize >= size) {
                    // Stop all listeners, then resolve
                    stream.off('data', dataEvent)
                    stream.off('end', endEvent)
                    stream.off('error', errorEvent)

                    resolve(buffer)
                }
            }
            // Should never hit this
            else {
                // Stop all listeners, then resolve
                stream.off('data', dataEvent)
                stream.off('end', endEvent)
                stream.off('error', errorEvent)

                resolve(buffer)
            }
        }

        // Add listeners
        stream.on('data', dataEvent)
        stream.on('end', endEvent)
        stream.on('error', errorEvent)
    })
}
