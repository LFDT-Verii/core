/*
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
 *
 */
const { buildExchangeProgress } = require('../../exchanges');
const { sharePresentation } = require('./share-presentation');
const { generateAccessToken } = require('../../tokens');

const handlePresentationSubmission = async (presentation, context) => {
  const { exchange, user, disclosure } = await sharePresentation(
    presentation,
    context
  );

  if (context.user) {
    await context.repos.feeds.updateLatestFeedTimestamp({
      vendorUserId: context.user.vendorUserId,
    });
  }

  const token = await generateAccessToken(
    exchange._id.toString(),
    user?._id,
    disclosure,
    exchange,
    context
  );

  return {
    exchange: buildExchangeProgress(exchange),
    token,
  };
};

module.exports = { handlePresentationSubmission };
