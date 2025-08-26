import { describe, test } from 'node:test';
import { expect } from 'expect';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import { VCLOrganizationsSearchDescriptor, VCLService } from '../../src';
import OrganizationsUseCaseImpl from '../../src/impl/data/usecases/OrganizationsUseCaseImpl';
import OrganizationsRepositoryImpl from '../../src/impl/data/repositories/OrganizationsRepositoryImpl';
import { OrganizationsMocks } from '../infrastructure/resources/valid/OrganizationsMocks';

describe('OrganizationsUseCase Tests', () => {
    const subject = new OrganizationsUseCaseImpl(
        new OrganizationsRepositoryImpl(
            new NetworkServiceSuccess(
                OrganizationsMocks.OrganizationJsonResultStr
            )
        )
    );

    test('testSearchForOrganizationsSuccess', async () => {
        const orgs = await subject.searchForOrganizations(
            new VCLOrganizationsSearchDescriptor(null, null, null, '')
        );
        const serviceCredentialAgentIssuer =
            orgs.all[0].serviceCredentialAgentIssuers[0];
        expect(serviceCredentialAgentIssuer.payload).toStrictEqual(
            OrganizationsMocks.ServiceJson
        );
        expect(serviceCredentialAgentIssuer.id).toEqual(
            OrganizationsMocks.ServiceJson[VCLService.KeyId]
        );
        expect(serviceCredentialAgentIssuer.type).toEqual(
            OrganizationsMocks.ServiceJson[VCLService.KeyType]
        );
        expect(serviceCredentialAgentIssuer.credentialTypes).toStrictEqual(
            OrganizationsMocks.ServiceJson[VCLService.KeyCredentialTypes]
        );
        expect(serviceCredentialAgentIssuer.serviceEndpoint).toEqual(
            OrganizationsMocks.ServiceEndpoint
        );
    });
});
