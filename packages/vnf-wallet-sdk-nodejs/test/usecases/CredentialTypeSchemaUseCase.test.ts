import { describe, test } from 'node:test';
import { expect } from 'expect';
import CredentialTypeSchemasUseCaseImpl from '../../src/impl/data/usecases/CredentialTypeSchemasUseCaseImpl';
import CredentialTypeSchemaRepositoryImpl from '../../src/impl/data/repositories/CredentialTypeSchemaRepositoryImpl';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { CredentialTypeSchemaMocks } from '../infrastructure/resources/valid/CredentialTypeSchemaMocks';
import { mockRegistrarGet, useNockLifecycle } from '../utils/nock';

describe('CredentialTypeSchemaUseCase', () => {
    const expectedCredentialTypeSchemasPayload = JSON.parse(
        CredentialTypeSchemaMocks.CredentialTypeSchemaJson,
    );
    const subject = new CredentialTypeSchemasUseCaseImpl(
        new CredentialTypeSchemaRepositoryImpl(new NetworkServiceImpl()),
        CredentialTypeSchemaMocks.CredentialTypes,
    );

    useNockLifecycle();

    test('returns credential type schemas', async () => {
        const scope = mockRegistrarGet(
            `/schemas/${CredentialTypeSchemaMocks.CredentialType.schemaName}`,
            expectedCredentialTypeSchemasPayload,
        );

        const credTypeSchemas = await subject.getCredentialTypeSchemas();

        expect(
            credTypeSchemas.all[
                CredentialTypeSchemaMocks.CredentialType.schemaName
            ]?.payload,
        ).toStrictEqual(expectedCredentialTypeSchemasPayload);
        expect(scope.isDone()).toBeTruthy();
    });
});
