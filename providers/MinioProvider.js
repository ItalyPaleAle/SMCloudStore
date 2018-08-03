'use strict'

const Minio = require('minio')

/**
 * Connection options for a Minio provider.
 * @typedef {Object} MinioConnectionOptions
 * @param {string} endPoint - URL to object storage server
 * @param {string} accessKey - Access Key for the server
 * @param {string} secretKey - Secret Key for the server
 * @param {boolean} [secure=true] - If true (default), connect via HTTPS
 * @param {number} [port] - Port where the server is listening on; defaults to 80 for HTTP (`secure=false`) and 443 for HTTPS (`secure=true`)
 */
/**
 * Dictionary of objects returned when listing a container.
 * 
 * @typedef {Object} ListItemObject
 * @param {string} path - Full path of the object inside the container
 * @param {Date} lastModified - Date when the object was last modified
 * @param {number} size - Size in bytes of the object
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
 * @class MinioProvider
 * Client to interact with a Minio object storage server.
 * This module can be used with AWS S3 too, as well as any other S3-compatible services.
 */
class MinioProvider {
    /**
     * Initializes a new client to interact with Minio.
     * 
     * @param {MinioConnectionOptions} connection - Dictionary with connection options.
     */
    constructor(connection) {
        if (!connection || !Object.keys(connection).length) {
            throw new Error('Connection argument is empty')
        }
        
        // The Minio library will validate the connection object
        this._minio = new Minio.Client(connection)
    }

    /**
     * Create a container ("bucket") on the server.
     * 
     * @param {string} container - Name of the container
     * @param {string} [region] - Region in which to create the container. Useful when interacting with AWS S3.
     * @returns {Promise<void>} Promise that resolves once the container has been created. The promise doesn't contain any meaningful return value.
     * @async
     */
    createContainer(container, region) {
        // This returns a promise
        return this._minio.makeBucket(container, region || '')
    }

    /**
     * Check if a container exists.
     * 
     * @param {string} container - Name of the container
     * @returns {Promise<boolean>} Promises that resolves with a boolean indicating if the container exists.
     * @async
     */
    containerExists(container) {
        return this._minio.bucketExists(container)
            .then((result) => {
                return !!result
            })
            .catch((err) => {
                // Treat exceptions as not founds
                return false
            })
    }

    /**
     * Create a container ("bucket") on the server if it doesn't already exist.
     * 
     * @param {string} container - Name of the container
     * @param {string} [region] - Region in which to create the container. Useful when interacting with AWS S3.
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
    listContainers() {
        return this._minio.listBuckets()
            .then((list) => list.map((el) => (el && el.name) || undefined))
    }

    /**
     * Removes a contaienr from the server
     * 
     * @param {string} container - Name of the container
     * @returns {Promise<void>} Promise that resolves once the container has been removed
     * @async
     */
    deleteContainer(container) {
        return this._minio.removeBucket(container)
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
        return this._minio.putObject(container, path, data, metadata)
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
        return this._minio.getObject(container, path)
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
        return new Promise((resolve, reject) => {
            const stream = this._minio.listObjectsV2(container, prefix, false)
            const list = []
            stream.on('data', (obj) => {
                let res

                // If we have a file, add path, lastModified and size
                if (obj.name && obj.lastModified) {
                    res = {
                        path: obj.name,
                        lastModified: obj.lastModified,
                        size: obj.size
                    }
                }
                // If we have a prefix (folder) instead
                else if (obj.prefix) {
                    res = {
                        prefix: obj.prefix
                    }
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
     * @param {string} container - Name of the container
     * @param {string} path - Path of the object, inside the container
     * @returns {Promise<void>} Promise that resolves once the object has been removed
     * @async
     */
    removeObject(container, path) {
        return this._minio.removeObject(container, path)
    }
}

module.exports = MinioProvider
