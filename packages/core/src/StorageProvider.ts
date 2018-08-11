'use strict'

import {Stream} from 'stream'

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

    /**
     * Creates a container on the server.
     * 
     * @param container - Name of the container
     * @param region - Region in which to create the container; some providers might ignore this
     * @returns Promise that resolves once the container has been created. The promise doesn't contain any meaningful return value.
     * @async
     */
    abstract createContainer(container: string, region?: string): Promise<void>

    /**
     * Checks if a container exists.
     * 
     * @param container - Name of the container
     * @returns Promises that resolves with a boolean indicating if the container exists.
     * @async
     */
    abstract containerExists(container: string): Promise<boolean>

    /**
     * Creates a container on the server if it doesn't already exist.
     * 
     * @param container - Name of the container
     * @param region - Region in which to create the container; some providers might ignore this
     * @returns Promise that resolves once the container has been created
     * @async
     */
    abstract ensureContainer(container: string, region?: string): Promise<void>

    /**
     * Lists all containers belonging to the user
     * 
     * @returns Promise that resolves with an array of all the containers
     * @async
     */
    abstract listContainers(): Promise<string[]>

    /**
     * Removes a contaienr from the server
     * 
     * @param container - Name of the container
     * @returns Promise that resolves once the container has been removed
     * @async
     */
    abstract deleteContainer(container: string): Promise<void>

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
    abstract putObject(container: string, path: string, data: Stream|string|Buffer, metadata?: any): Promise<void>

    /**
     * Requests an object from the server. The method returns a Promise that resolves to a Readable Stream containing the data.
     * 
     * @param container - Name of the container
     * @param path - Path of the object, inside the container
     * @returns Readable Stream containing the object's data
     * @async
     */
    abstract getObject(container: string, path: string): Promise<Stream>

    /**
     * Returns a list of objects with a given prefix (folder). The list is not recursive, so prefixes (folders) are returned as such.
     * 
     * @param container - Name of the container
     * @param prefix - Prefix (folder) inside which to list objects
     * @returns List of elements returned by the server
     * @async
     */
    abstract listObjects(container: string, prefix: string): Promise<ListResults>

    /**
     * Removes an object from the server
     * 
     * @param container - Name of the container
     * @param path - Path of the object, inside the container
     * @returns Promise that resolves once the object has been removed
     * @async
     */
    abstract removeObject(container: string, path: string): Promise<void>
}
