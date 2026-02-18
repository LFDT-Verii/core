// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "./VerificationCoupon.sol";

contract VerificationCouponV2 is VerificationCoupon {
    function version() external pure returns (string memory) {
        return "v2";
    }
}
