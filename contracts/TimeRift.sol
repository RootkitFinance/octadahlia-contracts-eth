// SPDX-License-Identifier: I-I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./OctaDahlia.sol";

contract TimeRift is MultiOwned {

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
        pairedToken.transferFrom(msg.sender, address(pool), startingLiquidity);
        Dahlia.balanceAdjustment(true, startingTokenSupply, msg.sender);
        pool.mint(address(this));
        Dahlia.setUp(pool, dev6, dev9);
        return address(Dahlia);
    }

    function balancePrices(uint256[] calldata noncesToBalance) public ownerSOnly() {
        uint256 safeLength = noncesToBalance.length;
        for (uint i = 0; i < safeLength; i++) {
            OctaDahlia(nonces[noncesToBalance[i]]).alignPrices();
        }
    }

    function whoNeedsBalance() public view returns (uint256[] memory) {
        uint256[] memory toBalance;
        OctaDahlia dahlia;
        uint256 poolBalance;
        uint256 trueSupply;
        uint256 dif;
        for (uint i = 0; i <= lastNonce; i++) {
            dahlia = nonces[i];
            poolBalance = dahlia.balanceOf(address(pools[address(dahlia)]));
            trueSupply = dahlia.totalSupply() - poolBalance;
            dif = trueSupply > poolBalance ? trueSupply - poolBalance : poolBalance - trueSupply;
            if (dif * 10000 / trueSupply > 1321) {
                toBalance[toBalance.length] = i;
            }
        }
        return toBalance;
    }

    function recoverTokens(IERC20 token) public ownerSOnly() {
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }
}