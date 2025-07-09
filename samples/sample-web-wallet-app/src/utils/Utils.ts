/**
 * Created by Michael Avoyan on 10/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Dictionary } from '../Types';

// eslint-disable-next-line complexity
export const getApprovedRejectedOfferIdsMock = (
  offers: Dictionary<any>
): [string[], string[]] => {
  const approvedOfferIds: string[] = [];
  const rejectedOfferIds: string[] = [];
  let offer1: string | null = null;
  let offer2: string | null = null;
  let offer3: string | null = null;

  if (offers.all.length > 0) {
    offer1 = offers.all[0].payload.id;
  }
  if (offers.all.length > 1) {
    offer2 = offers.all[1].payload.id;
  }
  if (offers.all.length > 2) {
    offer3 = offers.all[2].payload.id;
  }
  if (offer1 !== null) {
    approvedOfferIds.push(offer1);
  }
  if (offer2 !== null) {
    approvedOfferIds.push(offer2);
  }
  if (offer3 !== null) {
    rejectedOfferIds.push(offer3);
  }
  return [approvedOfferIds, rejectedOfferIds];
};

export const verifyToken = (token) => {
  return token?.jwtValue?.payload?.exp > Date.now() / 1000;
};
