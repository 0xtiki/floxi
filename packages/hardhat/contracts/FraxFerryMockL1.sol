// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FraxFerryMockL1 is Ownable {
    IERC20 private _asset;
    address private _recipient;

    constructor(IERC20 asset_) 
        Ownable(msg.sender)
    {
        _asset = asset_;
    }

    event Disembark(uint start, uint end, bytes32 hash);

    function disembark(bytes32 hash_) public onlyOwner {
        uint256 balance = _asset.balanceOf(address(this));
        require(balance > 0, "No balance to disembark");
        require(_asset.transfer(_recipient, balance), "Disembark transfer failed");

        emit Disembark(0, 2, hash_);
    }

    function emitDisembark(bytes32 hash_) public onlyOwner {
        emit Disembark(0, 2, hash_);
    }

    function setRecipient(address recipient_) public onlyOwner {
        _recipient = recipient_;
    }

    function withdraw(uint amount) public onlyOwner {
        require(_asset.transfer(msg.sender, amount), "Withdrawal failed");
    }

    function paused() public pure returns (bool) {
        return false;
    }
}
