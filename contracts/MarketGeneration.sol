// SPDX-License-Identifier: I-N-N-N-NFINITY!!!
pragma solidity ^0.7.6;

import "./Interfaces/IWETH.sol";
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
    ITimeRift immutable public timeRift;

    uint256 public totalHardCap;
    uint256 public individualHardCap;

    constructor(IERC20 _pairedToken, ITimeRift _timeRift) {   
        pairedToken = _pairedToken;
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
        
        uint256 balance = address(this).balance;
        IWETH(address(pairedToken)).deposit{ value: balance }();
        startingSupply = balance * octaDalhiaPerPaired;
        pairedToken.approve(address(timeRift), uint256(-1));
        octaDahlia = IERC20(timeRift.OctaDahliaGrowsBrighter(pairedToken, balance, startingSupply));
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

    function contribute() public payable active() {
        uint256 amount = msg.value;
        contribution[msg.sender] += amount;
        totalContribution += amount;

        require(totalHardCap == 0 || totalContribution < totalHardCap, "Total hard cap reached");
        require(individualHardCap == 0 || contribution[msg.sender] < individualHardCap, "Individual hard cap reached");
    }    

    receive() external payable active() {
        contribute();
    }

    function getTotalClaim(address account) public view returns (uint256) {
        uint256 accountContribution = contribution[account];
        return accountContribution == 0 ? 0 : accountContribution * startingSupply / totalContribution;
    }
}