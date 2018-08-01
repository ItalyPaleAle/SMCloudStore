/*eslint-env mocha */

'use strict'

const assert = require('assert')
const SMCloud = require('../index')
const randomstring = require('randomstring')
const digestStream = require('digest-stream')
const fs = require('fs')

const authData = require('./data/auth')

const genContainerName = () => {
    return randomstring.generate({
        length: 8,
        charset: 'alphabetic',
        capitalization: 'lowercase'
    })
}

describe('Minio provider', function() {

    // Will hold a client instance
    let client

    // Will contain a list of containers created for this test
    let containers = []

    // Will contain a list of test files
    const testFiles = [
        {
            file: 'test/data/benni-asal-756919-unsplash.jpg',
            destination: 'testimage.jpg',
            contentType: 'image/jpeg',
            size: 647173,
            digest: '1007c9d3516b054546a96754ae4651a2edaea5b7'
        },
        {
            file: 'test/data/pg1008.txt',
            destination: 'sub/folder/poem.txt',
            contentType: 'text/plain',
            size: 893449,
            digest: '1d97b282a762d4b7b21c5bed5216cf8db2b3c54a'
        },
        {
            string: 'M\'illumino d\'immenso',
            destination: 'test/strings/poem.txt',
            contentType: 'text/plain',
            size: 20,
            digest: 'c07707cf9912ed73615dcf4cf7f21523dbaab329'
        },
        {
            buffer: fs.readFileSync('test/data/pg1008.txt'),
            destination: 'test/buffers/poem.txt',
            contentType: 'text/plain',
            size: 893449,
            digest: '1d97b282a762d4b7b21c5bed5216cf8db2b3c54a'
        }        
    ]

    // Enable bailing if a test fails
    this.bail(true)

    it('constructor', function() {
        client = SMCloud.Create('minio', authData.minio)
        assert(client)

        assert.throws(() => {
            // Empty connection
            SMCloud.Create('minio', {})
        }, /connection argument/i)

        assert.throws(() => {
            // Missing endPoint
            SMCloud.Create('minio', {
                accessKey: authData.minio.accessKey,
                secretKey: authData.minio.secretKey
            })
        }, /invalid endpoint/i)
    })

    it('createContainer', async function() {
        // Create 3 randomly-named containers
        for (let i = 0; i < 3; i++) {
            containers.push(genContainerName())
            await client.createContainer(containers[i])
        }

        // Creating a container that already exists should fail
        assert.rejects(client.createContainer(containers[0]))
    })

    it('containerExists', async function() {
        let exists

        exists = await client.containerExists(containers[0])
        assert(exists === true)

        exists = await client.containerExists('doesnotexist')
        assert(exists === false)
    })

    it('ensureContainer', async function() {
        // New container
        const name = genContainerName()
        containers.push(name)
        await client.ensureContainer(name)

        // Existing container
        await client.ensureContainer(containers[0])
    })

    it.skip('listContainers', async function() {
        // Sort our list
        containers = containers.sort()

        // Ensure that we have the containers we created before
        const list = await client.listContainers()
        assert.deepEqual(list, containers)
    })

    it('deleteContainer', async function() {
        // Delete the last container in the list
        const name = containers.pop()
        await client.deleteContainer(name)

        // Deleting a container that doesn't exist
        assert.rejects(client.deleteContainer('doesnotexist'))
    })

    it('putObject', async function() {
        // Increase timeout
        this.timeout(15000)

        // Upload some files, in parallel
        const promises = []
        for (const i in testFiles) {
            let upload
            // Stream
            if (testFiles[i].file) {
                upload = fs.createReadStream(testFiles[i].file)
            }
            // String
            else if (testFiles[i].string) {
                upload = testFiles[i].string
            }
            // Buffer
            else if (testFiles[i].buffer) {
                upload = testFiles[i].buffer
            }

            // Metadata
            const metadata = {
                'Content-Type': testFiles[i].contentType
            }

            // Promise
            const p = client.putObject(containers[0], testFiles[i].destination, upload, metadata)
            promises.push(p)
        }
        await Promise.all(promises)
    })

    it('listObjects', async function() {
        // Function that checks the list returned by the server with what we expect
        // Based on https://stackoverflow.com/a/34566587
        const listEqual = (list, expect) => {
            // First, check for length differences
            if (list.length !== expect.length) {
                return false
            }

            // Convert each object in the array to a string so we can ignore the lastModified object
            const elemToString = (elem) => {
                if (elem.lastModified && elem.lastModified instanceof Date) {
                    elem.lastModified = 'date'
                }
                return JSON.stringify(elem)
            }
            const listStr = list.map(elemToString)
            const expectStr = expect.map(elemToString)

            // Then, check if all elements of list are in expect, and all elements of expect are in list
            const containsAll = (arr1, arr2) => {
                return arr2.every(arr2Item => arr1.includes(arr2Item))
            }
            return containsAll(listStr, expectStr) && containsAll(expectStr, listStr)
        }

        // Check recursively
        const testPath = async (path) => {
            const list = await client.listObjects(containers[0], path)

            // Check if it's what we were expecting
            const expect = []
            let expectFolders = []
            for (const i in testFiles) {
                const e = testFiles[i]
                // Files and folders inside the current path
                if (e.destination.startsWith(path)) {
                    // Check if we are expecting a folder
                    const substringEnd = e.destination.indexOf('/', path.length)
                    // We're expecting to find a folder
                    if (~substringEnd) {
                        const expectFolder = e.destination.substring(0, substringEnd)
                        expectFolders.push(expectFolder)
                    }
                    // We're expecting to find a file
                    else {
                        expect.push({
                            path: e.destination,
                            lastModified: 'date',
                            size: e.size
                        })
                    }
                }
            }

            // Filter the expectFolder list for duplicates
            expectFolders = expectFolders.filter((v, i, a) => {
                return a.indexOf(v) === i
            })

            // Add folders to the expect list, and start recursion
            for (const i in expectFolders) {
                expect.push({prefix: expectFolders[i] + '/'})

                assert(await testPath(expectFolders[i] + '/'))
            }

            // Ensure that the list matches what's returned
            return listEqual(list, expect)
        }
        assert(await testPath(''))
    })

    it('getObject', async function() {
        // Increase timeout
        this.timeout(15000)

        // Download the first 3 files and check their sha1 digest, in parallel
        const promises = []
        for (let i = 0; i < 3; i++) {
            const e = testFiles[i]

            const p = client.getObject(containers[0], e.destination)
                .then((stream) => {
                    return new Promise((resolve, reject) => {
                        stream
                            .pipe(digestStream('sha1', 'hex', (digest, length) => {
                                assert(length == e.size)
                                assert(digest == e.digest)
                                resolve()
                            }))
                            .on('error', (err) => {
                                reject(err)
                            })
                            .resume()
                    })
                })
            promises.push(p)
        }

        await Promise.all(promises)
    })

    it('removeObject', async function() {
        // Delete all files uploaded, in parallel
        const promises = []
        for (const i in testFiles) {
            promises.push(client.removeObject(containers[0], testFiles[i].destination))
        }
        await Promise.all(promises)
    })

    // Delete all containers that we created
    // Should fail if the containers aren't empty
    after(async function() {
        const promises = []
        for (const i in containers) {
            promises.push(client.deleteContainer(containers[i]))
        }
        await Promise.all(promises)
    })
})
