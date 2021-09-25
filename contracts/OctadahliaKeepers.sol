// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@chainlink/contracts/src/v0.7/interfaces/KeeperCompatibleInterface.sol";
import "./Interfaces/ITimeRiftKeepers.sol";

contract OctaDahliaKeepers is KeeperCompatibleInterface {
    ITimeRiftKeepers public timeRift;
    uint256[] public lastData;
    
    constructor(ITimeRiftKeepers rift) {
      timeRift = rift;
    }

    function checkUpkeep(bytes calldata /* checkData */) external override returns (bool upkeepNeeded, bytes memory performData) {
        uint256[] memory data = timeRift.whoNeedsBalance();
        if(data.length > 0){
            
            uint256 check=0;
            for(uint256 i = 0; i < data.length; i++){
                if(data[i] != 0){
                    check++;
                }
            }
            
            uint256[] memory newData = new uint256[](check);
            uint256 filterArrayCount = 0;
            for(uint256 i = 0; i < data.length; i++){
                if(data[i] != 0){
                    newData[filterArrayCount] = data[i];
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
        uint256[] memory dat = abi.decode(performData, (uint256[]));
        timeRift.balancePrices(dat);
    }   
    
}