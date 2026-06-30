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

const enqueueNotificationEvents = async (eventsBuilder, context) => {
  const { config, log } = context;

  if (config.notifications?.enabled !== true) {
    return [];
  }

  let events = [];
  try {
    events = castArray(eventsBuilder()).filter(({ type }) =>
      shouldEmitNotificationEvent(type, config.notifications),
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
        eventTypes: map('type', events),
        queueType: config.notifications.queue?.type,
      },
      'Unable to enqueue notification events',
    );
    return [];
  }
};

module.exports = { enqueueNotificationEvents };
