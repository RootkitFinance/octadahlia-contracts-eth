// SPDX-License-Identifier: I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./Interfaces/IOctaDahlia.sol";
import "./Interfaces/IFlowerFeeSplitter.sol";
import "./Interfaces/IERC20.sol";
import "./MultiOwned.sol";

contract FlowerFeeSplitter is MultiOwned, IFlowerFeeSplitter {

    mapping (address => IERC20) public pairedTokens; // flower => paired
    mapping (address => uint256) public collectedFees;
    
    constructor() {
        dictator = true;
    }

    function registerFlower(address flower, address pairedToken) ownerSOnly() public override {
        pairedTokens[flower] = IERC20(pairedToken);
    }

    function depositFees(address flower, uint256 amount) ownerSOnly() public override {       
        pairedTokens[flower].transferFrom(msg.sender, address(this), amount);
        collectedFees[flower] += amount;
    }

    function payFees(address flower) public override {
        IOctaDahlia dahlia = IOctaDahlia(flower);
        uint256 ownerCount = dahlia.ownerCount();
        uint256 friendsCount = dahlia.friendCount();
        uint256 share = collectedFees[flower]/(ownerCount + friendsCount);
        IERC20 paired = pairedTokens[flower];

        for (uint256 i = 1; i <= ownerCount; i++) {
            paired.transfer(dahlia.owners(i), share);
            collectedFees[flower] -= share;
        }

        for (uint256 i = 1; i <= friendsCount; i++) {
            paired.transfer(dahlia.friends(i), share);
            collectedFees[flower] -= share;
        }
    }
}