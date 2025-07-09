/* eslint-disable max-len */
import { CredentialTypesMocks } from './CredentialTypesMocks';
import { VCLCredentialTypes } from '../../../../src';

export class CredentialTypeSchemaMocks {
    static readonly CredentialTypeSchemaJson: string = `
    {
        "title": "vaccination-certificate",
        "$id": "https://velocitynetwork.foundation/schemas/vaccination-certificate",
        "type": "object",
        "properties": {
            "disease": {
                "type": "string",
                "description": "Disease or agent that the vaccination provides protection against"
            },
            "vaccineDescription": {
                "type": "string",
                "description": "Generic description of the vaccine/prophylaxis"
            },
            "vaccineType": {
                "type": "string",
                "description": "Generic description of the vaccine/prophylaxis or its component(s) [J07BX03 covid-19 vaccines]"
            },
            "certifiedBy": {
                "type": "string",
                "description": "Entity that has issued the certificate (allowing to check the certificate)"
            },
            "certificateNumber": {
                "type": "string",
                "description": "Unique identifier of the certificate (UVCI), to be printed (human readable) into the certificate; the unique identifier can be included in the IIS"
            },
            "certificateValidFrom": {
                "type": "string",
                "format": "date-time",
                "description": "Certificate valid from (required if known)"
            },
            "certificateValidTo": {
                "type": "string",
                "format": "date-time",
                "description": "Certificate valid until (validity can differ from the expected immunisation period)"
            },
            "formVersion": {
                "type": "string",
                "pattern": "^1.0.0$",
                "description": "Version of this minimum dataset definition"
            }
        },
        "required": [
            "disease",
            "vaccineDescription",
            "vaccineType",
            "certifiedBy",
            "certificateNumber",
            "certificateValidFrom",
            "formVersion"
        ]
    }`;

    static readonly CredentialType = {
        payload: JSON.parse(CredentialTypesMocks.CredentialType2),
        id: '5fe4a315d8b45dd2e80bd73a',
        schema: '',
        createdAt: '2022-03-17T09:24:38.448Z',
        schemaName: 'current-employment-position',
        credentialType: 'CurrentEmploymentPosition',
        recommended: true,
        jsonldContext: [],
        issuerCategory: 'RegularIssuer',
    };

    static readonly CredentialTypes = VCLCredentialTypes.fromPayload([
        CredentialTypeSchemaMocks.CredentialType,
    ]);
}
