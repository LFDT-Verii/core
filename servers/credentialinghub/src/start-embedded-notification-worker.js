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

const DEFAULT_SHUTDOWN_GRACE_MS = 5000;

const startEmbeddedNotificationWorker = (
  server,
  { shutdownGraceMs = DEFAULT_SHUTDOWN_GRACE_MS } = {},
) => {
  if (
    server.config.notifications?.enabled !== true ||
    server.config.notifications.workerMode !==
      NotificationWorkerModes.EMBEDDED_CHILD
  ) {
    return undefined;
  }

  let child;

  server.addHook('onReady', async () => {
    child = fork(path.join(__dirname, 'start-notification-worker.js'), {
      env: {
        ...process.env,
        NOTIFICATIONS_WORKER_MODE: NotificationWorkerModes.STANDALONE,
      },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });

    const notificationWorkerPid = child.pid;

    child.on('error', (error) => {
      server.log.error(
        { err: error, notificationWorkerPid },
        'Notification delivery worker child error',
      );
      // eslint-disable-next-line better-mutation/no-mutation
      child = undefined;
    });

    server.log.info(
      { notificationWorkerPid },
      'Notification delivery worker child started',
    );

    child.on('exit', (code, signal) => {
      server.log.warn(
        { code, notificationWorkerPid, signal },
        'Notification delivery worker child exited',
      );
      // eslint-disable-next-line better-mutation/no-mutation
      child = undefined;
    });
  });

  server.addHook('onClose', async () => {
    if (child == null || child.killed) {
      return;
    }

    const childExit = waitForChildExit(child, shutdownGraceMs);

    if (child.connected) {
      child.send('shutdown');
    }

    if (await childExit) {
      return;
    }

    if (!child.killed) {
      child.kill('SIGTERM');
    }
  });

  return undefined;
};

const waitForChildExit = (child, timeoutMs) =>
  new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      child.off('exit', onExit);
      resolve(false);
    }, timeoutMs);

    child.once('exit', onExit);
  });

module.exports = {
  startEmbeddedNotificationWorker,
};
