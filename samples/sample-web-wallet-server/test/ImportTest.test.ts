import { VCLEnvironment } from '@verii/vnf-nodejs-wallet-sdk';

describe('Imports Test', () => {
  test('testEnvironment', async () => {
    expect(VCLEnvironment.Dev).toBeDefined();
  });
});
