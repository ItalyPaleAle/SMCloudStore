# SMCloudStore

SMCloudStore is a lightweight Node.js module that offers a simple API to interact with the object storage services of multiple cloud providers, including:

- [AWS S3](https://aws.amazon.com/s3/)
- [Azure Blob Storage](https://azure.microsoft.com/en-us/services/storage/blobs/)
- [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html)
- [Google Cloud Storage](https://cloud.google.com/storage/)
- [Minio](https://minio.io/)
- Other S3-compatible providers
- …more to come!

## Features

- Simple, unified API to interact with all object storage providers
- Lightweight and flexible: each provider is published as a separate package, so installing SMCloudStore won't add SDKs for each vendor and thousands of dependencies to your projects
- Optimized for working with streams when putting/retrieving objects

This code is licensed under the terms of the MIT license (see LICENSE.md).

### SMCloudStore vs other packages

SMCloudStore is specifically focused on abstracting the differences between multiple object storage providers, as storage is the most commonly consumed API from cloud providers that isn't fully standardized. This doesn't aim to support for other services that cloud providers might offer, such as databases, VMs, etc.

- By focusing only on storage, we can keep things simple. There are few APIs and they are clear and easy to use.
- SMCloudStore is highly modular, and every provider comes with a separate NPM package. This means that you don't need to install the SDKs for every single cloud provider and all their dependencies if you plan to use only one or two of them.
- We are focusing on a modern development experience. The codebase is primarily written in TypeScript adn transpiled to JavaScript with all the typings published. We are also adopting a stream-centric approach with methods that upload and download objects from storage providers.

## Add to your project

To start, install the [smcloudstore](https://www.npmjs.com/package/smcloudstore) package:

````sh
npm install --save smcloudstore
````

Modules for each cloud provider are available on separate packages, so you can choose which ones to include. You need to install at least one of the following packages to use SMCloudStore:

- [@smcloudstore/aws-s3](https://www.npmjs.com/package/@smcloudstore/aws-s3): <br /> `npm install --save @smcloudstore/aws-s3`
- [@smcloudstore/azure-storage](https://www.npmjs.com/package/@smcloudstore/azure-storage): <br /> `npm install --save @smcloudstore/azure-storage`
- [@smcloudstore/backblaze-b2](https://www.npmjs.com/package/@smcloudstore/backblaze-b2): <br /> `npm install --save @smcloudstore/backblaze-b2`
- [@smcloudstore/google-cloud-storage](https://www.npmjs.com/package/@smcloudstore/google-cloud-storage): <br /> `npm install --save @smcloudstore/google-cloud-storage`
- [@smcloudstore/minio](https://www.npmjs.com/package/@smcloudstore/minio): <br /> `npm install --save @smcloudstore/minio`
- [@smcloudstore/generic-s3](https://www.npmjs.com/package/@smcloudstore/generic-s3): <br /> `npm install --save @smcloudstore/generic-s3`

## Nomenclature

Each cloud provider use different names for the same concept. In SMCloudStore, we're standardizing to the following nomenclature:

| SMCloudStore | AWS | Azure | Backblaze | Google Cloud | Minio |
| --- | --- | --- | --- | --- | --- |
| **Object** | Object | Blob | File | Object | Object |
| **Container** | Bucket | Container | Bucket | Bucket | Bucket |

## API Guide

Full API documentation is available on this project's [GitHub page](https://italypaleale.github.io/SMCloudStore/index.html) and in the [`/docs`](https://github.com/ItalyPaleAle/SMCloudStore/tree/master/docs) folder.

Each cloud storage provider is implemented in a class defined in one of the modules above. All providers inherit from the [`StorageProvider`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html) abstract class, which is in the `@smcloudstore/core` package.

All asynchronous methods in the examples below return Promises, which can be used as then-ables or with async/await in ES2016. The examples below show using async/await syntax, and assume that all async calls are included in async functions.

### Initialization

The main way to initialize the library is to use the [`SMCloudStore.Create(provider, connection)`](https://italypaleale.github.io/SMCloudStore/globals.html#smcloudstore) factory method. Using the factory method is recommended because it supports loading all providers with a "pluggable API", by just specifying their identifier in the first argument.

````js
// Require the package
const SMCloudStore = require('smcloudstore')

// Identifier of the provider
const provider = 'minio'

// Complete with the connection options for the provider
const connection = {
    // ...
}

// Return an instance of the cloud storage provider class
const storage = SMCloudStore.create(provider, connection)
````

The format of the `connection` argument varies by cloud provider. For more details, please refer to the README for each provider in the [`packages/`](https://github.com/ItalyPaleAle/SMCloudStore/tree/master/packages) folder.

Alternatively, you can create an instance of each provider by initializating the provider's class directly and invoking the [`constructor(connection)`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#constructor) method. For example, to create a new Azure Blob Storage provider:

````js
// Require the package
const AzureProvider = require('@smcloudstore/azure-storage')

// Complete with the connection options for the provider
const connection = {
    // ...
}

// Initialize the provider object
const storage = new AzureProvider(connection)
````

### storage.createContainer(container, [options])

Using [`storage.createContainer(container, [options])`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#createcontainer) you can create a new container on the cloud storage server. The `options` argument is a dictionary with various options, depending on the provider being used. The method returns a Promise that resolves with no value when the container has been created.

````js
// Create a new container called "testcontainer"
await storage.createContainer('testcontainer')

// Some providers, like AWS S3, require specifying a region
await storage.createContainer('testcontainer', {region: 'us-east-1'})
````

### storage.containerExists(container)

The method [`storage.containerExists(container)`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#containerexists) returns a Promise that resolves with a boolean indicating whether a container exists on the provider.

````js
// Once the async method resolves, exists will contain true or false
const exists = await storage.containerExists('testcontainer')
````

### storage.ensureContainer(container, [options])

[`storage.ensureContainer(container, [options])`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#ensurecontainer) is similar to `storage.createContainer()`, but it creates the container only if it doesn't already exist. The method returns a Promise that resolves with no value when the container has been created.

````js
// Container "testcontainer" will be created only if it doesn't already exists
await storage.ensureContainer('testcontainer')

// Some providers, like AWS S3, require specifying a region
await storage.ensureContainer('testcontainer', {region: 'us-east-1'})
````

### storage.listContainers()

The method [`storage.listContainers()`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#listcontainers) returns a Promise that resolves with the list of names of the containers that the user owns on the storage server.

````js
// List all containers the user owns
const containers = await storage.listContainers()
// Result is an array of strings, like: ['testcontainer', 'testcontainer2']
````

### storage.deleteContainer(container)

The method [`storage.deleteContainer(container)`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#deletecontainer) deletes a container from the storage server. It returns a Promise that resolves with no value on success.

````js
// Delete a container
await storage.deleteContainer('testcontainer')
````

### storage.putObject(container, path, data, [options])

[`storage.putObject(container, path, data, [options])`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#putobject) is the method to put (upload) an object to the storage server.

Arguments are:

- `container`: name of the destination container.
- `path`: full path inside the container where to store the object.
- `data`: the data to be uploaded. This could be a Readable Stream, or a string or Buffer containing the full data. Streams are preferred when dealing with larger amounts of data.
- `options`: dictionary with options. Options are primarily provider-dependent, so please refer to the documentation for each provider for more information. The list below includes only the common ones
  - `options.metadata`: object containing custom metadata and properties. An important key in the metadata object is `Content-Type`, which sets the Content-Type header for the file. Some providers might have special treatment for other keys too.

The method returns a Promise that resolves with no value when the upload is complete.

````js
// Upload a stream
const data = require('fs').createReadStream('someimage.jpg')
const options = {
    metadata: {
        'Content-Type': 'image/jpeg'
    }
}
await storage.putObject('testcontainer', 'directory/someimage.jpg', data, options)

// Upload the content of a string or Buffer
const data = 'Nel mezzo del cammin di nostra vita mi ritrovai per una selva oscura ché la diritta via era smarrita'
const options = {
    metadata: {
        'Content-Type': 'text/plain'
    }
}
await storage.putObject('testcontainer', 'directory/dante.txt', data, options)
````

### storage.getObject(container, path)

[`storage.getObject(container, path)`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#getobject) allows getting (downloading) an object from the storage server.

Arguments are:

- `container`: name of the container with the object.
- `path`: full path of the object to retrieve, inside the container.

The method returns a Promise that resolves with a Readable Stream.

````js
// Retrieve a file
const stream = await storage.getObject('testcontainer', 'directory/someimage.jpg')

// The method returns a Readable Stream that can be processed as you wish
// For example, to write the stream to file:
stream.pipe(require('fs').createWriteStream('write/to/someimage.jpg'))
````

### storage.getObjectAsBuffer(container, path)

[`storage.getObjectAsBuffer(container, path)`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#getobjectasbuffer) behaves similarly to `storage.getObject()`, accepting the same arguments, but returns the data in a Buffer object loaded in memory.

````js
// Retrieve a file as buffer
const buffer = await storage.getObjectAsBuffer('testcontainer', 'directory/someimage.jpg')

// Print the last 100 bytes from the Buffer
console.log(buffer.slice(-100))
````

### storage.getObjectAsString(container, path)

[`storage.getObjectAsString(container, path)`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#getobjectasstring) behaves similarly to `storage.getObject()`, accepting the same arguments, but returns the data as a utf8-encoded string.

````js
// Retrieve a file as string
const string = await storage.getObjectAsString('testcontainer', 'textfile.txt')

// Print the string
console.log(string)
````

### storage.listObjects(container, [prefix])

[`storage.listObjects(container, [prefix])`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#listobjects) returns a list of all the objects on the storage server at the specified path. This method does not recursively walk into directories (real or virtual, separated by a slash character). If `prefix` is not specified, the method will list the root "folder".

The method returns a Promise that resolves with an array of objects of type [`ListItemObject`](https://italypaleale.github.io/SMCloudStore/interfaces/listitemobject.html), containing information for an object on the server, or [`ListItemPrefix`](https://italypaleale.github.io/SMCloudStore/interfaces/listitemprefix.html), containing information for a prefix (folder).

````js
// Retrieve the list of objects
const list = await storage.listObjects('testcontainer', '/')

// List is an array of elements representing objects or prefixes

// Prefixes have the structure
{
    prefix: '/path'
}

// Object have the structure
{
    path: '/path/to/file.jpg',
    size: 123, // Size in bytes
    lastModified: Date() // Date object
    // Some providers might return more data, such as contentType, contentMD5, contentSHA1, and creationTime. Please refer to the documentation for details.
}
````

### storage.deleteObject(container, path)

The method [`storage.deleteObject(container, path)`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#deleteobject) deletes an object from a container in the storage server. It returns a Promise that resolves with no value on success.

````js
// Delete an object
await storage.deleteObject('testcontainer', 'path/to/file.jpg')
````

### storage.presignedGetUrl(container, path, [ttl])

The method [`storage.presignedGetUrl(container, path, [ttl])`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#presignedgeturl) returns a Promise that resolves with a pre-signed URL that can be used to download an object using any client (e.g. a web browser).

The `ttl` parameter determines how long the signed URL will be valid for, in seconds from present time.

````js
// Get the pre-signed URL
const url = await storage.presignedGetUrl('testcontainer', 'path/to/file.jpg', 60)
// Result is a full URL, like "https://storage.provider/path?token=..."
````

The URL can be used to retrieve the object. For example, using curl:

````sh
curl "https://storage.provider/path?token=..." > /path/to/destination/file
````

Note that **some providers do not support this method** (Backblaze B2), and will throw an exception every time it's called.

### stor age.presignedPutUrl(container, path, [options], [ttl])

The method [`storage.presignedPutUrl(container, path, [options], [ttl])`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#presignedputurl) returns a Promise that resolves with a pre-signed URL that can be used to upload an object to the server, using a PUT request from any client.

The `options` argument can be used by the provider to specify certain requirements for clients that will upload files. For example, it can be used to enforce a certain `Content-Type` header, etc. Its values are the same they are for the `putObject` method. Some providers ignore this value - please refer to the documentation for each provider for more details.

The `ttl` parameter determines how long the signed URL will be valid for, in seconds from present time.

````js
// Get the pre-signed URL
const url = await storage.presignedPutUrl('testcontainer', 'path/to/file.jpg', {}, 60)
// Result is a full URL, like "https://storage.provider/path?token=..."
````

The URL can be used to upload an object. For example, using curl:

````sh
curl --request PUT --upload-file "/path/to/file" "https://storage.provider/path?token=..." 
````

Note that **some providers do not support this method** (Backblaze B2), and will throw an exception every time it's called. Other providers, like Azure Storage, require clients to specify certain options when sending the PUT request; please refer to each provider's documentation.

### storage.client()

[`storage.client()`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#client) is a getter that exposes the underlying client for the storage provider, allowing for interaction with the provider directly. This is useful for advanced scenarios, such as needing to invoke provider-specific methods that aren't available in SMCloudStore.

### storage.provider()

[`storage.provider()`](https://italypaleale.github.io/SMCloudStore/classes/core.storageprovider.html#provider) returns the identifier (name) of the storage provider currently in use, for example `generic-s3`.
