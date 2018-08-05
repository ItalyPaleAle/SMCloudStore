'use strict'

const GCStorage = require('@google-cloud/storage')
const stream = require('stream')

/**
 * Connection options for a Google Cloud Storage provider.
 * @typedef {Object} GoogleCloudConnectionOptions
 * @param {string} projectId - ID of the Google Cloud project
 * @param {string} keyFilename - Path of the JSON file containing the keys
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
 * @class GoogleCloudStorageProvider
 * Client to interact with Google Cloud Storage.
 */
class GoogleCloudStorageProvider {
    /**
     * Initializes a new client to interact with Minio.
     * 
     * @param {GoogleCloudConnectionOptions} connection - Dictionary with connection options.
     */
    constructor(connection) {
        if (!connection || !Object.keys(connection).length) {
            throw new Error('Connection argument is empty')
        }
        
        // The Google Cloud library will validate the connection object
        this._client = GCStorage(connection)
    }

    /**
     * Create a container ("bucket") on the server.
     * 
     * @param {string} container - Name of the container
     * @param {string} [region] - Region in which to create the container.
     * @returns {Promise<void>} Promise that resolves once the container has been created. The promise doesn't contain any meaningful return value.
     * @async
     */
    createContainer(container, region) {
        if (!region) {
            throw Error('Argument region must be not empty')
        }

        const bucket = this._client.bucket(container)
        return bucket.create({
            location: region,
            regional: true
        })
    }

    /**
     * Check if a container exists.
     * 
     * @param {string} container - Name of the container
     * @returns {Promise<boolean>} Promises that resolves with a boolean indicating if the container exists.
     * @async
     */
    containerExists(container) {
        const bucket = this._client.bucket(container)
        return bucket.exists()
            .then((response) => {
                return !!response[0]
            })
    }

    /**
     * Create a container ("bucket") on the server if it doesn't already exist.
     * 
     * @param {string} container - Name of the container
     * @param {string} [region] - Region in which to create the container.
     * @returns {Promise<void>} Promise that resolves once the container has been created
     * @async
     */
    async ensureContainer(container, region) {
        const exists = await this.containerExists(container)
        if (!exists) {
            return this.createContainer(container, region)
        }
    }

    /**
     * Lists all containers belonging to the user
     * 
     * @returns {Promise<string[]>} Promise that resolves with an array of all the containers
     * @async
     */
    async listContainers() {
        const list = await this._client.getBuckets()
        if (!list || !list[0] || !list[0].length) {
            return []
        }
        else {
            return list[0].map((el) => (el && el.name))
        }
    }

    /**
     * Removes a contaienr from the server
     * 
     * @param {string} container - Name of the container
     * @returns {Promise<void>} Promise that resolves once the container has been removed
     * @async
     */
    deleteContainer(container) {
        const bucket = this._client.bucket(container)
        return bucket.delete()
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
        const bucket = this._client.bucket(container)
        const file = bucket.file(path)

        // Convert strings and buffers to streams
        let dataStream
        if (typeof data == 'object' && typeof data.pipe == 'function') {
            dataStream = data
        }
        else {
            dataStream = new stream.Duplex()
            // Buffers
            if (typeof data == 'object' && Buffer.isBuffer(data)) {
                dataStream.push(data)
            }
            else if (typeof data == 'string') {
                dataStream.push(data, 'utf8')
            }
            else {
                throw Error('Invalid data argument: must be a stream, a Buffer or a string')
            }
            dataStream.push(null)
        }

        return new Promise((resolve, reject) => {
            const options = {
                resumable: false,
                validation: 'md5',
                metadata
            }

            // Check if we have a Content-Type
            if (metadata['Content-Type']) {
                options.contentType = metadata['Content-Type']
                delete metadata['Content-Type']
            }

            dataStream.pipe(file.createWriteStream(options))
                .on('error', (err) => {
                    reject(err)
                })
                .on('finish', () => {
                    resolve()
                })
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
        const bucket = this._client.bucket(container)
        const file = bucket.file(path)
        
        // For Google Cloud Storage, this method doesn't actually need to be asynchronous
        return Promise.resolve(file.createReadStream({validation: 'md5'}))
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
        let list = []
        const requestPromise = (opts) => {
            return new Promise((resolve, reject) => {
                if (!opts) {
                    opts = {
                        delimiter: '/',
                        autoPaginate: false,
                        //maxResults: 2, // Debugging
                        prefix
                    }
                }
        
                // Using the callback API so we can get the full list
                this._client.bucket(container).getFiles(opts, (err, files, nextQuery, apiResponse) => {
                    if (err) {
                        return reject(err)
                    }
    
                    if (files && files.length) {
                        list = list.concat(files.map((el) => {
                            const obj = {
                                path: el.name
                            }
                            if (el.metadata) {
                                if (el.metadata.size) {
                                    obj.size = parseInt(el.metadata.size, 10)
                                }
                                if (el.metadata.updated) {
                                    obj.lastModified = new Date(el.metadata.updated)
                                }
                                if (el.metadata.timeCreated) {
                                    obj.creationTime = new Date(el.metadata.timeCreated)
                                }
                                if (el.metadata.md5Hash) {
                                    // Google Cloud Storage returns the MD5 as base64, so convert it to HEX
                                    obj.contentMD5 = Buffer.from(el.metadata.md5Hash, 'base64').toString('hex')
                                }
                                if (el.metadata.contentType) {
                                    obj.contentType = el.metadata.contentType
                                }
                            }
                            return obj
                        }))
                    }
    
                    if (apiResponse && apiResponse.prefixes) {
                        list = list.concat(apiResponse.prefixes.map((el) => {
                            return {prefix: el}
                        }))
                    }
    
                    if (nextQuery) {
                        return resolve(requestPromise(nextQuery))
                    }
                    else {
                        return resolve(list)
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
        const bucket = this._client.bucket(container)
        const file = bucket.file(path)   

        // Returns a promise
        return file.delete()
    }
}

module.exports = GoogleCloudStorageProvider
