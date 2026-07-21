import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { handler } = require('../src/lambda-monitor');

const tick = async () => {
  try {
    const result = await handler({ source: 'wallet-certifier.local' }, {});
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`Monitor invocation failed: ${error.message}\n`);
  }
};

tick().then(() => setInterval(tick, 5000));
