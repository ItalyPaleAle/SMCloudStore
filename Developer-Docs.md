# For Developers

This repository contains the source for multiple packages. Packages are maintained with [lerna](https://github.com/lerna/lerna).

## Cloning and initializing the repository

After cloning the repository, you need to initialize it by installing the local dependency for lerna, then install all dependencies. The last two steps are done automatically by the `bootstrap.sh` script.

````sh
# Clone the repository
git clone git@github.com:ItalyPaleAle/SMCloudStore.git

# Bootstrap - this will run "npm install" on the root folder, then bootstrap all packages with lerna (hoisted)
cd SMCloudStore
sh scripts/bootstrap.sh
````

## NPM scripts

Here is the list of relevant NPM scripts available:

- **`npm run tsc`**: compiles all the TypeScript files in all packages
- **`npm run compile`**: alias of `npm run tsc`
- **`npm run eslint`**: runs eslint on all JavaScript files
- **`npm run tslint`**: runs tslint on all TypeScript files
- **`npm run lint`**: alias that runs both eslint and tslint
- **`npm run typedoc`**: generates documentation using typedoc
- **`npm run docs`**: alias of `npm run typedoc`

## Running tests

This codebase comes with a full suite of unit tests. Before you can run the tests, you need to edit the `test/data/auth.js` file and add credentials for cloud providers. You also need to start a local Minio server.

To start a local Minio server (requires Docker):

````sh
sh scripts/start-minio.sh
````

Then add the keys for all other providers, passing them as environmental variables. You can put them in the **`.env` file**, which should look like:

````sh
# generic-s3
# Leave "s3.amazonaws.com" to test against AWS
SMCS_GENERICS3_ENDPOINT="s3.amazonaws.com"
SMCS_GENERICS3_ACCESS_KEY="..."
SMCS_GENERICS3_SECRET_KEY="..."
# Replace with AWS region id (ignored if not testing against AWS)
SMCS_GENERICS3_REGION="ca-central-1"

# azure-storage
SMCS_AZURESTORAGE_STORAGEACCOUNT="..."
SMCS_AZURESTORAGE_ACCESSKEY="..."

# aws-s3
SMCS_AWSS3_ACCESS_KEY="..."
SMCS_AWSS3_SECRET_KEY="..."
SMCS_AWSS3_SESSION_TOKEN="..."
SMCS_AWSS3_REGION="us-west-2"

# google-cloud-storage
GCLOUD_PROJECT="name-012345"
GOOGLE_APPLICATION_CREDENTIALS="/full/path/to/name-012345-hex.json"

# backblaze-b2
SMCS_BACKBLAZEB2_ACCOUNT_ID="..."
SMCS_BACKBLAZEB2_APPLICATION_KEY="..."
````

You can then run tests (which will also trigger a re-compilation of all TypeScript files) with:

````sh
npm run test
````

### Adding a new provider

To add a new provider, copy the folder structure of an existing provider (e.g. `generic-s3`). Make the required code changes. At the end, update the `scripts/compile.sh` file and make sure to include the new provider.
