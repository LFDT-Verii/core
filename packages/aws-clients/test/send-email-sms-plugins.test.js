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
const { mock, describe, it, after } = require('node:test');
const { expect } = require('expect');

const initSendEmailNotification = mock.fn(() => 'sendEmailFn');

mock.module('../src/email-notifications.js', {
  namedExports: {
    initSendEmailNotification,
  },
});

const initSendSmsNotification = mock.fn(() => 'sendSmsFn');

mock.module('../src/sms-notifications.js', {
  namedExports: {
    initSendSmsNotification,
  },
});

const { sendEmailPlugin, sendSmsPlugin } = require('..');

describe('Send Email and SMS Plugins', () => {
  after(() => {
    mock.reset();
  });

  it('email plugin should decorate fastify', async () => {
    const fakeServer = { config: { hi: 1 }, decorate: mock.fn(() => {}) };
    await sendEmailPlugin(fakeServer);
    expect(
      initSendEmailNotification.mock.calls.map((call) => call.arguments)
    ).toEqual([[fakeServer.config]]);
    expect(
      fakeServer.decorate.mock.calls.map((call) => call.arguments)
    ).toEqual([['sendEmail', 'sendEmailFn']]);
  });

  it('sms plugin should decorate fastify', async () => {
    const fakeServer = { config: {}, decorate: mock.fn(() => {}) };
    await sendSmsPlugin(fakeServer);
    expect(
      initSendSmsNotification.mock.calls.map((call) => call.arguments)
    ).toEqual([[fakeServer.config]]);
    expect(
      fakeServer.decorate.mock.calls.map((call) => call.arguments)
    ).toEqual([['sendSms', 'sendSmsFn']]);
  });
});
