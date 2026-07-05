/**
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
 */

const { fork } = require('node:child_process');
const path = require('node:path');
const {
  NotificationWorkerModes,
} = require('./entities/notifications/domain/notification-config');

const startEmbeddedNotificationWorker = (server) => {
  if (
    server.config.notifications?.enabled !== true ||
    server.config.notifications.workerMode !==
      NotificationWorkerModes.EMBEDDED_CHILD
  ) {
    return undefined;
  }

  let child;

  server.addHook('onReady', async () => {
    child = fork(path.join(__dirname, 'notification-worker.js'), {
      env: {
        ...process.env,
        NOTIFICATIONS_WORKER_MODE: NotificationWorkerModes.STANDALONE,
      },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });

    server.log.info(
      { notificationWorkerPid: child.pid },
      'Notification delivery worker child started',
    );

    child.on('exit', (code, signal) => {
      server.log.warn(
        { code, notificationWorkerPid: child.pid, signal },
        'Notification delivery worker child exited',
      );
    });
  });

  server.addHook('onClose', async () => {
    if (child == null || child.killed) {
      return;
    }

    if (child.connected) {
      child.send('shutdown');
    }

    child.kill('SIGTERM');
  });

  return undefined;
};

module.exports = {
  startEmbeddedNotificationWorker,
};
