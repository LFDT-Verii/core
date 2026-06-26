/*
 * Copyright 2026 Velocity Team
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

const { castArray, map } = require('lodash/fp');
const { shouldEmitNotificationEvent } = require('../domain');

const enqueueNotificationEvents = async (eventsOrBuilder, context) => {
  const { config, log } = context;

  if (!areNotificationsEnabled(config)) {
    return [];
  }

  try {
    const events = resolveNotificationEvents(
      eventsOrBuilder,
      config.notifications,
    );

    if (events.length === 0) {
      return [];
    }

    return await context.server.notificationEnqueueAdapter.enqueue(
      events,
      context,
    );
  } catch (error) {
    log.error(
      {
        err: error,
        eventTypes: getEventTypes(eventsOrBuilder),
        queueType: getNotificationQueueType(config),
      },
      'Unable to enqueue notification events',
    );
    return [];
  }
};

const areNotificationsEnabled = ({ notifications }) =>
  notifications?.enabled === true;

const getNotificationQueueType = ({ notifications }) =>
  notifications.queue?.type;

const resolveNotificationEvents = (eventsOrBuilder, notificationsConfig) =>
  castArray(resolveNotificationEventsOrBuilder(eventsOrBuilder)).filter(
    ({ type }) => shouldEmitNotificationEvent(type, notificationsConfig),
  );

const resolveNotificationEventsOrBuilder = (eventsOrBuilder) => {
  if (typeof eventsOrBuilder === 'function') {
    return eventsOrBuilder();
  }

  return eventsOrBuilder;
};

const getEventTypes = (eventsOrBuilder) => {
  if (typeof eventsOrBuilder === 'function') {
    return undefined;
  }

  return map('type', castArray(eventsOrBuilder));
};

module.exports = { enqueueNotificationEvents };
