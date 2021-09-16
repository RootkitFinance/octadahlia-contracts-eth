// SPDX-License-Identifier: I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./IERC20.sol";
import "./IUniswapV2Factory.sol";
import "./IMultiOwned.sol";
import "./IUniswapV2Pair.sol";

interface IOctaDahlia is IMultiOwned { 
    function alignPrices() external returns (uint256);
    function balanceAdjustment(bool increase, uint256 _amount, address _account) external;
    //function getPrice()external view returns (uint256);
    //function getPoolPrice() external view returns (uint256);
    //function distributeFees() external;
    //function setUp(IERC20 _pairedToken, IUniswapV2Factory _uniswapFactory) external returns(address);
    function setUp(IUniswapV2Pair _pair, address dev6, address dev9, address _mge, bool _dictator) external;
   // function setSisterTokens(IOctaDahlia _twin, IERC20 _bigSister, IERC20 _littleSister, bool activateTrading ,bool secureIt) external;
    function friendCount() external view returns (uint256);
    function friends(uint256) external view returns (address);
}