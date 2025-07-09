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

const mockTwilioCreate = jest.fn();
const mockTwilio = jest.fn(() => ({
  messages: {
    create: mockTwilioCreate,
  },
}));
jest.mock('twilio', () => {
  return mockTwilio;
});

const mockPublish = jest.fn((payload) => payload);

jest.mock('@aws-sdk/client-sns', () => ({
  PublishCommand: jest.fn((args) => args),
  SNSClient: jest.fn().mockImplementation(() => ({
    send: mockPublish,
  })),
}));

const { initSendSmsNotification } = require('../src/sms-notifications');

describe('SMS Notifications', () => {
  let sendSmsNotification;

  beforeEach(() => {
    mockPublish.mockReset();
    sendSmsNotification = initSendSmsNotification({
      twilioAccountSid: 'mocked-sid',
      twilioAuthToken: 'mocked-auth-token',
      twilioHostNumber: '+70200000',
    });
  });

  it('Should call SNS client without sender ID', async () => {
    await sendSmsNotification({ message: 'MESSAGE', phoneNumber: '123465' });

    expect(mockPublish).toHaveBeenCalledWith({
      Message: 'MESSAGE',
      PhoneNumber: '123465',
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    });
  });

  it('Should call SNS client with sender ID', async () => {
    await sendSmsNotification({
      message: 'MESSAGE',
      phoneNumber: '123465',
      senderId: 'SENDER-ID',
    });

    expect(mockPublish).toHaveBeenCalledWith({
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
    });
  });

  it('Should call Twilio client', async () => {
    await sendSmsNotification({
      message: 'MESSAGE',
      phoneNumber: '+65123465',
    });

    expect(mockTwilio).toHaveBeenCalledWith('mocked-sid', 'mocked-auth-token');
    expect(mockTwilioCreate).toHaveBeenCalledWith({
      to: '+65123465',
      from: '+70200000',
      body: 'MESSAGE',
    });
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

    expect(mockPublish).toHaveBeenCalledTimes(0);
    expect(mockTwilio).toHaveBeenCalledWith('mocked-sid', 'mocked-auth-token');
    expect(mockTwilioCreate).toHaveBeenCalledWith({
      to: '123465',
      from: '+70200000',
      body: 'MESSAGE',
    });
  });
});
