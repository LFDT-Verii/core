/**
 * Created by Michael Avoyan on 03/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, test } from 'node:test';
import { expect } from 'expect';
import { VCLEnvironment, VCLXVnfProtocolVersion } from '../src';
import GlobalConfig from '../src/impl/GlobalConfig';

describe('GlobalConfig', () => {
    test('should initialize with default values', () => {
        GlobalConfig.init(
            false,
            VCLEnvironment.Prod,
            VCLXVnfProtocolVersion.XVnfProtocolVersion1,
            true
        );

        expect(GlobalConfig.IsDebugOn).toEqual(false);
        expect(GlobalConfig.CurrentEnvironment).toEqual(VCLEnvironment.Prod);
        expect(GlobalConfig.XVnfProtocolVersion).toEqual(
            VCLXVnfProtocolVersion.XVnfProtocolVersion1
        );
        expect(GlobalConfig.IsDirectIssuerOn).toEqual(true);
    });

    test('should set custom values during initialization', () => {
        GlobalConfig.init(
            true,
            VCLEnvironment.Staging,
            VCLXVnfProtocolVersion.XVnfProtocolVersion2,
            false
        );

        expect(GlobalConfig.CurrentEnvironment).toEqual(VCLEnvironment.Staging);
        expect(GlobalConfig.XVnfProtocolVersion).toEqual(
            VCLXVnfProtocolVersion.XVnfProtocolVersion2
        );
        expect(GlobalConfig.IsDirectIssuerOn).toEqual(false);
        expect(GlobalConfig.IsDebugOn).toEqual(true);
        expect(GlobalConfig.IsLoggerOn).toEqual(true);
    });

    test('should correctly determine if logger is on', () => {
        GlobalConfig.init(
            false,
            VCLEnvironment.Prod,
            VCLXVnfProtocolVersion.XVnfProtocolVersion1,
            true
        );
        GlobalConfig.init(
            true,
            VCLEnvironment.Dev,
            VCLXVnfProtocolVersion.XVnfProtocolVersion1,
            true
        );
        expect(GlobalConfig.IsDebugOn).toEqual(true);
        expect(GlobalConfig.IsLoggerOn).toEqual(true);
    });

    test('should initialize logger with VCLLogService', () => {
        GlobalConfig.init(
            true,
            VCLEnvironment.Prod,
            VCLXVnfProtocolVersion.XVnfProtocolVersion1,
            true
        );

        expect(GlobalConfig.IsDebugOn).toEqual(true);
        expect(GlobalConfig.IsLoggerOn).toEqual(true);
    });

    test('test debug & logger for Prod', () => {
        GlobalConfig.init(
            false,
            VCLEnvironment.Prod,
            VCLXVnfProtocolVersion.XVnfProtocolVersion1,
            true
        );

        expect(GlobalConfig.IsDebugOn).toEqual(false);
        expect(GlobalConfig.IsLoggerOn).toEqual(false);
    });

    test('test debug & logger for Staging', () => {
        GlobalConfig.init(
            false,
            VCLEnvironment.Staging,
            VCLXVnfProtocolVersion.XVnfProtocolVersion1,
            true
        );

        expect(GlobalConfig.IsDebugOn).toEqual(false);
        expect(GlobalConfig.IsLoggerOn).toEqual(false);
    });

    test('test debug & logger for Qa', () => {
        GlobalConfig.init(
            false,
            VCLEnvironment.Qa,
            VCLXVnfProtocolVersion.XVnfProtocolVersion1,
            true
        );

        expect(GlobalConfig.IsDebugOn).toEqual(false);
        expect(GlobalConfig.IsLoggerOn).toEqual(true);
    });

    test('test debug & logger for Dev', () => {
        GlobalConfig.init(
            false,
            VCLEnvironment.Dev,
            VCLXVnfProtocolVersion.XVnfProtocolVersion1,
            true
        );

        expect(GlobalConfig.IsDebugOn).toEqual(false);
        expect(GlobalConfig.IsLoggerOn).toEqual(true);
    });
});
