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
const { beforeEach, describe, it, mock, after } = require('node:test');
const { expect } = require('expect');

class SESClient {}
const mockSESSendEmail = mock.fn((payload) => payload);
mock.module('@aws-sdk/client-ses', {
  namedExports: {
    SendEmailCommand: class SendEmailCommand {
      constructor(args) {
        return args;
      }
    },
    SESClient,
  },
});
SESClient.prototype.send = mockSESSendEmail;

const mockSESv2SendEmail = mock.fn((payload) => payload);
class SESv2Client {}
mock.module('@aws-sdk/client-sesv2', {
  namedExports: {
    SendEmailCommand: class SendEmailCommand {
      constructor(args) {
        return args;
      }
    },
    SESv2Client,
  },
});
SESv2Client.prototype.send = mockSESv2SendEmail;
const {
  initSendEmailNotification,
  buildRawMessage,
} = require('../src/email-notifications');

describe('Email notifications test suite', () => {
  let params;
  beforeEach(() => {
    params = {
      subject: 'fooSubject',
      message: 'fooMessage',
      sender: 'fooSender',
      recipients: ['fooRecipient'],
      replyTo: 'fooReplyTo',
    };
  });

  after(() => {
    mock.reset();
  });

  it('Should email with legacy client when awsEndpoint param exists', async () => {
    const sendEmail = initSendEmailNotification({ awsEndpoint: 'foo' });

    await sendEmail(params);

    expect(
      mockSESSendEmail.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      {
        Source: 'fooSender',
        Destination: {
          ToAddresses: ['fooRecipient'],
        },
        ReplyToAddresses: ['fooReplyTo'],
        Message: {
          Subject: {
            Data: 'fooSubject',
          },
          Body: {
            Text: {
              Data: 'fooMessage',
            },
          },
        },
      },
    ]);
  });

  it('Should email with attachment with legacy client', async () => {
    Math.random = () => 100;
    const sendEmail = initSendEmailNotification({ awsEndpoint: 'foo' });

    await sendEmail({
      ...params,
      attachment: 'name,value',
      contentType: 'text/csv',
      attachmentName: 'fooAttachmentName.csv',
    });

    expect(
      mockSESSendEmail.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      expect.objectContaining({
        Source: 'fooSender',
        Destination: {
          ToAddresses: ['fooRecipient'],
        },
        ReplyToAddresses: ['fooReplyTo'],
        Message: {
          Subject: {
            Data: 'fooSubject',
          },
          Body: {
            Raw: {
              Data: buildRawMessage({
                subject: 'fooSubject',
                message: 'fooMessage',
                sender: 'fooSender',
                recipients: ['fooRecipient'],
                ccs: [],
                attachment: 'name,value',
                contentType: 'text/csv',
                attachmentName: 'fooAttachmentName.csv',
              }),
            },
          },
        },
      }),
    ]);
  });

  it('Should email with non-legacy client when awsEndpoint param is missing', async () => {
    const sendEmail = initSendEmailNotification({});

    await sendEmail(params);

    expect(
      mockSESv2SendEmail.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      {
        FromEmailAddress: 'fooSender',
        Destination: {
          ToAddresses: ['fooRecipient'],
        },
        ReplyToAddresses: ['fooReplyTo'],
        Content: {
          Simple: {
            Body: {
              Text: {
                Data: 'fooMessage',
              },
            },
            Subject: {
              Data: 'fooSubject',
            },
          },
        },
      },
    ]);
  });

  it('Should email with attachment and non-legacy client', async () => {
    Math.random = () => 100;
    const sendEmail = initSendEmailNotification({});

    await sendEmail({
      ...params,
      attachment: 'name,value',
      contentType: 'text/csv',
      attachmentName: 'fooAttachmentName.csv',
    });

    expect(
      mockSESv2SendEmail.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      {
        FromEmailAddress: 'fooSender',
        Destination: {
          ToAddresses: ['fooRecipient'],
        },
        ReplyToAddresses: ['fooReplyTo'],
        Content: {
          Raw: {
            Data: buildRawMessage({
              subject: 'fooSubject',
              message: 'fooMessage',
              sender: 'fooSender',
              recipients: ['fooRecipient'],
              ccs: [],
              attachment: 'name,value',
              contentType: 'text/csv',
              attachmentName: 'fooAttachmentName.csv',
            }),
          },
        },
      },
    ]);
  });

  it('Should email using HTML body when html flag is true', async () => {
    const sendEmail = initSendEmailNotification({});

    await sendEmail({ ...params, html: true });

    expect(
      mockSESv2SendEmail.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      {
        FromEmailAddress: 'fooSender',
        Destination: {
          ToAddresses: ['fooRecipient'],
        },
        ReplyToAddresses: ['fooReplyTo'],
        Content: {
          Simple: {
            Body: {
              Html: {
                Data: 'fooMessage',
              },
            },
            Subject: {
              Data: 'fooSubject',
            },
          },
        },
      },
    ]);
  });

  it('Should email with legacy client including cc/bbc addresses', async () => {
    const sendEmail = initSendEmailNotification({ awsEndpoint: 'foo' });

    await sendEmail({
      ...params,
      ccs: ['fooCc'],
      bccs: ['fooBcc'],
      recipients: [],
    });

    expect(
      mockSESSendEmail.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      {
        Source: 'fooSender',
        Destination: {
          CcAddresses: ['fooCc'],
          BccAddresses: ['fooBcc'],
        },
        ReplyToAddresses: ['fooReplyTo'],
        Message: {
          Subject: {
            Data: 'fooSubject',
          },
          Body: {
            Text: {
              Data: 'fooMessage',
            },
          },
        },
      },
    ]);
  });

  it('Should email with non-legacy client including cc/bcc addresses', async () => {
    const sendEmail = initSendEmailNotification({});

    await sendEmail({
      ...params,
      ccs: ['fooCc'],
      bccs: ['fooBcc'],
      recipients: [],
    });

    expect(
      mockSESv2SendEmail.mock.calls.map((call) => call.arguments)
    ).toContainEqual([
      {
        FromEmailAddress: 'fooSender',
        Destination: {
          CcAddresses: ['fooCc'],
          BccAddresses: ['fooBcc'],
        },
        ReplyToAddresses: ['fooReplyTo'],
        Content: {
          Simple: {
            Body: {
              Text: {
                Data: 'fooMessage',
              },
            },
            Subject: {
              Data: 'fooSubject',
            },
          },
        },
      },
    ]);
  });
});
