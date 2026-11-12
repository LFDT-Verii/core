# @verii/batch-issuer

`batch-issuer` loads Credentialing Hub depots and credentials from a CSV file, a YAML spec and JSON Handlebars templates, for batch issuing through an issuer service's shared issue link. It validates the whole batch before anything is written, and reports every error.

This version validates. `load`, which writes the batch to the Hub, comes next.

## Commands

### `validate`

```sh
batch-issuer validate <spec> <csv> --endpoint <hub url> --registrar <registrar url> [options]
```

Validates the batch against its spec, the registrar and the Hub, and prints every error with its row, column and reason. Nothing is written to the Hub.

| Option | |
| --- | --- |
| `-e, --endpoint <url>` | The Credentialing Hub's base URL. Required |
| `-a, --auth-token <token>` | An operator API token. Required, unless `BATCH_ISSUER_AUTH_TOKEN` is set |
| `-r, --registrar <url>` | The registrar's base URL, for credential type schemas. Required when the spec has credentials |
| `--default-country <code>` | The country of phone numbers written without a country code, such as `US` |
| `--var <name=value>` | A value that overrides the CSV column of the same name, in every row. Repeatable |
| `--no-reuse` | Treat rows whose auth values already belong to a depot as errors |
| `--json` | Print the report as JSON |

### `check-rules`

```sh
batch-issuer check-rules <spec> --sample <credential> [<credential> ...] --endpoint <hub url>
```

Reads the `verifiablePresentationAuthRules` of the spec's issuer service from the Hub, and shows what each rule reads from sample credentials: what each of its claims path pointers selects, and the normalized values the Hub would match depots against. It uses the Hub's rule evaluation (`selectClaims` and `ruleValues` from `@verii/credentialing-hub-operator-api`). A rule reads only the samples of its `type`.

A sample is a JSON credential, or a file holding a JWT. A JWT is decoded as the Hub decodes a presented credential, so a VC 1.1 JWT's rules read the credential it carries, with `credentialSubject.id` taken from `sub`. Its signature isn't checked.

It takes the same `--endpoint`, `--auth-token` and `--json` options as `validate`.

### The operator token

Pass the token in `BATCH_ISSUER_AUTH_TOKEN` rather than with `--auth-token`, which leaves it in the shell history:

```sh
export BATCH_ISSUER_AUTH_TOKEN=...
batch-issuer validate spec.yaml holders.csv --endpoint https://hub.example.com --registrar https://registrar.example.com
```

The token is never printed, including in error messages.

### Exit codes

| Code | `validate` | `check-rules` |
| --- | --- | --- |
| 0 | The batch is valid | Every rule reads a value from the samples |
| 1 | The batch has errors | A rule reads nothing from the samples |
| 2 | It couldn't validate: bad options, a spec or CSV file that can't be read, or a Hub or registrar error | It couldn't check: bad options or spec, a sample that can't be read, or a Hub error |

## The spec

```yaml
tenantId: 6512a1b2c3d4e5f6a7b8c9d0
serviceId: 6512a1b2c3d4e5f6a7b8c9d1
depot:
  userReference: "{{employeeId}}"
  authValues:                  # position = the rule's valueIndex
    - column: email            # rule 0: EmailV1.0, credentialSubject.email
  expectedCredentialTypes: [OpenBadgeCredential]
  deferredCredentials: false
columns:                       # optional, for typed values (default string)
  creditsEarned: number
credentials:                   # optional: a load can create depots only
  - template: ./open-badge.template.json
    credentialReference: "{{employeeId}}-ivie-2026"
    tags: [batch-2026-11]
```

| Field | |
| --- | --- |
| `tenantId`, `serviceId` | The tenant and its issuer service. Required |
| `depot.userReference` | A Handlebars template of each depot's `userReference`. Required |
| `depot.authValues` | The CSV column of each of the service's auth rules, in `valueIndex` order: exactly one entry per rule. Leave it out for a `preauth` service |
| `depot.expectedCredentialTypes` | The credential types the depots may receive. Each template's type must be one of them |
| `depot.deferredCredentials` | Whether the depots' credentials may come later |
| `columns` | The type of each typed column: `string`, `number` or `boolean`. Other columns are strings |
| `credentials` | The credentials of each row. Without them, the spec loads depots only, and it needs `depot.deferredCredentials: true`, so a holder who opens the link before their credentials exist waits for them |
| `credentials[].template` | A JSON template of the credential's `content`, relative to the spec file |
| `credentials[].credentialReference` | A Handlebars template of the credential's `credentialReference`. It must be unique in the batch |
| `credentials[].tags` | Handlebars templates of the credential's tags |

The spec is checked against a JSON schema first, and nothing else is checked until it's valid.

## The CSV

The first line is the header. A byte order mark is stripped, header names are trimmed, and blank lines are skipped. Errors give rows as a spreadsheet numbers them, so the first row after the header is row 2.

