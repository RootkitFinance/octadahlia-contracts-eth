// SPDX-License-Identifier: I-I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./../OctaDahlia/OctaDahlia.sol";

abstract contract TimeRift is MultiOwned{

    address private dev6;
    address private dev9;
    IUniswapV2Factory public uniswapFactory;

    uint256 public lastNonce;
    mapping (uint256 => OctaDahlia) public nonces; // nonce -> flower
    mapping (address => IUniswapV2Pair) public pools; // flower -> pool

    constructor(address _dev6, address _dev9, IUniswapV2Factory _uniswapFactory) { 
        dev6 = _dev6;
        dev9 = _dev9;
        uniswapFactory = _uniswapFactory;
    }

    function OctaDahliaGrowsBrighter(IERC20 pairedToken, uint256 startingLiquidity, uint256 startingTokenSupply) public returns (address) {
        OctaDahlia Dahlia = new OctaDahlia();
        lastNonce++;
        nonces[lastNonce] = Dahlia;
        IUniswapV2Pair pool = IUniswapV2Pair(uniswapFactory.createPair(address(Dahlia), address(pairedToken)));
        pools[address(Dahlia)] = pool;
        Dahlia.balanceAdjustment(true, startingTokenSupply, address(pool));
        pairedToken.transferFrom(address(msg.sender), address(pool), startingLiquidity);
        Dahlia.balanceAdjustment(true, startingTokenSupply, address(pool));

        return address(Dahlia);
    }


    function balancePrices(address[] calldata noncesToBalance) public ownerSOnly(){
            uint256 safeLength = noncesToBalance.length;
            for (uint i = 0; i < lastNonce; i++) {

        }
    }

    function balanceMarket(uint256 _nonce) internal {

    }

    function whoNeedsBalance() public view returns (uint256[] memory) {
        uint256[] memory toBalance;
        OctaDahlia dahlia;
        uint256 poolBalance;
        uint256 trueSupply;
        uint256 dif;
        for (uint i = 1; i <= lastNonce; i++) {
            dahlia = nonces[i];
            poolBalance = dahlia.balanceOf(address(pools[address(dahlia)]));
            trueSupply = dahlia.totalSupply() - poolBalance;
            dif = trueSupply > poolBalance ? trueSupply - poolBalance : poolBalance - trueSupply;
            if (dif * 10000 / trueSupply > 1420) {
                toBalance[toBalance.length + 1] = i;
            }
        }
        return toBalance;
    }

    //function balanceCheck(uint256 _nonce) internal returns (bool) {

    //}




    /*
    function getPoolPrice() public view override returns (uint256) {
         return ( _balanceOf[address(pair)] * 1e18 / pairedToken.balanceOf(address(pair)));
    }

    function getPrice() public view override returns (uint256) {
        return ((totalSupply - _balanceOf[address(pair)]) * 1e18 / 
            pairedToken.balanceOf(address(pair)) + pairedToken.balanceOf(address(this)));
    }
    */
}