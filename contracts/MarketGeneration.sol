// SPDX-License-Identifier: I-N-N-N-NFINITY!!!
pragma solidity ^0.7.6;

import "./Interfaces/IUniswapV2Router02.sol";
import "./Interfaces/IERC20.sol";
import "./Interfaces/ITimeRift.sol";
import "./SafeSubtraction.sol";

contract MarketGeneration {
    using SafeSubtraction for uint256;

    address public owner = msg.sender;
    
    mapping (address => uint256) public contribution;
    mapping (address => bool) public claimed;

    uint256 public totalContribution;
    uint256 public startingSupply;

    bool public isActive;
    bool public distributionComplete;

    IERC20 public immutable pairedToken;
    IERC20 public octaDahlia;
    IUniswapV2Router02 immutable public uniswapV2Router;
    ITimeRift immutable public timeRift;

    uint256 public totalHardCap;
    uint256 public individualHardCap;

    constructor(IERC20 _pairedToken, IUniswapV2Router02 _uniswapV2Router, ITimeRift _timeRift) {   
        pairedToken = _pairedToken;
        uniswapV2Router = _uniswapV2Router;
        timeRift = _timeRift;
    }

    modifier ownerOnly() {
        require (msg.sender == owner, "Owner only");
        _;
    }

    modifier active() {
        require (isActive, "Distribution not active");
        _;
    }

    function setHardCap(uint256 _totalHardCap, uint256 _individualHardCap) public ownerOnly() {
        totalHardCap = _totalHardCap;
        individualHardCap = _individualHardCap;
    }

    function activate() public ownerOnly() {
        require (!isActive, "Already activated");
        isActive = true;
    }

    function complete(uint256 octaDalhiaPerPaired) public ownerOnly() active() { // if octaDalhiaPerPaired is 100, 100 octaDalhias are minted per 1 paired token
        isActive = false;
        if (totalContribution == 0) { return; }
        
        startingSupply = totalContribution * octaDalhiaPerPaired;
        pairedToken.approve(address(timeRift), totalContribution);
        octaDahlia = IERC20(timeRift.OctaDahliaGrowsBrighter(pairedToken, totalContribution, startingSupply));
        distributionComplete = true;
    }

    function claim() public {
        require (distributionComplete, "Distribution is not completed");

        address account = msg.sender;
        uint256 amount = contribution[account];

        require (amount > 0, "Nothing to claim");
        require (!claimed[account], "Already claimed");

        octaDahlia.transfer(account, getTotalClaim(account));
        claimed[account] = true;
    }

    function contribute(uint256 amount) private {       
        contribution[msg.sender] += amount;
        totalContribution += amount;

        require(totalHardCap == 0 || totalContribution < totalHardCap, "Total hard cap reached");
        require(individualHardCap == 0 || contribution[msg.sender] < individualHardCap, "Individual hard cap reached");
    }

    function contributePairedToken(uint256 amount) public active()  {
        pairedToken.transferFrom(msg.sender, address(this), amount);
        contribute(amount);
    }

    function contributeEth() public payable active() {
        address[] memory path = new address[](2);
        path[0] = uniswapV2Router.WETH();
        path[1] = address(pairedToken);
        uint256[] memory amounts = uniswapV2Router.swapExactETHForTokens{ value: msg.value }(0, path, address(this), block.timestamp);
        contribute(amounts[1]);
    }

    receive() external payable active() {
        contributeEth();
    }

    function getTotalClaim(address account) public view returns (uint256) {
        uint256 accountContribution = contribution[account];
        return accountContribution == 0 ? 0 : accountContribution * startingSupply / totalContribution;
    }
}