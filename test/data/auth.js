'use strict'

/* eslint-disable no-unreachable */

// DELETE THIS LINE AFTER SETTING AUTH INFO
throw Error('Missing authorization info for cloud providers')

module.exports = {
    // Minio
    'minio': {
        endPoint: 'localhost',
        port: 9001,
        secure: false,
        accessKey: '8O683FBOQPTVBLX8T11M',
        secretKey: 'ulTofsUnwmgnYLR8I6D4IbFD9N/NJ+XJ0X84bxrH'
    },

    // Azure
    'azure-storage': 'DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net',

    // AWS
    'aws-s3': {
        accessKey: '...',
        secretKey: '...'
    },
    
    // Generic S3
    'generic-s3': {
        endPoint: 's3.amazonaws.com',
        accessKey: '...',
        secretKey: '...',
        region: 'ca-central-1'
    },

    // Google Cloud
    'google-cloud-storage': {
        projectId: '...',
        keyFilename: '/path/to/file.json'
    }
}
