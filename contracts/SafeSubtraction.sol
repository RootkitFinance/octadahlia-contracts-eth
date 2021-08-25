// SPDX-License-Identifier: I-I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

library SafeSubtraction {
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;
        return c;
    }
}