pragma solidity >=0.4.22 <0.9.0;

library SignatureVerification {
    function getMessageHash(
        bytes memory _payload
    ) private pure returns (bytes32) {
        return keccak256(_payload);
    }

    function splitSignature(
        bytes memory sig
    ) private pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }

    function recoverSigner(
        bytes memory _payload,
        bytes memory _signature
    ) internal pure returns (address) {
        bytes32 messageHash = getMessageHash(_payload);
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
        return ecrecover(messageHash, v, r, s);
    }
}
