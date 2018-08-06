'use strict'

import * as Azure from 'azure-storage'
import {Stream, Transform} from 'stream'
import {ListItemObject, ListItemPrefix, ListResults, StorageProvider} from '../lib/StorageProvider'

/**
 * Connection options for an Azure Blob Storage provider.
 */
interface AzureStorageConnectionObject {
    /** Name of the storage account */
    storageAccount: string
    /** Access key (secret key) for the storage account */
    storageAccessKey: string
    /** Endpoint to use. Default is `blob.storage.windows.net` */
    host?: string
}
type AzureStorageConnectionOptions = string | AzureStorageConnectionObject

/**
 * Client to interact with Azure Blob Storage.
 */
class AzureStorageProvider extends StorageProvider {
    protected _client: Azure.BlobService

    /**
     * Initializes a new client to interact with Azure Blob Storage.
     * 
     * @param connection - Dictionary with connection options.
     */
    constructor(connection: AzureStorageConnectionOptions) {
        super()

        // Provider name
        this._provider = 'AzureStorage'

        // The Azure library will validate the connection object
        // TODO: Support object
        this._client = Azure.createBlobService(connection as string)
    }

    /**
     * Create a container on the server.
     * 
     * @param container - Name of the container
     * @param region - The region parameter is ignored by Azure.
     * @returns Promise that resolves once the container has been created. The promise doesn't contain any meaningful return value.
     * @async
     */
    createContainer(container: string, region?: string): Promise<void> {
        return this.createContainerInternal(container, false).then(() => {
            return
        })
    }

