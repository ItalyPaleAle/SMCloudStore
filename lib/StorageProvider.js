'use strict'

/**
 * @class StorageProvider
 * Base class for all storage providers.
 */
class StorageProvider {
    /**
     * Initializes a new storage provider
     */
    constructor() {
        this._client = null
        this._provider = null
    }
    
    /**
     * Returns the name of the provider
     * @returns {string} Provider name
     */
    get provider() {
        return this._provider
    }

    /**
     * Returns an instance of the client object, to interact with the cloud provider directly
     * @returns {Object} Client object
     */
    get client() {
        return this._client
    }
}

module.exports = StorageProvider
