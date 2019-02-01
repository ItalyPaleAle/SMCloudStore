#!/bin/sh

# Need a "subshell" to not pollute the shell with environmental variables
(
    # Load .env file if present
    if [ -f .env ]; then
        echo "Loading .env file"
        set -o allexport
        source .env
        set +o allexport
    fi

    # Run mocha and capture coverage information
    ./node_modules/.bin/nyc ./node_modules/.bin/_mocha
)
