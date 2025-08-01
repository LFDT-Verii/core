# Verii Credentials Issuer

This package provides core utilities for issuing Verifiable Credentials (VCs) in alignment with the Velocity Network specifications. It is intended for developers building services that prepare, issue, and manage the lifecycle of credentials.

## Features

- Issue credentials with `issueVeriiCredentials`
- Prepare credential offers
- Finalize credential exchanges
- Load and resolve credential references
- Trigger webhook notifications on issuance

## Installation

```bash
npm install @velocitycareerlabs/verii-issuing
```

## TL;DR
This package enables issuers to create W3C Verifiable Credentials using a Verii network (such as Velocity Network) data 
model and schema. Call `issueVeriiCredentials()` with your credential payload, configuration, and trace ID.

## Usage

### Main Entry: issueVeriiCredentials

This function is the recommended entry point for issuing one or more Verifiable Credentials. It handles validation, 
offer preparation, issuance, and anchoring to the blockchain.

```ts
import { issueVeriiCredentials } from '@velocitycareerlabs/velocity';

const unsignedCredentialOffers = [
    {
        type: 'EducationDegreeRegistrationV1.1',
        issuerId: 'did:web:example.com',
        credentialSubject: {
            degree: 'MSc in Policy Analysis',
            recipient: {
                givenName: 'Andres',
                familyName: 'Olave',
            }
        }
    }, 
    //...  many unsigned credential offers can be issued at once 
];

// Credential Metadata describes the schemaUrl & jsonld context for a specific type
const credentialMetadata = {
    "EducationDegreeRegistrationV1.1": {
        credentialType: 'EducationDegreeRegistrationV1.1',
        schemaUrl: 'https://velocitynetwork.foundation/schemas/education-degree-registration-v1.1.schema.json',
        jsonldContext: ['https://velocitynetwork.foundation/contexts/layer1-credentials-v1.1.json']
    }
}

const credentialSubjectId = "did:jwk:eyJrdHkiOiJFQyIsInVzZSI6InNpZyIsImNydiI6I..."; // credential subject id 

const result = await issueVeriiCredentials(
    unsignedCredentialOffers,
    credentialMetadata,
    issuerIds,  // see below
    credentialSubjectId,
    context // see below
);

console.log(result); // Issued credential(s) or summary metadata

// Output
// The function returns an array of W3C Verifiable Credential v1.1 JWTs:

// [
//   "eyJhbGciOiJFUzI1NiIsInR5cCI6...",
//   "eyJhbGciOiJFUzI1NiIsInR5cCI6..."
// ]
```

### Context
The context injects in configuration and services into the issuer. Two primary services are required
1. A KMS which signs JWTs based on Key Id's
2. A `allocationListQuery` is an API over a database or persistence service that manages the indexes being 
   allocated to on the DLT. 

The configuration properties are
#### caoDid
**type:** string

The Credential Application Operator DID (CAO DID). This DID represents the service provider or system that is operating 
on behalf of the credential subject

#### traceId
**type:** string
A unique identifier for tracing a credential issuance request across services and logs.

#### config
**type:** string
- revocationContractAddress (string):
  Ethereum address of the smart contract that manages credential revocation.
- metadataRegistryContractAddress (string):
  Ethereum address for the metadata registry contract used to anchor credential metadata on-chain.
- credentialExtensionsContextUrl (string):
  A JSON-LD context URL for custom or extended fields in the Verifiable Credential, typically aligning with
  ecosystem-specific vocabularies (e.g., Verii extensions).


```js
import { initProvider } from "@verii/base-contract-io";

// The KMS abstraction requires a signJwt function
const kms = {
    signJwt(
        decodedJwt, // { header: { ... }, payload: { ... } } 
        keyId
    ) {
        // ...
    }
}; 

// The allocationListQueries creates an allocation list and should allocate them atomically.
const allocationListQueries = {
    createNewAllocationList: (entityName, // allocation list name
                              issuerIds, // the issuerIds
                              newListId, // list id on the DLT
                              allocations, // array to store
                              context) => 
    {
        // ...
    },
    allocateNextEntry: (entityName,  // allocation list name
                        issuerIds,  // the issuerIds
                        context) => 
    {
        // ... 
    }
};

async function authenticator () {
    const token = authenticate() // Fetch an access token from an OAuth provider using the client_credential grant type
    return token
} 

const rpcProvider = initProvider("http://localhost:8545", authenticator);

const context = {
    kms,
    allocationListQueries,
    rpcProvider,
    caoDid: "did:web:example-service-provider.com",
    traceId: 'trace-abc-123',
    config: {
        revocationContractAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // DLT address for revocation address
        metadataRegistryContractAddress: "0x3f5CE5FBFe3E9af3971dD833D26BA9b5C936f0bE", // DLT address for VC metadata
        credentialExtensionsContextUrl: "https://verii.test/contexts/credential-extensions-2022.jsonld.json", // Context url
    },
};
```

### Issuer Ids
Finally, the issuer will need to utilize multiple ids when interacting with the service provider, the DID document, 
the service provider's KMS and the DLT

```js

const issuerIds = {
    // Database id for the issuer
    id: "64c3b6dcb3f1d83a94e3c1f7",
    
    // DID for the issuer
    did: "did:web:example.com",
    
    // issuer DID fragments for service and verification keys 
    issuingRefreshServiceId: "#issuer-service-1", // optional
    issuingServiceDIDKeyId: "#key-1",
    
    // DLT address for the issuer's primary account and their operator account
    dltPrimaryAddress: "0xaE5F37a1796d2465F8e31b3B5C3A8FcC4dA22a9E",
    dltOperatorAddress: "0x4e3bF5467b2c543aD1E3B719B7c9fC71Bb2F78e9", // can be identical to primary address
    
    // KMS ids used for the signing keys used for signing the Issuer VC and DLT transactions
    issuingServiceKMSKeyId: "4f9b4c24-7c81-4e76-8b9e-fc1c53b93a72",
    dltOperatorKMSKeyId: "d96c1c95-4f6a-48b8-9303-2f8e4e3de3fb",
};
```