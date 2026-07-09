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

const { EventEmitter } = require('node:events');
const { afterEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const createTestFastify = require('../helpers/create-test-fastify');

let nextChild;
const fork = mock.fn(() => nextChild ?? buildChild({ pid: 101 }));

mock.module('node:child_process', {
  namedExports: {
    fork,
  },
});

const {
  NotificationWorkerModes,
  buildNotificationConfig,
} = require('../../src/entities/notifications');
const {
  startEmbeddedNotificationWorker,
} = require('../../src/start-embedded-notification-worker');

describe('embedded notification worker', () => {
  let fastify;

  afterEach(async () => {
    if (fastify != null) {
      await fastify.close();

      fastify = undefined;
    }
    nextChild = undefined;
  });

  it('should fork the standalone notification worker entrypoint on ready', async () => {
    nextChild = buildChild({ exitOnShutdown: true, pid: 101 });
    fastify = createTestFastify({
      notifications: buildEnabledNotificationConfig(
        NotificationWorkerModes.EMBEDDED_CHILD,
      ),
    });
    startEmbeddedNotificationWorker(fastify);
    const callCountBeforeReady = fork.mock.callCount();

    await fastify.ready();

    expect(fork.mock.callCount()).toEqual(callCountBeforeReady + 1);
    expect(fork.mock.calls.at(-1).arguments[0]).toMatch(
      /start-notification-worker\.js$/,
    );
    expect(fork.mock.calls.at(-1).arguments[1]).toEqual([]);
    expect(fork.mock.calls.at(-1).arguments[2].env).toEqual(
      expect.objectContaining({
        NOTIFICATIONS_WORKER_MODE: NotificationWorkerModes.STANDALONE,
      }),
    );
  });

  it('should not fork when notifications are disabled', async () => {
    fastify = createTestFastify({
      notifications: buildNotificationConfig({ enabled: false }),
    });
    startEmbeddedNotificationWorker(fastify);
    const callCountBeforeReady = fork.mock.callCount();

    await fastify.ready();

    expect(fork.mock.callCount()).toEqual(callCountBeforeReady);
  });

  it('should close cleanly when the server stops before the child starts', async () => {
    fastify = createTestFastify({
      notifications: buildEnabledNotificationConfig(
        NotificationWorkerModes.EMBEDDED_CHILD,
      ),
    });
    startEmbeddedNotificationWorker(fastify);
    const callCountBeforeClose = fork.mock.callCount();

    await fastify.close();

    expect(fork.mock.callCount()).toEqual(callCountBeforeClose);

    fastify = undefined;
  });

  it('should close cleanly when the child exited before the server stops', async () => {
    nextChild = buildChild({ pid: 101 });
    fastify = createTestFastify({
      notifications: buildEnabledNotificationConfig(
        NotificationWorkerModes.EMBEDDED_CHILD,
      ),
    });
    startEmbeddedNotificationWorker(fastify);
    await fastify.ready();

    const child = fork.mock.calls.at(-1).result;
    child.emit('exit', 0, null);
    await fastify.close();

    expect(child.sentMessages).toEqual([]);
    expect(child.killSignals).toEqual([]);

    fastify = undefined;
  });

  it('should close cleanly when the child fails before spawning', async () => {
    nextChild = buildChild();
    fastify = createTestFastify({
      notifications: buildEnabledNotificationConfig(
        NotificationWorkerModes.EMBEDDED_CHILD,
      ),
    });
    startEmbeddedNotificationWorker(fastify);
    await fastify.ready();

    const child = fork.mock.calls.at(-1).result;
    expect(() => child.emit('error', new Error('spawn failed'))).not.toThrow();
    await fastify.close();

    expect(child.sentMessages).toEqual([]);
    expect(child.killSignals).toEqual([]);

    fastify = undefined;
  });

  it('should still shut down a live child that emitted an error before server close', async () => {
    nextChild = buildChild({ pid: 101 });
    fastify = createTestFastify({
      notifications: buildEnabledNotificationConfig(
        NotificationWorkerModes.EMBEDDED_CHILD,
      ),
    });
    startEmbeddedNotificationWorker(fastify, { shutdownGraceMs: 1 });
    await fastify.ready();

    const child = fork.mock.calls.at(-1).result;
    child.emit('error', new Error('ipc send failed'));
    await fastify.close();

    expect(child.sentMessages).toEqual(['shutdown']);
    expect(child.killSignals).toEqual(['SIGTERM']);

    fastify = undefined;
  });

  it('should allow the child process to gracefully exit when Fastify closes', async () => {
    nextChild = buildChild({ exitOnShutdown: true, pid: 101 });
    fastify = createTestFastify({
      notifications: buildEnabledNotificationConfig(
        NotificationWorkerModes.EMBEDDED_CHILD,
      ),
    });
    startEmbeddedNotificationWorker(fastify);
    await fastify.ready();

    const child = fork.mock.calls.at(-1).result;
    await fastify.close();

    expect(child.sentMessages).toEqual(['shutdown']);
    expect(child.killSignals).toEqual([]);

    fastify = undefined;
  });

  it('should terminate the child when it emits an error during graceful shutdown', async () => {
    nextChild = buildChild({ errorOnShutdown: true, pid: 101 });
    fastify = createTestFastify({
      notifications: buildEnabledNotificationConfig(
        NotificationWorkerModes.EMBEDDED_CHILD,
      ),
    });
    startEmbeddedNotificationWorker(fastify, { shutdownGraceMs: 1 });
    await fastify.ready();

    const child = fork.mock.calls.at(-1).result;
    await fastify.close();

    expect(child.sentMessages).toEqual(['shutdown']);
    expect(child.killSignals).toEqual(['SIGTERM']);

    fastify = undefined;
  });

  it('should terminate the child when graceful shutdown send throws', async () => {
    nextChild = buildChild({ pid: 101, throwOnShutdown: true });
    fastify = createTestFastify({
      notifications: buildEnabledNotificationConfig(
        NotificationWorkerModes.EMBEDDED_CHILD,
      ),
    });
    startEmbeddedNotificationWorker(fastify, { shutdownGraceMs: 1 });
    await fastify.ready();

    const child = fork.mock.calls.at(-1).result;
    await expect(fastify.close()).resolves.toEqual(undefined);

    expect(child.sentMessages).toEqual(['shutdown']);
    expect(child.killSignals).toEqual(['SIGTERM']);

    fastify = undefined;
  });

  it('should terminate the child process when it does not exit after shutdown', async () => {
    fastify = createTestFastify({
      notifications: buildEnabledNotificationConfig(
        NotificationWorkerModes.EMBEDDED_CHILD,
      ),
    });
    startEmbeddedNotificationWorker(fastify, { shutdownGraceMs: 1 });
    await fastify.ready();

    const child = fork.mock.calls.at(-1).result;
    await fastify.close();

    expect(child.sentMessages).toEqual(['shutdown']);
    expect(child.killSignals).toEqual(['SIGTERM']);

    fastify = undefined;
  });
});

const buildEnabledNotificationConfig = (workerMode) =>
  buildNotificationConfig({
    allowInsecureWebhookUrl: true,
    enabled: true,
    webhookSecret: 'delivery-secret',
    webhookUrl: 'http://127.0.0.1:65535/notifications',
    workerMode,
  });

const buildChild = ({
  errorOnShutdown = false,
  exitOnShutdown = false,
  pid,
  throwOnShutdown = false,
} = {}) => {
  const child = new EventEmitter();
  child.connected = true;
  child.kill = (signal = 'SIGTERM') => {
    child.killSignals.push(signal);
    child.killed = true;
    child.emit('exit', null, signal);
  };
  child.killed = false;
  child.killSignals = [];
  child.pid = pid;
  child.sentMessages = [];
  child.send = (message) => {
    child.sentMessages.push(message);
    handleChildMessage(child, message, {
      errorOnShutdown,
      exitOnShutdown,
      throwOnShutdown,
    });
  };
  return child;
};

const handleChildMessage = (
  child,
  message,
  { errorOnShutdown, exitOnShutdown, throwOnShutdown },
) => {
  if (message !== 'shutdown') {
    return;
  }
  if (throwOnShutdown) {
    throw new Error('ipc channel closed');
  }
  if (errorOnShutdown) {
    child.emit('error', new Error('ipc send failed'));
  }
  if (exitOnShutdown) {
    child.connected = false;
    child.emit('exit', 0, null);
  }
};
