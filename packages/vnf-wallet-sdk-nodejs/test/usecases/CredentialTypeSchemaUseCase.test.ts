import { describe, test } from 'node:test';
import { expect } from 'expect';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import CredentialTypeSchemasUseCaseImpl from '../../src/impl/data/usecases/CredentialTypeSchemasUseCaseImpl';
import CredentialTypeSchemaRepositoryImpl from '../../src/impl/data/repositories/CredentialTypeSchemaRepositoryImpl';
import { CredentialTypeSchemaMocks } from '../infrastructure/resources/valid/CredentialTypeSchemaMocks';

describe('CredentialTypeSchemaUseCase Tests', () => {
    const expectedCredentialTypeSchemasPayload = JSON.parse(
        CredentialTypeSchemaMocks.CredentialTypeSchemaJson
    );
    const subject = new CredentialTypeSchemasUseCaseImpl(
        new CredentialTypeSchemaRepositoryImpl(
            new NetworkServiceSuccess(expectedCredentialTypeSchemasPayload)
        ),
        CredentialTypeSchemaMocks.CredentialTypes
    );

    test('testGetCredentialTypeSchemas', async () => {
        const credTypeSchemas = await subject.getCredentialTypeSchemas();

        expect(
            credTypeSchemas.all[
                CredentialTypeSchemaMocks.CredentialType.schemaName
            ]?.payload
        ).toStrictEqual(expectedCredentialTypeSchemasPayload);
    });
});
