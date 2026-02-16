const ethers = require('ethers');
const Migrations = require('./build/contracts/Migrations.json');
const truffleConfig = require('./truffle-config');

const cmd = process.argv[2] || 'get';
const env = process.argv[3] || 'localdocker';
const value = process.argv[4] || '1';
const networkId = truffleConfig.networks[env].network_id;

console.log(`ENV: ${env} Network Id: ${networkId}`);

const config = {
  contractAddress: Migrations.networks[networkId].address,
  rpcUrl: truffleConfig.networks[env].rpcUrl,
  gas: truffleConfig.networks[env].gas,
  gasPrice: truffleConfig.networks[env].gasPrice,
};

const main = async () => {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const instance = new ethers.Contract(
    config.contractAddress,
    Migrations.abi,
    provider
  );

  if (cmd === 'set') {
    await instance.methods.setCompleted(value).send({
      from: config.provider.addresses[0],
      gas: config.gas,
      gasPrice: config.gasPrice,
    });
  }

  const lastCompletedMigration = await instance.last_completed_migration();
  console.log(`last_completed_migration: ${lastCompletedMigration}`);
};

main();
