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
  const clearChild = (childProcess) => {
    if (child === childProcess) {
      // eslint-disable-next-line better-mutation/no-mutation
      child = undefined;
    }
  };

  server.addHook('onReady', async () => {
    const childProcess = fork(
      path.join(__dirname, 'start-notification-worker.js'),
      [],
      {
        env: {
          ...process.env,
          NOTIFICATIONS_WORKER_MODE: NotificationWorkerModes.STANDALONE,
        },
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      },
    );

    child = childProcess;

    const notificationWorkerPid = childProcess.pid;

    childProcess.on('error', (error) => {
      server.log.error(
        { err: error, notificationWorkerPid },
        'Notification delivery worker child error',
      );
      if (childProcess.pid == null) {
        clearChild(childProcess);
      }
    });

    server.log.info(
      { notificationWorkerPid },
      'Notification delivery worker child started',
    );

    childProcess.on('exit', (code, signal) => {
      server.log.warn(
        { code, notificationWorkerPid, signal },
        'Notification delivery worker child exited',
      );
      clearChild(childProcess);
    });
  });

  server.addHook('onClose', async () => {
    const childProcess = child;
    if (childProcess == null || !isChildRunning(childProcess)) {
      return;
    }

    const childExit = waitForChildExit(childProcess, shutdownGraceMs);

    sendShutdownMessage(childProcess, server.log);

    if (await childExit) {
      return;
    }

    if (isChildRunning(childProcess)) {
      childProcess.kill('SIGTERM');
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

const isChildRunning = (childProcess) =>
  !childProcess.killed &&
  childProcess.exitCode == null &&
  childProcess.signalCode == null;

const sendShutdownMessage = (childProcess, log) => {
  if (!childProcess.connected) {
    return;
  }

  try {
    childProcess.send('shutdown');
  } catch (error) {
    log.warn(
      { err: error, notificationWorkerPid: childProcess.pid },
      'Notification delivery worker child shutdown signal failed',
    );
  }
};

module.exports = {
  startEmbeddedNotificationWorker,
};
