// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "./MetadataRegistry.sol";

contract MetadataRegistryV2 is MetadataRegistry {
    function version() external pure returns (string memory) {
        return "v2";
    }
}
