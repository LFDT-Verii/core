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
const { map } = require('lodash/fp');
const {
  initSendEmailNotifications,
  initAuth0Provisioner,
} = require('../entities');

const notifySupportAndGroups = async (fastify) => {
  const {
    sendOrganizationCreatedNotification,
    sendServiceNotificationToGroup,
    sendServiceNotification,
  } = initSendEmailNotifications(fastify);
  const { getUsersByIds } = initAuth0Provisioner(fastify.config);

  fastify
    .pubsub('notifySupportAndGroups')
    .subscribe(
      'organizations',
      'created',
      async (
        { payload: { organization, addedServices, activatedServiceIds } },
        context
      ) => {
        return Promise.all([
          sendOrganizationCreatedNotification({ organization }, context),
          sendServiceNotificationToGroup(
            {
              organization,
              addedServices,
              activatedServiceIds,
              isCreateOrganization: true,
            },
            context
          ),
        ]);
      }
    )
    .subscribe(
      'services',
      'added',
      async (
        { payload: { organization, addedServices, activatedServiceIds } },
        context
      ) => {
        await sendServiceNotificationToGroup(
          {
            organization,
            addedServices,
            activatedServiceIds,
            isCreateOrganization: false,
          },
          context
        );
      }
    )
    .subscribe(
      'services',
      'activated',
      async ({ payload: { organization, activatedServiceIds } }, context) => {
        const { clientAdminIds } = await context.repos.groups.findGroupByDid(
          organization.didDoc.id
        );
        const userEmails = map(
          'email',
          await getUsersByIds({ userIds: clientAdminIds })
        );
        await sendServiceNotification(
          {
            organization,
            userEmails,
            activatedServiceIds,
          },
          context
        );
      }
    );
};

module.exports = notifySupportAndGroups;
