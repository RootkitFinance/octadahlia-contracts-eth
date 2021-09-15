// SPDX-License-Identifier: I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./Interfaces/IMultiOwned.sol";
import "./Interfaces/IFlowerFeeSplitter.sol";
import "./Interfaces/IERC20.sol";

contract FlowerFeeSplitter is IFlowerFeeSplitter {

    mapping (address => address) public pairedTokens; // flower => paired
    mapping (address => uint256) public collectedFees;

    function registerFlower(address flower, address pairedToken) public override {
        pairedTokens[flower] = pairedToken;
    }

    function depositFees(address flower, uint256 amount) public override {
        collectedFees[flower] += amount;
    }

    function payFees(address flower) public override {
        IMultiOwned multiOwned = IMultiOwned(flower);
        uint256 ownerCount = multiOwned.ownerCount();
        uint256 share = collectedFees[flower]/ownerCount;
        IERC20 paired = IERC20( pairedTokens[flower]);

        for (uint256 i = 1; i <= ownerCount; i++) {
            paired.transfer(multiOwned.owners(i), share);
        }

        collectedFees[flower] = 0;
    }
}