/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import Urls, { HeaderValues } from '../../src/impl/data/repositories/Urls';
import GlobalConfig from '../../src/impl/GlobalConfig';
import VCLXVnfProtocolVersion from '../../src/api/VCLXVnfProtocolVersion';
import VCLEnvironment from '../../src/api/VCLEnvironment';

describe('UrlsTest', () => {
    beforeEach(() => {
        // Set up any necessary preconditions here
    });

    test('testProdEnvironment', () => {
        const registrarPrefix = 'https://registrar.velocitynetwork.foundation';

        GlobalConfig.setCurrentEnvironment(VCLEnvironment.Prod);

        verifyUrlsPrefix(registrarPrefix);
    });

    test('testStagingEnvironment', () => {
        const registrarPrefix =
            'https://stagingregistrar.velocitynetwork.foundation';

        GlobalConfig.setCurrentEnvironment(VCLEnvironment.Staging);

        verifyUrlsPrefix(registrarPrefix);
    });

    test('testQaEnvironment', () => {
        const registrarPrefix =
            'https://qaregistrar.velocitynetwork.foundation';

        GlobalConfig.setCurrentEnvironment(VCLEnvironment.Qa);

        verifyUrlsPrefix(registrarPrefix);
    });

    test('testDevEnvironment', () => {
        const registrarPrefix =
            'https://devregistrar.velocitynetwork.foundation';

        GlobalConfig.setCurrentEnvironment(VCLEnvironment.Dev);

        verifyUrlsPrefix(registrarPrefix);
    });

    const verifyUrlsPrefix = (registrarPrefix: string) => {
        expect(Urls.CredentialTypes.startsWith(registrarPrefix)).toEqual(true);
        expect(Urls.CredentialTypeSchemas.startsWith(registrarPrefix)).toEqual(
            true
        );
        expect(Urls.Countries.startsWith(registrarPrefix)).toEqual(true);
        expect(Urls.Organizations.startsWith(registrarPrefix)).toEqual(true);
        expect(Urls.ResolveKid.startsWith(registrarPrefix)).toEqual(true);
        expect(
            Urls.CredentialTypesFormSchema.startsWith(registrarPrefix)
        ).toEqual(true);
    };

    test('testXVnfProtocolVersion', () => {
        GlobalConfig.setXVnfProtocolVersion(
            VCLXVnfProtocolVersion.XVnfProtocolVersion1
        );
        expect(HeaderValues.XVnfProtocolVersion).toEqual('1.0');

        GlobalConfig.setXVnfProtocolVersion(
            VCLXVnfProtocolVersion.XVnfProtocolVersion2
        );
        expect(HeaderValues.XVnfProtocolVersion).toEqual('2.0');
    });

    afterEach(() => {
        // Clean up any necessary postconditions here
    });
});
