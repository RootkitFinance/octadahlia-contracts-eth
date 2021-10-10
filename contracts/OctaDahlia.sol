// SPDX-License-Identifier: I-I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./SafeSubtraction.sol";
import "./MultiOwned.sol";
import "./LiquidityLockedERC20.sol";
import "./Interfaces/IERC20.sol";
import "./Interfaces/IUniswapV2Pair.sol";
import "./Interfaces/IOctaDahlia.sol"; 

import "hardhat/console.sol";

contract OctaDahlia is LiquidityLockedERC20, MultiOwned, IOctaDahlia {

    using SafeSubtraction for uint256;

    IUniswapV2Pair public pair;
    IERC20 public pairedToken;
    address public rift;
    address public mge;
    bool private isToken0;

    uint256 public burnRate = 1321; // 13.21 % burn + 3.21% system fees

    constructor() {
        rift = msg.sender; // remove if not launched by the Time Rift Contract, gives mint power
    }

    function balanceAdjustment(bool increase, uint256 _amount, address _account) external override {
        require (msg.sender == rift || msg.sender == mge);
        if (increase) {
            _mint(_account, _amount);
        }
        else {
            _burn(_account, _amount);
        }
    }

    function alignPrices() public virtual override returns (uint256){
        require (msg.sender == rift || msg.sender == mge);
        liquidityPairLocked[pair] = false;
        uint256 pendingFees = _balanceOf[rift];
        console.log('pendingFees:', pendingFees);

        uint256 out1 = getAmountOut(pendingFees);
        console.log('getAmountOut:', out1);

        uint256 out0 = 0;
        _burn(rift, pendingFees);
        _mint(address(pair), pendingFees);
        if (!isToken0) {
            out0 = out1;
            out1 = 0;
        }
        address to = mge == address(0) ? rift : mge;
        pair.swap(out0 , out1 , to, new bytes(0));

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
        return isToken0 ? out1 : out0;
    }
 
    // set up functions
    function setUp(IUniswapV2Pair _pair, address dev6, address dev9, address _mge, bool _dictator) external override {
        require (ownerCount == 0);
        pair = _pair;
        isToken0 = pair.token0() == address(this);
        pairedToken = isToken0 ? IERC20(pair.token1()) : IERC20(pair.token0());
        mge = _mge;
        dictator = _dictator;
        address owner1 = _mge == address(0) ? address(tx.origin) : _mge;
        setInitialOwners(owner1, dev6, dev9);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal override virtual {       
        (uint256 dynamicBurnModifier, bool poolPriceHigher) = dynamicBurnRate();
        bool buy = sender == address(pair);
        bool sell = recipient == address(pair);

        if (!buy && !sell) {
            amount = _burnAndFees(sender, amount, burnRate);
        }

        if (sell) {
            if (poolPriceHigher) {
                amount = _burnAndFees(sender, amount, burnRate + dynamicBurnModifier);
            }
            else {
                dynamicBurnModifier = dynamicBurnModifier + 100 > burnRate ? 100 : burnRate - dynamicBurnModifier;
                amount = _burnAndFees(sender, amount, dynamicBurnModifier);
            }
        }

        _balanceOf[sender] = _balanceOf[sender].sub(amount, "OcDa: low balance");
        _balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
        
        if (buy) {
            require (amount < totalSupply / 100);
            if (poolPriceHigher) {
                dynamicBurnModifier = dynamicBurnModifier + 100 > burnRate ? 100 : burnRate - dynamicBurnModifier;
                _burnAndFees(recipient, amount, dynamicBurnModifier);
            }
            else {
                _burnAndFees(recipient, amount, burnRate + dynamicBurnModifier);
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

    function dynamicBurnRate() internal view returns(uint256, bool) {
        uint256 pairBalance = _balanceOf[address(pair)];
        uint256 circSupply = totalSupply - pairBalance;
        uint256 dif;
        if (circSupply > pairBalance) {
            dif = circSupply - pairBalance;
            return (dif * 9970 / circSupply, true);
        }
        else {
            dif = pairBalance - circSupply;
            return (dif * 9970 / circSupply, false);
        }
    }

    function getAmountOut(uint amountIn) internal view returns (uint amountOut) {
        uint amountInWithFee = amountIn * 997;
        uint numerator = amountInWithFee * pairedToken.balanceOf(address(pair));
        uint denominator = _balanceOf[address(pair)] * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function recoverTokens(IERC20 token) public ownerSOnly() {
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }

    // up to 9 friends can receive a cut of fees, controlled by the owner with index spot 1.
    // up to 9 owners also receive fees, each owner slot is under the control of itself if
    // the dictator bool is false. If dictator bool is true, owner 1 controls all 18 spots.
    uint256 public override friendCount;
    mapping (uint256 => address) public override friends;

    function addOrChangeFriends(uint256 indexSpot, address friend) public virtual ownerOnly(){
        require (indexSpot <= 9);
        if (friends[indexSpot] == address(0)){
            friendCount++;
        }
        friends[indexSpot] = friend;
    }
}