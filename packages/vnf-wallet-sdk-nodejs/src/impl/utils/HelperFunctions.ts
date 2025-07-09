/**
 * Created by Michael Avoyan on 08/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomBytes } from 'crypto';
import { Nullish } from '../../api/VCLTypes';
import VCLLog from './VCLLog';
import VCLError from '../../api/entities/error/VCLError';

export const getQueryParamsFromString = (
    srcStr: string
): Map<string, string> => {
    const result = new Map<string, string>();

    try {
        const url = new URL(srcStr.valueOf());
        const entries = url.searchParams.entries();

        for (const i of entries) {
            const [key, value] = i;
            // each 'entry' is a [key, value] tuple
            result.set(key, value);
        }
    } catch (error) {
        VCLLog.error(error);
    }

    return result;
};

export const appendQueryParamsToString = (
    srcStr: Nullish<string>,
    queryParams: string
): string => {
    return (
        srcStr?.valueOf() +
        (getQueryParamsFromString(decodeURI(srcStr?.valueOf() ?? '')).size
            ? '&'
            : '?') +
        queryParams
    );
};

export const getUrlSubPathFromString = (
    srcStr: Nullish<string>,
    subPathPrefix: string
): Nullish<string> => {
    return decodeURI(srcStr?.valueOf() ?? '')
        .split('/')
        .find((item) => item.startsWith(subPathPrefix));
};

export const randomString = (length: number): string =>
    randomBytes(length).toString('hex');

export const addDaysToNowDate = (srcDate: Date, days: number): Date => {
    srcDate.setUTCDate(srcDate.getUTCDate() + days);
    return srcDate;
};

export const equalsToDate = (date1: Date, date2: Date): boolean => {
    const selfCopy = new Date(
        Date.UTC(
            date1.getUTCFullYear(),
            date1.getUTCMonth(),
            date1.getUTCDate()
        )
    );
    const check = new Date(
        Date.UTC(
            date2.getUTCFullYear(),
            date2.getUTCMonth(),
            date2.getUTCDate()
        )
    );
    return selfCopy === check;
};

export const ensureDefined = <T>(
    value: T | null | undefined,
    name: string
): T => {
    if (value == null) {
        throw new VCLError(`${name} is required`);
    }
    return value;
};
