import { describe, test } from 'node:test';
import { expect } from 'expect';
import { VCLOrganizationsSearchDescriptor, VCLService } from '../../src';
import OrganizationsUseCaseImpl from '../../src/impl/data/usecases/OrganizationsUseCaseImpl';
import OrganizationsRepositoryImpl from '../../src/impl/data/repositories/OrganizationsRepositoryImpl';
import { OrganizationsMocks } from '../infrastructure/resources/valid/OrganizationsMocks';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { mockRegistrarGet, useNockLifecycle } from '../utils/nock';

describe('OrganizationsUseCase', () => {
    const subject = new OrganizationsUseCaseImpl(
        new OrganizationsRepositoryImpl(new NetworkServiceImpl()),
    );
    const organizationsSearchDescriptor = new VCLOrganizationsSearchDescriptor(
        null,
        null,
        null,
        '',
    );

    useNockLifecycle();

    test('returns organizations for a search descriptor', async () => {
        const scope = mockRegistrarGet(
            '/api/v0.6/organizations/search-profiles',
            OrganizationsMocks.OrganizationJsonResultStr,
        );

        const orgs = await subject.searchForOrganizations(
            organizationsSearchDescriptor,
        );
        const serviceCredentialAgentIssuer =
            orgs.all[0].serviceCredentialAgentIssuers[0];
        expect(serviceCredentialAgentIssuer).toEqual(
            new VCLService(OrganizationsMocks.ServiceJson),
        );
        expect(scope.isDone()).toBeTruthy();
    });
});
