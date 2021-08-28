// SPDX-License-Identifier: I-N-N-N-NFINITY!!!
pragma solidity ^0.7.6;

import "./Interfaces/IMultiOwned.sol";

abstract contract MultiOwned is IMultiOwned {

    uint256 public override ownerCount; // 3 to start, up to 6 more, 9 in total

    mapping (uint256 => address) public override owners;
    mapping (address => uint256) public override ownerIndex; 
    address public pendingOwner;

    modifier ownerSOnly() {
        require (ownerIndex[msg.sender] != 0, "Owners only");
        _;
    }

    modifier ownerOnly() {
        require (ownerIndex[msg.sender] == 1, "Owners only");
        _;
    }

    function isOwner(address owner) public virtual override view returns (bool){
        return ownerIndex[owner] != 0;
    }

    function transferOwnership(address newOwner) public virtual override ownerSOnly() {
        uint256 index = ownerIndex[msg.sender];
        if (index == 1) {
            pendingOwner = newOwner;
        }
        else {
            address oldOwner =  owners[index];
            require (msg.sender == oldOwner);
            ownerIndex[oldOwner] = 0;
            require (ownerIndex[newOwner] == 0);
            owners[index] = newOwner;
            ownerIndex[newOwner] = index;
            emit OwnershipTransferred(oldOwner, newOwner);
        }
        
    }

    function claimOwnership() public virtual override {
        require (pendingOwner == msg.sender);
        address oldOwner =  owners[1];
        ownerIndex[oldOwner] = 0;
        ownerIndex[msg.sender] = 1;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, msg.sender);
        owners[1] = msg.sender;
    }

    function setInitialOwners(address owner1, address owner2, address owner3) public virtual override {
        require (ownerCount == 0);
        owners[1] = owner1;
         ownerIndex[owner1] = 1;
        owners[2] = owner2;
         ownerIndex[owner2] = 2;
        owners[3] = owner3;
         ownerIndex[owner3] = 3;
        ownerCount = 3;
    }

    function addExtraOwners(uint256 indexSpot, address newOwner) public virtual override ownerOnly(){
        require (owners[indexSpot] == address(0));
        ownerCount++;
        require (ownerCount <= 9);
        owners[indexSpot] = newOwner;
        ownerIndex[newOwner] = indexSpot;
    }
}