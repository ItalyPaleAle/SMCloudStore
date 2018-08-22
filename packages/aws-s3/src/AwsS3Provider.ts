'use strict'

import {ListItemObject, ListItemPrefix, ListResults, PutObjectOptions, StorageProvider} from '@smcloudstore/core/dist/StorageProvider'
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
 * ACL for containers and objects. Refer to the [documentation](https://docs.aws.amazon.com/AmazonS3/latest/dev/acl-overview.html#canned-acl) for more details. Default value is `private` for containers and null (inherited) for objects.
 * 
 * For consistency with other providers, a few aliases are added:
 * - `none` is an alias for `private`
 * - `public` is an alias for `public-read`
 */
type AwsS3ACL = 'private' | 'public-read' | 'public-read-write' | 'authenticated-read' | 'none' | 'public'

/**
 * Options passed when creating a container
 */
interface AwsS3CreateContainerOptions {
    /** Determine access level for all objects in the container */
    access?: AwsS3ACL
}

/**
 * Options passed when putting an object.
 */
interface AwsS3PutObjectOptions extends PutObjectOptions {
    /** Determine access level for the object. Default: inherit from the container */
    access?: AwsS3ACL,

    /** Enable AES256 server-side encryption for the object at rest, with AWS-managed keys. Default: disabled */
    serverSideEncryption?: boolean

    /** Storage class to use. Refer to the [documentation](https://docs.aws.amazon.com/AmazonS3/latest/dev/storage-class-intro.html) for more details. Default is 'STANDARD' */
    class?: 'STANDARD' | 'REDUCED_REDUNDANCY' | 'STANDARD_IA' | 'ONEZONE_IA'
}

/**
 * Returns the value for the ACL to pass to the APIs, given an access argument
 * 
 * @param access Value among the types of `AwsS3ACL`
 * @returns String value to pass to the S3 APIs
 */
function ACLString(access: AwsS3ACL): string {
    switch (access) {
        case 'public-read':
        case 'public':
            return 'public-read'
            break
        case 'public-read-write':
        case 'authenticated-read':
            return access
            break
        case 'none':
        case 'private':
        default:
            return 'private'
    }
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

            const methodOptions = {
                ACL: ACLString(options.access),
                Bucket: container,
                CreateBucketConfiguration: {
                    LocationConstraint: this._region
                }
            } as S3.CreateBucketRequest
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
            } as S3.HeadBucketRequest
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
            } as S3.DeleteBucketRequest
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
     * @param options - Key-value pair of options used by providers, including the `metadata` dictionary and additional S3-specific options
     * @returns Promise that resolves once the object has been uploaded
     * @async
     */
    putObject(container: string, path: string, data: Stream|string|Buffer, options?: AwsS3PutObjectOptions): Promise<void> {
        if (!options) {
            options = {}
        }

        return new Promise((resolve, reject) => {
            // Basic method options
            const methodOptions = {
                Body: data,
                Bucket: container,
                Key: path
            } as S3.PutObjectRequest

            // ACL: add only if explicitly passed
            if (options.access) {
                methodOptions.ACL = ACLString(options.access)
            }

            // Storage class
            if (options.class) {
                methodOptions.StorageClass = options.class
            }

            // Enable server-side encryption
            if (options.serverSideEncryption) {
                methodOptions.ServerSideEncryption = 'AES256'
            }

            // Metadata
            if (options.metadata) {
                // Clone the metadata object before altering it
                const metadataClone = Object.assign({}, options.metadata) as {[k: string]: string}

                if (metadataClone['Content-Type']) {
                    methodOptions.ContentType = metadataClone['Content-Type']
                    delete metadataClone['Content-Type']
                }
                if (metadataClone['Content-Encoding']) {
                    methodOptions.ContentEncoding = metadataClone['Content-Encoding']
                    delete metadataClone['Content-Encoding']
                }
                if (metadataClone['Content-Language']) {
                    methodOptions.ContentLanguage = metadataClone['Content-Language']
                    delete metadataClone['Content-Language']
                }
                if (metadataClone['Cache-Control']) {
                    methodOptions.CacheControl = metadataClone['Cache-Control']
                    delete metadataClone['Cache-Control']
                }
                if (metadataClone['Content-Disposition']) {
                    methodOptions.ContentDisposition = metadataClone['Content-Disposition']
                    delete metadataClone['Content-Disposition']
                }
                if (metadataClone['Content-MD5']) {
                    methodOptions.ContentMD5 = metadataClone['Content-MD5']
                    delete metadataClone['Content-MD5']
                }

                methodOptions.Metadata = metadataClone
            }

            // Send the request
            this._client.putObject(methodOptions, function(err, response) {
                if (err || !response || !response.ETag) {
                    return reject(err || Error('Invalid response while putting object'))
                }

                resolve()
            })
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
        const methodOptions = {
            Bucket: container,
            Key: path
        } as S3.GetObjectRequest

        const stream = this._client.getObject(methodOptions).createReadStream()
        return Promise.resolve(stream)
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
        const list = [] as ListResults
        const makeRequest = (continuationToken?: string): Promise<ListResults> => {
            return new Promise((resolve, reject) => {
                const methodOptions = {
                    Bucket: container,
                    ContinuationToken: continuationToken || undefined,
                    Delimiter: '/',
                    MaxKeys: 500,
                    Prefix: prefix
                } as S3.ListObjectsV2Request
                this._client.listObjectsV2(methodOptions, function(err, data) {
                    if (err || !data || !data.KeyCount || !data.Contents) {
                        return reject(err || Error('Invalid response while putting object'))
                    }

                    // Add all objects
                    for (const el of data.Contents) {
                        const add = {
                            lastModified: el.LastModified,
                            path: el.Key,
                            size: el.Size
                        } as ListItemObject

                        // Check if the ETag is the MD5 of the file (this is the case for files that weren't uploaded in multiple parts, in which case there's a dash in the ETag)
                        if (el.ETag.indexOf('-') >= 0) {
                            add.contentMD5 = el.ETag
                        }

                        list.push(add)
                    }

                    // Add all prefixes
                    for (const el of data.CommonPrefixes) {
                        list.push({
                            prefix: el.Prefix
                        } as ListItemPrefix)
                    }

                    // Check if we have to make another request
                    if (data.ContinuationToken) {
                        resolve(makeRequest(data.ContinuationToken))
                    }
                    else {
                        resolve(list)
                    }
                })
            })
        }

        return makeRequest()
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
        return new Promise((resolve, reject) => {
            const methodOptions = {
                Bucket: container,
                Key: path
            } as S3.DeleteObjectRequest

            this._client.deleteObject(methodOptions, function(err, data) {
                if (err || !data) {
                    return reject(err || Error('Invalid response while deleting object'))
                }

                resolve()
            })
        })
    }
}

export = AwsS3Provider
