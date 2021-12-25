// SPDX-License-Identifier: I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./IERC20.sol";

interface IMultiOwned {
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    function setInitialOwner(address owner) external;
    function addExtraOwners(uint256 indexSpot, address newOwner) external;
    function ownerCount() external view returns (uint256);
    function owners(uint256) external view returns (address);
    function ownerIndex(address) external view returns (uint256);
    function transferOwnership(address newOwner) external;
    function claimOwnership() external;
    function isOwner(address owner) external view returns (bool);
}