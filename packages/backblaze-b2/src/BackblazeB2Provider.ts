'use strict'

import {ListItemObject, ListItemPrefix, ListResults, StorageProvider} from '@smcloudstore/core/dist/StorageProvider'
import {Stream} from 'stream'
const B2 = require('backblaze-b2') as any


/**
 * Connection options for a Backblaze B2 provider.
 */
interface BackblazeB2ConnectionOptions {
    /** Account Id */
    accountId: string
    /** Application key (secret key) */
    applicationKey: string
}

/**
 * Options passed when creating a container
 */
interface BackblazeB2CreateContainerOptions {
    /** Determine access level for all files in the container. Defaults to 'private' if not specified */
    access?: 'public' | 'private'
}

/**
 * Returns a Promise that resolves after a certain amlount of time (in ms)
 * 
 * @param delay - ms to wait
 * @returns Promise that resolves after the delay
 * @async
 */
function waitPromise(delay: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, delay)
    })
}

/**
 * Client to interact with Backblaze B2 cloud storage.
 */
class BackblazeB2Provider extends StorageProvider {
    protected _client: any
    private _isAuthorized: boolean

    /**
     * Initializes a new client to interact with Backblaze B2.
     * 
     * @param connection - Dictionary with connection options.
     */
    constructor(connection: BackblazeB2ConnectionOptions) {
        if (!connection || !Object.keys(connection).length) {
            throw new Error('Connection argument is empty')
        }

        super(connection)

        // Authorization for B2 is asynchronous, so will be executed on the first async call
        this._isAuthorized = false

        // Provider name
        this._provider = 'backblaze-b2'

        // The B2 library will validate the connection object
        this._client = new B2(connection)
    }

    /**
     * Create a container ("bucket") on the server.
     * 
     * @param container - Name of the container
     * @param options - Dictionary with options for creating the container, including the access level
     * @returns Promise that resolves once the container has been created. The promise doesn't contain any meaningful return value.
     * @async
     */
    createContainer(container: string, options?: BackblazeB2CreateContainerOptions): Promise<void> {
        const access = (options && options.access && options.access == 'public')
            ? 'allPublic'
            : 'allPrivate'
        
        // Ensure we are authorized, then perform the request
        return this._ensureAuthorized()
            .then(() => this._client.createBucket(container, access))
    }

    /**
     * Check if a container exists.
     * 
     * @param container - Name of the container
     * @returns Promises that resolves with a boolean indicating if the container exists.
     * @async
     */
    containerExists(container: string): Promise<boolean> {
        // There's no method in the B2 APIs to get a single bucket, so list all buckets and look for the one we're interested in
        return this.listContainers()
            .then((list) => {
                return list.indexOf(container) >= 0
            })
    }

    /**
     * Create a container ("bucket") on the server if it doesn't already exist.
     * 
     * @param container - Name of the container
     * @param options - Dictionary with options for creating the container, including the access level
     * @returns Promise that resolves once the container has been created
     * @async
     */
    ensureContainer(container: string, options?: BackblazeB2CreateContainerOptions): Promise<void> {
        return this.containerExists(container).then((exists) => {
            if (!exists) {
                return this.createContainer(container)
            }
        })
    }

    /**
     * Lists all containers belonging to the user
     * 
     * @returns Promise that resolves with an array of all the containers
     * @async
     */
    listContainers(): Promise<string[]> {
        // Ensure we are authorized, then perform the request
        return this._ensureAuthorized()
            .then(() => this._client.listBuckets())
            .then((response) => {
                if (!response || !response.data || !response.data.buckets || !Array.isArray(response.data.buckets)) {
                    return []
                }

                // Return only the bucketName element from the array of objects
                return response.data.buckets.map((el) => (el && el.bucketName) || undefined)
            })
    }

