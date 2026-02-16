const Web3 = require('web3');
const fs = require('fs');
const VerificationCouponV2 = require("../build/contracts/VerificationCoupon");
const VerificationCouponV1 = require('./contracts-v1/verification-coupon.json');
const truffleConfig = require('../truffle-config.js');

const env = process.argv[4] || 'localdocker';
console.log('ENV:', env)
const networkId = truffleConfig.networks[env].network_id;

const proxies = require(`../.openzeppelin/unknown-${networkId}.json`).proxies;
const config = {
  contractAddressV1: proxies[0].address,
  contractAddressV2: proxies[1].address,
  provider: truffleConfig.networks[env].provider,
  gas: truffleConfig.networks[env].gas,
  gasPrice: truffleConfig.networks[env].gasPrice,
};
console.log(`ENV: ${env} Network Id: ${networkId}`, config);



module.exports = async function (deployer) {
    // const web3 = new Web3(config.provider);
    // const instanceV1 = new web3.eth.Contract(VerificationCouponV1.abi, config.contractAddressV1);
    //
    // const events = await instanceV1.getPastEvents('MintCouponBundle', {
    //     fromBlock: 0,
    //     toBlock: 'latest'
    // });
    // fs.writeFileSync(`_${env}-events-mint.json`, JSON.stringify(events))
    // const balances = events.reduce((acc, { returnValues: { owner, ownerDid } })=> {
    //   acc[owner] = { value:0,  ownerDid } ;
    //   return acc;
    // }, {});
    // for(let account in balances) {
    //   balances[account].value = await instanceV1.methods.balanceOf(account).call();
    // }
    // console.log('Balances:', balances);
    // fs.writeFileSync(`_${env}-balances.json`, JSON.stringify(balances))
    //
    // const expirationTime = Math.floor(Date.now() / 1000) + 3 * 30 * 24 * 60 * 60;
    // const traceId = 'migration';
    // const instanceV2 = new web3.eth.Contract(VerificationCouponV2.abi, config.contractAddressV2);
    // const migratedBalances = {};
    // for(let account in balances) {
    //   console.log('Minting:', account, balances[account]);
    //   if (Number(balances[account].value) > 0) {
    //     await instanceV2.methods.mint(account, expirationTime, balances[account].value, traceId, balances[account].ownerDid).send({
    //       from: config.provider.addresses[0],
    //       gas: config.gas,
    //       gasPrice: config.gasPrice
    //     });
    //   }
    //   migratedBalances[account] = balances[account];
    //   console.log('Minted:', account, balances[account]);
    // }
    // fs.writeFileSync(`_${env}-migrated-balances-v2.json`, JSON.stringify(migratedBalances));
    // const eventsV2 = await instanceV2.getPastEvents('MintCouponBundle', {
    //   fromBlock: 0,
    //   toBlock: 'latest'
    // });
    // fs.writeFileSync(`_${env}-events-mint-v2.json`, JSON.stringify(eventsV2));
    console.log('Balances migrated!');
};
