// SPDX-License-Identifier: I-I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./SafeSubtraction.sol";
import "./MultiOwned.sol";
import "./ERC20.sol";
import "./IUniswapV2Pair.sol";
import "./IOctaDahlia.sol"; 

contract OctaDahlia is ERC20, MultiOwned, IOctaDahlia {

    using SafeSubtraction for uint256;

    IUniswapV2Pair public pair;
    IERC20 public pairedToken;
    address public rift;
    address public mge;
    bool private isToken0;

    uint256 public burnRate;
    uint256 public maxBuyPercent;

    // to prevent liq removal
    uint256 public lpTotalSupply;

    // for Rootflection
    uint256 public totalPaid;
    mapping (address => uint256) public paid;

    constructor() {
        rift = msg.sender; // remove if not launched by the Time Rift Contract, gives mint power
    }

    function getPrices() public view returns (uint256, uint256) {
        uint256 circSupply = totalSupply - _balanceOf[address(pair)];
        uint256 reserves = pairedToken.balanceOf(address(pair));
        uint256 price1 =  circSupply * 1e12 / reserves;
        uint256 price2 = reserves * 1e12 / circSupply;
        return (price1, price2);
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
        uint256 pendingFees = _balanceOf[rift] - (_balanceOf[rift] * burnRate / 10000);
        uint256 out1 = getAmountOut(pendingFees);
        uint256 out0 = 0;

        _burn(rift, _balanceOf[rift]);
        _mint(address(pair), pendingFees);
        if (!isToken0) {
            out0 = out1;
            out1 = 0;
        }
        address to = mge == address(0) ? rift : mge;
        pair.swap(out0, out1, to, new bytes(0));

        uint256 pairBalance = _balanceOf[address(pair)];
        uint256 neededInPool = totalSupply - pairBalance;
        if (neededInPool > pairBalance) {
            _mint(address(pair), neededInPool - pairBalance);
        }
        else if (pairBalance > neededInPool){
            _burn(address(pair), (pairBalance - neededInPool));
        }
        pair.sync();
        return isToken0 ? out1 : out0;
    }
 
    // set up functions
    function setUp(IUniswapV2Pair _pair, address _mge, bool _dictator, uint256 _burnRate, uint256 _maxBuyPercent) external {
        require (ownerCount == 0);
        pair = _pair;
        isToken0 = pair.token0() == address(this);
        pairedToken = isToken0 ? IERC20(pair.token1()) : IERC20(pair.token0());
        mge = _mge;
        dictator = _dictator;
        burnRate = _burnRate;
        maxBuyPercent = _maxBuyPercent;
        address owner = _mge == address(0) ? address(tx.origin) : _mge;
        setInitialOwner(owner);
    }

    function pendingReward(address account) public view returns (uint256) {
        uint256 accountRewards = (_balanceOf[address(this)] + totalPaid) * (_balanceOf[account]) * (1e18) / (totalSupply - _balanceOf[address(pair)]) / (1e18);
        uint256 alreadyPaid = paid[account];
        return accountRewards > alreadyPaid ? accountRewards - alreadyPaid : 0;
    }

    function balanceOf(address account) public override view returns (uint256) {
        return _balanceOf[account] + pendingReward(account);
    }

    function _transfer(address sender, address recipient, uint256 amount) internal override virtual {
        uint256 ROOTflectionSender = pendingReward(sender);
        uint256 ROOTflectionReceivier = pendingReward(recipient);
        bool buy = sender == address(pair);
        bool sell = recipient == address(pair);

        if (ROOTflectionSender > 0 && !buy) {
            _balanceOf[address(this)] -= ROOTflectionSender;
            _balanceOf[sender] += ROOTflectionSender;
            paid[sender] += ROOTflectionSender;
            totalPaid += ROOTflectionSender;
            emit Transfer(address(this), sender, ROOTflectionSender);
        }

        if (ROOTflectionReceivier > 0 && !sell) {
            _balanceOf[address(this)] -= ROOTflectionReceivier;
            _balanceOf[recipient] += ROOTflectionReceivier;
            paid[recipient] += ROOTflectionReceivier;
            totalPaid += ROOTflectionReceivier;
            emit Transfer(address(this), recipient, ROOTflectionReceivier);
        }
        (uint256 dynamicBurnModifier, bool poolPriceHigher) = dynamicBurnRate();
        
        

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
            require (amount < totalSupply * maxBuyPercent / 10000);
            if (poolPriceHigher) {
                dynamicBurnModifier = dynamicBurnModifier + 100 > burnRate ? 100 : burnRate - dynamicBurnModifier;
                _burnAndFees(recipient, amount, dynamicBurnModifier);
            }
            else {
                _burnAndFees(recipient, amount, burnRate + dynamicBurnModifier);
            }
        }
        uint _lpTotalSupply = pair.totalSupply();
        require (_lpTotalSupply >= lpTotalSupply);
        lpTotalSupply = _lpTotalSupply;
    }

    function _burnAndFees(address account, uint256 amount, uint256 burnPercent) internal returns(uint256) {
        uint256 burnAmount = amount * burnPercent / 10000;
        uint256 fees = amount * 246 / 10000;
        _balanceOf[account] = _balanceOf[account].sub(burnAmount + fees);
        totalSupply = totalSupply - burnAmount + fees;
        _balanceOf[rift] += fees;
        _balanceOf[address(this)] += fees;
        emit Transfer(account, address(this), fees);
        emit Transfer(account, address(0), burnAmount - fees);
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
        require (address(token) != address(this) && address(token) != address(pairedToken));
        token.transfer(msg.sender, token.balanceOf(address(this)));
    }
}