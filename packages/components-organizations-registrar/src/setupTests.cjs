// eslint-disable-next-line import/no-extraneous-dependencies
const { enableFetchMocks } = require('jest-fetch-mock');

const { TextEncoder, TextDecoder } = require('util');

// eslint-disable-next-line better-mutation/no-mutation
global.TextEncoder = TextEncoder;
// eslint-disable-next-line better-mutation/no-mutation
global.TextDecoder = TextDecoder;

enableFetchMocks();
