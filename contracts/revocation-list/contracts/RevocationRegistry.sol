// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@verii/permissions-contract/contracts/Permissions.sol";
import "@verii/signature-verification-library/libraries/SignatureVerification.sol";

library SafeCast {
    function toUint8(uint256 value) internal pure returns (uint8) {
        require(value < 2 ** 8, "SafeCast: value doesn't fit in 8 bits");
        return uint8(value);
    }
}

contract RevocationRegistry is Initializable {
    uint256 private constant REVOCATION_LIST_LENGTH = 10240;
    uint256 private constant REVOCATION_ARRAY_SIZE =
    REVOCATION_LIST_LENGTH / 256;

    struct WalletRevocationRegistry {
        bool walletInRegistry;
        uint256 totalLists;
        mapping(uint256 => bool) listIdUsage;
        mapping(uint256 => uint256[]) lists;
    }

    mapping(address => WalletRevocationRegistry) public registry;

    Permissions internal permissions;

    modifier onlyVnf() {
        require(msg.sender == permissions.getVNF(), "Permissions: caller is not VNF");
        _;
    }

    event WalletAdded(address wallet, string traceId, string caoDid);
    event RevocationListCreate(address wallet, uint256 listId, string traceId, string caoDid);
    event RevokedStatusUpdate(address owner, uint256 listId, uint32 index, string traceId, string caoDid);

    function initialize() public initializer {}

    function setPermissionsAddress(address _permissions) public {
        require(address(permissions) == address(0) || msg.sender == permissions.getVNF(), 'Permissions: caller is not VNF');
        permissions = Permissions(_permissions);
    }

    function getPermissionsAddress() public view returns (address) {
        return address(permissions);
    }

    function isWalletExist(address wallet) public view returns (bool) {
        return registry[wallet].walletInRegistry;
    }

    modifier existingWallet(address operator) {
        address primary = permissions.checkOperator(operator);
        require(isWalletExist(primary), "wallet not in registry");
        _;
    }

    function isListExist(address wallet, uint256 listId)
    public
    view
    returns (bool)
    {
        return registry[wallet].listIdUsage[listId];
    }

    function getPositionAndOffset(uint32 position, uint32 divider)
    private
    pure
    returns (uint32, uint32)
    {
        if (position < divider) {
            return (0, position);
        }

        uint32 pos = position / divider;
        uint32 offset = position % divider;

        return (pos, offset);
    }

    function addWallet(string memory traceId, string memory caoDid) public {
        addWalletInternal(traceId, caoDid, msg.sender);
    }

    function addWalletSigned(string memory traceId, string memory caoDid, bytes memory signature) public {
        address operator = SignatureVerification.recoverSigner(abi.encode(msg.sender), signature);
        addWalletInternal(traceId, caoDid, operator);
    }

    function addWalletInternal(string memory traceId, string memory caoDid, address operator) private {
        address primary = permissions.checkOperator(operator);
        require(!isWalletExist(primary), "wallet already in registry");

        WalletRevocationRegistry storage walletRegistry = registry[primary];

        walletRegistry.walletInRegistry = true;

        emit WalletAdded(primary, traceId, caoDid);
    }

    function addRevocationList(uint256 listId, string memory traceId, string memory caoDid) public {
        addRevocationListInternal(listId, traceId, caoDid, msg.sender);
    }

    function addRevocationListSigned(uint256 listId, string memory traceId, string memory caoDid, bytes memory signature) public {
        address operator = SignatureVerification.recoverSigner(abi.encode(msg.sender), signature);
        addRevocationListInternal(listId, traceId, caoDid, operator);
    }

    function addRevocationListInternal(uint256 listId, string memory traceId, string memory caoDid, address operator) private existingWallet(operator) {
        address primary = permissions.checkOperator(operator);
        require(!isListExist(primary, listId), "revocation list with given id already exist");

        WalletRevocationRegistry storage walletRegistry = registry[primary];

        uint256[] memory revocationList = new uint256[](REVOCATION_ARRAY_SIZE);

        walletRegistry.listIdUsage[listId] = true;
        walletRegistry.lists[listId] = revocationList;
        walletRegistry.totalLists++;

        emit RevocationListCreate(primary, listId, traceId, caoDid);
    }

    function setRevokedStatus(uint256 listId, uint32 index, string memory traceId, string memory caoDid)
    public
    {
        setRevokedStatusInternal(listId, index, traceId, caoDid, msg.sender);
    }

    function setRevokedStatusSigned(uint256 listId, uint32 index, string memory traceId, string memory caoDid, bytes memory signature)
    public
    {
        address operator = SignatureVerification.recoverSigner(abi.encode(msg.sender), signature);
        setRevokedStatusInternal(listId, index, traceId, caoDid, operator);
    }

    function setRevokedStatusInternal(uint256 listId, uint32 index, string memory traceId, string memory caoDid, address operator)
    private
    existingWallet(operator)
    {
        address primary = permissions.checkOperator(operator);
        require(index < REVOCATION_LIST_LENGTH, "list index out of bound");
        require(isListExist(primary, listId), "revocation list with given id does not exist");

        (uint32 pos, uint32 offset) = getPositionAndOffset(index, 256);

        uint256 currentValue = registry[primary].lists[listId][pos];
        uint256 bitValue = 1 << offset;

        registry[primary].lists[listId][pos] = currentValue | bitValue;

        emit RevokedStatusUpdate(primary, listId, index, traceId, caoDid);
    }

    function getRevokedStatus(
        address wallet,
        uint256 listId,
        uint32 index
    ) public view returns (uint8 revokedStatus) {

        require(index < REVOCATION_LIST_LENGTH, "list index out of bound");
        require(isWalletExist(wallet), "wallet not in registry");
        require(isListExist(wallet, listId), "revocation list with given id does not exist");

        (uint32 pos, uint32 offset) = getPositionAndOffset(index, 256);

        uint256 mask = 1 << offset;
        uint256 maskedValue = registry[wallet].lists[listId][pos] & mask;
        revokedStatus = SafeCast.toUint8(maskedValue >> offset);

        return revokedStatus;
    }

    function getRevocationListCount()
    external
    view
    existingWallet(msg.sender)
    returns (uint256)
    {
        address primary = permissions.checkOperator(msg.sender);
        return registry[primary].totalLists;
    }
}
