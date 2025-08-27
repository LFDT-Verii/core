/**
 * Copyright 2023 Velocity Team
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

const { beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const { refreshTokenExtension } = require('../src/refresh-token-extension');

describe('Refresh token extension test suite', () => {
  beforeEach(async () => {});

  it('prepFilter should no-op if refresh token is not present in the filter', async () => {
    const extension = refreshTokenExtension({
      prepFilter: mock.fn((x) => x),
      prepModification: mock.fn((x) => x),
    });
    expect(
      extension.prepFilter({
        foo: 'bar',
      })
    ).toEqual({
      foo: 'bar',
    });
  });
  it('prepFilter should hash the refresh token if present in the filter', async () => {
    const extension = refreshTokenExtension({
      prepFilter: mock.fn((x) => x),
      prepModification: mock.fn((x) => x),
    });
    const refreshTokenUnhashed = 'refreshTokenFoo';
    const preppedFilter = extension.prepFilter({
      foo: 'bar',
      refreshToken: refreshTokenUnhashed,
    });
    expect(preppedFilter).toEqual({
      foo: 'bar',
      refreshToken: expect.any(String),
    });
    expect(refreshTokenUnhashed).not.toEqual(preppedFilter.refreshToken);
  });
  it('prepModification should no-op if refresh token is not present in the filter', async () => {
    const extension = refreshTokenExtension({
      prepFilter: mock.fn((x) => x),
      prepModification: mock.fn((x) => x),
    });
    expect(
      extension.prepModification({
        foo: 'bar',
      })
    ).toEqual({
      foo: 'bar',
    });
  });
  it('prepModification should hash the refresh token if present in the filter', async () => {
    const extension = refreshTokenExtension({
      prepFilter: mock.fn((x) => x),
      prepModification: mock.fn((x) => x),
    });
    const refreshTokenUnhashed = 'refreshTokenFoo';
    const preppedModification = extension.prepModification({
      foo: 'bar',
      refreshToken: refreshTokenUnhashed,
    });
    expect(preppedModification).toEqual({
      foo: 'bar',
      refreshToken: expect.any(String),
    });
    expect(refreshTokenUnhashed).not.toEqual(preppedModification.refreshToken);
  });
});
