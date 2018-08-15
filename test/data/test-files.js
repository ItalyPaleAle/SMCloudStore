'use strict'

const fs = require('fs')

const testFiles = [
    {
        file: __dirname + '/benni-asal-756919-unsplash.jpg',
        destination: 'testimage.jpg',
        contentType: 'image/jpeg',
        size: 647173,
        digestMD5: 'eab029bf064a2a44cbfb46264606f7d3',
        digestSHA1: '1007c9d3516b054546a96754ae4651a2edaea5b7'
    },
    {
        file: __dirname + '/pg1008.txt',
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
        buffer: fs.readFileSync(__dirname + '/pg1008.txt'),
        originalPath: __dirname + '/pg1008.txt',
        destination: 'test/buffers/poem.txt',
        contentType: 'application/x-poem',
        size: 893449,
        digestMD5: 'c0656985bed744013a8003af58cc83bf',
        digestSHA1: '1d97b282a762d4b7b21c5bed5216cf8db2b3c54a'
    }
]

module.exports = testFiles
