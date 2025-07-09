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
const { startsWith } = require('lodash/fp');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { createTwilioClient } = require('./twilio-factory');
const { buildClientConfig } = require('./client-config');

const singaporePhoneCode = '+65';

const senderIdAttribute = (senderId) =>
  senderId
    ? {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: senderId,
        },
      }
    : {};

const initSendSmsNotification =
  ({
    awsRegion,
    awsEndpoint,
    twilioAccountSid,
    twilioAuthToken,
    twilioHostNumber,
    onlyTwilioSms,
  }) =>
  async ({ message, phoneNumber, senderId }) => {
    const awsSns = new SNSClient(
      buildClientConfig({
        apiVersion: '2010-03-31',
        awsRegion,
        awsEndpoint,
      })
    );
    const { sendTwilioSms } = createTwilioClient({
      twilioAccountSid,
      twilioAuthToken,
      twilioHostNumber,
    });

    if (onlyTwilioSms || startsWith(singaporePhoneCode, phoneNumber)) {
      await sendTwilioSms(phoneNumber, message);
      return;
    }

    await awsSns.send(
      new PublishCommand({
        Message: message,
        PhoneNumber: phoneNumber,
        MessageAttributes: {
          ...senderIdAttribute(senderId),
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional',
          },
        },
      })
    );
  };

module.exports = {
  initSendSmsNotification,
};
