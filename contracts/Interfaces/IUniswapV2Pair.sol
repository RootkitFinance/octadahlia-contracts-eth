// SPDX-License-Identifier: I-N-N-N-NFINITY!!!
pragma solidity ^0.7.6;

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function mint(address to) external;
    function sync() external;
    function skim(address to) external;
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
    function balanceOf(address _account) external view returns (uint256);
    function transfer(address _recipient, uint256 _amount) external returns (bool);
    function approve(address _spender, uint256 _amount) external returns (bool);
}