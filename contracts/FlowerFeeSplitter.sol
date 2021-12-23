// SPDX-License-Identifier: I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./IFlowerFeeSplitter.sol";
import "./IERC20.sol";
import "./IMultiOwned.sol";
import "./SafeSubtraction.sol";

contract FlowerFeeSplitter is IFlowerFeeSplitter {

    using SafeSubtraction for uint256;

    address public owner = msg.sender;
    mapping (address => IERC20) public pairedTokens; // flower => paired
    mapping (address => uint256) public collectedFees;
    mapping (address => bool) public controllers;

    address public rootFeeder;
    address public devFeeder;

    modifier ownerOnly() {
        require (msg.sender == owner, "Owner only");
        _;
    }
    
    constructor(address _rootFeeder, address _devFeeder) {
        rootFeeder = _rootFeeder;
        devFeeder = _devFeeder;
    }

    function setController(address controller, bool allow) public ownerOnly() {
        controllers[controller] = allow;
    }

    function registerFlower(address flower, address pairedToken) public override {
        require (controllers[msg.sender] || msg.sender == owner, "Not an owner or controller");
        pairedTokens[flower] = IERC20(pairedToken);
    }

    function depositFees(address flower, uint256 amount) public override {
        require (controllers[msg.sender] || msg.sender == owner, "Not an owner or controller");
        pairedTokens[flower].transferFrom(msg.sender, address(this), amount);
        collectedFees[flower] += amount;
    }

    function payFees(address flower) public override {
        uint256 share = collectedFees[flower] / 3 * 2;

        IMultiOwned dahlia = IMultiOwned(flower);
        uint256 ownerCount = dahlia.ownerCount();
        uint256 ownerShare = share / 100 / ownerCount * 100;
        IERC20 paired = pairedTokens[flower];

        for (uint256 i = 1; i <= ownerCount; i++) {
            paired.transfer(dahlia.owners(i), ownerShare);
        }

        collectedFees[flower] = collectedFees[flower].sub(share);
        
        share = collectedFees[flower] / 30 * 20;
        paired.transfer(rootFeeder, share);
        paired.transfer(devFeeder, share / 2);
        collectedFees[flower] = 0;
    }
}