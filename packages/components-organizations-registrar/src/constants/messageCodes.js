/**
 * Copyright 2023 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export const MESSAGE_CODES = {
  BAD_INVITEE_EMAIL: 'bad_invitee_email',
  INVITATION_SENT: 'invitation_sent',
  INVITATION_EXPIRED: 'invitation_expired',
  INVITATION_NOT_SENT: 'invitation_not_sent',
};

export const Authorities = {
  NationalAuthority: 'NationalAuthority',
  DunnAndBradstreet: 'DunnAndBradstreet',
  GLEIF: 'GLEIF',
  LinkedIn: 'LinkedIn',
};

export const authorityOptions = {
  DunnAndBradstreet: `D-U-N-S${String.fromCodePoint(174)} Number`,
  GLEIF: 'LEI',
  NationalAuthority: 'Local Country Registration ID',
};

export const AuthoritiesList = Object.values(Authorities);
