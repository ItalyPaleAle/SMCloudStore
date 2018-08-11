'use strict'

/* eslint-disable no-console */

const util = require('util')
const exec = util.promisify(require('child_process').exec)

;(async () => {
    // Compile all packages
    console.log('`compile.sh` -> compile all TypeScript files')
    try {
        const {stdout, stderr} = await exec('sh scripts/compile.sh', {
            encoding: 'utf8'
        })
        if (stdout) {
            console.log('`compile.sh` stdout: ', stdout)
        }
        if (stderr) {
            console.log('`compile.sh` stderr: ', stderr)
        }
    }
    catch (err) {
        console.error('`compile.sh` failed with error: ', err)
    }

    // Done
    console.log('All done!')
})()
