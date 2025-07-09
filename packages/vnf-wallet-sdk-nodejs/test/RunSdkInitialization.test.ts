/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from '@jest/globals';
import { VCLImpl } from '../src/impl/VCLImpl';
import { VCLProvider } from '../src';

describe('GlobalConfigTest', () => {
    it('sdk should be initialized successfully', async () => {
        const vclSdk = VCLProvider.getInstance();

        // const initializationDescriptor = new VCLInitializationDescriptor(
        //     VCLEnvironment.Dev,
        //     VCLXVnfProtocolVersion.XVnfProtocolVersion2,
        //     new VCLCryptoServicesDescriptor(
        //         new KeyServiceMock(),
        //         new JwtSignServiceMock(),
        //         new JwtVerifyServiceMock()
        //     )
        // );
        // await vclSdk.initialize(initializationDescriptor);

        expect(vclSdk).toBeInstanceOf(VCLImpl);
    });
});
