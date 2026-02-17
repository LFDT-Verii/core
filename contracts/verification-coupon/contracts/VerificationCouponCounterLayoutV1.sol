// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@verii/permissions-contract/contracts/Permissions.sol";

library LegacyCountersUpgradeable {
    struct Counter {
        uint256 _value;
    }

    function current(Counter storage counter) internal view returns (uint256) {
        return counter._value;
    }

    function increment(Counter storage counter) internal {
        counter._value += 1;
    }
}

/**
 * @dev Test-only contract that mirrors the pre-migration counter storage shape.
 * It is used to validate proxy storage compatibility when upgrading to
 * VerificationCoupon that now uses a plain uint256 for _tokenIdTracker.
 */
contract VerificationCouponCounterLayoutV1 is
    Initializable,
    AccessControlEnumerableUpgradeable,
    ERC1155Upgradeable
{
    using LegacyCountersUpgradeable for LegacyCountersUpgradeable.Counter;

    address VNF;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    mapping(uint256 => uint256) private expirationTime;
    mapping(address => uint256[]) private ownerTokens;
    LegacyCountersUpgradeable.Counter private _tokenIdTracker;

    string private _tokenName;
    Permissions internal permissions;

    function initialize(string memory tokenName, string memory baseTokenURI) public initializer {
        ERC1155Upgradeable.__ERC1155_init(baseTokenURI);
        AccessControlEnumerableUpgradeable.__AccessControlEnumerable_init();
        VNF = msg.sender;
        _tokenName = tokenName;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function setPermissionsAddress(address _permissions) public {
        require(msg.sender == VNF, "The caller is not VNF");
        permissions = Permissions(_permissions);
    }

    function mint(
        address to,
        uint256 _expirationTime,
        uint256 quantity,
        string memory,
        string memory
    ) public virtual {
        require(hasRole(MINTER_ROLE, msg.sender), "VerificationCoupon: must have a minter role to mint");
        require(quantity > 0, "Invalid quantity");

        uint256 tokenId = _tokenIdTracker.current();
        _mint(to, tokenId, quantity, "");
        ownerTokens[to].push(tokenId);
        expirationTime[tokenId] = _expirationTime;
        _tokenIdTracker.increment();
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControlEnumerableUpgradeable, ERC1155Upgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
