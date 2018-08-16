'use strict'

import {ExtractFromBuffer, IsStream} from '@smcloudstore/core/dist/StreamUtils'
import {Stream, Duplex} from 'stream'
import {WaitPromise} from '@smcloudstore/core/dist/Utils'

/**
 * Manages the upload of objects to Backblaze B2
 */
class B2Upload {
    /** Size of each chunk that is uploaded when using B2's large file APIs, in bytes. Minimum value is 5MB; default is 20 MB. */
    static ChunkSize = 20 * 1024 * 1024

    /** Backblaze recommends retrying all uploads at least two times (up to five) in case of errors, with an incrementing delay. We're retrying all uploads 3 times by default. */
    static Retries = 3

    /** Instance of the B2 client library */
    protected client: any

    /** Id of the target bucket */
    protected bucketId: string

    /** Path where to store the object, inside the container */
    protected path: string

    /** Data to upload */
    protected data: Stream|string|Buffer

    /** Metadata for the object */
    protected metadata: any

    /** Length (in bytes) of the input data */
    protected length: number

    /**
     * Initializes a new B2Upload class
     * 
     * @param client - Instance of the B2 client library
     * @param bucketId - Id of the target bucket
     * @param path - Path where to store the object, inside the container
     * @param data - Data to upload
     * @param metadata - Metadata for the object
     * @param length - Length (in bytes) of the input data
     */
    constructor(client: any, bucketId: string, path: string, data: Stream|string|Buffer, metadata?: any, length?: number) {
        // Store all arguments as properties
        this.client = client
        this.bucketId = bucketId
        this.path = path
        this.data = data
        this.metadata = metadata || {}
        this.length = length || 0
    }

    /**
     * Start the upload of the object
     * 
     * @returns Promise that resolves when the object has been uploaded
     * @async
     */
    start(): Promise<void> {
        // Check if we have a string or a Buffer, and proceed straight to the upload phase
        // Max size for this method is 5GB
        if (typeof this.data == 'string' || (typeof this.data == 'object' && Buffer.isBuffer(this.data))) {
            // Convert strings to Buffers
            if (typeof this.data == 'string') {
                this.data = Buffer.from(this.data as string, 'utf8')
            }

            // Ensure length (in bytes) is less than 5GB
            // TODO: IN THIS SCENARIO WE SHOULD USE LARGE FILES API
            if (this.data.byteLength > 5 * 1024 * 1024 * 1024) {
                throw Error('Maximum size for strings and Buffers is 5 GB')
            }

            // Upload the file, returning the Promise
            return this.putFile()
        }

        // At this point, we should only have streams
        if (IsStream(this.data)) {
            throw Error('putObject requires a Stream, a Buffer or a string')
        }

        // First, ensure that chunkSize is at least 5MB
        if (B2Upload.ChunkSize < 5 * 1024 * 1024) {
            throw Error('chunkSize must be at least 5MB')
        }

        /*// Get the Stream into two Duplex streams to copy it
        // One of the two will be destroyed
        const streamCopy = [new Duplex(), new Duplex()]
        ;(this.data as Stream).pipe(streamCopy[0])
        ;(this.data as Stream).pipe(streamCopy[1])

        // Load the first chunk into a Buffer (note this returns a Promise)
        return ExtractFromBuffer(streamCopy[0], B2Upload.ChunkSize)
            .then((firstChunk) => {
                // Destroy streamCopy
                // TODO: THIS IS NODE 8+
                streamCopy[0].destroy()

                // If we don't have a length argument specified, get the length for the first chunk
                if (!length) {
                    if (!firstChunk || !firstChunk.byteLength) {
                        throw Error('First chunk read from the stream has zero length')
                    }

                    length = firstChunk.byteLength
                }

                // Check if the length is not longer than chunkSize: if it is, just upload the Buffer as a single file
                // While B2 large file APIs support files that are at least 5 MB + 1 byte, we are splitting the data into chunkSize chunks, so there's no point in using the more complex API in case it's smaller
                if (length <= B2Upload.ChunkSize) {
                    return this._uploadFile(bucketId, path, firstChunk, metadata)
                }
                else {
                    // If we're still here, then we need to upload the file using the large file APIs
                    return this._uploadLargeFile(bucketId, path, streamCopy[1], metadata)
                }
            })*/
    }

