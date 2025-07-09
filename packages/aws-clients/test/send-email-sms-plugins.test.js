/*
 * Copyright 2024 Velocity Team
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
 *
 */
const { initSendEmailNotification } = require('../src/email-notifications');

jest.mock('../src/email-notifications', () => {
  return {
    initSendEmailNotification: jest.fn().mockReturnValue('sendEmailFn'),
  };
});

const { initSendSmsNotification } = require('../src/sms-notifications');

jest.mock('../src/sms-notifications', () => {
  return {
    initSendSmsNotification: jest.fn().mockReturnValue('sendSmsFn'),
  };
});

const { sendEmailPlugin, sendSmsPlugin } = require('..');

describe('Send Email and SMS Plugins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('email plugin should decorate fastify', async () => {
    const fakeServer = { config: { hi: 1 }, decorate: jest.fn() };
    await sendEmailPlugin(fakeServer);
    expect(initSendEmailNotification.mock.calls).toEqual([[fakeServer.config]]);
    expect(fakeServer.decorate.mock.calls).toEqual([
      ['sendEmail', 'sendEmailFn'],
    ]);
  });

  it('sms plugin should decorate fastify', async () => {
    const fakeServer = { config: {}, decorate: jest.fn() };
    await sendSmsPlugin(fakeServer);
    expect(initSendSmsNotification.mock.calls).toEqual([[fakeServer.config]]);
    expect(fakeServer.decorate.mock.calls).toEqual([['sendSms', 'sendSmsFn']]);
  });
});
