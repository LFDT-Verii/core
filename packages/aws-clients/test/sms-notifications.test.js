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
// eslint-disable-next-line max-classes-per-file
const { mock, beforeEach, describe, it, after } = require('node:test');
const { expect } = require('expect');

const mockTwilioCreate = mock.fn();

class Twilio {
  constructor() {
    this.messages = {
      create: mockTwilioCreate,
    };
  }
}
mock.module('twilio', { defaultExport: Twilio });

const mockPublish = mock.fn((payload) => Promise.resolve(payload));
class SNSClient {}
SNSClient.prototype.send = mockPublish;
mock.module('@aws-sdk/client-sns', {
  namedExports: {
    PublishCommand: class PublishCommand {
      constructor(args) {
        return args;
      }
    },
    SNSClient,
  },
});

const { initSendSmsNotification } = require('../src/sms-notifications');

describe('SMS Notifications', () => {
  let sendSmsNotification;

  after(() => {
    mock.reset();
  });

  beforeEach(() => {
    mockPublish.mock.resetCalls();
    sendSmsNotification = initSendSmsNotification({
      twilioAccountSid: 'mocked-sid',
      twilioAuthToken: 'mocked-auth-token',
      twilioHostNumber: '+70200000',
    });
  });

  it('Should call SNS client without sender ID', async () => {
    await sendSmsNotification({ message: 'MESSAGE', phoneNumber: '123465' });

    expect(mockPublish.mock.calls.map((call) => call.arguments)).toContainEqual(
      [
        {
          Message: 'MESSAGE',
          PhoneNumber: '123465',
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
          },
        },
      ]
    );
  });

  it('Should call SNS client with sender ID', async () => {
    await sendSmsNotification({
      message: 'MESSAGE',
      phoneNumber: '123465',
      senderId: 'SENDER-ID',
    });

    expect(mockPublish.mock.calls.map((call) => call.arguments)).toContainEqual(
      [
        {
          Message: 'MESSAGE',
          PhoneNumber: '123465',
          MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: 'SENDER-ID',
            },
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
          },
        },
      ]
    );
  });

  it('Should call Twilio client', async () => {
    await sendSmsNotification({
      message: 'MESSAGE',
      phoneNumber: '+65123465',
    });

    expect(
      mockTwilioCreate.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      {
        to: '+65123465',
        from: '+70200000',
        body: 'MESSAGE',
      },
    ]);
  });

  it('Should call only Twilio client', async () => {
    const sendSmsNotificationCustom = initSendSmsNotification({
      twilioAccountSid: 'mocked-sid',
      twilioAuthToken: 'mocked-auth-token',
      twilioHostNumber: '+70200000',
      onlyTwilioSms: true,
    });

    await sendSmsNotificationCustom({
      message: 'MESSAGE',
      phoneNumber: '123465',
    });

    expect(mockPublish.mock.callCount()).toEqual(0);
    expect(
      mockTwilioCreate.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      {
        to: '123465',
        from: '+70200000',
        body: 'MESSAGE',
      },
    ]);
  });
});
