/*eslint-env mocha */

'use strict'

const assert = require('assert')
const SMCloudStore = require('../../index')
const randomstring = require('randomstring')
const digestStream = require('digest-stream')
const fs = require('fs')

const authData = require('../data/auth')

module.exports = (providerName, testSuiteOptions) => {
    const genContainerName = () => {
        const parts = []

        if (testSuiteOptions && testSuiteOptions.containerNamePrefix) {
            parts.push(testSuiteOptions.containerNamePrefix)
        }

        parts.push(randomstring.generate({
            length: 8,
            charset: 'alphabetic',
            capitalization: 'lowercase'
        }))

        return parts.join('-')
    }

    describe('Test suite for ' + providerName, function() {

        // Set default timeout to 10s and slow warning to 1s
        this.timeout(10000)
        this.slow(1000)

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
                digestMD5: 'eab029bf064a2a44cbfb46264606f7d3',
                digestSHA1: '1007c9d3516b054546a96754ae4651a2edaea5b7'
            },
            {
                file: 'test/data/pg1008.txt',
                destination: 'sub/folder/poem.txt',
                contentType: 'text/plain',
                size: 893449,
                digestMD5: 'c0656985bed744013a8003af58cc83bf',
                digestSHA1: '1d97b282a762d4b7b21c5bed5216cf8db2b3c54a'
            },
            {
                string: 'M\'illumino d\'immenso',
                destination: 'test/strings/poem.txt',
                contentType: 'text/plain',
                size: 20,
                digestMD5: '0ba618099a4475a45887d4022340b72b',
                digestSHA1: 'c07707cf9912ed73615dcf4cf7f21523dbaab329'
            },
            {
                buffer: fs.readFileSync('test/data/pg1008.txt'),
                destination: 'test/buffers/poem.txt',
                contentType: 'text/plain',
                size: 893449,
                digestMD5: 'c0656985bed744013a8003af58cc83bf',
                digestSHA1: '1d97b282a762d4b7b21c5bed5216cf8db2b3c54a'
            }
        ]

        // Enable bailing if a test fails
        this.bail(true)

        it('constructor', function() {
            client = SMCloudStore.Create(providerName, authData[providerName])
            assert(client)
        })

        it('createContainer', async function() {
            // Create 2 randomly-named containers
            for (let i = 0; i < 2; i++) {
                containers.push(genContainerName())
                await client.createContainer(containers[i], (testSuiteOptions && testSuiteOptions.region))
            }
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
            await client.ensureContainer(containers[0], (testSuiteOptions && testSuiteOptions.region))
        })

        it('listContainers', async function() {
            // Sort our list
            containers = containers.sort()

            // Ensure that we have the containers we created before
            const list = await client.listContainers()
            assert(list && list.length >= containers.length)
            for (const i in containers) {
                assert(list.includes(containers[i]))
            }
        })

        it('deleteContainer', async function() {
            // Delete the last container in the list
            const name = containers.pop()
            await client.deleteContainer(name)

            // Deleting a container that doesn't exist
            await assert.rejects(client.deleteContainer('doesnotexist'))
        })

        it('putObject', async function() {
            // Increase timeout
            this.timeout(60000)
            this.slow(0)

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
            // Sort objects by key
            // Based on https://stackoverflow.com/a/31725356/192024
            const ksort = (obj) => {
                const keys = Object.keys(obj)
                keys.sort()
                return keys.reduce((target, key) => {
                    target[key] = obj[key]
                    return target
                }, {})
            }

            // Function that checks the list returned by the server with what we expect
            // Based on https://stackoverflow.com/a/34566587
            const listEqual = (list, expect) => {
                // First, check for length differences
                if (list.length !== expect.length) {
                    return false
                }

                // Convert each object in the array to a string so we can ignore the lastModified and creationTime objects
                const elemToString = (elem) => {
                    if (elem.lastModified && elem.lastModified instanceof Date) {
                        elem.lastModified = 'date'
                    }
                    if (elem.creationTime && elem.creationTime instanceof Date) {
                        elem.creationTime = 'date'
                    }
                    elem = ksort(elem)
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
            const listObjectOptions = (testSuiteOptions && testSuiteOptions.listObjects) || []
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
                            const expectEl = {
                                path: e.destination,
                                lastModified: 'date',
                                size: e.size
                            }
                            if (listObjectOptions.includes('includeContentMD5')) {
                                expectEl.contentMD5 = e.digestMD5
                            }
                            if (listObjectOptions.includes('includeContentType')) {
                                expectEl.contentType = e.contentType
                            }
                            if (listObjectOptions.includes('includeCreationTime')) {
                                expectEl.creationTime = 'date'
                            }
                            expect.push(expectEl)
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
            this.timeout(60000)
            this.slow(0)

            // Download the first 3 files and check their sha1 digest, in parallel
            const promises = []
            for (let i = 0; i < 3; i++) {
                const e = testFiles[i]

                const p = client.getObject(containers[0], e.destination)
                    .then((stream) => {
                        return new Promise((resolve, reject) => {
                            stream
                                .on('error', (err) => {
                                    reject(err)
                                })
                                .pipe(digestStream('sha1', 'hex', (digest, length) => {
                                    assert(length == e.size)
                                    assert(digest == e.digestSHA1)
                                    resolve()
                                }))
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
}
