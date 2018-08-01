'use strict'

const SMCloud = {
    /**
     * Initializes a new client to interact with cloud providers' object storage services.
     * 
     * @param {string} provider - Name of the cloud provider to use (see `SMCloud.Providers`)
     * @param {Object} connection - Dictionary with connection options. List of keys is specific for every cloud provider
     * @returns {Object} An instance of a cloud provider module
     */
    Create: (provider, connection) => {
        // Validate arguments
        const supportedProviders = SMCloud.Providers()
        if (!provider || typeof provider !== 'string' || !supportedProviders.includes(provider)) {
            throw Error('The specified provider is not valid. Valid providers inlcude: ' + supportedProviders.join(', '))
        }

        if (!connection) {
            throw Error('The connection argument must be non-empty')
        }

        // Require the specific provider, then initialize it
        const providerModule = require('./providers/' + provider + '.js')
        return new providerModule(connection)
    },

    /**
     * Returns a list of supported providers.
     * 
     * @returns {String[]} List of supported provider names
     */
    Providers: () => {
        return [
            'azure',
            'minio'
        ]
    }
}

module.exports = SMCloud
