/*eslint-env mocha */

'use strict'

const assert = require('assert')
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
        // Load the provider's class
        const Provider = require('../../packages/' + providerName)

        // Set default timeout to 10s and slow warning to 1s
        this.timeout(15000)
        this.slow(2000)

        // Will hold a client instance
        let storage

        // Will contain a list of containers created for this test
        const containers = []

        // Contains a list of test files
        const testFiles = require('../data/test-files')
        const largeFiles = require('../data/large-files')

        // Enable bailing (skip further tests) if a test fails
        this.bail(true)

        before(function() {
            if (testSuiteOptions.beforeTests) {
                testSuiteOptions.beforeTests()
            }
        })

        it('constructor', function() {
            storage = new Provider(authData[providerName])
            assert(storage)
        })

        it('provider', function() {
            // Should return the provider name
            assert(storage.provider === providerName)
        })

        it('client', function() {
            // Access the client directly
            assert(typeof storage.client === 'object' && storage.client)
        })

        it('createContainer', async function() {
            // Create 2 randomly-named containers
            for (let i = 0; i < 2; i++) {
                containers.push(genContainerName())
                await storage.createContainer(containers[i], (testSuiteOptions && testSuiteOptions.createContainerOptions))
            }
        })

        it.skip('containerExists', async function() {
            let exists

            exists = await storage.containerExists(containers[0])
            assert(exists === true)

            exists = await storage.containerExists('doesnotexist')
            assert(exists === false)
        })

        it.skip('ensureContainer', async function() {
            // New container
            const name = genContainerName()
            containers.push(name)
            await storage.ensureContainer(name, (testSuiteOptions && testSuiteOptions.region))

            // Existing container
            await storage.ensureContainer(containers[0], (testSuiteOptions && testSuiteOptions.region))
        })

        it.skip('listContainers', async function() {
            // Ensure that we have the containers we created before
            const list = await storage.listContainers()
            assert(list && list.length >= containers.length)
            for (const i in containers) {
                assert(list.includes(containers[i]))
            }
        })

        // Wait 2 seconds because some providers (like AWS) might cause failures otherwise
        it.skip('…waiting…', async function() {
            this.slow(10000)
            this.timeout(3000)

            await new Promise((resolve, reject) => {
                setTimeout(resolve, 2000)
            })
        })

        it.skip('deleteContainer', async function() {
            // Delete the last container in the list
            const name = containers.pop()
            await storage.deleteContainer(name)

            // Deleting a container that doesn't exist
            await assert.rejects(storage.deleteContainer('doesnotexist'))
        })

        it('putObject', async function() {
            // Increase timeout
            this.timeout(60000)
            this.slow(0)

            // Upload some files, in parallel
            const promises = []
            const addTests = (files) => {
                for (const i in files) {
                    let upload
                    // Stream
                    if (files[i].file) {
                        upload = fs.createReadStream(files[i].file)
                    }
                    // String
                    else if (files[i].string) {
                        upload = files[i].string
                    }
                    // Buffer
                    else if (files[i].buffer) {
                        upload = files[i].buffer
                    }

                    // Metadata
                    const metadata = {
                        'Content-Type': files[i].contentType
                    }

                    // Promise
                    const p = storage.putObject(containers[0], files[i].destination, upload, metadata)
                    promises.push(p)
                }
            }
            //addTests(testFiles)

            // Check if we need to test with large files
            if (testSuiteOptions.largeFiles) {
                addTests(largeFiles)
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
                const list = await storage.listObjects(containers[0], path)

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

                const p = storage.getObject(containers[0], e.destination)
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

        it('getObjectAsBuffer', async function() {
            // Increase timeout
            this.timeout(60000)
            this.slow(0)

            // Read a file as Buffer and compare the content
            return storage.getObjectAsBuffer(containers[0], testFiles[3].destination)
                .then((buffer) => {
                    assert(buffer.equals(testFiles[3].buffer))
                })
        })

        it('getObjectAsString', async function() {
            // Increase timeout
            this.timeout(60000)
            this.slow(0)

            // Read a file as Buffer and compare the content
            return storage.getObjectAsString(containers[0], testFiles[2].destination)
                .then((str) => {
                    assert(str == testFiles[2].string)
                })
        })

        it('deleteObject', async function() {
            // Delete all files uploaded, in parallel
            const promises = []
            for (const i in testFiles) {
                promises.push(storage.deleteObject(containers[0], testFiles[i].destination))
            }
            await Promise.all(promises)
        })

        // Delete all containers that we created
        // Should fail if the containers aren't empty
        after(async function() {
            const promises = []
            for (const i in containers) {
                promises.push(storage.deleteContainer(containers[i]))
            }
            await Promise.all(promises)
        })
    })
}
