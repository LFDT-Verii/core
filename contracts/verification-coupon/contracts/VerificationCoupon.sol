// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@verii/permissions-contract/contracts/Permissions.sol";

/**
 * @dev {ERC721} token, including:
 *
 *  - ability for holders to burn (destroy) their tokens
 *  - a minter role that allows for token minting (creation)
 *  - a pauser role that allows to stop all token transfers
 *  - token ID and URI autogeneration
 *
 * This contract uses {AccessControl} to lock permissioned functions using the
 * different roles - head to its documentation for details.
 *
 * The account that deploys the contract will be granted the minter and pauser
 * roles, as well as the default admin role, which will let it grant both minter
 * and pauser roles to other accounts.
 */
contract VerificationCoupon is Initializable, AccessControlEnumerableUpgradeable, ERC1155Upgradeable {
    address VNF;
    using CountersUpgradeable for CountersUpgradeable.Counter;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    mapping(uint256 => uint256) private expirationTime;

    mapping(address => uint256[]) private ownerTokens;

    CountersUpgradeable.Counter private _tokenIdTracker;

    string private _tokenName;

    Permissions internal permissions;

    event MintCouponBundle(address owner, uint256 bundleId, uint256 expirationTime, uint256 quantity, string traceId, string ownerDid);

    event BurnCoupon(address owner, uint256 bundleId, string traceId, string caoDid, string burnerDid, uint256 balance, uint256 expirationTime, uint256 burnTime);

    function initialize(string memory tokenName, string memory baseTokenURI) public initializer {
        ERC1155Upgradeable.__ERC1155_init(baseTokenURI);
        VNF = msg.sender;
        _tokenName = tokenName;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
    }

    function setPermissionsAddress(address _permissions) public {
        require(msg.sender == VNF, "The caller is not VNF");
        permissions = Permissions(_permissions);
    }

    function getPermissionsAddress() public view returns (address) {
        return address(permissions);
    }

    function getVNF() public view returns (address) {
        return VNF;
    }

    function isExpired(uint256 tokenId) public view returns (bool) {
        return block.timestamp >= expirationTime[tokenId];
    }

    function getTokenId(address operator) public view returns (uint256) {
        address primary = permissions.checkOperator(operator);
        uint256 quantity = ownerTokens[primary].length;
        require(quantity != 0, "No available tokens");

        uint256 lowestTokenId = type(uint256).max;
        uint256 currentTokenId;
        for (uint256 i = 0; i < quantity; i++) {
            currentTokenId = ownerTokens[primary][i];
            if (!isExpired(currentTokenId) && currentTokenId < lowestTokenId) {
                lowestTokenId = currentTokenId;
            }
        }
        require(lowestTokenId != type(uint256).max, "No available tokens");
        return lowestTokenId;
    }

    function removeTokenId(uint256 tokenId, address burnAddress) private {
        uint256[] storage tokenList = ownerTokens[burnAddress];
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenId == tokenList[i]) {
                tokenList[i] = tokenList[tokenList.length - 1];
                return tokenList.pop();
            }
        }
    }

    function mint(address to, uint256 _expirationTime, uint256 quantity, string memory traceId, string memory ownerDid) public virtual {
        require(hasRole(MINTER_ROLE, msg.sender), "VerificationCoupon: must have a minter role to mint");
        require(quantity > 0, "Invalid quantity");

        uint256 tokenId = _tokenIdTracker.current();
        _mint(to, tokenId, quantity, "");
        ownerTokens[to].push(tokenId);
        expirationTime[tokenId] = _expirationTime;
        _tokenIdTracker.increment();
        emit MintCouponBundle(to, tokenId, _expirationTime, quantity, traceId, ownerDid);
    }

    function burn(uint256 tokenId, string memory traceId, string memory caoDid, string memory burnerDid, address operator) public virtual {
        require(permissions.checkAddressScope(msg.sender, "coupon:burn"), "Burn: caller does not have coupon:burn permission");
        address primary = permissions.checkOperator(operator);
        require(balanceOf(primary, tokenId) > 0, "Burn: bundle has no balance");
        burnExpiredTokens(primary);

        _burn(primary, tokenId, 1);
        uint256 balance = balanceOf(primary, tokenId);
        uint256 expiration = expirationTime[tokenId];
        if (balance == 0) {
            delete expirationTime[tokenId];
            removeTokenId(tokenId, primary);
        }
        emit BurnCoupon(primary, tokenId, traceId, caoDid, burnerDid, balance, expiration, block.timestamp);
    }

    function burnExpiredTokens(address burnAddress) private {
        uint256 quantity = ownerTokens[burnAddress].length;
        uint256 currentTokenId;
        uint256 i = 0;
        while (i < quantity) {
            currentTokenId = ownerTokens[burnAddress][i];
            if (isExpired(currentTokenId)) {
                uint256 balance = balanceOf(burnAddress, currentTokenId);
                _burn(burnAddress, currentTokenId, balance);
                delete expirationTime[currentTokenId];
                removeTokenId(currentTokenId, burnAddress);
                quantity--;
            } else {
                i++;
            }
        }
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlEnumerableUpgradeable, ERC1155Upgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _getTokenName() public view virtual returns (string memory) {
        return _tokenName;
    }
}
