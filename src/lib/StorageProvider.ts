'use strict'

/** Dictionary of objects returned when listing a container. */
export interface ListItemObject {
    /** Full path of the object inside the container */
    path: string
    /** Size in bytes of the object */
    size: number
    /** Date when the object was last modified */
    lastModified: Date
    /** Date when the object was created */
    creationTime?: Date
    /** Content-Type header of the object, if present */
    contentType?: string
    /** MD5 digest of the object, if present */
    contentMD5?: string
}

/** Dictionary of prefixes returned when listing a container. */
export interface ListItemPrefix {
    /** Name of the prefix */
    prefix: string
}

/** The `listObjects` method returns an array with a mix of objects of type `ListItemObject` and `ListItemPrefix` */
export type ListResults = Array<ListItemObject|ListItemPrefix>

/**
 * Base class for all storage providers.
 */
export abstract class StorageProvider {
    protected _client: any
    protected _provider: string

    /**
     * Initializes a new storage provider
     */
    constructor() {
        this._client = null
        this._provider = null
    }
    
    /**
     * Returns the name of the provider
     * @returns Provider name
     */
    get provider(): string {
        return this._provider
    }

    /**
     * Returns an instance of the client object, to interact with the cloud provider directly
     * @returns Client object
     */
    get client(): any {
        return this._client
    }
}
