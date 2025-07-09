# vendor-credentials command

Used for creating users and then attaching them to specific credentials. 

- Supports new users only, not matching to existing users
- Credentials & People must be specified as a handlebars templates. The data is populated from two sources
   - the csv specified with variable names the same as the headers
   - any `-v` arg parsed in

Checkout the [test data](../test/data).

## How to Use
`data-loader vendorcreds [options]`

### Config

#### General config

`-c [CSV_FILENAME]` **required** parameter containing the csv file

`-p [OUTPUT_PATH]` **required** the output directory to use where QR codes and output state files are stored

`-l [LABEL]` A label to attach to the records added to the agent

`--dry-run` Run a test that parses the CSV and creates offers, but does not attempt to write the data to an agent. great for testing!

#### Issuing config

`--new` to create a new issuing configuration ("disclosure")

`-i [DISCLOSURE_ID]` an existing disclosure to use for the batch issuing

`-d [DID]` **required** the issuer's DID

`-t [URL]` **required** the url to the T&Cs that holder must consent to

`--purpose` The purpose to display to the user. Use a maximum for 64 chars. Default is "Career Credential Issuing"

`--authTokenExpiresIn` The number of minutes that the offer will be available for after activation. Default is 365 days.

#### User authentication and matching config

`-y [ID_CREDENTIAL_TYPE]`  the credential type used for identifying the user. Default is Email.

`-u [COLUMN]` the column from the CSV for the user id. Value is made available as "vendorUserId" in the offer template. Default is the first column

`-m [COLUMN]` the column from the CSV for the user to be matched against the ID credential's "identifier" property. Default is the first column

#### Offer generation config

`-o [OFFER_TEMPLATE_FILENAME]` **required** offer handlebars template. Use moustaches around variables such as `{{did}}` 

`--var=[VAR_NAME]=[VAR_VALUE]` variables used in the templates can be specified on the command line. They override any csv values

#### Credential Agent config

`-e [URL]` **required if not a dryrun** the endpoint of the mockvendor server

`-t [AUTH_TOKEN]` **required if not a dryrun** the bearer token to use when calling the mockvendor server

`--legacy` the target credential agent is running in the "LEGACY" offer type mode. Default is false

#### Output config

`-x` if passed an output csv is generated including the vendor's user id as the first column and the generated qrcode filename and deeplink

`--x-name [OUTPUT_CSV_NAME]` The file name for the output CSV. Default is "output"

### Dry Run Example
Dry runs that print out what updates will be issued should omit the `-e` prop

`./data-loader vendorcreds -c ./test/data/variables.csv -o ./test/data/offer.template.json -d did:ion:sap456`
