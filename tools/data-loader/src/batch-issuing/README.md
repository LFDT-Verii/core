# vendor-credentials command

Used for generating ready-to-claim qr-code from a csv that can be shared in order to claim credentials.

## Guidelines

- **Currently only a single credential can be issued per user.**
- **The CSV must**
  - have a header row as the first row
  - the person's email address must be the first column
- **Credentials are specified as a handlebars templates.** The data is populated from
  - the csv specified with variable names the same as the headers
  - the `-d` arg passed in. It is available in your template as `{{did}}`
  - any `-v` arg passed in. Such a value is an override value

### Steps
1. Create a template of the offer based on examples [here](../../test/data)
2. Create a CSV containing the email as the first column and all other required variables in the rest of the columns. Ensure there is a header row.
3. Identify the following option values
   1. Credential Agent endpoint and necessary auth token.
   2. Identify the DID of the issuer organization
   3. Identify the URL that hosts the terms and conditions.
   4. Identify any customizations required for the purpose, activatesIn & expiresIn options
4. Do a dry run and ensure no errors occur
5. Execute the script without the dryrun flag

## How to Use

`data-loader batchissuing [options]`

### Options

`-d --did [DID]` DID of the issuing organization. One of `tenant` or `did` must be specified.

`-n --tenant [TENANT_ID]` Id of the issuing organization's tenant. One of `tenant` or `did` must be specified.

`-o [OFFER_TEMPLATE_PATH]` **required** path to an offer handlebars template. Use moustaches around variables such as `{{email}}`

`-c [CSV_PATH]` **required** path to the csv file containig variables. The person's mail must be the first column.

`--var=[VAR_NAME]=[VAR_VALUE]` optional variables. Can be used within templates. They override any csv values of the same name

`-p [/PATH/FOO]` **required** path to write the QR code image to. This path must already exist

`--legacy` fallback to legacy batch issuing which will create a QR code per holder

`-e [URL]` **required** url of the target credential agent server

`-a [AUTH_TOKEN]` **required** bearer token to use when calling the credential agent server

`-t [URL]` **required** terms and conditions url for the holder to accept

`--purpose [STRING]` optional purpose to display to the user. Use a maximum for 64 chars. Default is "Career Credential Issuing" 

`--authTokenExpiresIn [AUTH_TOKEN_EXPIRES_IN]` optional time in minutes that the token will expire in after calling `/submit-identification`. Default is 10080 minutes expiry

`-x` optional output a csv file containing the deeplink and path to the qr code

`--x-name` optional 'The file name for the output CSV. Default is "output"'

`-y --credential-type [CREDENTIAL_TYPE]` optional 'The type of credentials 
(EmailV1.0, PhoneV1.0, DriversLicenseV1.0). Default is EmailV1.0.'

`--x-vendor-userid-name` optional The column name to use for the vendor user id in the output csv. Default is "email"

`-i --disclosure` optional. If with value, allows the offers and identities to be added to an existing disclosure. If without value, turn on interractive mode
where need to select available disclosure. If neither --disclosure or --new is provided, it will start interactive mode.

`--new` optional. The offers and identities will be added to a new disclosure.

### Examples
Executing batch issuing

```
./data-loader batchissuing -d did:ion:EiAbP9xvCYnUOiLwqgbkV4auH_26Pv7BT2pYYT3masvvhw -o ./test/data/badge-offer.template.json -c ./test/data/batch-vars.csv -p ./tmp -t https://www.example.com/terms.html -e https://devagent.velocitycareerlabs.io -a eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoidmVsb2NpdHkuYWRtaW5AZXhhbXBsZS5jb20ifQ.EoDg_46Qi28tScPD5xwHW4TCdEtN8-gzYoAgFa34fCQ  
```

Executing batch issuing that produces an output csv named output.csv and email as the first column.

```
./data-loader batchissuing -x -d did:ion:EiAbP9xvCYnUOiLwqgbkV4auH_26Pv7BT2pYYT3masvvhw -o ./test/data/badge-offer.template.json -c ./test/data/batch-vars.csv -p ./tmp -t https://www.example.com/terms.html -e https://devagent.velocitycareerlabs.io -a eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoidmVsb2NpdHkuYWRtaW5AZXhhbXBsZS5jb20ifQ.EoDg_46Qi28tScPD5xwHW4TCdEtN8-gzYoAgFa34fCQ  
```

Dry runs that print out the offers that would be issued should omit the `-e` and `-a` props and instead pass in `--dryrun`
```
./data-loader batchissuing -d did:ion:EiAbP9xvCYnUOiLwqgbkV4auH_26Pv7BT2pYYT3masvvhw -o ./test/data/badge-offer.template.json -c ./test/data/batch-vars.csv -p ./tmp -t https://www.example.com/terms.html --dryrun
```

Executing batch issuing with new disclosure.
```
./data-loader batchissuing -d did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA -o ./data-loader/test/data/badge-offer.template.json -c ./data-loader/test/data/batch-vars.csv -p ./tmp -t https://www.example.com/terms.html -e https://devagent.velocitycareerlabs.io -a eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoidmVsb2NpdHkuYWRtaW5AZXhhbXBsZS5jb20ifQ.EoDg_46Qi28tScPD5xwHW4TCdEtN8-gzYoAgFa34fCQ --new
```

Executing batch issuing with existing disclosure (interactive mode).
```
./data-loader batchissuing -d did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA -o ./data-loader/test/data/badge-offer.template.json -c ./data-loader/test/data/batch-vars.csv -p ./tmp -t https://www.example.com/terms.html -e https://devagent.velocitycareerlabs.io -a eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoidmVsb2NpdHkuYWRtaW5AZXhhbXBsZS5jb20ifQ.EoDg_46Qi28tScPD5xwHW4TCdEtN8-gzYoAgFa34fCQ --disclosure
```