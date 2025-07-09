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

const { isEmpty, join } = require('lodash/fp');
const {
  SESClient,
  SendEmailCommand: SESSendEmailCommand,
} = require('@aws-sdk/client-ses');
const {
  SESv2Client,
  SendEmailCommand: SESv2SendEmailCommand,
} = require('@aws-sdk/client-sesv2');
const { buildClientConfig } = require('./client-config');

// 2020-10-20: At the moment free Localstack doesn't support SESv2,
// so SES is used for testing when a value is passed for endpoint (local address)

const createSesClient = ({ awsRegion, awsEndpoint }) =>
  new SESClient(
    buildClientConfig({
      apiVersion: '2010-12-01',
      awsRegion,
      awsEndpoint,
    })
  );

const createSesV2Client = ({ awsRegion }) =>
  new SESv2Client(
    buildClientConfig({
      apiVersion: '2019-09-27',
      awsRegion,
    })
  );

const initSendEmailNotification =
  ({ awsRegion, awsEndpoint }) =>
  // eslint-disable-next-line complexity
  async ({
    subject,
    message,
    sender,
    recipients,
    ccs,
    bccs,
    replyTo,
    attachment,
    attachmentName,
    contentType,
    html = false,
  }) => {
    const destination = {};

    if (!isEmpty(recipients)) {
      destination.ToAddresses = recipients;
    }

    if (!isEmpty(ccs)) {
      destination.CcAddresses = ccs;
    }

    if (!isEmpty(bccs)) {
      destination.BccAddresses = bccs;
    }

    if (awsEndpoint) {
      const awsSes = createSesClient({
        awsRegion,
        awsEndpoint,
      });

      await awsSes.send(
        new SESSendEmailCommand({
          Source: sender,
          Destination: destination,
          ReplyToAddresses: [replyTo],
          Message: {
            Subject: {
              Data: subject,
            },
            Body: {
              ...(isEmpty(attachment)
                ? {
                    Text: {
                      Data: message,
                    },
                  }
                : {
                    Raw: {
                      Data: buildRawMessage({
                        subject,
                        message,
                        sender,
                        recipients,
                        ccs,
                        attachment,
                        contentType,
                        attachmentName,
                      }),
                    },
                  }),
            },
          },
        })
      );
    } else {
      const awsSesV2 = createSesV2Client({
        awsRegion,
      });

      await awsSesV2.send(
        new SESv2SendEmailCommand({
          FromEmailAddress: sender,
          Destination: destination,
          ReplyToAddresses: [replyTo],
          Content: {
            ...(isEmpty(attachment)
              ? {
                  Simple: {
                    Body: {
                      [html ? 'Html' : 'Text']: {
                        Data: message,
                      },
                    },
                    Subject: {
                      Data: subject,
                    },
                  },
                }
              : {
                  Raw: {
                    Data: buildRawMessage({
                      subject,
                      message,
                      sender,
                      recipients,
                      ccs,
                      attachment,
                      contentType,
                      attachmentName,
                    }),
                  },
                }),
          },
        })
      );
    }
  };

const buildRawMessage = ({
  subject,
  message,
  sender,
  recipients,
  ccs,
  attachment,
  contentType,
  attachmentName,
}) => {
  const boundary = `----=_Part${Math.random().toString().substring(2)}`;
  const rawMessage = [
    `From: ${sender}`,
    `To: ${join(', ', recipients)}`,
    `Cc: ${join(', ', ccs)}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '\n',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '\n',
    message,
    '\n',
    `--${boundary}`,
    `Content-Type: ${contentType}; name="${attachmentName}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    '\n',
    Buffer.from(attachment).toString('base64'),
    '\n',
    `--${boundary}--`,
  ];

  return rawMessage.join('\n');
};

module.exports = {
  createSesClient,
  createSesV2Client,
  initSendEmailNotification,
  buildRawMessage,
};
