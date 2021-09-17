// SPDX-License-Identifier: I-I-N-N-N-N-NFINITYYY!!
pragma solidity ^0.7.6;

import "./SafeSubtraction.sol";
import "./Interfaces/IERC20.sol"; 

abstract contract PairedToken is IERC20 {

    using SafeSubtraction for uint256;

    mapping (address => uint256) internal _balanceOf;
    mapping (address => mapping (address => uint256)) public override allowance; 

    uint256 public override totalSupply;

    string public override name = "pairedToken";
    string public override symbol = "pTok";
    uint8 public override decimals = 18;

    function balanceOf(address account) public virtual override view returns (uint256) { return _balanceOf[account]; }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        uint256 oldAllowance = allowance[sender][msg.sender];
        if (oldAllowance != uint256(-1)) {
            _approve(sender, msg.sender, oldAllowance.sub(amount, "ERC20: allow"));
        }
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual {
        _balanceOf[sender] = _balanceOf[sender].sub(amount, "ERC20: low balance");
        _balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    function _mint(address account, uint256 amount) internal virtual {
        totalSupply += amount;
        _balanceOf[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        _balanceOf[account] = _balanceOf[account].sub(amount, "ERC20: burn too much");
        totalSupply -= amount;
        emit Transfer(account, address(0), amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual {
        allowance[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function burn(uint256 tokenAmounts) public virtual override {
        _burn(msg.sender, tokenAmounts); 
    }

    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }

}