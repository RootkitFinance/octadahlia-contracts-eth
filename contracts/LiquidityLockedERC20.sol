// SPDX-License-Identifier: U-U-U-UPPPPP!!!
pragma solidity ^0.7.4;

import "./ERC20.sol";
import "./Interfaces/IUniswapV2Pair.sol";

abstract contract LiquidityLockedERC20 is ERC20 {
    mapping (IUniswapV2Pair => bool) public liquidityPairLocked;


    struct CallRecord {
        address origin;
        uint32 blockNumber;
        bool transferFrom;
    }

    CallRecord balanceAllowed;

    function balanceOf(address account) public override view returns (uint256) {
        IUniswapV2Pair pair = IUniswapV2Pair(address(msg.sender));
        if (liquidityPairLocked[pair]) {
            CallRecord memory last = balanceAllowed;
            require (last.origin == tx.origin && last.blockNumber == block.number, "Liquidity is locked");
            if (last.transferFrom) {
                (uint256 reserve0, uint256 reserve1,) = pair.getReserves();
                IERC20 token0 = IERC20(pair.token0());
                if (address(token0) == address(this)) {
                    require (IERC20(pair.token1()).balanceOf(address(pair)) < reserve1, "Liquidity is locked");
                }
                else {
                    require (token0.balanceOf(address(pair)) < reserve0, "Liquidity is locked"); 
                }
            }
        }
        return super.balanceOf(account);
    }

    function allowBalance(bool _transferFrom) private {
        CallRecord memory last = balanceAllowed;
        CallRecord memory allow = CallRecord({ 
            origin: tx.origin,
            blockNumber: uint32(block.number),
            transferFrom: _transferFrom
        });
        require (last.origin != allow.origin || last.blockNumber != allow.blockNumber || last.transferFrom != allow.transferFrom, "Liquidity is locked (Please try again next block)");
        balanceAllowed = allow;
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        if (liquidityPairLocked[IUniswapV2Pair(address(msg.sender))]) {
            allowBalance(false);
        }
        else {
            balanceAllowed = CallRecord({ origin: address(0), blockNumber: 0, transferFrom: false });
        }
        return super.transfer(recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        if (liquidityPairLocked[IUniswapV2Pair(recipient)]) {
            allowBalance(true);
        }
        else {
            balanceAllowed = CallRecord({ origin: address(0), blockNumber: 0, transferFrom: false });
        }
        return super.transferFrom(sender, recipient, amount);
    }
}