// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract Permissions is Initializable {
    address VNF;
    mapping(address => mapping(string => bool)) private addressToPermissions;

    mapping(address => address) private primaryToPermissioning;
    mapping(address => address) private primaryToRotation;
    mapping(address => address) private operatorToPrimary;
    address[] private primaries;

    modifier non0Address(address addr) {
        require(addr != address(0), "Permissions: address is 0 address");
        _;
    }

    modifier onlyVnf() {
        require(msg.sender == VNF, "Permissions: caller is not VNF");
        _;
    }

    modifier onlyRotation(address primary) {
        require(msg.sender == primaryToRotation[primary], "Permissions: caller is not rotation key");
        _;
    }

    modifier onlyPermissions(address primary) {
        require(msg.sender == primaryToPermissioning[primary], "Permissions: caller is not permissioning key");
        _;
    }

    function initialize() public initializer {
        if (VNF == address(0)) {
            VNF = msg.sender;
        }
    }

    function rotateVNF(address addr) public onlyVnf non0Address(addr) {
        VNF = addr;
    }

    function getVNF() public view returns (address) {
        return VNF;
    }

    function addAddressScope(address addr, string memory scope) public onlyVnf non0Address(addr) {
        addressToPermissions[addr][scope] = true;
    }

    function removeAddressScope(address addr, string memory scope) public onlyVnf {
        addressToPermissions[addr][scope] = false;
    }

    function updateAddressScopes(address addr, string[] memory scopesToAdd, string[] memory scopesToRemove) public onlyVnf {
        for (uint256 i = 0; i < scopesToAdd.length; i++) {
            string memory scopeToAdd = scopesToAdd[i];
            addressToPermissions[addr][scopeToAdd] = true;
        }
        for (uint256 i = 0; i < scopesToRemove.length; i++) {
            string memory scopeToRemove = scopesToRemove[i];
            addressToPermissions[addr][scopeToRemove] = false;
        }
    }

    function checkAddressScope(address addr, string memory scope) public view returns (bool) {
        return addressToPermissions[addr][scope];
    }

    function addPrimary(address primary, address permissioning, address rotation) public onlyVnf non0Address(primary) {
        primaryToPermissioning[primary] = permissioning;
        primaryToRotation[primary] = rotation;
        primaries.push(primary);
    }

    function rotatePermissioning(address primary, address newPermissioning, address newRotation) public onlyRotation(primary) {
        primaryToPermissioning[primary] = newPermissioning;
        primaryToRotation[primary] = newRotation;
    }

    function getPrimaries() public view returns (address[] memory) {
        return primaries;
    }

    function addOperatorKey(address primary, address operator) public onlyPermissions(primary) non0Address(operator) {
        require(operatorToPrimary[operator] == address(0), "Permissions: operator is already mapped to a primary");
        operatorToPrimary[operator] = primary;
    }

    function removeOperatorKey(address primary, address operator) public onlyPermissions(primary) {
        operatorToPrimary[operator] = address(0);
    }

    function rotateOperatorKey(address primary, address newOperator, address oldOperator) public onlyPermissions(primary) {
        removeOperatorKey(primary, oldOperator);
        addOperatorKey(primary, newOperator);
    }

    function lookupPrimary(address operator) public view returns (address) {
        return operatorToPrimary[operator];
    }

    function checkOperator(address operator) public view returns (address) {
        address primary = operatorToPrimary[operator];
        require(primary != address(0), "Permissions: operator not pointing to a primary");
        require(checkAddressScope(primary, "transactions:write"), "Permissions: primary of operator lacks transactions:write scope");
        return primary;
    }

    function checkOperatorWithScope(address operator, string memory scope) public view returns (address) {
        address primary = checkOperator(operator);
        require(checkAddressScope(primary, scope), "Permissions: primary of operator lacks scope");
        return primary;
    }

    function getPermissionOfCredentialTypeHash(bytes2 credentialType) private pure returns (string memory) {
        string memory permissionCredentialIssue = "credential:issue";
        string memory permissionCredentialIdentityIssue = "credential:identityissue";
        string memory permissionCredentialContactIssue = "credential:contactissue";

        if(credentialType == 0x7808) {return permissionCredentialIssue;} // Assessment
        else if(credentialType == 0x41ec) {return permissionCredentialIssue;} // AssessmentV1.0
        else if(credentialType == 0xaf29) {return permissionCredentialIssue;} // AssessmentV1.1
        else if(credentialType == 0x0024) {return permissionCredentialIssue;} // Badge
        else if(credentialType == 0xc184) {return permissionCredentialIssue;} // BadgeV1.1
        else if(credentialType == 0x8684) {return permissionCredentialIssue;} // Certification
        else if(credentialType == 0x5df0) {return permissionCredentialIssue;} // CertificationV1.0
        else if(credentialType == 0xade9) {return permissionCredentialIssue;} // CertificationV1.1
        else if(credentialType == 0x2096) {return permissionCredentialIssue;} // Course
        else if(credentialType == 0xb037) {return permissionCredentialIssue;} // CourseAttendanceV1.0
        else if(credentialType == 0xc385) {return permissionCredentialIssue;} // CourseAttendanceV1.1
        else if(credentialType == 0x5f0e) {return permissionCredentialIssue;} // CourseCompletionV1.0
        else if(credentialType == 0x4b80) {return permissionCredentialIssue;} // CourseCompletionV1.1
        else if(credentialType == 0xf2dc) {return permissionCredentialIssue;} // CourseRegistrationV1.0
        else if(credentialType == 0x955b) {return permissionCredentialIssue;} // CourseRegistrationV1.1
        else if(credentialType == 0x7516) {return permissionCredentialIssue;} // CurrentEmploymentPosition
        else if(credentialType == 0xeea2) {return permissionCredentialIdentityIssue;} // DriversLicenseV1.0
        else if(credentialType == 0xb89f) {return permissionCredentialIssue;} // EducationDegree
        else if(credentialType == 0x294a) {return permissionCredentialIssue;} // EducationDegreeGraduationV1.0
        else if(credentialType == 0x8642) {return permissionCredentialIssue;} // EducationDegreeGraduationV1.1
        else if(credentialType == 0x9b9f) {return permissionCredentialIssue;} // EducationDegreeRegistrationV1.0
        else if(credentialType == 0x5ab6) {return permissionCredentialIssue;} // EducationDegreeRegistrationV1.1
        else if(credentialType == 0xb139) {return permissionCredentialIssue;} // EducationDegreeStudyV1.0
        else if(credentialType == 0xa214) {return permissionCredentialIssue;} // EducationDegreeStudyV1.1
        else if(credentialType == 0x969c) {return permissionCredentialContactIssue;} // Email
        else if(credentialType == 0x8f07) {return permissionCredentialContactIssue;} // EmailV1.0
        else if(credentialType == 0x764c) {return permissionCredentialIssue;} // EmploymentCurrentV1.0
        else if(credentialType == 0xdb4c) {return permissionCredentialIssue;} // EmploymentCurrentV1.1
        else if(credentialType == 0x7e15) {return permissionCredentialIssue;} // EmploymentPastV1.0
        else if(credentialType == 0xf4aa) {return permissionCredentialIssue;} // EmploymentPastV1.1
        else if(credentialType == 0x851f) {return permissionCredentialIdentityIssue;} // IdDocument
        else if(credentialType == 0xfeab) {return permissionCredentialIdentityIssue;} // IdDocumentV1.0
        else if(credentialType == 0xefca) {return permissionCredentialIssue;} // LicenseV1.0
        else if(credentialType == 0xd8ae) {return permissionCredentialIssue;} // LicenseV1.1
        else if(credentialType == 0xdeef) {return permissionCredentialIdentityIssue;} // NationalIdCardV1.0
        else if(credentialType == 0x2936) {return permissionCredentialIssue;} // OpenBadgeCredential
        else if(credentialType == 0x86bf) {return permissionCredentialIssue;} // OpenBadgeV1.0
        else if(credentialType == 0x5b0e) {return permissionCredentialIssue;} // OpenBadgeV2.0
        else if(credentialType == 0x7b17) {return permissionCredentialIdentityIssue;} // PassportV1.0
        else if(credentialType == 0x29d2) {return permissionCredentialIssue;} // PastEmploymentPosition
        else if(credentialType == 0x63dc) {return permissionCredentialContactIssue;} // Phone
        else if(credentialType == 0x4ffb) {return permissionCredentialContactIssue;} // PhoneV1.0
        else if(credentialType == 0xf052) {return permissionCredentialIssue;} // ProofOfAgeV1.0
        else if(credentialType == 0xa004) {return permissionCredentialIdentityIssue;} // ResidentPermitV1.0
        return "";
    }

    function checkOperatorPermission(address operator, string memory permission) public view returns (address) {
        require(!isEqual(permission, ""), "Permissions: permission may not be empty");
        address primary = checkOperator(operator);
        require(checkAddressScope(primary, permission), "Permissions: primary of operator lacks requested permission");
        return primary;
    }

    function isEqual(string memory a, string memory b) public pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
    }
}
