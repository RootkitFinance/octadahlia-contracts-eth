// SPDX-License-Identifier: I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./IMultiOwned.sol";
import "./IUniswapV2Pair.sol";

interface IOctaDahlia is IMultiOwned { 
    function alignPrices() external returns (uint256);
    function balanceAdjustment(bool increase, uint256 _amount, address _account) external;
    function setUp(IUniswapV2Pair _pair, address dev6, address dev9, address _mge, bool _dictator) external;
}