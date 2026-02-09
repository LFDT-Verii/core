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

const { describe, it } = require('node:test');
const { expect } = require('expect');

const { enqueue } = require('../src/sequential-promise-queue');

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('sequential-promise-queue', () => {
  it('runs tasks sequentially', async () => {
    const events = [];
    const firstGate = createDeferred();

    const first = enqueue(Promise.resolve(), async () => {
      events.push('first:start');
      await firstGate.promise;
      events.push('first:end');
      return 'first-result';
    });

    const second = enqueue(first.nextQueue, async () => {
      events.push('second:start');
      events.push('second:end');
      return 'second-result';
    });

    await Promise.resolve();
    expect(events).toEqual(['first:start']);

    firstGate.resolve();
    const [firstResult, secondResult] = await Promise.all([
      first.taskPromise,
      second.taskPromise,
    ]);

    expect(firstResult).toEqual('first-result');
    expect(secondResult).toEqual('second-result');
    expect(events).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
    ]);
  });

  it('continues queue after a failed task and preserves task error', async () => {
    const firstError = new Error('first failed');
    const first = enqueue(Promise.resolve(), async () => {
      throw firstError;
    });

    await expect(first.taskPromise).rejects.toThrow('first failed');
    await expect(first.nextQueue).resolves.toBeUndefined();

    const second = enqueue(first.nextQueue, async () => 'second-result');
    await expect(second.taskPromise).resolves.toEqual('second-result');
    await expect(second.nextQueue).resolves.toBeUndefined();
  });

  it('runs a task even when prior queue is rejected', async () => {
    const priorError = new Error('prior queue failed');
    const priorQueue = Promise.reject(priorError);

    const queued = enqueue(priorQueue, async () => 'runs-after-rejection');

    await expect(queued.taskPromise).resolves.toEqual('runs-after-rejection');
    await expect(queued.nextQueue).resolves.toBeUndefined();
  });
});
