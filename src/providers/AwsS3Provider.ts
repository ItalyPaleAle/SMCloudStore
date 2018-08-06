'use strict'

import Minio from 'minio'
import MinioProvider from './MinioProvider'

/**
 * Connection options for an AWS S3 provider.
 */
interface AwsS3ConnectionOptions {
    /** Access Key for the server */
    accessKey: string
    /** Secret Key for the server */
    secretKey: string
    /** If true (default), connect via HTTPS */
    secure?: boolean
}

/**
 * Client to interact with AWS S3. It is based on the MinioProvider class.
 */
class AwsS3Provider extends MinioProvider {
    /**
     * Initializes a new client to interact with AWS S3.
     * 
     * @param connection - Dictionary with connection options.
     */
    constructor(connection: AwsS3ConnectionOptions) {
        if (!connection || !Object.keys(connection).length) {
            throw new Error('Connection argument is empty')
        }

        // Initialize the Minio provider, on which this is based
        // Clone the property object before modifying it
        const minioConnection = Object.assign({}, connection) as Minio.ClientOptions
        minioConnection.endPoint = 's3.amazonaws.com'
        super(minioConnection)

        this._provider = 'AwsS3'
    }
}

export = AwsS3Provider