    /**
     * Uploads a single file, when data is a Buffer or string up to 5GB.
     * 
     * @returns Promise that resolves when the object has been uploaded
     * @async
     */
    private putFile(): Promise<any> {
        // Counter for re-trying uploads if there's an error
        let retryCounter = 0

        // First, get the upload url and upload authorization token
        return this.client.getUploadUrl(this.bucketId)
            // Then upload the file
            .then((response) => {
                if (!response || !response.data || !response.data.authorizationToken || !response.data.uploadUrl) {
                    throw Error('Invalid response when requesting the upload url and upload authorization token')
                }

                // Request args
                const requestArgs = {
                    uploadUrl: response.data.uploadUrl,
                    uploadAuthToken: response.data.authorizationToken,
                    filename: this.path,
                    data: this.data,
                    info: {} as any,
                    mime: 'application/octet-stream'
                }

                // Metadata
                if (this.metadata) {
                    // Add custom headers
                    // Maximum 10 headers, and they can only contain [A-Za-z0-9]
                    // If headers don't start with 'X-Bz-Info-', the prefix will be added
                    let i = 0
                    for (const key in this.metadata) {
                        if (!this.metadata.hasOwnProperty(key)) {
                            continue
                        }

                        // Content-Type header has a special treatment
                        if (key == 'Content-Type') {
                            requestArgs.mime = this.metadata['Content-Type']
                        }
                        else {
                            // We can't have more than 10 headers
                            if (i == 10) {
                                throw Error('Cannot send more than 10 custom headers')
                            }

                            // Ensure the key is valid
                            if (!key.match('^[A-Za-z0-9\-]+$')) {
                                throw Error('Invalid header format: must be A-Za-z0-9')
                            }

                            // Check if the prefix is there already
                            if (key.substr(0, 10) != 'X-Bz-Info-') {
                                requestArgs.info['X-Bz-Info-' + key] = this.metadata[key]
                            }
                            else {
                                requestArgs.info[key] = this.metadata[key]
                            }

                            // Increment the counter
                            i++
                        }
                    }
                }

                // Send the request
                return this.client.uploadFile(requestArgs)
            })
            .catch((err) => {
                // TODO: REMOVE THIS
                console.error('Upload failed with error ', err)
                if (retryCounter < B2Upload.Retries) {
                    retryCounter++
                    // Before retrying, wait for an increasing delay
                    return WaitPromise((retryCounter + 1) * 500)
                        .then(() => this.putFile())
                }
                else {
                    // Let the error bubble up
                    throw err
                }
            })
    }
    
    /*
    private _uploadLargeFile(bucketId: string, path: string, stream: Stream, metadata?: any): Promise<any> {
        if (!IsStream(stream)) {
            throw Error('Argument stream must be a Readable Stream')
        }
        return Promise.resolve()
            // First step: request the fileId
            // TODO: METADATA
            .then(() => this._client.startLargeFile({bucketId: bucketId, fileName: path}))
            .then((response) => {
                if (!response || !response.data || !response.data.fileId) {
                    throw Error('Invalid response when requesting the file id')
                }

                const fileId = response.data.fileId as string

                // Read from stream into chunks of chunkSize
                const buffer = Buffer.alloc(this.chunkSize)
                const bufferDataSize = 0
                stream.on('data', (data: string|Buffer) => {
                    if (typeof data == 'string') {
                        data = Buffer.from(data as string, 'utf8')
                    }

                    const length = data.byteLength
                })
            })
    }

    private _uploadPart(fileId: string, partNumber: number, data: Buffer): Promise<any> {
        // Backblaze recommends retrying at least two times (up to five) in case of errors, with an incrementing delay. We're retrying all uploads 3 times
        let retryCounter = 0

        // First, get the upload part url and upload authorization token
        return this._client.getUploadPartUrl({fileId: fileId})
            .then((response) => {
                if (!response || !response.data || !response.data.authorizationToken || !response.data.uploadUrl) {
                    throw Error('Invalid response when requesting the upload part url and upload authorization token')
                }

                // Upload the part
                return this._client.uploadPart({
                    partNumber: partNumber,
                    uploadUrl: response.data.uploadUrl,
                    uploadAuthToken: response.data.authorizationToken,
                    data: data
                })
            })
            .catch((err) => {
                // TODO: REMOVE THIS
                console.error('Upload failed with error ', err)
                if (retryCounter < 3) {
                    retryCounter++
                    // Before retrying, wait for an increasing delay
                    return waitPromise((retryCounter + 1) * 500)
                        .then(() => this._uploadPart(fileId, partNumber, data))
                }
                else {
                    // Let the error bubble up
                    throw err
                }
            })
    }
    */
}

export = B2Upload