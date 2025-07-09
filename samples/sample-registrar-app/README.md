# Sample Registrar App

The sample registrar app shows how to use the components-registrar-app components & pages

## Builds
Vite is used for building the project - primarily involving transpilation of JSX files using SWC

## Tests
Tests are written in Jest

## Style
Style is maintained in eslint based on the monorepo root styles

## How to develop
There are two types of server that this application requires: a registrar server and an authorization server. 

It ships with an example of how to run using completely local development but your mileage may vary as to how well it works. 
Certain flows cannot be tested locally yet including signup.

### Local Registrar and Auth Servers
1. Start the sample-registrar-server docker compose (it will automatically start a fake auth0 server): `docker compose up`
2. Start the sample-regsitrar-app: `> vite start` 

### Remote Registrar and avoid Auth Server
1. Create an remote env file (eg. `env.remotedev`) based on `template.env.remotedev`
2. Login into the auth server for the remote environment and get an access token  
3. Open `AuthBridgeProvider.js` file
4. Hardcode the access token as the return value from `getAccessToken` and `getAccessTokenWithPopup`
5. `> vite start:remote`

### Remote Auth only
1. Start the sample-registrar-server docker compose (it will automatically start a fake auth0 server): `docker compose up`
2. Create an remote env file (eg. `env.remoteauth`) based on `template.env.remoteauth`
3. `> vite start:remoteauth`


Using a 