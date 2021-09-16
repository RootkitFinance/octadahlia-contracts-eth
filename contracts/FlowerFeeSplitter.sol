// SPDX-License-Identifier: I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./Interfaces/IMultiOwned.sol";
import "./Interfaces/IFlowerFeeSplitter.sol";
import "./Interfaces/IERC20.sol";
import "./MultiOwned.sol";

contract FlowerFeeSplitter is MultiOwned, IFlowerFeeSplitter {

    mapping (address => IERC20) public pairedTokens; // flower => paired
    mapping (address => uint256) public collectedFees;

    function registerFlower(address flower, address pairedToken) ownerSOnly() public override {
        pairedTokens[flower] = IERC20(pairedToken);
    }

    function depositFees(address flower, uint256 amount) ownerSOnly() public override {       
        pairedTokens[flower].transferFrom(msg.sender, address(this), amount);
        collectedFees[flower] += amount;
    }

    function payFees(address flower) public override {
        IMultiOwned multiOwned = IMultiOwned(flower);
        uint256 ownerCount = multiOwned.ownerCount();
        uint256 share = collectedFees[flower]/ownerCount;
        IERC20 paired = pairedTokens[flower];

        for (uint256 i = 1; i <= ownerCount; i++) {
            paired.transfer(multiOwned.owners(i), share);
            collectedFees[flower] -= share;
        }
    }
}