const { omit, values, pick } = require('lodash/fp');
const { organizationProfileBaseSchema } = require('@verii/common-schemas');
const {
  ServiceCategories,
  ServiceTypesOfServiceCategory,
} = require('@verii/organizations-registry');

const keyIndividualProperties = [
  'adminGivenName',
  'adminFamilyName',
  'adminTitle',
  'adminEmail',
  'signatoryGivenName',
  'signatoryFamilyName',
  'signatoryTitle',
  'signatoryEmail',
];

const addInvitationBodySchema = {
  title: 'add-invitation-body',
  $id: 'https://velocitycareerlabs.io/add-invitation-body.json',
  type: 'object',
  description:
    'payload for adding a invitations to an organization in the registrar',
  properties: {
    inviteeEmail: {
      type: 'string',
    },
    inviteeService: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          type: {
            type: 'string',
            enum: [
              ...values(
                ServiceTypesOfServiceCategory[
                  ServiceCategories.IdDocumentIssuer
                ]
              ),
              ...values(
                ServiceTypesOfServiceCategory[
                  ServiceCategories.NotaryIdDocumentIssuer
                ]
              ),
              ...values(
                ServiceTypesOfServiceCategory[ServiceCategories.ContactIssuer]
              ),
              ...values(
                ServiceTypesOfServiceCategory[
                  ServiceCategories.NotaryContactIssuer
                ]
              ),
              ...values(
                ServiceTypesOfServiceCategory[ServiceCategories.Inspector]
              ),
              ...values(
                ServiceTypesOfServiceCategory[ServiceCategories.Issuer]
              ),
              ...values(
                ServiceTypesOfServiceCategory[ServiceCategories.NotaryIssuer]
              ),
              ...values(
                ServiceTypesOfServiceCategory[ServiceCategories.IdentityIssuer]
              ),
              ...values(
                ServiceTypesOfServiceCategory[
                  ServiceCategories.HolderAppProvider
                ]
              ),
            ],
            minLength: 1,
          },
          serviceEndpoint: {
            type: 'string',
          },
          credentialTypes: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        required: ['id', 'type', 'serviceEndpoint'],
      },
    },
    inviteeProfile: {
      type: 'object',
      properties: {
        ...omit(
          keyIndividualProperties,
          organizationProfileBaseSchema.properties
        ),
        type: omit(['default'], organizationProfileBaseSchema.properties.type),
      },
      required: ['name'],
    },
    inviteeDid: {
      type: 'string',
    },
    keyIndividuals: {
      type: 'object',
      properties: pick(
        keyIndividualProperties,
        organizationProfileBaseSchema.properties
      ),
      required: ['adminGivenName', 'adminFamilyName', 'adminEmail'],
    },
  },
  required: [
    'inviteeEmail',
    'inviteeService',
    'inviteeProfile',
    'keyIndividuals',
  ],
};

module.exports = { addInvitationBodySchema };