    /**
     * Removes a contaienr from the server
     * 
     * @param container - Name of the container
     * @returns Promise that resolves once the container has been removed
     * @async
     */
    deleteContainer(container: string): Promise<void> {
        // Request the bucketId for the container
        return this._getBucketId(container)
            .then((bucketId) => {
                if (!bucketId) {
                    throw Error('Container not found: ' + container)
                }

                return this._client.deleteBucket(bucketId)
            })
            .then(() => {
                // Return void
                return
            })
    }

    /**
     * Uploads a stream to the object storage server.
     * 
     * The Backblaze B2 APIs have relatively poor support for streams, as it requires the size of the data to be sent at the beginning of the request. As a consequence, this method will upload the file using a different API based on the input data:
     * 
     * 1. If the length of the data can be known before the upload starts, makes a single upload call. This applies to all situations when `data` is a Buffer or a string, and when `data` is a stream and either the `length` argument is specified, or `data.byteLength` is defined.
     * 2. In the situation when `data` is a stream and the length can't be known beforehand, if the data is longer than 5MB the method will use B2's [large files APIs](https://www.backblaze.com/b2/docs/large_files.html). With those, it's possible to chunk the file into many chunks and upload them separately, thus it's not necessary to load the entire strema in memory. However, this way of uploading files requires many more network calls, and could be significantly slower. These APIs are used also when the length is known in advance, but it's bigger than 5GB. Maximum size is 200GB (using 20MB chunks).
     * 
     * @param container - Name of the container
     * @param path - Path where to store the object, inside the container
     * @param data - Object data or stream. Can be a Stream (Readable Stream), Buffer or string.
     * @param metadata - Key-value pair with metadata for the object, for example `Content-Type` or custom tags
     * @param length - When passing a stream as data object, being able to specify the length of the data allows for faster uploads
     * @returns Promise that resolves once the object has been uploaded
     * @async
     */
    putObject(container: string, path: string, data: Stream|string|Buffer, metadata?: any, length?: number): Promise<void> {
        // First step: get the bucketId for the container
        const promise = this._getBucketId(container)

    }

    /**
     * Requests an object from the server. The method returns a Promise that resolves to a Readable Stream containing the data.
     * 
     * @param container - Name of the container
     * @param path - Path of the object, inside the container
     * @returns Readable Stream containing the object's data
     * @async
     */
    getObject(container: string, path: string): Promise<Stream> {
        return this._client.getObject(container, path)
    }

    /**
     * Returns a list of objects with a given prefix (folder). The list is not recursive, so prefixes (folders) are returned as such.
     * 
     * @param container - Name of the container
     * @param prefix - Prefix (folder) inside which to list objects
     * @returns List of elements returned by the server
     * @async
     */
    listObjects(container: string, prefix?: string): Promise<ListResults> {
        return new Promise((resolve, reject) => {
            const stream = this._client.listObjectsV2(container, prefix, false) as Stream
            const list = [] as ListResults
            stream.on('data', (obj) => {
                let res

                // If we have a file, add path, lastModified and size
                if (obj.name && obj.lastModified) {
                    res = {
                        lastModified: obj.lastModified,
                        path: obj.name,
                        size: obj.size
                    } as ListItemObject
                }
                // If we have a prefix (folder) instead
                else if (obj.prefix) {
                    res = {
                        prefix: obj.prefix
                    } as ListItemPrefix
                }
                else {
                    throw Error('Invalid object returned from the server')
                }

                list.push(res)
            })
            stream.on('error', (err) => {
                reject(err)
            })
            stream.on('end', () => {
                resolve(list)
            })
        })
    }

    /**
     * Removes an object from the server
     * 
     * @param container - Name of the container
     * @param path - Path of the object, inside the container
     * @returns Promise that resolves once the object has been removed
     * @async
     */
    deleteObject(container: string, path: string): Promise<void> {
        return this._client.removeObject(container, path)
    }

