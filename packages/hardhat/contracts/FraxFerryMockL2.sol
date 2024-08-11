// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FraxFerryMockL2 is Ownable {
    IERC20 private _asset;

    event Embark(address indexed sender, uint index, uint amount, uint amountAfterFee, uint timestamp);
    event Depart(uint batchNo, uint start, uint end, bytes32 hash);

    constructor(IERC20 asset_) 
        Ownable(msg.sender)
    {
        _asset = asset_;
    }

    function embarkWithRecipient(uint amount, address recipient) public {
        require(_asset.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint amountAfterFee = amount - calculateFee(amount);
        emit Embark(msg.sender, block.number, amount, amountAfterFee, block.timestamp);

        // Mock logic for departing to L1
        emit Depart(block.number, 0, 0, keccak256(abi.encodePacked(block.number, msg.sender, amountAfterFee)));
    }

    function calculateFee(uint amount) public pure returns (uint) {
        // Mock fee calculation, e.g., 1% fee
        return (amount * 1) / 100;
    }

    function withdraw(uint amount) external onlyOwner {
        require(_asset.transfer(msg.sender, amount), "Withdrawal failed");
    }
}
