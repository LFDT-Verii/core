/*
 * Copyright 2025 Velocity Team
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

const { isEmpty, omitBy, isNil, map } = require('lodash/fp');
const { optional } = require('@verii/common-functions');
const { initAuth0Provisioner } = require('../../oauth');
const {
  parseProfileToCsv,
  ServiceTypeLabels,
  getSubjectNetPrefix,
} = require('../domains');
const {
  initOrganizationRegistrarEmails,
} = require('./init-organization-registrar-emails');

const initSendEmailNotifications = async (initCtx) => {
  const { config } = initCtx;
  const {
    emailToNewOrgForServicesActivated,
    emailToSupportForOrgRegisteredAndServicesNeedActivation,
    emailToSupportForServicesAddedAndNeedActivation,
    emailToRegisteredOrgForServicesActivated,
  } = initOrganizationRegistrarEmails(config);
  const { getUsersByIds } = await initAuth0Provisioner(config);

  const shouldSendEmailForServicesActivated = (
    activatedServiceIds,
    userEmails
  ) => {
    return activatedServiceIds.length > 0 && !isEmpty(userEmails);
  };

  const shouldSendEmailForServicesNeedActivation = (
    addedServices,
    activatedServiceIds
  ) => {
    return (
      addedServices.length > 0 &&
      activatedServiceIds.length !== addedServices.length
    );
  };

  const sendServiceNotification = async (
    {
      organization,
      userEmails,
      addedServices = [],
      activatedServiceIds = [],
      isCreateOrganization = false,
    },
    ctx
  ) => {
    const emailToServiceNeedActivation = isCreateOrganization
      ? emailToSupportForOrgRegisteredAndServicesNeedActivation
      : emailToSupportForServicesAddedAndNeedActivation;

    const emailForServicesActivated = isCreateOrganization
      ? emailToNewOrgForServicesActivated
      : emailToRegisteredOrgForServicesActivated;

    if (shouldSendEmailForServicesActivated(activatedServiceIds, userEmails)) {
      await initCtx.sendEmail(
        emailForServicesActivated({
          organization,
          activatedServiceIds,
          emails: userEmails,
        })
      );
    } else if (
      shouldSendEmailForServicesNeedActivation(
        addedServices,
        activatedServiceIds
      )
    ) {
      await initCtx.sendEmail(
        emailToServiceNeedActivation(
          {
            organization,
            addedServices,
          },
          ctx
        )
      );
    }
  };

  const sendServiceNotificationToGroup = async (
    {
      organization,
      addedServices,
      activatedServiceIds,
      isCreateOrganization = false,
    },
    ctx
  ) => {
    const { repos, user, log } = ctx;
    const group = await repos.groups.findGroupByUserIdAndDid(
      user.sub,
      organization.didDoc.id
    );
    if (!group) {
      const message = 'There was no group for organization';
      log.info(
        {
          did: organization.didDoc.id,
          user: user.sub,
        },
        message
      );
      return;
    }

    const { clientAdminIds } = group;
    const userEmails = map(
      'email',
      await getUsersByIds({ userIds: clientAdminIds })
    );

    await sendServiceNotification(
      omitBy(isNil, {
        organization,
        userEmails,
        addedServices,
        activatedServiceIds,
        isCreateOrganization,
      }),
      ctx
    );
  };

  const sendOrganizationCreatedNotification = async (
    { organization },
    context
  ) => {
    const csvFile = await parseProfileToCsv(organization.profile);
    await initCtx.sendEmail({
      subject: await context.renderTemplate(
        'support-organization-created-subject',
        {
          organization,
          netPrefix: getSubjectNetPrefix(context.config),
        }
      ),
      message: await context.renderTemplate(
        'support-organization-created-body',
        {
          organization,
        }
      ),
      sender: config.noReplyEmail,
      ccs: config.organizationCreationEmailCcList,
      recipients: [config.registrarSupportEmail],
      attachment: csvFile,
      attachmentName: 'organization.csv',
      contentType: 'text/csv',
    });
  };

  const sendEmailToSignatoryForOrganizationApproval = async (
    { organization, authCode, isReminder = false },
    context
  ) => {
    const invitation = await optional(
      () => context.repos.invitations.findById(organization.invitationId),
      [organization.invitationId]
    );
    const inviterOrganization = invitation?.inviterDid
      ? await context.repos.organizations.findOneByDid(invitation.inviterDid)
      : null;
    const html = await context.renderTemplate('signatory-approval-email-body', {
      organization,
      inviterOrganization,
      authCode,
      ServiceTypeLabels,
      config,
    });
    await initCtx.sendEmail({
      subject: `${isReminder ? 'Reminder: ' : ''}${
        inviterOrganization?.profile?.name ??
        `${organization.profile.adminGivenName} ${organization.profile.adminFamilyName}`
      } is requesting your approval to register ${
        organization.profile.name
      } on the Velocity Network`,
      message: html,
      sender: config.registrarSupportEmail,
      recipients: [organization.profile.signatoryEmail],
      bccs: [config.signatoryVnfEmail],
      replyTo: config.registrarSupportEmail,
      html: true,
    });
  };

  return {
    sendServiceNotification,
    sendServiceNotificationToGroup,
    sendOrganizationCreatedNotification,
    sendEmailToSignatoryForOrganizationApproval,
  };
};

module.exports = {
  initSendEmailNotifications,
};
