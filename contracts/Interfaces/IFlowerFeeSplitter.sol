// SPDX-License-Identifier: I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

interface IFlowerFeeSplitter {
    function registerFlower(address flower, address pairedToken) external;
    function depositFees(address flower, uint256 amount) external;
    function payFees(address flower) external;    
}