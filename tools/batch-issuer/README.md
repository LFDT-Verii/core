# @verii/batch-issuer

`batch-issuer` loads Credentialing Hub depots and credentials from a CSV file, a YAML spec and JSON Handlebars templates, for batch issuing through an issuer service's shared issue link. It validates the whole batch before anything is written, and reports every error. A load records what it creates in a state file, so a load that stops partway can be run again.

## Commands

### `validate`

```sh
batch-issuer validate <spec> <csv> --endpoint <hub url> --network <network> --registrar <registrar url> [options]
```

Validates the batch against its spec, the registrar and the Hub, and prints every error with its row, column and reason. Nothing is written to the Hub. It's the same as `load --dryrun`.

| Option | |
| --- | --- |
| `-e, --endpoint <url>` | The Credentialing Hub's base URL. Required |
| `-a, --auth-token <token>` | An operator API token. Required, unless `BATCH_ISSUER_AUTH_TOKEN` is set |
| `--network <name>` | The Velocity network of the Hub, such as `devnet`, `testnet` or `mainnet`. Required. The state file is tied to it, so a state file from a load into another network is refused. It's compared in lower case, and any name is accepted |
| `-r, --registrar <url>` | The registrar's base URL, for credential type schemas. Required when the spec has credentials |
| `--default-country <code>` | The country of phone numbers written without a country code, such as `US` |
| `--var <name=value>` | A value that overrides the CSV column of the same name, in every row. Repeatable |
| `--no-reuse` | Treat rows whose auth values already belong to a depot as errors. A depot that the state file records, because an earlier load of the batch created it, isn't a reuse |
| `--state <file>` | The batch's state file. Defaults to the CSV's name with `.state.jsonl` in the CSV's directory, such as `holders.state.jsonl` for `holders.csv`. See [Reruns and the state file](#reruns-and-the-state-file) |
| `--json` | Print the report as JSON |

### `load`

```sh
batch-issuer load <spec> <csv> --endpoint <hub url> --network <network> --registrar <registrar url> [options]
```

Validates the batch as `validate` does, then creates its depots and credentials in the Hub, and writes each row's issue link to a CSV file for mail merge. See [What `load` does](#what-load-does).

It takes the same arguments and options as `validate`, and these:

