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

const {
  initSendEmailNotification,
  buildRawMessage,
} = require('../src/email-notifications');

const mockSESSendEmail = jest.fn((payload) => payload);

jest.mock('@aws-sdk/client-ses', () => ({
  SendEmailCommand: jest.fn((args) => args),
  SESClient: jest.fn().mockImplementation(() => ({
    send: mockSESSendEmail,
  })),
}));

const mockSESv2SendEmail = jest.fn((payload) => payload);

jest.mock('@aws-sdk/client-sesv2', () => ({
  SendEmailCommand: jest.fn((args) => args),
  SESv2Client: jest.fn().mockImplementation(() => ({
    send: mockSESv2SendEmail,
  })),
}));

describe('Email notifications test suite', () => {
  let params;
  beforeEach(() => {
    // jest.resetAllMocks();
    params = {
      subject: 'fooSubject',
      message: 'fooMessage',
      sender: 'fooSender',
      recipients: ['fooRecipient'],
      replyTo: 'fooReplyTo',
    };
  });

  it('Should email with legacy client when awsEndpoint param exists', async () => {
    const sendEmail = initSendEmailNotification({ awsEndpoint: 'foo' });

    await sendEmail(params);

    expect(mockSESSendEmail).toHaveBeenCalledWith({
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
    });
  });

  it('Should email with attachment with legacy client', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(100);
    const sendEmail = initSendEmailNotification({ awsEndpoint: 'foo' });

    await sendEmail({
      ...params,
      attachment: 'name,value',
      contentType: 'text/csv',
      attachmentName: 'fooAttachmentName.csv',
    });

    expect(mockSESSendEmail).toHaveBeenCalledWith({
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
    });
  });

  it('Should email with non-legacy client when awsEndpoint param is missing', async () => {
    const sendEmail = initSendEmailNotification({});

    await sendEmail(params);

    expect(mockSESv2SendEmail).toHaveBeenCalledWith({
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
    });
  });

  it('Should email with attachment and non-legacy client', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(100);
    const sendEmail = initSendEmailNotification({});

    await sendEmail({
      ...params,
      attachment: 'name,value',
      contentType: 'text/csv',
      attachmentName: 'fooAttachmentName.csv',
    });

    expect(mockSESv2SendEmail).toHaveBeenCalledWith({
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
    });
  });

  it('Should email using HTML body when html flag is true', async () => {
    const sendEmail = initSendEmailNotification({});

    await sendEmail({ ...params, html: true });

    expect(mockSESv2SendEmail).toHaveBeenCalledWith({
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
    });
  });

  it('Should email with legacy client including cc/bbc addresses', async () => {
    const sendEmail = initSendEmailNotification({ awsEndpoint: 'foo' });

    await sendEmail({
      ...params,
      ccs: ['fooCc'],
      bccs: ['fooBcc'],
      recipients: [],
    });

    expect(mockSESSendEmail).toHaveBeenCalledWith({
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
    });
  });

  it('Should email with non-legacy client including cc/bcc addresses', async () => {
    const sendEmail = initSendEmailNotification({});

    await sendEmail({
      ...params,
      ccs: ['fooCc'],
      bccs: ['fooBcc'],
      recipients: [],
    });

    expect(mockSESv2SendEmail).toHaveBeenCalledWith({
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
    });
  });
});
