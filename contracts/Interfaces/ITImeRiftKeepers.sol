// SPDX-License-Identifier: I-I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./IERC20.sol";

interface ITimeRiftKeepers {
    function OctaDahliaGrowsBrighter(IERC20 pairedToken, uint256 startingLiquidity, uint256 startingTokenSupply, bool dictate) external returns (address);
    function whoNeedsBalance() external returns (uint256[] memory);
    function balancePrices(uint256[] memory noncesToBalance) external;
}