/**
 * Created by Michael Avoyan on 24/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

const BaseUrl = 'http://0.0.0.0:5000';

const Urls = {
  get getCountries(): string {
    return `${BaseUrl}/getCountries`;
  },
  get getCredentialTypes(): string {
    return `${BaseUrl}/getCredentialTypes`;
  },
  get getPresentationRequest(): string {
    return `${BaseUrl}/getPresentationRequest`;
  },
  get getCredentialTypeSchemas(): string {
    return `${BaseUrl}/getCredentialTypeSchemas`;
  },
  get submitPresentation(): string {
    return `${BaseUrl}/submitPresentation`;
  },
  get getExchangeProgress(): string {
    return `${BaseUrl}/getExchangeProgress`;
  },
  get searchForOrganizations(): string {
    return `${BaseUrl}/searchForOrganizations`;
  },
  get getCredentialManifest(): string {
    return `${BaseUrl}/getCredentialManifest`;
  },
  get generateOffers(): string {
    return `${BaseUrl}/generateOffers`;
  },
  get checkOffers(): string {
    return `${BaseUrl}/checkOffers`;
  },
  get finalizeOffers(): string {
    return `${BaseUrl}/finalizeOffers`;
  },
  get getAuthToken(): string {
    return `${BaseUrl}/getAuthToken`;
  },
  get getCredentialTypesUIFormSchema(): string {
    return `${BaseUrl}/getCredentialTypesUIFormSchema`;
  },
  get getVerifiedProfile(): string {
    return `${BaseUrl}/getVerifiedProfile`;
  },
  get verifyJwt(): string {
    return `${BaseUrl}/verifyJwt`;
  },
  get generateSignedJwt(): string {
    return `${BaseUrl}/generateSignedJwt`;
  },
  get generateDidJwk(): string {
    return `${BaseUrl}/generateDidJwk`;
  },
};

export default Urls;
