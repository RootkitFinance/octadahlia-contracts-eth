// SPDX-License-Identifier: I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./IMultiOwned.sol";

interface IOctaDahlia is IMultiOwned { 
    function alignPrices() external returns (uint256);
    function balanceAdjustment(bool increase, uint256 _amount, address _account) external;
}