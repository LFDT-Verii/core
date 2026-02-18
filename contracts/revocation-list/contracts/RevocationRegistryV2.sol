// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "./RevocationRegistry.sol";

contract RevocationRegistryV2 is RevocationRegistry {
    function version() external pure returns (string memory) {
        return "v2";
    }
}
