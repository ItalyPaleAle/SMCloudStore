/*eslint-env mocha */

'use strict'

const assert = require('assert')
const randomstring = require('randomstring')
const digestStream = require('digest-stream')
const fs = require('fs')
const request = require('request')
const StreamUtils = require('../../packages/core/dist/StreamUtils')

const authData = require('../data/auth')

module.exports = (providerName, testSuiteOptions) => {
    if (!testSuiteOptions) {
        testSuiteOptions = {}
    }
    
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

    const waitingTest = async function() {
        this.slow(10000)
        this.timeout(3000)

        await new Promise((resolve, reject) => {
            setTimeout(resolve, 2000)
        })
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
        const presignedFiles = require('../data/presigned-files')

        // Enable bailing (skip further tests) if a test fails
        this.bail(true)

        before(function() {
            if (testSuiteOptions && testSuiteOptions.beforeTests) {
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

        // Wait 2 seconds because some providers (like AWS) might cause failures otherwise
        it('…waiting…', waitingTest)

        it('containerExists', async function() {
            let exists

            exists = await storage.containerExists(containers[0])
            assert(exists === true)

            exists = await storage.containerExists(containers[0] + '-2')
            assert(exists === false)

            exists = await storage.containerExists('doesnotexist')
            assert(exists === false)
        })

        it('ensureContainer', async function() {
            // New container
            const name = genContainerName()
            containers.push(name)
            await storage.ensureContainer(name, (testSuiteOptions && testSuiteOptions.createContainerOptions))

            // Existing container
            await storage.ensureContainer(containers[0], (testSuiteOptions && testSuiteOptions.createContainerOptions))
        })

        // Wait 2 seconds because some providers (like AWS) might cause failures otherwise
        it('…waiting…', waitingTest)

        it('listContainers', async function() {
            // Ensure that we have the containers we created before
            const list = await storage.listContainers()
            assert(list && list.length >= containers.length)
            for (const el of containers) {
                assert(list.includes(el))
            }
        })

        it('deleteContainer', async function() {
            // Delete the last container in the list
            const name = containers.pop()
            await storage.deleteContainer(name)

            // Deleting a container that doesn't exist
            await assert.rejects(storage.deleteContainer('doesnotexist'))
        })

        it('putObject', async function() {
            // Increase timeout
            this.timeout(120000)
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

                    // Options & metadata
                    const options = {
                        metadata: {
                            'Content-Type': files[i].contentType
                        }
                    }

                    // Promise
                    const p = storage.putObject(containers[0], files[i].destination, upload, options)
                    promises.push(p)
                }
            }
            addTests(testFiles)

            // Check if we need to test with large files
            if (testSuiteOptions && testSuiteOptions.testLargeFiles) {
                addTests(largeFiles)
            }

            await Promise.all(promises)
        })

        it('listObjects', async function() {
            // Increase timeout
            this.timeout(60000)

            let fileList = testFiles
            if (testSuiteOptions && testSuiteOptions.testLargeFiles) {
                fileList = fileList.concat(largeFiles)
            }

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
                for (const file of fileList) {
                    // Files and folders inside the current path
                    if (file.destination.startsWith(path)) {
                        // Check if we are expecting a folder
                        const substringEnd = file.destination.indexOf('/', path.length)
                        // We're expecting to find a folder
                        if (~substringEnd) {
                            const expectFolder = file.destination.substring(0, substringEnd)
                            expectFolders.push(expectFolder)
                        }
                        // We're expecting to find a file
                        else {
                            const expectEl = {
                                path: file.destination,
                                lastModified: 'date',
                                size: file.size
                            }
                            if (listObjectOptions.includes('includeContentMD5')) {
                                expectEl.contentMD5 = file.digestMD5
                            }
                            if (listObjectOptions.includes('includeContentType')) {
                                expectEl.contentType = file.contentType
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
            this.timeout(120000)
            this.slow(0)

            // Download the first 3 files and check their sha1 digest, in parallel
            const promises = []
            for (let i = 0; i < 3; i++) {
                const e = testFiles[i]

                const p = storage.getObject(containers[0], e.destination)
                    .then((stream) => {
                        // Ensure result is a Readable Stream
                        assert(StreamUtils.IsReadableStream(stream))

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

            // If we uploaded large files, test with one of those too
            if (testSuiteOptions && testSuiteOptions.testLargeFiles) {
                promises.push(storage.getObject(containers[0], largeFiles[0].destination)
                    .then((stream) => {
                        // Ensure result is a Readable Stream
                        assert(StreamUtils.IsReadableStream(stream))

                        return new Promise((resolve, reject) => {
                            stream
                                .on('error', (err) => {
                                    reject(err)
                                })
                                .pipe(digestStream('sha1', 'hex', (digest, length) => {
                                    assert(length == largeFiles[0].size)
                                    assert(digest == largeFiles[0].digestSHA1)
                                    resolve()
                                }))
                                .resume()
                        })
                    }))
            }

            await Promise.all(promises)
        })

        it('getObjectAsBuffer', async function() {
            // Increase timeout
            this.timeout(120000)
            this.slow(0)

            // Read a file as Buffer and compare the content
            return storage.getObjectAsBuffer(containers[0], testFiles[3].destination)
                .then((buffer) => {
                    assert(buffer.equals(testFiles[3].buffer))
                })
        })

        it('getObjectAsString', async function() {
            // Increase timeout
            this.timeout(120000)
            this.slow(0)

            // Read a file as Buffer and compare the content
            return storage.getObjectAsString(containers[0], testFiles[2].destination)
                .then((str) => {
                    assert(str == testFiles[2].string)
                })
        })

        it('presignedPutUrl', async function() {
            // Skip if the provider doesn't support this
            if (testSuiteOptions.skipPresignedUrlTests) {
                assert.throws(() => {
                    storage.presignedGetUrl()
                })
                return
            }

            // Increase timeout
            this.timeout(120000)
            this.slow(0)

            const file = presignedFiles[0]

            // Get a URL to upload a file
            const uploadUrl = await storage.presignedPutUrl(containers[0], file.destination, {
                metadata: {
                    'Content-Type': file.contentType
                }
            })

            // Ensure this is a URL
            assert(uploadUrl)
            assert(uploadUrl.substr(0, 4) == 'http')

            // Try uploading a file via PUT
            await new Promise((resolve, reject) => {
                const headers = Object.assign(
                    {},
                    testSuiteOptions.signedPutRequestHeaders || {},
                    {'Content-Type': file.contentType}
                )
                const options = {
                    body: file.string,
                    headers: headers
                }
                request.put(uploadUrl, options, (error, response, body) => {
                    if (error) {
                        reject(error)
                    }

                    // Ensure status code is a successful one
                    if (!response || !response.statusCode || response.statusCode < 200 || response.statusCode > 299) {
                        // eslint-disable-next-line no-console
                        console.log(response.statusCode, body)
                        return reject(Error('Invalid response status code'))
                    }
                    
                    resolve()
                })
            })
        })

        it('presignedGetUrl', async function() {
            // Skip if the provider doesn't support this
            if (testSuiteOptions.skipPresignedUrlTests) {
                assert.throws(() => {
                    storage.presignedGetUrl()
                })
                return
            }

            // Get the pre-signed URL for some files, in parallel
            const promises = []
            for (let i = 0; i < 3; i++) {
                const e = testFiles[i]

                const p = storage.presignedGetUrl(containers[0], e.destination)
                    .then((url) => {
                        assert(url)
                        assert(url.substr(0, 4) == 'http')
                    })
                promises.push(p)
            }
            await Promise.all(promises)

            // Request also the URL for the file that was just uploaded
            const testUrl = await storage.presignedGetUrl(containers[0], presignedFiles[0].destination)

            // Request one of the URLs that was returned, to ensure it actually works
            await new Promise((resolve, reject) => {
                request(testUrl, (error, response, body) => {
                    if (error) {
                        reject(error)
                    }

                    if (!body) {
                        return reject(Error('Empty response'))
                    }
                    assert(body == presignedFiles[0].string)

                    // Test the Content-Type header
                    assert(response.headers && response.headers['content-type'] == presignedFiles[0].contentType)

                    resolve()
                })
            })
        })

        let filesDeleted = false
        it('deleteObject', async function() {
            // Increase timeout
            this.timeout(60000)

            // Delete all files uploaded, in parallel
            const promises = []
            let fileList = [].concat(testFiles, testSuiteOptions.skipPresignedUrlTests ? [] : presignedFiles)
            if (testSuiteOptions && testSuiteOptions.testLargeFiles) {
                fileList = fileList.concat(largeFiles)
            }
            for (const file of fileList) {
                promises.push(storage.deleteObject(containers[0], file.destination))
            }
            await Promise.all(promises)

            filesDeleted = true
        })

        // Delete all objects and containers that we created
        after(async function() {
            // Increase timeout
            this.timeout(60000)

            // If it hasn't happened already, delete all files uploaded, in parallel
            let promises = []
            if (!filesDeleted) {
                let fileList = [].concat(testFiles, testSuiteOptions.skipPresignedUrlTests ? [] : presignedFiles)
                if (testSuiteOptions && testSuiteOptions.testLargeFiles) {
                    fileList = fileList.concat(largeFiles)
                }
                for (const file of fileList) {
                    promises.push(storage.deleteObject(containers[0], file.destination))
                }
                await Promise.all(promises)
            }

            // Delete all containers
            promises = []
            for (const i in containers) {
                promises.push(storage.deleteContainer(containers[i]))
            }
            await Promise.all(promises)
        })
    })
}
