import { describe, test } from 'node:test';
import { expect } from 'expect';
import { VCLOffers } from '../../src';
import { CommonMocks } from '../infrastructure/resources/CommonMocks';
import { OffersMocks } from '../infrastructure/resources/valid/OffersMocks';

describe('VCLOffers', () => {
    const subject1 = VCLOffers.fromPayload(
        JSON.parse(OffersMocks.offersJsonArrayStr),
        123,
        CommonMocks.Token,
    );
    const subject2 = VCLOffers.fromPayload(
        JSON.parse(OffersMocks.offersJsonObjectStr),
        123,
        CommonMocks.Token,
    );
    const subject3 = VCLOffers.fromPayload(
        JSON.parse(OffersMocks.offersJsonEmptyArrayStr),
        123,
        CommonMocks.Token,
    );
    const subject4 = VCLOffers.fromPayload(
        JSON.parse(OffersMocks.offersJsonEmptyObjectStr),
        123,
        CommonMocks.Token,
    );

    test('creates offers from an array payload', async () => {
        expect(subject1.payload[VCLOffers.CodingKeys.KeyOffers]).toStrictEqual(
            JSON.parse(OffersMocks.offersJsonArrayStr),
        );

        testExpectations(subject1);
        expect(subject1.challenge).toEqual(null);
        expect(subject1.all.map((offer) => offer.payload)).toStrictEqual(
            JSON.parse(OffersMocks.offersJsonArrayStr),
        );
    });

    test('creates offers from an object payload', async () => {
        expect(subject2.payload).toStrictEqual(
            JSON.parse(OffersMocks.offersJsonObjectStr),
        );

        testExpectations(subject2);
        expect(subject2.challenge).toEqual(OffersMocks.challenge);
        expect(subject2.all.map((offer) => offer.payload)).toStrictEqual(
            JSON.parse(OffersMocks.offersJsonArrayStr),
        );
    });

    test('creates offers from an empty array payload', async () => {
        expect(subject3.payload[VCLOffers.CodingKeys.KeyOffers]).toStrictEqual(
            JSON.parse(OffersMocks.offersJsonEmptyArrayStr),
        );

        testExpectations(subject1);
        expect(subject3.challenge).toEqual(null);
        expect(subject3.all.map((offer) => offer.payload)).toStrictEqual(
            JSON.parse(OffersMocks.offersJsonEmptyArrayStr),
        );
    });

    test('creates offers from an empty object payload', async () => {
        expect(subject4.payload).toStrictEqual(
            JSON.parse(OffersMocks.offersJsonEmptyObjectStr),
        );

        testExpectations(subject2);
        expect(subject4.challenge).toEqual(OffersMocks.challenge);
        expect(subject4.all.map((offer) => offer.payload)).toStrictEqual(
            JSON.parse(OffersMocks.offersJsonEmptyArrayStr),
        );
    });

    const testExpectations = (subject: VCLOffers) => {
        expect(subject.responseCode).toEqual(123);
        expect(subject.sessionToken).toStrictEqual(CommonMocks.Token);
        expect(subject.all.length).toEqual(11);
    };
});
