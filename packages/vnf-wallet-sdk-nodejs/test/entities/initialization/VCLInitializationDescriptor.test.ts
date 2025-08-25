/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, test } from 'node:test';
import { expect } from 'expect';
import {
    VCLCryptoServicesDescriptor,
    VCLEnvironment,
    VCLInitializationDescriptor,
    VCLXVnfProtocolVersion,
} from '../../../src';
import { KeyServiceMock } from '../../infrastructure/resources/key/KeyServiceMock';
import { JwtVerifyServiceMock } from '../../infrastructure/resources/jwt/JwtVerifyServiceMock';
import { JwtSignServiceMock } from '../../infrastructure/resources/jwt/JwtSignServiceMock';

describe('VCLInitializationDescriptor tests', () => {
    const cryptoServicesDescriptor = new VCLCryptoServicesDescriptor(
        new KeyServiceMock(),
        new JwtSignServiceMock(),
        new JwtVerifyServiceMock()
    );

    test('should create an instance with specified values: Dev, XVnfProtocolVersion1', () => {
        const environment = VCLEnvironment.Dev;
        const xVnfProtocolVersion = VCLXVnfProtocolVersion.XVnfProtocolVersion1;

        const subject = new VCLInitializationDescriptor(
            environment,
            xVnfProtocolVersion,
            cryptoServicesDescriptor
        );

        expect(subject.environment).toStrictEqual(environment);
        expect(subject.xVnfProtocolVersion).toStrictEqual(xVnfProtocolVersion);
        expect(subject.cryptoServicesDescriptor).toStrictEqual(
            cryptoServicesDescriptor
        );
    });

    test('should create an instance with specified values: Qa, XVnfProtocolVersion1', () => {
        const environment = VCLEnvironment.Qa;
        const xVnfProtocolVersion = VCLXVnfProtocolVersion.XVnfProtocolVersion1;

        const subject = new VCLInitializationDescriptor(
            environment,
            xVnfProtocolVersion,
            cryptoServicesDescriptor
        );

        expect(subject.environment).toStrictEqual(environment);
        expect(subject.xVnfProtocolVersion).toStrictEqual(xVnfProtocolVersion);
        expect(subject.cryptoServicesDescriptor).toStrictEqual(
            cryptoServicesDescriptor
        );
    });

    test('should create an instance with specified values: Staging, XVnfProtocolVersion1', () => {
        const environment = VCLEnvironment.Staging;
        const xVnfProtocolVersion = VCLXVnfProtocolVersion.XVnfProtocolVersion1;

        const subject = new VCLInitializationDescriptor(
            environment,
            xVnfProtocolVersion,
            cryptoServicesDescriptor
        );

        expect(subject.environment).toStrictEqual(environment);
        expect(subject.xVnfProtocolVersion).toStrictEqual(xVnfProtocolVersion);
        expect(subject.cryptoServicesDescriptor).toStrictEqual(
            cryptoServicesDescriptor
        );
    });

    test('should create an instance with specified values: Prod, XVnfProtocolVersion1', () => {
        const environment = VCLEnvironment.Prod;
        const xVnfProtocolVersion = VCLXVnfProtocolVersion.XVnfProtocolVersion1;

        const subject = new VCLInitializationDescriptor(
            environment,
            xVnfProtocolVersion,
            cryptoServicesDescriptor
        );

        expect(subject.environment).toStrictEqual(environment);
        expect(subject.xVnfProtocolVersion).toStrictEqual(xVnfProtocolVersion);
        expect(subject.cryptoServicesDescriptor).toStrictEqual(
            cryptoServicesDescriptor
        );
    });

    test('should create an instance with specified values: Dev, XVnfProtocolVersion2', () => {
        const environment = VCLEnvironment.Dev;
        const xVnfProtocolVersion = VCLXVnfProtocolVersion.XVnfProtocolVersion1;

        const subject = new VCLInitializationDescriptor(
            environment,
            xVnfProtocolVersion,
            cryptoServicesDescriptor
        );

        expect(subject.environment).toStrictEqual(environment);
        expect(subject.xVnfProtocolVersion).toStrictEqual(xVnfProtocolVersion);
        expect(subject.cryptoServicesDescriptor).toStrictEqual(
            cryptoServicesDescriptor
        );
    });

    test('should create an instance with specified values: Qa, XVnfProtocolVersion2', () => {
        const environment = VCLEnvironment.Qa;
        const xVnfProtocolVersion = VCLXVnfProtocolVersion.XVnfProtocolVersion1;

        const subject = new VCLInitializationDescriptor(
            environment,
            xVnfProtocolVersion,
            cryptoServicesDescriptor
        );

        expect(subject.environment).toStrictEqual(environment);
        expect(subject.xVnfProtocolVersion).toStrictEqual(xVnfProtocolVersion);
        expect(subject.cryptoServicesDescriptor).toStrictEqual(
            cryptoServicesDescriptor
        );
    });

    test('should create an instance with specified values: Staging, XVnfProtocolVersion2', () => {
        const environment = VCLEnvironment.Staging;
        const xVnfProtocolVersion = VCLXVnfProtocolVersion.XVnfProtocolVersion1;

        const subject = new VCLInitializationDescriptor(
            environment,
            xVnfProtocolVersion,
            cryptoServicesDescriptor
        );

        expect(subject.environment).toStrictEqual(environment);
        expect(subject.xVnfProtocolVersion).toStrictEqual(xVnfProtocolVersion);
        expect(subject.cryptoServicesDescriptor).toStrictEqual(
            cryptoServicesDescriptor
        );
    });

    test('should create an instance with specified values: Prod, XVnfProtocolVersion2', () => {
        const environment = VCLEnvironment.Prod;
        const xVnfProtocolVersion = VCLXVnfProtocolVersion.XVnfProtocolVersion1;

        const subject = new VCLInitializationDescriptor(
            environment,
            xVnfProtocolVersion,
            cryptoServicesDescriptor
        );

        expect(subject.environment).toStrictEqual(environment);
        expect(subject.xVnfProtocolVersion).toStrictEqual(xVnfProtocolVersion);
        expect(subject.cryptoServicesDescriptor).toStrictEqual(
            cryptoServicesDescriptor
        );
    });
});
