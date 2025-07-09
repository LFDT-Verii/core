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

const { replaceItem } = require('../src/lodash-ext');

describe('replace item', () => {
  it('should handle different arrays', () => {
    expect(replaceItem({ x: 1 }, { y: 1 }, [])).toEqual([]);
    expect(replaceItem({ x: 1 }, { y: 1 }, null)).toEqual([]);
    expect(replaceItem({ x: 1 }, { y: 1 }, [{ x: 2 }])).toEqual([{ x: 2 }]);
    expect(replaceItem({ x: 1 }, { y: 1 }, [{ x: 1 }])).toEqual([{ y: 1 }]);
    expect(replaceItem({ x: 1 }, { y: 1 }, [{ x: 1 }, { x: 2 }])).toEqual([
      { y: 1 },
      { x: 2 },
    ]);
    expect(
      replaceItem({ x: 2 }, { y: 1 }, [{ x: 1 }, { x: 2 }, { x: 3 }])
    ).toEqual([{ x: 1 }, { y: 1 }, { x: 3 }]);
  });
});
