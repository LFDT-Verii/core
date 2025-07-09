const { isEmpty, size } = require('lodash/fp');
const { nanoid } = require('nanoid');
const { subMinutes } = require('date-fns/fp');
const { SignatoryEventStatus } = require('../domain');

const task = 'send-reminders';
const sendReminders = async (
  sendEmailToSignatoryForOrganizationApproval,
  req
) => {
  const currentTime = new Date();
  const { repos, config, log } = req;
  const { signatoryLinkResend } = config;
  const signatoryStatuses = await repos.signatoryStatus.findByEvent(
    subMinutes(signatoryLinkResend, currentTime)
  );
  if (isEmpty(signatoryStatuses)) {
    log.info({ task, message: 'No signatory reminders to send' });
    return;
  }

  for await (const signatoryStatusDoc of signatoryStatuses) {
    await sendReminder(
      signatoryStatusDoc,
      sendEmailToSignatoryForOrganizationApproval,
      req
    );
  }
};

const sendReminder = async (
  signatoryStatusDoc,
  sendEmailToSignatoryForOrganizationApproval,
  context
) => {
  const { repos, config, log } = context;
  try {
    const filter = { _id: signatoryStatusDoc.organizationId };
    const organization = await repos.organizations.findOne({ filter });

    if (isEmpty(organization)) {
      log.error({ message: 'Organization not found', filter });
      await repos.signatoryStatus.addState(
        signatoryStatusDoc._id,
        SignatoryEventStatus.REMINDER_ERROR,
        {
          error: 'Organization not found',
        }
      );
      return;
    }

    if (size(signatoryStatusDoc.events) >= config.signatoryMaxReminderCount) {
      await repos.signatoryStatus.addState(
        signatoryStatusDoc._id,
        SignatoryEventStatus.MAX_REACHED
      );
      await context.sendSupportEmail(
        await context.renderTemplate(
          'support-signatory-max-reminders-reached-email-subject',
          { organization }
        ),
        await context.renderTemplate(
          'support-signatory-max-reminders-reached-email-body',
          {
            organization,
          }
        )
      );
      return;
    }

    const authCode = nanoid();
    await sendEmailToSignatoryForOrganizationApproval(
      {
        organization,
        authCode,
        isReminder: true,
      },
      context
    );
    await repos.signatoryStatus.addStateAndCode(
      signatoryStatusDoc._id,
      SignatoryEventStatus.LINK_SENT,
      authCode
    );
  } catch (error) {
    log.error({ err: error });
    await repos.signatoryStatus.addState(
      signatoryStatusDoc._id,
      SignatoryEventStatus.REMINDER_ERROR,
      {
        error: error.message,
      }
    );
  }
};

module.exports = {
  sendReminders,
  sendReminder,
};
