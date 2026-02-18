// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@verii/verification-coupon-contract/contracts/VerificationCoupon.sol";
import "@verii/permissions-contract/contracts/Permissions.sol";
import "@verii/signature-verification-library/libraries/SignatureVerification.sol";

contract MetadataRegistry is Initializable {
    VerificationCoupon internal Coupon;

    struct CredentialEntry {
        bytes2 credentialType;
        bytes encryptedPublicKey;
        bool used;
    }

    struct ListMetadata {
        bytes2 version;
        bytes2 algType;
        bytes issuerVc;
        bool used;
    }

    struct CredentialIdentifier {
        address accountId;
        uint256 listId;
        uint32 index;
    }

    struct CredentialMetadata {
        bytes2 version;
        bytes2 credentialType;
        bytes2 algType;
        bytes encryptedPublicKey;
        bytes issuerVc;
    }

    mapping(bytes2 => bool) public freeCredentialTypes;
    mapping(address => mapping(uint256 => ListMetadata)) public lists;
    mapping(address => mapping(uint256 => mapping(uint32 => CredentialEntry))) internal indexUsed;

    Permissions internal permissions;

    event CreatedMetadataList(address sender, bytes issuerVc, uint256 listId, string traceId, string caoDid);
    event AddedCredentialMetadata(address sender, bytes issuerVc, uint256 listId, bytes2 credentialType, uint32 index, string traceId, string caoDid);
    event GotCredentialMetadata(CredentialMetadata[] credentialMetadataList);

    modifier onlyVnf() {
        require(msg.sender == permissions.getVNF(), "Permissions: caller is not VNF");
        _;
    }

    function initialize(address _coupon, bytes2[] memory freeCredentialTypesList) public initializer {
        Coupon = VerificationCoupon(_coupon);
        for (uint256 i = 0; i < freeCredentialTypesList.length; i++) {
            freeCredentialTypes[freeCredentialTypesList[i]] = true;
        }
    }

    function setPermissionsAddress(address _permissions) public {
        require(address(permissions) == address(0) || msg.sender == permissions.getVNF(), 'Permissions: caller is not VNF');
        permissions = Permissions(_permissions);
    }

    function getPermissionsAddress() public view returns (address) {
        return address(permissions);
    }

    function setCouponAddress(address _coupon) public {
        require(msg.sender == Coupon.getVNF(), "The caller is not VNF");
        Coupon = VerificationCoupon(_coupon);
    }

    function isExistMetadataList(address accountId, uint256 listId) public view returns (bool){
        return lists[accountId][listId].used;
    }

    function newMetadataList(uint256 listId, bytes2 algType, bytes2 version, bytes memory issuerVc, string memory traceId, string memory caoDid) public {
        newMetadataListInternal(listId, algType, version, issuerVc, traceId, caoDid, msg.sender);
    }

    function newMetadataListSigned(uint256 listId, bytes2 algType, bytes2 version, bytes memory issuerVc, string memory traceId, string memory caoDid, bytes memory signature) public {
        address operator = SignatureVerification.recoverSigner(abi.encode(msg.sender), signature);
        newMetadataListInternal(listId, algType, version, issuerVc, traceId, caoDid, operator);
    }

    function newMetadataListInternal(uint256 listId, bytes2 algType, bytes2 version, bytes memory issuerVc, string memory traceId, string memory caoDid, address operator) private {
        address primary = permissions.checkOperator(operator);
        require(!lists[primary][listId].used, "List id already used");
        ListMetadata storage entries = lists[primary][listId];
        entries.version = version;
        entries.algType = algType;
        entries.issuerVc = issuerVc;
        entries.used = true;
        emit CreatedMetadataList(primary, issuerVc, listId, traceId, caoDid);
    }

    function setEntry(
        bytes2 credentialType,
        bytes memory encryptedPublicKey,
        uint256 listId,
        uint32 index,
        string memory traceId,
        string memory caoDid
    ) public {
        setEntryInternal(credentialType, encryptedPublicKey, listId, index, traceId, caoDid, msg.sender);
    }

    function setEntrySigned(
        bytes2 credentialType,
        bytes memory encryptedPublicKey,
        uint256 listId,
        uint32 index,
        string memory traceId,
        string memory caoDid,
        bytes memory signature
    ) public {
        address operator = SignatureVerification.recoverSigner(abi.encode(msg.sender), signature);
        setEntryInternal(credentialType, encryptedPublicKey, listId, index, traceId, caoDid, operator);
    }

    function setEntryInternal(
        bytes2 credentialType,
        bytes memory encryptedPublicKey,
        uint256 listId,
        uint32 index,
        string memory traceId,
        string memory caoDid,
        address operator
    ) private {
        address primary = checkOperatorWithCredentialType(operator, credentialType);
        require(index < 10000, "Invalid index");
        require(!indexUsed[primary][listId][index].used, "Index already used");
        require(lists[primary][listId].used, "List Id not aveliable");
        CredentialEntry storage entryDataLocal = indexUsed[primary][listId][index];
        entryDataLocal.credentialType = credentialType;
        entryDataLocal.encryptedPublicKey = encryptedPublicKey;
        entryDataLocal.used = true;
        emit AddedCredentialMetadata(primary, lists[primary][listId].issuerVc, listId, credentialType, index, traceId, caoDid);
    }

    function addFreeTypes(bytes2[] memory freeCredentialTypesList) public {
        require(msg.sender == Coupon.getVNF(), "The caller is not VNF");
        for (uint256 i = 0; i < freeCredentialTypesList.length; i++) {
            freeCredentialTypes[freeCredentialTypesList[i]] = true;
        }
    }

    function removeFreeTypes(bytes2[] memory freeCredentialTypesList) public {
        require(msg.sender == Coupon.getVNF(), "The caller is not VNF");
        for (uint256 i = 0; i < freeCredentialTypesList.length; i++) {
            delete freeCredentialTypes[freeCredentialTypesList[i]];
        }
    }

    function isFreeCredentialType(bytes2 credentialType) public view returns (bool){
        return freeCredentialTypes[credentialType];
    }

    function isFreeGetEntries(CredentialMetadata[] memory entries) private view returns (bool){
        for (uint256 i = 0; i < entries.length; i++) {
            if (!isFreeCredentialType(entries[i].credentialType)) {
                return false;
            }
        }
        return true;
    }

    function _getEntries(
        CredentialIdentifier[] memory _entryIndexes
    ) private view returns (CredentialMetadata[] memory) {
        CredentialMetadata[] memory entries = new CredentialMetadata[](
            _entryIndexes.length
        );
        for (uint256 i = 0; i < _entryIndexes.length; i++) {
            require(lists[_entryIndexes[i].accountId][_entryIndexes[i].listId].used, "List id not used");
            require(indexUsed[_entryIndexes[i].accountId][_entryIndexes[i].listId][_entryIndexes[i].index].used, "Index not used");
            entries[i].version = lists[_entryIndexes[i].accountId][_entryIndexes[i].listId].version;
            entries[i].credentialType = indexUsed[_entryIndexes[i].accountId][_entryIndexes[i].listId][_entryIndexes[i].index].credentialType;
            entries[i].algType = lists[_entryIndexes[i].accountId][_entryIndexes[i].listId].algType;
            entries[i].encryptedPublicKey = indexUsed[_entryIndexes[i].accountId][_entryIndexes[i].listId][_entryIndexes[i].index].encryptedPublicKey;
            entries[i].issuerVc = lists[_entryIndexes[i].accountId][_entryIndexes[i].listId].issuerVc;
        }
        return entries;
    }

    function getFreeEntries(
        CredentialIdentifier[] memory _entryIndexes
    ) public view returns (CredentialMetadata[] memory) {
        CredentialMetadata[] memory entries = _getEntries(_entryIndexes);
        require(isFreeGetEntries(entries), 'Only free creadential types is allowed without coupon');
        return entries;
    }

    function getPaidEntries(
        CredentialIdentifier[] memory _entryIndexes,
        string memory traceId,
        string memory caoDid,
        string memory burnerDid
    ) public {
        getPaidEntriesInternal(_entryIndexes, traceId, caoDid, burnerDid, msg.sender);
    }

    function getPaidEntriesSigned(
        CredentialIdentifier[] memory _entryIndexes,
        string memory traceId,
        string memory caoDid,
        string memory burnerDid,
        bytes memory signature
    ) public {
        address operator = SignatureVerification.recoverSigner(abi.encode(msg.sender), signature);
        getPaidEntriesInternal(_entryIndexes, traceId, caoDid, burnerDid, operator);
    }

    function getPaidEntriesInternal(
        CredentialIdentifier[] memory _entryIndexes,
        string memory traceId,
        string memory caoDid,
        string memory burnerDid,
        address operator
    ) private {
        CredentialMetadata[] memory entries = _getEntries(_entryIndexes);
        require(!isFreeGetEntries(entries), 'No paid creadential types');
        uint256 _coupon = Coupon.getTokenId(operator);
        Coupon.burn(_coupon, traceId, caoDid, burnerDid, operator);
        emit GotCredentialMetadata(entries);
    }

    function checkOperatorWithCredentialType(address operator, bytes2 credentialType) public view returns (address) {
        string memory permission = getPermissionOfCredentialTypeHash(credentialType);
        try permissions.checkOperatorPermission(operator, permission) returns (address primary) {
            return primary;
        } catch Error(string memory reason) {
            require(isEqual(reason, "Permissions: primary of operator lacks requested permission"), reason);
            require(false, buildCheckOperatorPermissionError(permission));
        }
        return address(0);
    }

    function getPermissionOfCredentialTypeHash(bytes2 credentialType) private pure returns (string memory) {
        string memory permissionCredentialIssue = "credential:issue";
        string memory permissionCredentialIdentityIssue = "credential:identityissue";
        string memory permissionCredentialContactIssue = "credential:contactissue";
        string memory fallbackPermission = permissionCredentialIssue;
        if (credentialType == 0x7808) {return permissionCredentialIssue;}
        // Assessment
        else if (credentialType == 0x41ec) {return permissionCredentialIssue;}
        // AssessmentV1.0
        else if (credentialType == 0xaf29) {return permissionCredentialIssue;}
        // AssessmentV1.1
        else if (credentialType == 0x0024) {return permissionCredentialIssue;}
        // Badge
        else if (credentialType == 0xc184) {return permissionCredentialIssue;}
        // BadgeV1.1
        else if (credentialType == 0x8684) {return permissionCredentialIssue;}
        // Certification
        else if (credentialType == 0x5df0) {return permissionCredentialIssue;}
        // CertificationV1.0
        else if (credentialType == 0xade9) {return permissionCredentialIssue;}
        // CertificationV1.1
        else if (credentialType == 0x2096) {return permissionCredentialIssue;}
        // Course
        else if (credentialType == 0xb037) {return permissionCredentialIssue;}
        // CourseAttendanceV1.0
        else if (credentialType == 0xc385) {return permissionCredentialIssue;}
        // CourseAttendanceV1.1
        else if (credentialType == 0x5f0e) {return permissionCredentialIssue;}
        // CourseCompletionV1.0
        else if (credentialType == 0x4b80) {return permissionCredentialIssue;}
        // CourseCompletionV1.1
        else if (credentialType == 0xf2dc) {return permissionCredentialIssue;}
        // CourseRegistrationV1.0
        else if (credentialType == 0x955b) {return permissionCredentialIssue;}
        // CourseRegistrationV1.1
        else if (credentialType == 0x7516) {return permissionCredentialIssue;}
        // CurrentEmploymentPosition
        else if (credentialType == 0xeea2) {return permissionCredentialIdentityIssue;}
        // DriversLicenseV1.0
        else if (credentialType == 0xb89f) {return permissionCredentialIssue;}
        // EducationDegree
        else if (credentialType == 0x294a) {return permissionCredentialIssue;}
        // EducationDegreeGraduationV1.0
        else if (credentialType == 0x8642) {return permissionCredentialIssue;}
        // EducationDegreeGraduationV1.1
        else if (credentialType == 0x9b9f) {return permissionCredentialIssue;}
        // EducationDegreeRegistrationV1.0
        else if (credentialType == 0x5ab6) {return permissionCredentialIssue;}
        // EducationDegreeRegistrationV1.1
        else if (credentialType == 0xb139) {return permissionCredentialIssue;}
        // EducationDegreeStudyV1.0
        else if (credentialType == 0xa214) {return permissionCredentialIssue;}
        // EducationDegreeStudyV1.1
        else if (credentialType == 0x969c) {return permissionCredentialContactIssue;}
        // Email
        else if (credentialType == 0x8f07) {return permissionCredentialContactIssue;}
        // EmailV1.0
        else if (credentialType == 0x764c) {return permissionCredentialIssue;}
        // EmploymentCurrentV1.0
        else if (credentialType == 0xdb4c) {return permissionCredentialIssue;}
        // EmploymentCurrentV1.1
        else if (credentialType == 0x7e15) {return permissionCredentialIssue;}
        // EmploymentPastV1.0
        else if (credentialType == 0xf4aa) {return permissionCredentialIssue;}
        // EmploymentPastV1.1
        else if (credentialType == 0x851f) {return permissionCredentialIdentityIssue;}
        // IdDocument
        else if (credentialType == 0xfeab) {return permissionCredentialIdentityIssue;}
        // IdDocumentV1.0
        else if (credentialType == 0xefca) {return permissionCredentialIssue;}
        // LicenseV1.0
        else if (credentialType == 0xd8ae) {return permissionCredentialIssue;}
        // LicenseV1.1
        else if (credentialType == 0xdeef) {return permissionCredentialIdentityIssue;}
        // NationalIdCardV1.0
        else if (credentialType == 0x2936) {return permissionCredentialIssue;}
        // OpenBadgeCredential
        else if (credentialType == 0x86bf) {return permissionCredentialIssue;}
        // OpenBadgeV1.0
        else if (credentialType == 0x5b0e) {return permissionCredentialIssue;}
        // OpenBadgeV2.0
        else if (credentialType == 0x7b17) {return permissionCredentialIdentityIssue;}
        // PassportV1.0
        else if (credentialType == 0x29d2) {return permissionCredentialIssue;}
        // PastEmploymentPosition
        else if (credentialType == 0x63dc) {return permissionCredentialContactIssue;}
        // Phone
        else if (credentialType == 0x4ffb) {return permissionCredentialContactIssue;}
        // PhoneV1.0
        else if (credentialType == 0xf052) {return permissionCredentialIssue;}
        // ProofOfAgeV1.0
        else if (credentialType == 0xa004) {return permissionCredentialIdentityIssue;}
        // ResidentPermitV1.0
        return fallbackPermission;
    }

    function buildCheckOperatorPermissionError(string memory permission) private pure returns (string memory) {
        if (isEqual(permission, "credential:issue")) {
            return "Permissions: primary of operator lacks credential:issue permission";
        } else if (isEqual(permission, "credential:identityissue")) {
            return "Permissions: primary of operator lacks credential:identityissue permission";
        } else if (isEqual(permission, "credential:contactissue")) {
            return "Permissions: primary of operator lacks credential:contactissue permission";
        }
        return "Permissions: primary of operator lacks permission for credentialType";
    }

    function isEqual(string memory a, string memory b) public pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }
}
