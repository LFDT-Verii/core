/*
 * Copyright 2024 Velocity Team
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

const { map } = require('lodash/fp');

const collectionClient = async ({
  mongoClient,
  name,
  factory,
  defaultProjection = { _id: 1 },
  extensions,
}) => {
  const collectionConnection = await mongoClient
    .db('test-collections')
    .collection(name);
  const collection = {
    insertOne: (obj, ...args) =>
      collectionConnection
        .insertOne(factory(obj), ...args)
        .then((result) => result.insertedId),
    insertMany: (objs, ...args) =>
      collectionConnection
        .insertMany(map(factory, objs), ...args)
        .then((result) => Object.values(result.insertedIds)),
    insert: (...args) => collectionConnection.insertOne(...args),
    findByIds: (ids, projection = defaultProjection) =>
      collectionConnection.find({ _id: { $in: ids } }, projection).toArray(),
    findById: (id, projection = defaultProjection) =>
      collectionConnection.findOne({ _id: id }, { projection }),
    deleteMany: () => collectionConnection.deleteMany(),
    collection: () => collectionConnection,
  };
  if (extensions != null) {
    for (const [extensionName, extension] of Object.entries(
      extensions(collection)
    )) {
      collection[extensionName] = extension;
    }
  }

  return collection;
};

module.exports = { collectionClient };
