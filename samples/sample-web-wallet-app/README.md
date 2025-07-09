# Web Wallet App

## Getting started

### SDK

Open one terminal window in the directory: `packages/vnf-wallet-sdk-nodejs`

#### Run in watch mode

`yarn build:watch`

Builds the SDK in watch mode, any changes cause recompilation. Use when developing

### Server
Open another terminal window in the directory: `samples/sample-web-wallet-server`

#### Run the server

`yarn start:dev`

Builds the server using `ts-node`

### This App

Open another terminal window in the current directory: `samples/sample-web-wallet/app`

- `yarn start`

Runs the app in the development mode.\
Open [http://localhost:5173](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

## Building

- `yarn build`

Builds the app for production to the `dist` folder.


## Testing

- `yarn test`

Launches the test runner
