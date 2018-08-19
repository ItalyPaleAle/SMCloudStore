'use strict'

import {ListItemObject, ListItemPrefix, ListResults, StorageProvider} from '@smcloudstore/core/dist/StorageProvider'
import S3 = require('aws-sdk/clients/s3')
import {Stream} from 'stream'

/**
 * Connection options for an AWS S3 provider.
 */
interface AwsS3ConnectionOptions {
    /** Access Key ID */
    accessKeyId: string
    /** Secret Access Key */
    secretAccessKey: string,
    /** Default region to use; if not set, defaults to "US Standard" (Virginia) */
    region?: string
}

/**
 * Options passed when creating a container
 */
interface AwsS3CreateContainerOptions {
    /**
     * Determine access level for all files in the container. Refer to the (https://docs.aws.amazon.com/AmazonS3/latest/dev/acl-overview.html#canned-acl)[documentation] for more details. Default value is `private`.
     * 
     * For consistency with other providers, a few aliases are added:
     * - `none` is an alias for `private`
     * - `public` is an alias for `public-read`
     */
    access?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read' | 'none' | 'public'
}

/**
 * Options passed when creating a container
 */
interface GenericS3CreateContainerOptions {
    /** Region in which to create the container; useful for AWS S3 and some other providers based on this */
    region?: string
}

/**
 * Client to interact with a generic S3 object storage server, using the Minio library.
 */
class AwsS3Provider extends StorageProvider {
    protected _client: S3
    protected _region: string

    /**
     * Initializes a new client to interact with AWS S3.
     * 
     * @param connection - Dictionary with connection options.
     */
    constructor(connection: AwsS3ConnectionOptions) {
        if (!connection || !Object.keys(connection).length) {
            throw new Error('Connection argument is empty')
        }

        super(connection)

        // Provider name
        this._provider = 'aws-s3'

        // Region, if passed
        this._region = connection.region || ''

        // The AWS library will validate the connection object
        const options = Object.assign(connection, {apiVersion: '2006-03-01'}) as S3.ClientConfiguration
        this._client = new S3(options)
    }

    /**
     * Create a container ("bucket") on the server.
     * 
     * @param container - Name of the container
     * @param options - Dictionary with options for creating the container.
     * @returns Promise that resolves once the container has been created. The promise doesn't contain any meaningful return value.
     * @async
     */
    createContainer(container: string, options?: AwsS3CreateContainerOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!options) {
                options = {}
            }
            // Get the ACL param
            let ACL
            switch (options.access) {
                case 'public-read':
                case 'public':
                    ACL = 'public-read'
                    break
                case 'public-read-write':
                case 'authenticated-read':
                    ACL = options.access
                    break
                case 'none':
                case 'private':
                default:
                    ACL = 'private'
                    break
            }

            const methodOptions = {
                ACL: ACL,
                Bucket: container,
                CreateBucketConfiguration: {
                    LocationConstraint: this._region
                }
            }
            this._client.createBucket(methodOptions, function(err, data) {
                if (err || !data || !data.Location) {
                    return reject(err || Error('Invalid response while creating container'))
                }

                resolve()
            })
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
            const methodOptions = {
                Bucket: container
            }
            this._client.headBucket(methodOptions, function(err, data) {
                if (err) {
                    // Check error code to see if bucket doesn't exist, or if someone else owns it
                    if (err.statusCode == 404) {
                        // Container doesn't exist
                        resolve(false)
                    }
                    else if (err.statusCode === 403) {
                        // Someone else owns this
                        resolve(false)
                    }
                    else {
                        // Another error, so throw an exception
                        return reject(err)
                    }
                }
                else {
                    // Bucket exists and user owns it
                    resolve(true)
                }
            })
        })
    }

    /**
     * Create a container ("bucket") on the server if it doesn't already exist.
     * 
     * @param container - Name of the container
     * @param options - Dictionary with options for creating the container, including the region (useful when dealing with AWS S3, for example).
     * @returns Promise that resolves once the container has been created
     * @async
     */
    ensureContainer(container: string, options?: AwsS3CreateContainerOptions): Promise<void> {
        // First, check if the container exists
        return this.containerExists(container)
            .then((exists) => {
                // Create the container if it doesn't exist already
                if (!exists) {
                    return this.createContainer(container, options)
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
        return new Promise((resolve, reject) => {
            this._client.listBuckets(function(err, data) {
                if (err || !data || !data.Buckets) {
                    return reject(err || Error('Invalid response while listing containers'))   
                }

                const list = []
                for (const bucket of data.Buckets) {
                    if (bucket && bucket.Name) {
                        list.push(bucket.Name)
                    }
                }
                resolve(list)
            })
        })
    }

    /**
     * Removes a container from the server
     * 
     * @param container - Name of the container
     * @returns Promise that resolves once the container has been removed
     * @async
     */
    deleteContainer(container: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const methodOptions = {
                Bucket: container
            }
            this._client.deleteBucket(methodOptions, function(err, data) {
                if (err || !data) {
                    return reject(err || Error('Invalid response while deleting container'))   
                }
                
                resolve()
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
        return Promise.resolve()
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
        return Promise.resolve(null)
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
        return Promise.resolve([])
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
        return Promise.resolve()
    }
}

export = AwsS3Provider