    /**
     * Check if a container exists.
     * 
     * @param container - Name of the container
     * @returns Promises that resolves with a boolean indicating if the container exists.
     * @async
     */
    containerExists(container: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this._client.getContainerProperties(container, (err, response) => {
                if (err) {
                    // If error is "Not Found", then just return false
                    return err.toString().match(/NotFound/) ?
                        resolve(false) :
                        reject(err)
                }
                else if (response && response.name) {
                    return resolve(true)
                }
                else {
                    throw Error('Response does not contain storage account name')
                }
            })
        })
    }

    /**
     * Create a container on the server if it doesn't already exist.
     * 
     * @param container - Name of the container
     * @param region - The region parameter is ignored by Azure.
     * @returns Promise that resolves once the container has been created
     * @async
     */
    ensureContainer(container: string, region?: string): Promise<void> {
        return this.createContainerInternal(container, true).then(() => {
            return
        })
    }

    /**
     * Lists all containers belonging to the user
     * 
     * @returns Promise that resolves with an array of all the containers
     * @async
     */
    listContainers(): Promise<string[]> {
        const resultList = [] as string[]

        // The response might be split into multiple pages, so we need to be prepared to make multiple requests and use a continuation token
        const requestPromise = (continuationToken: Azure.common.ContinuationToken): Promise<string[]> => {
            return new Promise((resolve, reject) => {
                this._client.listContainersSegmented(continuationToken, (err, response) => {
                    if (err) {
                        return reject(err)
                    }

                    // Iterate through entries
                    if (!response.entries || !Array.isArray(response.entries)) {
                        throw Error('Response does not contain an entries array')
                    }
                    for (const i in response.entries) {
                        if (response.entries.hasOwnProperty(i)) {
                            const e = response.entries[i]
                            if (!e || !e.name) {
                                throw Error('Invalid entry')
                            }
                            resultList.push(e.name)
                        }
                    }

                    // Check if we have a continuation token
                    if (response.continuationToken) {
                        // We have a token, so need to make another request, returning a promise
                        resolve(requestPromise(response.continuationToken))
                    }
                    else {
                        // No token, so return the list of what we've collected
                        resolve(resultList)
                    }
                })
            })
        }

        return requestPromise(null)
    }

    /**
     * Removes a contaienr from the server
     * 
     * @param container - Name of the container
     * @returns Promise that resolves once the container has been removed
     * @async
     */
    deleteContainer(container: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._client.deleteContainer(container, (err, response) => {
                if (err) {
                    return reject(err)
                }
                else if (!response || !response.isSuccessful) {
                    throw Error('Response was empty or not successful')
                }
                else {
                    return resolve()
                }
            })
        })
    }

    /**
     * Uploads a stream to the object storage server
     * 
     * @param container - Name of the container
     * @param path - Path where to store the object, inside the container
     * @param data - Object data or stream. Can be a Stream (Readable Stream), Buffer or string.
     * @param metadata - Key-value pair with metadata for the object, for example `Content-Type` or custom tags
     * @returns Promise that resolves once the object has been uploaded
     * @async
     */
    putObject(container: string, path: string, data: Stream|string|Buffer, metadata?: any): Promise<void> {
        if (!data) {
            throw Error('Argument data is empty')
        }

        // Azure wants some headers, like Content-Type, outside of the metadata object
        const options = {
            contentSettings: {},
            metadata: {}
        } as Azure.BlobService.CreateBlockBlobRequestOptions

        if (metadata) {
            // Clone the metadata object before altering it
            const metadataClone = Object.assign({}, metadata) as {[k: string]: string}

            if (metadataClone['Content-Type']) {
                options.contentSettings.contentType = metadataClone['Content-Type']
                delete metadataClone['Content-Type']
            }
            if (metadataClone['Content-Encoding']) {
                options.contentSettings.contentEncoding = metadataClone['Content-Encoding']
                delete metadataClone['Content-Encoding']
            }
            if (metadataClone['Content-Language']) {
                options.contentSettings.contentLanguage = metadataClone['Content-Language']
                delete metadataClone['Content-Language']
            }
            if (metadataClone['Cache-Control']) {
                options.contentSettings.cacheControl = metadataClone['Cache-Control']
                delete metadataClone['Cache-Control']
            }
            if (metadataClone['Content-Disposition']) {
                options.contentSettings.contentDisposition = metadataClone['Content-Disposition']
                delete metadataClone['Content-Disposition']
            }
            if (metadataClone['Content-MD5']) {
                // Content-MD5 is auto-generated if not sent by the user
                // If sent by the user, then Azure uses it to ensure data did not get altered in transit
                options.contentSettings.contentMD5 = metadataClone['Content-MD5']
                delete metadataClone['Content-MD5']
            }

            options.metadata = metadataClone
        }

        return new Promise((resolve, reject) => {
            const callback = (err, response) => {
                if (err) {
                    return reject(err)
                }
                // When uploading a string or Buffer, we have a complex object; for a stream, we just have a list of committedBlocks in the response
                if (!response || (!response.name && !response.commmittedBlocks)) {
                    throw Error('Response was empty or not successful')
                }
                else {
                    return resolve()
                }
            }

            // Check if we have a stream
            if (typeof data == 'object' && typeof (data as any).pipe == 'function') {
                (data as Stream).pipe(this._client.createWriteStreamToBlockBlob(container, path, options, callback))
            }
            // Strings and Buffers are supported too
            else if (typeof data == 'string' || (typeof data == 'object' && Buffer.isBuffer(data))) {
                this._client.createBlockBlobFromText(container, path, data, options, callback)
            }
            // Fail otherwise
            else {
                throw Error('Argument data must be a Stream, a String or a Buffer')
            }
        })
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
        // Create a transform stream we can return in the result, which is readable
        const duplexStream = new Transform({
            transform(chunk, encoding, done) {
                done(null, chunk)
            }
        })
        // Request the data
        this._client.getBlobToStream(container, path, duplexStream, (err, response) => {
            // Pass errors to the stream as events
            if (err) {
                duplexStream.destroy((typeof err == 'object' && err instanceof Error) ? err : Error(err))
            }
        })

        // Wrap this in a promise because the method expects result to be async
        return Promise.resolve(duplexStream)
    }

    /**
     * Returns a list of objects with a given prefix (folder). The list is not recursive, so prefixes (folders) are returned as such.
     * 
     * @param container - Name of the container
     * @param prefix - Prefix (folder) inside which to list objects
     * @returns List of elements returned by the server
     * @async
     */
    listObjects(container: string, prefix: string): Promise<ListResults> {
        const resultList = []

        // The response might be split into multiple pages, so we need to be prepared to make multiple requests and use a continuation token
        const requestPromise = (type: 'blob'|'prefix', continuationToken: Azure.common.ContinuationToken): Promise<ListResults> => {
            return new Promise((resolve, reject) => {
                // The following properties/methods aren't defined in the typings file
                const blobTypeConstants = (Azure.Constants.BlobConstants as any).ListBlobTypes
                const listBlobType = (type == 'prefix') ? blobTypeConstants.Directory : blobTypeConstants.Blob

                const clientAny = this._client as any
                clientAny._listBlobsOrDircotriesSegmentedWithPrefix(container, prefix, continuationToken, listBlobType, {delimiter: '/'}, (err, response) => {
                    if (err) {
                        return reject(err)
                    }

                    // Iterate through the list of items and add objects to the result list
                    for (const i in response.entries) {
                        if (response.entries.hasOwnProperty(i)) {
                            const e = response.entries[i]

                            // Is this a prefix (folder) or object? If etag is present, it's an object
                            if (e.etag) {
                                const res = {
                                    creationTime: e.creationTime ? new Date(e.creationTime) : undefined,
                                    lastModified: e.lastModified ? new Date(e.lastModified) : undefined,
                                    path: e.name,
                                    size: parseInt(e.contentLength, 10)
                                } as ListItemObject
                                /* istanbul ignore else */
                                if (e.contentSettings && e.contentSettings.contentMD5) {
                                    // Azure returns the Content-MD5 header as base64, so convert it to HEX
                                    res.contentMD5 = Buffer.from(e.contentSettings.contentMD5, 'base64').toString('hex')
                                }
                                /* istanbul ignore else */
                                if (e.contentSettings && e.contentSettings.contentType) {
                                    res.contentType = e.contentSettings.contentType
                                }
                                resultList.push(res)
                            }
                            else {
                                resultList.push({
                                    prefix: e.name
                                } as ListItemPrefix)
                            }
                        }
                    }

                    // Check if we have a continuation token
                    if (response.continuationToken) {
                        // We have a token, so need to make another request, returning a promise
                        resolve(requestPromise(type, response.continuationToken))
                    }
                    else {
                        // No token, so return the list of what we've collected
                        resolve(resultList)
                    }
                })
            })
        }

        return Promise.all([
            requestPromise('blob', null),
            requestPromise('prefix', null)
        ]).then(() => {
            return resultList
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
    removeObject(container: string, path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._client.deleteBlob(container, path, (err, response) => {
                if (err) {
                    return reject(err)
                }
                else if (!response || !response.isSuccessful) {
                    throw Error('Response was empty or not successful')
                }
                else {
                    return resolve()
                }
            })
        })
    }

    /* Internal methods */

    /**
     * Create a container on the server, choosing whether to use the "ifNotExists" method or not
     * @param container - Name of the container
     * @param ifNotExists - If true, use the "ifNotExists" method variant
     * @returns Promise that resolves once the container has been created. The promise doesn't contain any meaningful return value.
     * @async
     */
    private createContainerInternal(container: string, ifNotExists: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            const options = {
                // All containers are private by default
                publicAccessLevel: null
            } as Azure.BlobService.CreateContainerOptions

            const callback = (err, response) => {
                if (err) {
                    return reject(err)
                }
                else if (response && response.name) {
                    return resolve()
                }
                else {
                    throw Error('Response does not contain storage account name')
                }
            }

            if (ifNotExists) {
                this._client.createContainerIfNotExists(container, options, callback)
            }
            else {
                this._client.createContainer(container, options, callback)
            }
        })
    }
}

export = AzureStorageProvider
