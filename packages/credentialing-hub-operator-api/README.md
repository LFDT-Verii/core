# @verii/credentialing-hub-operator-api

What the Credentialing Hub (`@verii/server-credentialing-hub`) and a client of its operator API both need to build and validate requests. The Hub imports these instead of keeping its own copies, so a client stays in step with it.

The package is plain JavaScript. It has no Fastify or MongoDB code, and it never depends on the Hub.

## Schemas

The operator API's JSON schemas, with the `$id`s the Hub publishes in its OpenAPI document:

| Export | `$id` | Used for |
| --- | --- | --- |
| `newIssuerServiceSchema` | `new-issuer-service` | the `service` of `issuer-services/create` and `issuer-services/update` |
| `issuerServiceSchema` | `issuer-service` | an issuer service in responses |
| `newDepotSchema` | `new-depot` | the `depot` of `depots/create` |
| `depotSchema` | `depot` | a depot in responses |
| `depotConflictErrorSchema` | `depot-conflict-error` | the 409 response of `depots/create` |
| `newCredentialSchema` | `new-credential` | the `credential` of `credentials/create` and of each `credentials/create-many` item |
| `credentialSchema` | `Credential` | a credential in responses |

## Validator

`initOperatorApiValidator()` compiles the request schemas (`new-issuer-service`, `new-depot` and `new-credential`) with the AJV options and formats the Hub uses. A client then accepts what the Hub accepts. Like the Hub, it doesn't apply schema defaults or coerce types, so it never changes the data, and it reports only the first error.

```js
const {
  initOperatorApiValidator,
} = require('@verii/credentialing-hub-operator-api');

const { validate, assertValid } = initOperatorApiValidator();

// The AJV errors, or [] when the depot is valid
const errors = validate('new-depot', { userReference: 'employee-1', authValues: ['adam@example.com'] });

// Returns the data, or throws a 400 error with Fastify's message format and the AJV errors in `validation`
assertValid('new-depot', depot, 'body/depot');
```

`operatorApiAjvOptions` and `operatorApiAjvFormats` are the options and formats it uses. A Hub test checks they match the Hub's config.

## Auth values

A depot's `authValues` are matched against what a holder's credentials disclose after normalizing both:

- `toAuthMatchValue(value)` trims and lower-cases a string, and leaves a number or boolean as it is. It doesn't convert between types, so `"12345"` never matches `12345`.
- `buildAuthMatchValues(authValues)` normalizes each value of a depot's `authValues`, in order.

## Rule evaluation

An issuer service's `verifiablePresentationAuthRules` read values from the credentials a holder presents:

- `selectClaims(pointer, credential)` evaluates a claims path pointer (OpenID4VP 1.0, section 7) against a credential and returns what it selects. A string selects a key of an object, a non-negative integer an index of an array, and `null` every element of an array. It never throws.
- `ruleValues(rule, credentials)` returns the distinct normalized scalar values that a rule finds in the credentials of its `type`. `credentials` are `{ type, credential }` for each credential. The rule's pointers are tried in order, and the first one that selects a string, number or boolean supplies the values.

```js
const { ruleValues } = require('@verii/credentialing-hub-operator-api');

ruleValues(
  { path: [['credentialSubject', 'email']], rule: 'pick', valueIndex: 0, type: 'EmailV1.0' },
  [{ type: 'EmailV1.0', credential: { credentialSubject: { email: ' Adam@Example.com' } } }],
); // ['adam@example.com']
```

## Error codes

The `errorCode`s that the issuer service, depot and credential operator endpoints return:

- `IssuerServicesErrors` and `ServiceConfigurationErrors`, from `issuer-services/*`
- `DepotErrors`, from `depots/*`
- `CredentialErrors`, from `credentials/*`

```js
const { DepotErrors } = require('@verii/credentialing-hub-operator-api');

if (response.errorCode === DepotErrors.AUTH_VALUES_ALREADY_USED) {
  // reuse response.depotId
}
```
