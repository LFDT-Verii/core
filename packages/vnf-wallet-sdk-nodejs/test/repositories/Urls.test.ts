/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, test } from 'node:test';
import { expect } from 'expect';
import Urls, { HeaderValues } from '../../src/impl/data/repositories/Urls';
import GlobalConfig from '../../src/impl/GlobalConfig';
import VCLXVnfProtocolVersion from '../../src/api/VCLXVnfProtocolVersion';
import VCLEnvironment from '../../src/api/VCLEnvironment';

describe('Urls', () => {
    test('builds urls for the prod environment', () => {
        const registrarPrefix = 'https://registrar.velocitynetwork.foundation';

        GlobalConfig.setCurrentEnvironment(VCLEnvironment.Prod);

        verifyUrlsPrefix(registrarPrefix);
    });

    test('builds urls for the staging environment', () => {
        const registrarPrefix =
            'https://stagingregistrar.velocitynetwork.foundation';

        GlobalConfig.setCurrentEnvironment(VCLEnvironment.Staging);

        verifyUrlsPrefix(registrarPrefix);
    });

    test('builds urls for the qa environment', () => {
        const registrarPrefix =
            'https://qaregistrar.velocitynetwork.foundation';

        GlobalConfig.setCurrentEnvironment(VCLEnvironment.Qa);

        verifyUrlsPrefix(registrarPrefix);
    });

    test('builds urls for the dev environment', () => {
        const registrarPrefix =
            'https://devregistrar.velocitynetwork.foundation';

        GlobalConfig.setCurrentEnvironment(VCLEnvironment.Dev);

        verifyUrlsPrefix(registrarPrefix);
    });

    const verifyUrlsPrefix = (registrarPrefix: string) => {
        expect(Urls.CredentialTypes.startsWith(registrarPrefix)).toEqual(true);
        expect(Urls.CredentialTypeSchemas.startsWith(registrarPrefix)).toEqual(
            true,
        );
        expect(Urls.Countries.startsWith(registrarPrefix)).toEqual(true);
        expect(Urls.Organizations.startsWith(registrarPrefix)).toEqual(true);
        expect(Urls.ResolveKid.startsWith(registrarPrefix)).toEqual(true);
        expect(
            Urls.CredentialTypesFormSchema.startsWith(registrarPrefix),
        ).toEqual(true);
    };

    test('uses the configured x-vnf protocol version', () => {
        GlobalConfig.setXVnfProtocolVersion(
            VCLXVnfProtocolVersion.XVnfProtocolVersion1,
        );
        expect(HeaderValues.XVnfProtocolVersion).toEqual('1.0');

        GlobalConfig.setXVnfProtocolVersion(
            VCLXVnfProtocolVersion.XVnfProtocolVersion2,
        );
        expect(HeaderValues.XVnfProtocolVersion).toEqual('2.0');
    });
});
