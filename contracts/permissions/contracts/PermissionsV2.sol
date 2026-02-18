// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "./Permissions.sol";

contract PermissionsV2 is Permissions {
    function version() external pure returns (string memory) {
        return "v2";
    }
}
