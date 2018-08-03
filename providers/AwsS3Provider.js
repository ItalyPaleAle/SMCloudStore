'use strict'

const MinioProvider = require('./MinioProvider')

/**
 * Connection options for an AwsS3 provider.
 * @typedef {Object} AwsS3ConnectionOptions
 * @param {string} accessKey - Access Key for the server
 * @param {string} secretKey - Secret Key for the server
 * @param {boolean} [secure=true] - If true (default), connect via HTTPS
 */

/**
 * @class AwsS3Provider
 * Client to interact with AWS S3. It is based on the MinioProvider class.
 */
class AwsS3Provider extends MinioProvider {
    /**
     * Initializes a new client to interact with AWS S3.
     * 
     * @param {AwsS3ConnectionOptions} connection - Dictionary with connection options.
     */
    constructor(connection) {
        if (!connection || !Object.keys(connection).length) {
            throw new Error('Connection argument is empty')
        }

        connection.endPoint = 's3.amazonaws.com'
        super(connection)
    }
}

module.exports = AwsS3Provider
