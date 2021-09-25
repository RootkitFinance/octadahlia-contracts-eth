// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@chainlink/contracts/src/v0.7/interfaces/KeeperCompatibleInterface.sol";
import "./Interfaces/ITimeRiftKeepers.sol";

contract OctaDahliaKeepers is KeeperCompatibleInterface {
    ITimeRiftKeepers public timeRift;
    
    constructor(ITimeRiftKeepers rift) {
      timeRift = rift;
    }

    function checkUpkeep(bytes calldata /* checkData */) external override returns (bool upkeepNeeded, bytes memory performData) {
        uint256[] memory whoNeedsBalance = timeRift.whoNeedsBalance();
        if(whoNeedsBalance.length > 0){
            
            uint256 check = 0;
            for(uint256 i = 0; i < whoNeedsBalance.length; i++){
                if(whoNeedsBalance[i] != 0){
                    check++;
                }
            }
            
            uint256[] memory newData = new uint256[](check);
            uint256 filterArrayCount = 0;
            for(uint256 i = 0; i < whoNeedsBalance.length; i++){
                if(whoNeedsBalance[i] != 0){
                    newData[filterArrayCount] = whoNeedsBalance[i];
                    filterArrayCount++;                    
                }
            }
            
            if(newData.length > 0){
                upkeepNeeded = true;
                performData = abi.encode(newData);
            }
        }
        else{
            upkeepNeeded = false;
        }
    }

    function performUpkeep(bytes calldata performData) external override {
        uint256[] memory noncesToBalance = abi.decode(performData, (uint256[]));
        timeRift.balancePrices(noncesToBalance);
    }   
    
}