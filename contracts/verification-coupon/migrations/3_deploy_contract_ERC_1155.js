const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const VerificationCoupon = artifacts.require("VerificationCoupon");

module.exports = async function (deployer) {
    const name = "Velocity Verification Coupon";
    const baseTokenURI = "https://www.velocitynetwork.foundation/";
    const instance = await deployProxy(VerificationCoupon, [name, baseTokenURI], { deployer });
    console.log('Deployed', instance.address);
};