| Option | |
| --- | --- |
| `--dryrun` | Stop after validating. `load --dryrun` is `validate` |
| `--resolve-deferred` | Resolve the deferred credentials of each reused depot that receives credentials, so a wallet waiting for them is told |
| `-o, --output <file>` | The links file. Defaults to the CSV's name with `.links.csv` in the CSV's directory, such as `holders.links.csv` for `holders.csv`. See [The links file](#the-links-file) |

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
batch-issuer validate spec.yaml holders.csv --endpoint https://hub.example.com --network testnet --registrar https://registrar.example.com
```

The token is never printed or written, including in error messages, the links file and the state file.

### Exit codes

| Code | `validate` | `load` | `check-rules` |
| --- | --- | --- | --- |
| 0 | The batch is valid | The batch is loaded | Every rule reads a value from the samples |
| 1 | The batch has errors | The batch has errors, and nothing was written | A rule reads nothing from the samples |
| 2 | It couldn't validate: bad options, a spec or CSV file that can't be read, a state file of another batch, or a Hub or registrar error. A Hub response without what it should hold, such as a proxy's HTML page, is an error | It couldn't validate, as for `validate`, or a write failed partway, or a wallet message failed when it resolved deferred credentials. The state file records what was written, and rerunning the same command continues the load and retries the messages | It couldn't check: bad options or spec, a sample that can't be read, or a Hub error |

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
- **Strict placeholders.** A column used in a placeholder, such as `{{name}}`, must be present: a row without it is an error, not an empty string. An empty cell renders as an empty string. A block helper's parameter isn't checked: `#if`, `#unless`, `#each` and `#with` read a missing column as falsy. So `{{#if middleName}} {{middleName}}{{/if}}` makes `middleName` optional, but a misspelled column there silently takes the other branch.
- **Not escaped.** Values aren't HTML-escaped: `{{name}}` and `{{{name}}}` are the same.
- **Typed values.** A string that is exactly `{{column}}`, or `{{[a column]}}`, takes the column's type from `columns`, so `"{{creditsEarned}}"` renders as the number `1.5`. Inside a longer string, a value stays text.
- **Overrides.** `--var name=value` overrides the CSV column `name` in every row, or provides it when the CSV has no such column.
- **Types.** The template's `type` must be a literal, not a Handlebars template.

`userReference`, `credentialReference` and tags are always strings, so they don't use `columns`.

Numbers are decimal, such as `12`, `-1.5` or `1e3`. Booleans are `true` or `false`, in any case.

## What `validate` checks

Every error is collected, and the command fails when there's any. `load` checks the same before it writes anything.

1. **The spec against the service,** from `issuer-services/get`:
   - the service is an internal `verifiable_presentation` service, or `preauth`, and isn't deactivated;
   - `depot.authValues` maps exactly the rules' `valueIndex` 0 to n−1;
   - each template's type is in `depot.expectedCredentialTypes`, when it's set.
2. **Each row against the spec:**
   - the columns the spec uses in placeholders are present. A block helper's parameter isn't checked, as [Templates](#templates) says. A column the CSV doesn't have at all is one error, not one per row;
   - auth values are non-blank once trimmed, and convert to their rule's `valueType`;
   - phone values, for a rule of type `PhoneV1.0` or with `valueFormat: e164`, are normalized to E.164 (`+15556192191`) with `libphonenumber-js`, using `--default-country` for numbers without a country code. A number that can't be normalized is an error;
   - email values, for a rule of type `EmailV1.0` or with `valueFormat: email`, are email addresses, by the same check as the Hub's `email` format;
   - no two rows have the same auth values, compared as the Hub matches them: normalized with `buildAuthMatchValues`, and by type, so `"12345"` and `12345` differ. Each duplicate row gets an error that counts the other rows and lists at most 10 of them, such as `has the same auth values as 49,999 other rows: 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 and 49,989 more`;
   - the templates render;
   - each `credentialReference` is unique in the batch. Each duplicate credential's error counts the uses and rows and lists at most 10 rows;
   - each depot and credential passes the operator API's validator (`initOperatorApiValidator`), as the Hub validates `depots/create` and `credentials/create`.
3. **Each credential against its type:** the `credentialSubject` is checked against the type's JSON schema from the registrar, which `credentials/create` loads the same way. Every schema error is reported, not only the first.
4. **The batch against the Hub:** one `POST depots/get` with the rows' auth values, at most 1000 tuples per request. The depots it returns are matched to rows by normalizing their `authValues` with `buildAuthMatchValues`. For a match:
   - the same `userReference` is a returning holder, whose depot gets the row's credentials. The row's credential types must be in the depot's `expectedCredentialTypes`, when it has any. A depot-only row has no credentials, so the spec's `depot.expectedCredentialTypes`, which a later load adds, must be in them instead. In a depot-only load, the depot must also have `deferredCredentials: true`, as the load's new depots do: the setting can't be changed, and the holder would otherwise get an empty offer. With `--no-reuse`, it's an error, unless the state file records the depot because an earlier load of the batch created it;
   - a different `userReference` is always an error: two people share an email, or an email was reassigned;
   - auth values that belong to more than one depot are an error.

   A `preauth` service's depots can't be found by auth values, so every row gets a new depot.

Then the state file must belong to the batch, as [Reruns and the state file](#reruns-and-the-state-file) says.

## What `load` does

1. **Validates** the batch, as `validate` does. Any error stops the load before anything is written, with the same report, and exits with 1. `--dryrun` stops here.
2. **Depots:** `depots/create` for each row without a depot, one at a time, so two creates for the same holder can't race. A row that validation matched to an existing depot uses it. A 409 means that another client created a depot with the row's auth values after validation: the load stops and reports the row.
3. **Credentials:** `credentials/create-many`, in requests of at most 100 credentials, each to its row's depot, new or reused. The Hub takes up to 1000 per request (`CREDENTIALS_CREATE_MANY_MAX_ITEMS`), but it limits a request's body to 8 MiB, which 1000 large credentials can exceed. When the Hub refuses a request with a 400, the load reports each invalid credential with its row and template, and stops. The Hub checks every credential of a request before it creates any, so a refused request creates nothing, but the requests before it did.
4. **Deferred credentials:** with `--resolve-deferred`, `depots/resolve-deferred-credentials` for each reused depot that has `deferredCredentials: true` and received credentials from the batch. A wallet that's waiting on the depot is told its credentials are ready. The depots the batch creates aren't resolved: their holders haven't had a link yet. The Hub answers with the wallet message's status: `sent`, `skipped_no_messaging_settings`, `skipped_no_waiting_exchange` or `failed`. A depot whose message `failed` isn't recorded as resolved: the load goes on, then reports each one with its row, its depot and the Hub's error, and exits with 2. A rerun resolves it again.
5. **Links,** written to [the links file](#the-links-file):
   - a service with internal `verifiable_presentation` auth: the shared link, from `issue-links/refresh` without a `depotId`. It's printed, and every row gets it;
   - a `preauth` service: each depot the batch created gets its own link, from `issue-links/refresh` with its `depotId`. Reused depots are never refreshed, because a refresh replaces the depot's pre-authorized code (`refreshPreauthCode`) and breaks the links already sent. A service with both kinds of auth gives a reused depot's row the shared link instead.

The state file records each depot, credential, resolved depot and `preauth` link as soon as the Hub confirms it. A depot whose wallet message failed isn't recorded as resolved.

## The links file

`--output`, by default `holders.links.csv` beside `holders.csv`, has a line for each row that has a link, for mail merge:

```
row,userReference,redirectUrl
2,E1001,https://hub.example.com/app-redirect?...
3,E1002,https://hub.example.com/app-redirect?...
```

`row` is the row's number in the CSV. Each run writes the whole file again. It can hold links that claim credentials, as [Keep the files private](#keep-the-files-private) says.

## Reruns and the state file

A load can fail partway after validation passes, for example on a network error. The Hub has no all-or-nothing endpoint, so the load records what it creates in a state file, and a rerun of the same command skips what's done.

`--state`, by default `holders.state.jsonl` beside `holders.csv`, records:
- the batch: its `--network`, `tenantId` and `serviceId`, and a hash of the spec file, its templates, the CSV, and the `--var` and `--default-country` values. The network tells apart loads into Hubs on different networks that hold the same tenant and service ids, such as a testnet Hub restored from a mainnet snapshot;
- each depot the batch created, with its row;
- each credential it created, with its row, `credentialReference`, id and depot;
- each depot whose deferred credentials it resolved, and each `preauth` link, with its row.

It's [JSON Lines](https://jsonlines.org). The load creates it with the batch's line, and appends a line as soon as the Hub confirms each depot, each `create-many` request, each resolved depot and each link:

```
{"batch":{"network":"testnet","tenantId":"6512a1b2c3d4e5f6a7b8c9d0","serviceId":"6512a1b2c3d4e5f6a7b8c9d1","hash":"9f2c…"}}
{"depots":[{"row":3,"id":"6512a1b2c3d4e5f6a7b8c9e1"}]}
{"credentials":[{"row":2,"credentialReference":"E1001-ivie-2026","id":"…","depotId":"…"},…]}
{"resolvedDepots":["6512a1b2c3d4e5f6a7b8c9e0"]}
{"links":[{"row":3,"redirectUrl":"https://…"}]}
```

A crash while a line is written can leave the last line unfinished. A last line that isn't JSON is ignored, so its record counts as not done, and the next load cuts it off before it appends. Any other line that isn't JSON is an error that names the file and the line.

A rerun:
- finds the depots again: by their auth values for a `verifiable_presentation` service, through validation's step 4, and from the state file, by row, for a `preauth` service, whose depots have no auth values. A depot the state file records counts as skipped, not reused, and `--no-reuse` accepts it;
- skips the credentials the state file records, by `credentialReference`;
- doesn't refresh a link again, or resolve a depot again unless its wallet message failed.

A rerun of a finished load creates nothing, and writes the same links file.

A state file belongs to one batch, and any change to the spec, its templates, the CSV, `--network`, `--var` or `--default-country` makes a different batch. `validate`, `load --dryrun` and `load` refuse the state file of another batch, and exit with 2. To load a new batch whose CSV has the same name, pass another `--state`, or move the old state file away.

### Keep the files private

The state file and the links file can hold links that claim credentials: a `preauth` link carries the depot's pre-authorized code, so anyone who has it can claim that holder's credentials. The load creates both files readable and writable by their owner only (mode `0600`). Keep them private, and delete them when the batch is done. A `verifiable_presentation` service's shared link is the same for every holder, and isn't a secret in the same way, but the files are still private.

### What a rerun can't tell

The Hub doesn't require a `credentialReference` to be unique (#1244), so the state file is the only guard against creating a credential twice:
- **A request that fails without a response,** such as a timeout or a dropped connection, may still have been carried out. A `create-many` request's credentials are then missing from the state file, and a rerun creates them again. A depot created that way is found again by its auth values for a `verifiable_presentation` service, as a reused depot, which `--no-reuse` refuses, but a `preauth` service's depot is created again.
- **A refused `create-many` request** created nothing. A rerun sends it again, which only helps once the cause is fixed in the Hub or the registrar, for example a credential type that the Hub's registrar doesn't know yet. A fix in the spec, a template or the CSV makes it a different batch, which the state file refuses.
- **A lost or deleted state file** makes a rerun create every credential again. The depots of a `verifiable_presentation` service are found again by their auth values, and reused.

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

`load` prints the summary when the batch is valid, and what it did when it's done:

```
The batch is valid: 3 rows, 2 new depots, 1 existing depot, 3 credentials.
Depots: 2 created, 1 reused, 0 skipped.
Credentials: 3 created, 0 skipped.
Issue link: https://hub.example.com/app-redirect?...
Links: holders.links.csv
State: holders.state.jsonl
```

Created is what this run created, reused the depots that already existed, and skipped what an earlier run of the batch created. With `--resolve-deferred`, a line counts the depots whose deferred credentials it resolved. The issue link is the shared link of a `verifiable_presentation` service.

When a wallet message fails, the load finishes, prints that report, then prints the failed messages on stderr, and exits with 2:

```
Row 2:
  - the wallet message about depot 6512a1b2c3d4e5f6a7b8c9e0 failed: connect ECONNREFUSED 203.0.113.7:443

Error: the waiting wallets of 1 depot weren't told that their deferred credentials are ready. Rerun the same command to retry.
```

A load that stops prints, on stderr, the rows the Hub refused, if any, the error, and how far the batch got:

```
Row 3:
  - email: the auth values belong to depot 6512a1b2c3d4e5f6a7b8c9ff, which another client created after validation

Error: depots/create refused a depot
The load stopped after creating 1 of 3 depots and 0 of 3 credentials. holders.state.jsonl records what was created. Rerun the same command to continue.
```

With `--json`, `load` prints `{ valid, errors, summary, load }`, where `load` has the counts `depots: { created, reused, skipped }` and `credentials: { created, skipped }`, `resolvedDepots` with `--resolve-deferred`, the shared `link`, the `output` and `state` files, and `failedNotifications`: the wallet messages that failed, each with its `row`, `depotId` and the Hub's `error`. When the load stops, `load` has an `error` with its `message` and the refused rows' `errors`, and no `link`, `output` or `failedNotifications`.

## Example

`test/fixtures` has a spec, a CSV and an Open Badge template:

```sh
batch-issuer validate test/fixtures/spec.yaml test/fixtures/holders.csv \
  --endpoint https://hub.example.com --network testnet --registrar https://registrar.example.com
```
