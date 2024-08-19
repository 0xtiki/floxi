// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FraxFerryMockL2 is Ownable {
    IERC20 private _asset;

    event Embark(address indexed sender, uint index, uint amount, uint amountAfterFee, uint timestamp);
    event Depart(uint batchNo, uint start, uint end, bytes32 hash);

    uint public MIN_WAIT_PERIOD_ADD=3600; // Minimal 1 hour waiting
    uint public MIN_WAIT_PERIOD_EXECUTE=79200; // Minimal 22 hour waiting
    uint public FEE_RATE=0;      // 0.1% fee
    uint public FEE_MIN=1*1e16;   // 0.01 token min fee
    uint public FEE_MAX=1*1e16; // 0.01 token max fee
   
    uint constant public REDUCED_DECIMALS=1e10;

    constructor(IERC20 asset_) 
        Ownable(msg.sender)
    {
        _asset = asset_;
    }

    function embarkWithRecipient(uint amount, address recipient) public {
        require(_asset.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint amountAfterFee = amount - calculateFee(amount);
        emit Embark(msg.sender, 1, amount, amountAfterFee, block.timestamp);

        // Mock logic for departing to L1
        emit Depart(block.number, 0, 2, keccak256(abi.encodePacked(block.number, msg.sender, amountAfterFee)));
    }

    function emitEmbark() public onlyOwner {
        emit Embark(msg.sender, 1, 100000000, 1000000000, block.timestamp);
    }

    function emitDepart() public onlyOwner {
        uint amountAfterFee = 10000000000000;
        emit Depart(block.number, 0, 2, keccak256(abi.encodePacked(block.number, msg.sender, amountAfterFee)));
    }

    function calculateFee(uint amount) public pure returns (uint) {
        // Mock fee calculation, e.g., 1% fee
        return (amount * 1) / 100;
    }

    function withdraw(uint amount) public onlyOwner {
        require(_asset.transfer(msg.sender, amount), "Withdrawal failed");
    }

    function paused() public pure returns (bool) {
        return false;
    }
}
