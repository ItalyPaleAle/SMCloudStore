'use strict'

const Azure = require('azure-storage')
const stream = require('stream')

/**
 * Connection options for an Azure provider.
 * @typedef {Object} AzureConnectionOptions
 * @param {string} connectionString - Connection String, as returned by Azure
 */
/**
 * Dictionary of objects returned when listing a container.
 * 
 * @typedef {Object} ListItemObject
 * @param {string} path - Full path of the object inside the container
 * @param {Date} [creationTime] - Date when the object was created
 * @param {Date} lastModified - Date when the object was last modified
 * @param {number} size - Size in bytes of the object
 * @param {string} [contentType] - Content-Type of the object, if present
 * @param {string} [contentMD5] - MD5 digest of the object, if present
 */
/**
 * Dictionary of prefixes returned when listing a container.
 * 
 * @typedef {Object} ListItemPrefix
 * @param {string} prefix - Name of the prefix
 */
/**
 * The `listObjects` method returns an array with a mix of objects of type `ListItemObject` and `ListItemPrefix`
 * @typedef {Array<ListItemObject|ListItemPrefix>} ListResults
 */

/**
 * @class AzureStorageProvider
 * Client to interact with Azure Blob Storage.
 */
class AzureStorageProvider {
    /**
     * Initializes a new client to interact with Azure Blob Storage.
     * 
     * @param {AzureConnectionOptions} connection - Dictionary with connection options.
     */
    constructor(connection) {
        // The Azure library will validate the connection object
        this._azure = Azure.createBlobService(connection)
    }

    /**
     * Create a container on the server.
     * 
     * @param {string} container - Name of the container
     * @param {string} [region] - The region parameter is ignored by Azure.
     * @returns {Promise<void>} Promise that resolves once the container has been created. The promise doesn't contain any meaningful return value.
     * @async
     */
    createContainer(container, region) {
        return this._createContainerInternal(container, false)
    }

