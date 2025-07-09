# Spencer Mongo Extensions

There are two extensions:
- Multitenant Extension
- Protected Mongo Collection Extension

## Multitenant Extension
The Multitenant extension adds easy to use share-collection multi tenancy support by passing in a 
`tenant` object on the context. 

The property on the collection is by default `tenantId` but is configurable by 
passing in `repoProp` when initializing the extension.

The property to be referenced on the `tenant` object is by default the `_id` but
is also configurable by passing in `tenantProp`  when initializing the extension.

Both `repoProp` & `tenantProp` can be paths within the json document such as `"some.nested.key"`

### Migrations (advanced)
The Multitenant extension supports lazy migration from one `repoProp`/`tenantProp` 
configuration to another. Use the `migrateFrom: { repoProp: 'oldCollectionReferenceProperty', tenantProp: 'oldTenantProperty' }`

### Examples
#### Default case
A multi tenant collection where the reference is stored like `{ tenantId: 64f1123edf89a89f18418843e12 }` which is the value in the `tenant._id` 
`multitenantExtension()` 

#### Customized repo prop and tenant prop
A multi tenant collection where the reference is stored like `{issuer: {id: did:ion:123901239013}}` to the value in the `tenant.did`

`multitenantExtension({ repoProp: 'issuer.id', tenantProp: 'did'})`

#### Migration (advanced)
A multi tenant collection that used to store references to tenants like the customization above but wants to move to the default (`tenant._id` stored under `tenantId`)
`multitenantExtension({migrationFrom: { repoProp: 'issuer.id', tenantProp: 'did'}, repoProp: 'tenantId', tenantProp: '_id'})`

## Protected Mongo Collection Extension

Protected Mongo Collection supports encryption of a single property on the collection 
using a secret set as an environment variable. Used it to protect PII, keys/secrets and the like.