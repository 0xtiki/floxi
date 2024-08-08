// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IStrategy} from "./IStrategy.sol";


interface IDelegationManager {
    
    struct QueuedWithdrawalParams {
        address withdrawer;
        IStrategy[] strategies;
        uint256[] shares;
    }

    // @notice Struct that bundles together a signature and an expiration time for the signature. Used primarily for stack management.
    struct SignatureWithExpiry {
        // the signature itself, formatted as a single bytes object
        bytes signature;
        // the expiration timestamp (UTC) of the signature
        uint256 expiry;
    }
    
    struct Withdrawal {
        // The address that originated the Withdrawal
        address staker;
        // The address that the staker was delegated to at the time that the Withdrawal was created
        address delegatedTo;
        // The address that can complete the Withdrawal + will receive funds when completing the withdrawal
        address withdrawer;
        // Nonce used to guarantee that otherwise identical withdrawals have unique hashes
        uint256 nonce;
        // Block number when the Withdrawal was created
        uint32 startBlock;
        // Array of strategies that the Withdrawal contains
        address[] strategies;
        // Array containing the amount of shares in each Strategy in the `strategies` array
        uint256[] shares;
    }

    function delegateTo(
        address operato,
        SignatureWithExpiry memory approverSignatureAndExpiry,
        bytes32 approverSaltr
    ) 
        external;

    /**
     * @notice returns the address of the operator that `staker` is delegated to.
     * @notice Mapping: staker => operator whom the staker is currently delegated to.
     * @dev Note that returning address(0) indicates that the staker is not actively delegated to any operator.
     */
    function delegatedTo(address staker) external view returns (address);
    
    function paused() external view returns (bool);

    /**
     * @notice Allows a staker to queue withdrawals of shares/strategies.
     * @param queuedWithdrawalParams Array of QueuedWithdrawalParams containing withdrawer, strategies, and shares.
     * @return withdrawalRoots Array of withdrawal roots.
     */
    function queueWithdrawals(
        QueuedWithdrawalParams[] calldata queuedWithdrawalParams
    ) external returns (bytes32[] memory);

    /**
     * @notice Used to complete the specified withdrawal.
     * @param withdrawal The Withdrawal to complete.
     * @param tokens Array of tokens input to the 'withdraw' function of the strategies.
     * @param middlewareTimesIndex Index in the operator's middleware times array.
     * @param receiveAsTokens Whether to receive the withdrawal as tokens.
     */
    function completeQueuedWithdrawal(
        Withdrawal calldata withdrawal,
        IERC20[] calldata tokens,
        uint256 middlewareTimesIndex,
        bool receiveAsTokens
    ) external;

    /**
     * @notice Used to complete the specified withdrawals.
     * @param withdrawals Array of Withdrawals to complete.
     * @param tokens Array of tokens for each Withdrawal.
     * @param middlewareTimesIndexes Array of indexes referencing middleware times.
     * @param receiveAsTokens Array indicating whether to complete each withdrawal as tokens.
     */
    function completeQueuedWithdrawals(
        Withdrawal[] calldata withdrawals,
        IERC20[][] calldata tokens,
        uint256[] calldata middlewareTimesIndexes,
        bool[] calldata receiveAsTokens
    ) external;
}