    /**
     * Check if a container exists.
     * 
     * @param {string} container - Name of the container
     * @returns {Promise<boolean>} Promises that resolves with a boolean indicating if the container exists.
     * @async
     */
    containerExists(container) {
        return new Promise((resolve, reject) => {
            this._azure.getContainerProperties(container, (err, response) => {
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
     * @param {string} container - Name of the container
     * @param {string} [region] - The region parameter is ignored by Azure.
     * @returns {Promise<void>} Promise that resolves once the container has been created
     * @async
     */
    ensureContainer(container, region) {
        return this._createContainerInternal(container, true)
    }

    /**
     * Lists all containers belonging to the user
     * 
     * @returns {Promise<string[]>} Promise that resolves with an array of all the containers
     * @async
     */
    listContainers() {
        const resultList = []

        // The response might be split into multiple pages, so we need to be prepared to make multiple requests and use a continuation token
        const requestPromise = (continuationToken) => {
            return new Promise((resolve, reject) => {
                this._azure.listContainersSegmented(continuationToken, (err, response) => {
                    if (err) {
                        return reject(err)
                    }
                    
                    // Iterate through entries
                    if (!response.entries || !Array.isArray(response.entries)) {
                        throw Error('Response does not contain an entries array')
                    }
                    for (const i in response.entries) {
                        const e = response.entries[i]
                        if (!e || !e.name) {
                            throw Error('Invalid entry')
                        }
                        resultList.push(e.name)
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
     * @param {string} container - Name of the container
     * @returns {Promise<void>} Promise that resolves once the container has been removed
     * @async
     */
    deleteContainer(container) {
        return new Promise((resolve, reject) => {
            this._azure.deleteContainer(container, (err, response) => {
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
     * @param {string} container - Name of the container
     * @param {string} path - Path where to store the object, inside the container
     * @param {Stream|string|Buffer} data - Object data or stream. Can be a Stream (Readable Stream), Buffer or string.
     * @param {Object} [metadata] - Key-value pair with metadata for the object, for example `Content-Type` or custom tags
     * @returns {Promise<void>} Promise that resolves once the object has been uploaded
     * @async
     */
    putObject(container, path, data, metadata) {
        if (!data) {
            throw Error('Argument data is empty')
        }

        // Azure wants some headers, like Content-Type, outside of the metadata object
        const contentSettings = {}
        if (metadata) {
            if (metadata['Content-Type']) {
                contentSettings.contentType = metadata['Content-Type']
                delete metadata['Content-Type']
            }
            if (metadata['Content-Encoding']) {
                contentSettings.contentEncoding = metadata['Content-Encoding']
                delete metadata['Content-Encoding']
            }
            if (metadata['Content-Language']) {
                contentSettings.contentLanguage = metadata['Content-Language']
                delete metadata['Content-Language']
            }
            if (metadata['Cache-Control']) {
                contentSettings.cacheControl = metadata['Cache-Control']
                delete metadata['Cache-Control']
            }
            if (metadata['Content-Disposition']) {
                contentSettings.contentDisposition = metadata['Content-Disposition']
                delete metadata['Content-Disposition']
            }
            if (metadata['Content-MD5']) {
                // Content-MD5 is auto-generated if not sent by the user
                // If sent by the user, then Azure uses it to ensure data did not get altered in transit
                contentSettings.contentMD5 = metadata['Content-MD5']
                delete metadata['Content-MD5']
            }
        }
        const options = {
            metadata,
            contentSettings
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
            if (typeof data == 'object' && typeof data.pipe == 'function') {
                data.pipe(this._azure.createWriteStreamToBlockBlob(container, path, options, callback))
            }
            // Strings and Buffers are supported too
            else if (typeof data == 'string' || (typeof data == 'object' && Buffer.isBuffer(data))) {
                this._azure.createBlockBlobFromText(container, path, data, options, callback)
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
     * @param {string} container - Name of the container
     * @param {string} path - Path of the object, inside the container
     * @returns {Promise<Stream>} Readable Stream containing the object's data
     * @async
     */
    getObject(container, path) {
        // Create a transform stream we can return in the result, which is readable
        const duplexStream = new stream.Transform({
            transform(chunk, encoding, done) {
                done(null, chunk)
            }
        })
        // Request the data
        this._azure.getBlobToStream(container, path, duplexStream, (err, response) => {
            // Pass errors to the stream as events
            if (err) {
                duplexStream.destroy(typeof err == 'object' && err instanceof Error) ? err : Error(err)
            }
        })

        // Wrap this in a promise because the method expects result to be async
        return Promise.resolve(duplexStream)
    }

    /**
     * Returns a list of objects with a given prefix (folder). The list is not recursive, so prefixes (folders) are returned as such.
     * 
     * @param {string} container - Name of the container
     * @param {string} prefix - Prefix (folder) inside which to list objects
     * @returns {Promise<ListResults>} List of elements returned by the server
     * @async
     */
    listObjects(container, prefix) {
        const resultList = []

        // The response might be split into multiple pages, so we need to be prepared to make multiple requests and use a continuation token
        const requestPromise = (continuationToken) => {
            return new Promise((resolve, reject) => {
                this._azure.listBlobsOrBlobDirectoriesSegmentedWithPrefix(container, prefix, continuationToken, {delimiter: '/', maxResults: 2}, (err, response) => {
                    if (err) {
                        return reject(err)
                    }
                    
                    // Iterate through the list of items and add objects to the result list
                    for (const i in response.entries) {
                        const e = response.entries[i]

                        // Depending on pagination, we might get some emtpy items, so let's skip them
                        if (!e || !e.name) {
                            continue
                        }

                        // Is this a prefix (folder) or object? If etag is present, it's an object
                        if (e.etag) {
                            const res = {
                                path: e.name,
                                creationTime: e.creationTime ? new Date(e.creationTime) : undefined,
                                lastModified: e.lastModified ? new Date(e.lastModified) : undefined,
                                size: parseInt(e.contentLength, 10)
                            }
                            if (e.contentSettings && e.contentSettings.contentMD5) {
                                // Azure returns the Content-MD5 header as base64, so convert it to JSON
                                res.contentMD5 = Buffer.from(e.contentSettings.contentMD5, 'base64').toString('hex')
                            }
                            if (e.contentSettings && e.contentSettings.contentType) {
                                res.contentType = e.contentSettings.contentType
                            }
                            resultList.push(res)
                        }
                        else {
                            resultList.push({
                                prefix: e.name
                            })
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
     * Removes an object from the server
     * 
     * @param {string} container - Name of the container
     * @param {string} path - Path of the object, inside the container
     * @returns {Promise<void>} Promise that resolves once the object has been removed
     * @async
     */
    removeObject(container, path) {
        return new Promise((resolve, reject) => {
            this._azure.deleteBlob(container, path, (err, response) => {
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
     * @param {string} container - Name of the container
     * @param {boolean} ifNotExists - If true, use the "ifNotExists" method variant
     * @returns {Promise<void>} Promise that resolves once the container has been created. The promise doesn't contain any meaningful return value.
     * @private
     * @async
     */
    _createContainerInternal(container, ifNotExists) {
        return new Promise((resolve, reject) => {
            const options = {
                // All containers are private by default
                publicAccessLevel: null
            }
            this._azure['createContainer' + (ifNotExists ? 'IfNotExists' : '')](container, options, (err, response) => {
                if (err) {
                    return reject(err)
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
}

module.exports = AzureStorageProvider
