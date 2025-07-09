# verifgen
Generates credentials and presentations

## Creating Credentials
Veifgen allows you to create self signed credentials.

### Options
|flag|description|
|---|---|
|-o|specify output file|
|-s|self sign|
|-t|credential type to set|

### Creating an identity credential (self signed)
`$ node ./src/verifgen.js credential IdentityAndContact-Adam-Smith -o adamsmith-id -s`

### Creating an a regular credential (self signed)
`$ node ./src/verifgen.js credential CurrentEmploymentPosition-2015-Programme-Manager -s -t CurrentEmploymentPosition -o adam-currentemployment`

`$ node ./src/verifgen.js credential Degree -s -t EducationDegree -o adam-educationdegree`

## Creating Presentations
Now that you have a set of credentials then you can create presentations for sending to an agent.

### Options
| flag | description                                                                                    |
|------|------------------------------------------------------------------------------------------------|
| -o   | specify output file                                                                            |
| -r   | specify the presentation request or credential manifest containing the presentation definition |
| -i   | specify issuer persona (See "Using personas" section below)                                    |
| -p   | specify x-vnf-protocol-version for presentation (issuer persona is required for v2)            |
| -c   | specify all input credential files                                                             |
| -v   | specify a vendorOriginContext value                                                            |

### Creating a identity presentation (for issuing)
`$ node ./src/verifgen.js presentation -c adamsmith-id -r credential-manifest.json -o adam-id-presentation`

### Creating a credentials presentation with a vendor origin context(for a disclosure)
`$ node ./src/verifgen.js presentation -r presentation-request.json -v eyj!143PRrs -c adamsmith-id adam-currentemployment adam-educationdegree -o adam-creds-presentation.v1`

## Future Dev
- Support organization signed credentials


## Creating agent jwt token
`$ node ./src/verifgen agent-jwt --secret 'cc7e0d44fd473002f1c42167459001140ec6389b7353f8088f4d9a95f2f596f2' --email example@example.com --groupId 123654`

## Verifgen proof command

This command is used to generate a proof JWT.

### How to Use

verifgen proof [options]
Options

| -c, --challenge <challenge> Directly specify the challenge used in the JWT. If not provided, it will be loaded from the generate-offers response.

| -r, --response <generate-offers-response-filename> The filename containing the generate-offers response. Defaults to generate-offers-response.json.

| -a, --audience <audience> (required) Specifies the audience which must be present in the payload. (Usually the issuer url the proof is being generated for)

|  -p, --persona <persona> (required) Specifies the persona private key used to sign the JWT. (See "Using personas" section below)

`node ./src/verifgen proof -c someChallengeValue -a https://example.com/audience -p <persona>`

### Using "personas"

Whatever is passed in as the `-p` value, is what the documentation calls "a persona".
In practice, what this means, is that it will look for certain files that are expected to be present
for the persona to be used properly. 
With a persona of johndoe, the following files would be expected.
1. A did document named `johndoe.did`, with JSON contents like:
   ```
   {
     "id":"did:jwk:..."
   }
   ```

   The important thing here is that the `id` property is present, and represents the identity of the persona


2. One of the following:
   1. A private jwk in a file named `johndoe.prv.key.json`, with JSON contents like:
      ```
      {
        "kty": "...",
        "crv": "...",
        "d": "...",
        "x": "...",
        "y": "..."
      }
      ```
   2. A private hex string in a file named `johndoe.prv.key` with a string like:
      ```
      8a2c1...
      ```
      The CLI will attempt to load the JWK first. 
      Otherwise the CLI will attempt to load the hex file.
      
      This private key will be used to sign whatever JWTs are relevant to the CLI tool being used.
      So using `verifgen presentation`, this key will be used to sign the presentation.
      And using `verifgen proof`, this key will be used to sign the proof.
      And same goes for other instances where the `-p <persona` option is specified.
