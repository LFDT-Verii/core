/**
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
 */

const { startAppServer } = require('./start-app-server');
const { startNotificationWorker } = require('./start-notification-worker');
const {
  NotificationWorkerModes,
} = require('./entities/notifications/domain/notification-config');
const config = require('./config');

/* istanbul ignore next */
process.on('unhandledRejection', (error) => {
  console.error(error);
  process.exit(1);
});

if (
  config.notifications.enabled &&
  config.notifications.workerMode === NotificationWorkerModes.STANDALONE
) {
  startNotificationWorker().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  startAppServer();
}
