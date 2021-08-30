// SPDX-License-Identifier: I-I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;


import "../ERC20.sol";

contract ERC20Test is ERC20 { 
    constructor() {
        _mint(msg.sender, 100 ether);
    }
}