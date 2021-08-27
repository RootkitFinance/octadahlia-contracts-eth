// SPDX-License-Identifier: I-I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./SafeSubtraction.sol";
import "./LiquidityLockedERC20.sol";
import "./Interfaces/IERC20.sol";
import "./Interfaces/IUniswapV2Factory.sol";
import "./Interfaces/IUniswapV2Pair.sol";
import "./Interfaces/ITimeBeacon.sol";
import "./Interfaces/IOctaDahlia.sol"; 
import "./Interfaces/ITimeRift.sol";

contract OctaDahlia is LiquidityLockedERC20 {

    using SafeSubtraction for uint256;

    IUniswapV2Pair public pair;
    address private rift;

    uint256 public burnRate = 13.21; // 13.21 % burn + 3.21% fees, fee is high to cover gas cost of balance function

    constructor() {
        rift = msg.sender;
    }

    function balanceAdjustment(bool increase, uint256 _amount, address _account) external {
        require (msg.sender == rift);
        if (increase) {
            _mint(_account, _amount);
        }
        else {
            _burn(_account, _amount);
        }
    }

    function alignPrices() public virtual override {
        require (msg.sender == rift);
        liquidityPairLocked[pair] = false;
        uint256 pairBalance = _balanceOf[address(pair)];
        uint256 neededInPool = totalSupply - pairBalance;
        if (neededInPool > pairBalance) {
            _mint(address(pair), neededInPool - pairBalance);
        }
        else if (pairBalance > neededInPool){
            _burn(address(pair), (pairBalance - neededInPool));
        }
        pair.sync();
        liquidityPairLocked[pair] = true;
    }

    // set up functions
    function setUp(IUniswapV2Pair _pair, address dev6, address dev9) external override returns(address) {
        require (ownerCount == 0);
        pair = _pair;
        setInitialOwners(address(tx.origin), dev6, dev9);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal override virtual {
        require (amount < totalSupply / 100);

        (uint256 dynamicBurnModifier, bool poolBalanceHigher ) = dynamicBurnRate();
        bool fromPair = sender == address(pair) ? true : false;
        bool toPair = recipient == address(pair) ? true : false;

        if (!fromPair && !toPair) {
            amount = _burnAndFees(sender, amount, burnRate);
        }

        if (toPair) {
            if (poolBalanceHigher) {
                amount = _burnAndFees(sender, amount, burnRate + dynamicBurnModifier);
            }
            else {
                dynamicBurnModifier = dynamicBurnModifier + 100 > burnRate ? 100 : burnRate - dynamicBurnModifier;
                amount = _burnAndFees(sender, amount, burnRate + dynamicBurnModifier);
            }
        }

        _balanceOf[sender] = _balanceOf[sender].sub(amount, "OcDa: low balance");
        _balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
        if (fromPair) {
             if (poolBalanceHigher) {
                dynamicBurnModifier = dynamicBurnModifier + 100 > burnRate ? 100 : burnRate - dynamicBurnModifier;
                amount = _burnAndFees(sender, amount, burnRate + dynamicBurnModifier);
            }
            else {
                amount = _burnAndFees(sender, amount, burnRate + dynamicBurnModifier);
            }
        }
    }

    function _burnAndFees(address account, uint256 amount, uint256 burnPercent) internal returns(uint256) {
        uint256 burnAmount = amount * burnPercent / 10000;
        uint256 fees = amount * 321 / 10000;
        _balanceOf[account] = _balanceOf[account].sub(burnAmount + fees);
        totalSupply -= burnAmount;
        _balanceOf[rift] += fees;
        emit Transfer(account, address(0), burnAmount);
        emit Transfer(account, rift, fees);
        return (amount - burnAmount - fees);
    }

    function dynamicBurnRate() internal view returns(uint256, bool poolBalanceHigher) {
        uint256 pairBalance = _balanceOf[address(pair)];
        uint256 circSupply = totalSupply - pairBalance;
        uint256 dif;
        if (circSupply > pairBalance) {
            dif = circSupply - pairBalance;
            return (dif * 10000 / circSupply, false);
        }
        else if (pairBalance > circSupply){
            dif = pairBalance - circSupply;
            return (dif * 10000 / circSupply, true);
        }
    }

    function updateNameAndTicker(string memory _name, string memory _symbol) public {
        require (msg.sender == rift);
        name = _name;
        symbol = _symbol;
    }

    function recoverTokens(IERC20 token) public ownerSOnly() {
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }
}