Quoting is strict. A cell with a comma, a quote or a line break must be quoted, with each quote inside it doubled: `"Ng ""CJ"""`. A quote that is never closed would take the rest of the file into one cell, so it's an error at the row where the quote opens. A quote inside an unquoted cell is an error too. A CSV that doesn't parse stops validation before the Hub is called.

## Templates

A template is a credential's JSON `content`, with `type` and `credentialSubject`, whose strings are Handlebars templates:

```json
{
  "type": ["OpenBadgeCredential", "VerifiableCredential"],
  "credentialSubject": {
    "type": "AchievementSubject",
    "creditsEarned": "{{creditsEarned}}",
    "achievement": {
      "name": "Influenza Vaccine Immunization Education (IVIE)",
      "description": "Awarded to {{firstName}} {{lastName}}"
    }
  }
}
```

- **Value by value.** Each string is rendered on its own, and the JSON is never rebuilt from text. A CSV value only ever becomes part of a string, so a value with quotes or braces can't change the credential's structure. Keys, numbers, booleans and nulls are kept as they are.
- **Strict.** A column that a row doesn't have is an error, not an empty string. An empty cell renders as an empty string.
- **Not escaped.** Values aren't HTML-escaped: `{{name}}` and `{{{name}}}` are the same.
- **Typed values.** A string that is exactly `{{column}}`, or `{{[a column]}}`, takes the column's type from `columns`, so `"{{creditsEarned}}"` renders as the number `1.5`. Inside a longer string, a value stays text.
- **Overrides.** `--var name=value` overrides the CSV column `name` in every row, or provides it when the CSV has no such column.
- **Types.** The template's `type` must be a literal, not a Handlebars template.

`userReference`, `credentialReference` and tags are always strings, so they don't use `columns`.

Numbers are decimal, such as `12`, `-1.5` or `1e3`. Booleans are `true` or `false`, in any case.

## What `validate` checks

Every error is collected, and the command fails when there's any.

1. **The spec against the service,** from `issuer-services/get`:
   - the service is an internal `verifiable_presentation` service, or `preauth`, and isn't deactivated;
   - `depot.authValues` maps exactly the rules' `valueIndex` 0 to n−1;
   - each template's type is in `depot.expectedCredentialTypes`, when it's set.
2. **Each row against the spec:**
   - the columns the spec uses are present. A column the CSV doesn't have at all is one error, not one per row;
   - auth values are non-blank once trimmed, and convert to their rule's `valueType`. A rule without a `valueType` takes strings;
   - phone values, for a rule of type `PhoneV1.0` or with `valueFormat: e164`, are normalized to E.164 (`+15556192191`) with `libphonenumber-js`, using `--default-country` for numbers without a country code. A number that can't be normalized is an error;
   - email values, for a rule of type `EmailV1.0` or with `valueFormat: email`, are email addresses, by the same check as the Hub's `email` format;
   - no two rows have the same auth values, compared as the Hub matches them: normalized with `buildAuthMatchValues`, and by type, so `"12345"` and `12345` differ;
   - the templates render;
   - each `credentialReference` is unique in the batch;
   - each depot and credential passes the operator API's validator (`initOperatorApiValidator`), as the Hub validates `depots/create` and `credentials/create`.
3. **Each credential against its type:** the `credentialSubject` is checked against the type's JSON schema from the registrar, which `credentials/create` loads the same way. Every schema error is reported, not only the first.
4. **The batch against the Hub:** one `POST depots/get` with the rows' auth values, at most 1000 tuples per request. The depots it returns are matched to rows by normalizing their `authValues` with `buildAuthMatchValues`. For a match:
   - the same `userReference` is a returning holder, whose depot gets the row's credentials. The row's credential types must be in the depot's `expectedCredentialTypes`, when it has any. In a depot-only load, the depot must have `deferredCredentials: true`, as the load's new depots do: the setting can't be changed, and the holder would otherwise get an empty offer. With `--no-reuse`, it's an error;
   - a different `userReference` is always an error: two people share an email, or an email was reassigned;
   - auth values that belong to more than one depot are an error.

   A `preauth` service's depots can't be found by auth values, so every row gets a new depot.

## Output

The report lists the errors without a row first, then each row's errors:

```
Row 3:
  - email: "adam" is not an email address
  - creditsEarned: "two" is not a number (template ./open-badge.template.json)

The batch is not valid: 2 errors. Nothing was written to the Hub.
```

A valid batch is summarized:

```
The batch is valid: 3 rows, 2 new depots, 1 existing depot, 3 credentials. Nothing was written to the Hub.
```

With `--json`, the report is `{ valid, errors, summary }`. Each error has a `reason`, and a `row`, `column` and `template` when they apply. `summary` is missing when the spec has errors.

## Example

`test/fixtures` has a spec, a CSV and an Open Badge template:

```sh
batch-issuer validate test/fixtures/spec.yaml test/fixtures/holders.csv \
  --endpoint https://hub.example.com --registrar https://registrar.example.com
```