    /**
     * Returns the bucketId property for a given bucket name, as most B2 methods require a bucket's ID
     * 
     * @param bucketName - Name of the bucket
     * @returns Promise that resolves with the bucketId
     * @async
     */
    private _getBucketId(bucketName: string): Promise<string> {
        // Ensure we are authorized, then perform the request
        // There's no method in the B2 APIs to get a single bucket, so we need to request the full list
        // TODO: ADD CACHING
        return this._ensureAuthorized()
            .then(() => this._client.listBuckets())
            .then((response) => {
                if (!response || !response.data || !response.data.buckets || !Array.isArray(response.data.buckets)) {
                    return null
                }

                // Look for the bucket with the requested name, then return the id
                for (const el of response.data.buckets) {
                    if (el.bucketName == bucketName) {
                        return el.bucketId as string
                    }
                }

                // Couldn't find the bucket
                return null
            })
    }

    /**
     * Performs authorization
     * 
     * @returns Promise that resolves once the client is authorized
     * @async
     */
    private _ensureAuthorized(): Promise<void> {
        if (this._isAuthorized) {
            return Promise.resolve()
        }
        else {
            return this._client.authorize()
        }
    }

    private _uploadFile(bucketId: string, path: string, data: string|Buffer, metadata?: any, length?: number): Promise<any> {
        // Backblaze recommends retrying at least two times (up to five) in case of errors, with an incrementing delay. We're retrying all uploads 3 times
        let retryCounter = 0

        // First, get the upload url and upload authorization token
        return this._client.getUploadUrl(bucketId)
            // Then upload the file
            .then((response) => {
                if (!response || !response.data || !response.data.authorizationToken || !response.data.uploadUrl) {
                    throw Error('Invalid response when requesting the upload url and upload authorization token')
                }

                // Convert data to a Buffer if it's a string
                if (data && typeof data == 'string') {
                    data = Buffer.from(data as string, 'utf8')
                }

                // Request args
                const requestArgs = {
                    uploadUrl: response.data.uploadUrl,
                    uploadAuthToken: response.data.authorizationToken,
                    filename: path,
                    data: data,
                    hash: 'do_not_verify', // TODO: Compute SHA1 at the end, as per https://www.backblaze.com/b2/docs/uploading.html
                    info: {} as any,
                    mime: 'application/octet-stream'
                }

                // Metadata
                if (metadata) {
                    // Add custom headers
                    // Maximum 10 headers, and they can only contain [A-Za-z0-9]
                    // If headers don't start with 'X-Bz-Info-', the prefix will be added
                    let i = 0
                    for (const key in metadata) {
                        if (!metadata.hasOwnProperty(key)) {
                            continue
                        }

                        // Content-Type header has a special treatment
                        if (key == 'Content-Type') {
                            requestArgs.mime = metadata['Content-Type']
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
                                requestArgs.info['X-Bz-Info-' + key] = metadata[key]
                            }
                            else {
                                requestArgs.info[key] = metadata[key]
                            }

                            // Increment the counter
                            i++
                        }
                    }
                }

                // Send the request
                return this._client.uploadFile(requestArgs)
            })
            .catch((err) => {
                // TODO: REMOVE THIS
                console.error('Upload failed with error ', err)
                if (retryCounter < 3) {
                    retryCounter++
                    // Before retrying, wait for an increasing delay
                    return waitPromise((retryCounter + 1) * 500)
                        .then(() => this._uploadFile(bucketId))
                }
                else {
                    // Let the error bubble up
                    throw err
                }
            })
    }

    private _uploadPart(fileId: string, partNumber: number, data: Buffer): Promise<any> {
        // Backblaze recommends retrying at least two times (up to five) in case of errors, with an incrementing delay. We're retrying all uploads 3 times
        let retryCounter = 0

        // First, get the upload url and upload authorization token
        return this._client.getUploadUrl({fileId: fileId})
            .then((response) => {
                if (!response || !response.data || !response.data.authorizationToken || !response.data.uploadUrl) {
                    throw Error('Invalid response when requesting the upload url and upload authorization token')
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
}

export = BackblazeB2Provider
