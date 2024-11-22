// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC4626, IERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
// import "hardhat/console.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/DoubleEndedQueue.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/**
 * @title IERC7540
 * @dev Interface for ERC7540 compliant contracts, defining asynchronous deposit and redeem operations
 */
interface IERC7540 {
    /**
     * @dev Emitted when a deposit request is made
     * @param controller The address of the controller
     * @param owner The address of the owner
     * @param requestId The unique identifier for the request
     * @param sender The address of the sender
     * @param assets The amount of assets being deposited
     */
    event DepositRequest(address indexed controller, address indexed owner, uint256 indexed requestId, address sender, uint256 assets);

    /**
     * @dev Emitted when a redeem request is made
     * @param controller The address of the controller
     * @param owner The address of the owner
     * @param requestId The unique identifier for the request
     * @param sender The address of the sender
     * @param shares The amount of shares being redeemed
     */
    event RedeemRequest(address indexed controller, address indexed owner, uint256 indexed requestId, address sender, uint256 shares);

    /**
     * @dev Emitted when an operator is set for a controller
     * @param controller The address of the controller
     * @param operator The address of the operator
     * @param approved Whether the operator is approved or not
     */
    event OperatorSet(address indexed controller, address indexed operator, bool approved);

    /**
     * @dev Requests a deposit of assets
     * @param assets The amount of assets to deposit
     * @param controller The address of the controller
     * @param owner The address of the owner
     * @return requestId The unique identifier for the deposit request
     */
    function requestDeposit(uint256 assets, address controller, address owner) external returns (uint256 requestId);

    /**
     * @dev Returns the amount of assets in a pending deposit request
     * @param requestId The unique identifier for the request
     * @param controller The address of the controller
     * @return assets The amount of assets in the pending deposit request
     */
    function pendingDepositRequest(uint256 requestId, address controller) external view returns (uint256 assets);

    /**
     * @dev Returns the amount of assets in a claimable deposit request
     * @param requestId The unique identifier for the request
     * @param controller The address of the controller
     * @return assets The amount of assets in the claimable deposit request
     */
    function claimableDepositRequest(uint256 requestId, address controller) external view returns (uint256 assets);

    /**
     * @dev Requests a redeem of shares
     * @param shares The amount of shares to redeem
     * @param controller The address of the controller
     * @param owner The address of the owner
     * @return requestId The unique identifier for the redeem request
     */
    function requestRedeem(uint256 shares, address controller, address owner) external returns (uint256 requestId);

    /**
     * @dev Returns the amount of shares in a pending redeem request
     * @param requestId The unique identifier for the request
     * @param controller The address of the controller
     * @return shares The amount of shares in the pending redeem request
     */
    function pendingRedeemRequest(uint256 requestId, address controller) external view returns (uint256 shares);

    /**
     * @dev Returns the amount of shares in a claimable redeem request
     * @param requestId The unique identifier for the request
     * @param controller The address of the controller
     * @return shares The amount of shares in the claimable redeem request
     */
    function claimableRedeemRequest(uint256 requestId, address controller) external view returns (uint256 shares);

    /**
     * @dev Checks if an address is an operator for a controller
     * @param controller The address of the controller
     * @param operator The address to check
     * @return status True if the address is an operator, false otherwise
     */
    function isOperator(address controller, address operator) external view returns (bool status);

    /**
     * @dev Sets or revokes an operator for the caller
     * @param operator The address to set as operator
     * @param approved True to approve the operator, false to revoke
     * @return success True if the operation was successful
     */
    function setOperator(address operator, bool approved) external returns (bool success);
}

/**
 * @title IFraxFerry
 * @dev Interface for the FraxFerry contract, used for cross-chain asset transfers
 */
interface IFraxFerry {
    /**
     * @dev Initiates a cross-chain transfer of assets
     * @param amount The amount of assets to transfer
     * @param recipient The address of the recipient on the destination chain
     */
    function embarkWithRecipient(uint amount, address recipient) external;

    /**
     * @dev Checks if the ferry is paused
     * @return A boolean indicating whether the ferry is paused
     */
    function paused() external view returns (bool);

    /**
     * @dev Returns the fee rate for transfers
     * @return The fee rate as a uint
     */
    function FEE_RATE() external view returns (uint);

    /**
     * @dev Returns the minimum fee for transfers
     * @return The minimum fee as a uint
     */
    function FEE_MIN() external view returns (uint);

    /**
     * @dev Returns the maximum fee for transfers
     * @return The maximum fee as a uint
     */
    function FEE_MAX() external view returns (uint);

    /**
     * @dev Returns the number of decimals to reduce for rounding
     * @return The number of decimals to reduce as a uint
     */
    function REDUCED_DECIMALS() external view returns (uint);
}

/**
 * @title ICrossDomainMessenger
 * @dev Interface for cross-domain messaging
 */
interface ICrossDomainMessenger {
    /**
     * @dev Returns the address of the sender from the other domain
     * @return The address of the cross-domain sender
     */
    function xDomainMessageSender() external view returns (address);

    /**
     * @dev Sends a message to the other domain
     * @param _target The address of the target contract in the other domain
     * @param _message The calldata to be executed in the other domain
     * @param _gasLimit The gas limit for executing the message in the other domain
     */
    function sendMessage(
        address _target,
        bytes calldata _message,
        uint32 _gasLimit
    ) external;
}

/**
 * @title FloxiSfrxEth
 * @dev ERC7540 vault that handles async deposits and redeems for restaking ERC20 tokens on another chain.
 *      Fees are expressed in basis points (bp).
 */
contract FloxiSfrxEth is ERC4626, ReentrancyGuard, Ownable, IERC7540, ERC165 {
    using Math for uint256;
    using SafeERC20 for IERC20;

    /**
     * @dev Emitted when assets are shipped to L1
     * @param receiver The address of the receiver on L1
     * @param assets The amount of assets shipped
     */
    event AssetsShippedToL1(
        address indexed receiver,
        uint256 assets
    );

    /**
     * @dev Emitted when redeems are unlocked
     * @param assetsUnlocked The amount of assets unlocked
     * @param fromNonce The starting nonce of the unlocked redeems
     * @param toNonce The ending nonce of the unlocked redeems
     */
    event RedeemsUnlocked(
        uint256 indexed assetsUnlocked,
        uint256 fromNonce,
        uint256 toNonce
    );

    /**
     * @dev Emitted when deposits are unlocked
     * @param totalUnlockedDeposits The total amount of deposits unlocked
     * @param unlockFrom The starting nonce of the unlocked deposits
     * @param unlockTo The ending nonce of the unlocked deposits
     */
    event DepositsUnlocked(
        uint256 indexed totalUnlockedDeposits,
        uint256 unlockFrom,
        uint256 unlockTo
    );

    // === Immutable variables ===

    IERC20 public immutable _asset;
    address public immutable _remoteAsset;
    address public immutable _remoteContract;
    address public immutable _l2CrossDomainMessenger;
    address public immutable _treasury;

    // === Constants ===

    // ERC-165 interface IDs
    bytes4 private constant _INTERFACE_ID_ERC7540 = 0xe3bc4e65;
    bytes4 private constant _INTERFACE_ID_ERC7575 = 0x2f0a18c5;
    bytes4 private constant _INTERFACE_ID_ASYNC_DEPOSIT = 0xce3bbe50;
    bytes4 private constant _INTERFACE_ID_ASYNC_REDEEM = 0x620ee8e4;
    
    // FraxFerry V2 Fraxtal https://github.com/FraxFinance/frax-solidity/blob/master/src/types/constants.ts#L4341C60-L4341C102
    address public immutable _fraxFerry;
    uint256 private constant _BASIS_POINT_SCALE = 1e4;
    uint256 private constant _WEI_PER_GWEI = 1e9;
    uint256 private constant _L1_GAS_ESTIMATE = 78500;
    uint256 private constant _GAS_PRICE = 30;
    uint256 public constant _MIN_DEPOSIT = 100000000000000000; // 0.1 ether

    /**
     * @dev Constructor for the FloxiSfrxEth contract
     * @param asset_ The address of the asset token
     * @param remoteAsset_ The address of the asset on the remote chain
     * @param remoteContract_ The address of the remote contract
     * @param l2CrossDomainMessenger_ The address of the L2 cross-domain messenger
     * @param treasury_ The address of the treasury
     * @param fraxFerry_ The address of the FraxFerry contract
     */
    constructor(
        IERC20 asset_,
        address remoteAsset_,
        address remoteContract_,
        address l2CrossDomainMessenger_,
        address treasury_,
        address fraxFerry_
    )
        ERC20("Floxi Staked Frax ETH", "fsfrxEth")
        ERC4626(asset_)
        Ownable(msg.sender)
    {
        _asset = asset_;
        _remoteAsset = remoteAsset_;
        _remoteContract = remoteContract_;
        _l2CrossDomainMessenger = l2CrossDomainMessenger_;
        _treasury = treasury_;
        _fraxFerry = fraxFerry_;
    }

    // Tracks assets on L1
    uint256 public l1Assets = 0;
    uint256 public l1Shares = 0;
    
    mapping(address controller => address operator) public operatorMapping;

    // === Deposit flow state variables ===
    uint256 public depositRequestNonce;
    DoubleEndedQueue.Bytes32Deque private _depositRequestQueue;
    mapping(bytes32 => uint256) public depositRequests;
    mapping(address => uint256) public depositedAssets;
    mapping(address controller => mapping(uint256 requestId => uint256 assets)) public pendingDepositRequests;
    mapping(address controller => mapping(uint256 requestId => uint256 assets)) public claimableDepositRequests;
    uint256 public depositRequestCompletedNonce;
    mapping(address controller => uint256 assets) public claimableDeposits;
    mapping(address controller => uint256 multiplier) public sharesPerAssetMultiplier;

    // === Redeem flow state variables ===
    uint256 public redeemRequestNonce;
    DoubleEndedQueue.Bytes32Deque private _redeemRequestQueue;
    mapping(bytes32 => uint256) public redeemRequests;
    mapping(address controller => mapping(uint256 requestId => uint256 shares)) public pendingRedeemRequests;
    mapping(address controller => mapping(uint256 requestId => uint256 shares)) public claimableRedeemRequests;
    uint256 public redeemRequestCompletedNonce;
    mapping(address controller => uint256 assets) public claimableRedeems;

    // === Modifiers ===

    /**
     * @dev Modifier to ensure that only the remote contract can call a function
     */
    modifier onlyRemoteContract() {
        require(msg.sender == _l2CrossDomainMessenger,"Sender must be the CrossDomainMessenger");
        require(ICrossDomainMessenger(_l2CrossDomainMessenger).xDomainMessageSender() == _remoteContract,"Remote sender must be Floxi L1");
        _;
    }

    // === ERC-165 functions ===

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == _INTERFACE_ID_ERC7540 ||
            interfaceId == _INTERFACE_ID_ERC7575 ||
            interfaceId == _INTERFACE_ID_ASYNC_DEPOSIT ||
            interfaceId == _INTERFACE_ID_ASYNC_REDEEM ||
            super.supportsInterface(interfaceId);
    }

    // === ERC-7575 functions ===

    /**
     * @dev Returns the number of shares that would be minted for a given amount of assets
     * @param assets The amount of assets to convert to shares
     * @return The number of shares that would be minted
     */
    function share(uint256 assets) external view returns (uint256) {
        return convertToShares(assets, msg.sender);
    }

    // === Operator functions ===

    /// @inheritdoc IERC7540
    function isOperator(address controller, address operator) public view returns (bool) {
        return operatorMapping[controller] == operator;
    }

    /// @inheritdoc IERC7540
    function setOperator(address operator, bool approved) external returns (bool) {
        address controller = msg.sender;
        if (approved) {
            operatorMapping[controller] = operator;
        } else {
            if (operatorMapping[controller] == operator) {
                delete operatorMapping[controller];
            }
        }
        emit OperatorSet(controller, operator, approved);

        return true;
    }

    // === ERC7540 deposit flow ===

   /// @inheritdoc IERC7540
    function requestDeposit(uint256 assets, address controller, address owner) public nonReentrant returns (uint256 requestId) {
        // Ensure the deposit amount is greater than the minimum required deposit
        require(assets > _MIN_DEPOSIT, "Minimum deposit amount not met");
        // Ensure the FraxFerry contract is not paused
        require(IFraxFerry(_fraxFerry).paused() == false, "FraxFerry is paused");
        // Ensure the caller is the owner or an authorized operator
        require(owner == msg.sender || isOperator(owner, msg.sender), "Not authorized");

        // Convert the caller's address to bytes32 format
        bytes32 addressToBytes32 = bytes32(uint256(uint160(controller)));

        // Add the caller's address to the deposit request queue
        DoubleEndedQueue.pushBack(_depositRequestQueue, addressToBytes32);

        // Generate a unique request ID for the deposit request
        requestId = uint256(keccak256(abi.encode(controller, depositRequestNonce)));
        
        // Increment the deposit request nonce
        depositRequestNonce++;

        // Transfer the assets from the owner to the contract
        _asset.safeTransferFrom(owner, address(this), assets);

        // Calculate the entry fee based on the total assets
        uint256 entryFee = _feeOnTotal(assets, _entryFeeBasisPoints());

        // Calculate the assets after deducting the entry fee
        uint256 feeInclusive = assets - entryFee;

        // Round the fee-inclusive amount to the nearest reduced decimals
        uint256 roudedAmout = (feeInclusive/IFraxFerry(_fraxFerry).REDUCED_DECIMALS())*IFraxFerry(_fraxFerry).REDUCED_DECIMALS();

        // Calculate the rounding error
        uint256 roundingError = feeInclusive - roudedAmout;

        // Get the recipient address for the entry fee
        address recipient = _entryFeeRecipient();

        // Transfer the entry fee and rounding error to the recipient if applicable
        if (entryFee > 0 && recipient != address(this)) {
            _asset.transfer(recipient, entryFee + roundingError);
        }

        // Ship the rounded amount to L1 and get the ticket amount for the shipped assets
        uint256 ticket = shipToL1(roudedAmout);

        // Calculate the amount after deducting the ticket
        uint256 amountAfterTicket = roudedAmout - ticket;   

        // Store the pending deposit request amount
        pendingDepositRequests[controller][requestId] = amountAfterTicket;

        // Emit the DepositRequest event
        emit DepositRequest(controller, owner, requestId, msg.sender, assets);

        // Return the request ID
        return requestId;
    }

    /// @inheritdoc IERC7540
    function pendingDepositRequest(uint256 requestId, address controller) public view returns (uint256 assets) {
        return pendingDepositRequests[controller][requestId];
    }

    /// @inheritdoc IERC7540
    function claimableDepositRequest(uint256 requestId,address controller) external view returns (uint256 assets) {
        return claimableDepositRequests[controller][requestId];
    }

    /**
     * @dev Unlocks deposits based on the information received from the remote contract.
     * @param assets The total amount of assets to unlock.
     * @param shares The total amount of shares corresponding to the assets.
     * @param l1Assets_ The updated total assets on L1.
     * @param l1Shares_ The updated total shares on L1.
     * @param maxIterations The maximum number of deposit requests to process in this call.
     */
    function unlockDeposits(uint256 assets, uint256 shares, uint256 l1Assets_, uint256 l1Shares_, uint256 maxIterations) external onlyRemoteContract {
        // Ensure there are deposits in the queue to process
        require(DoubleEndedQueue.empty(_depositRequestQueue) == false, 'No deposits in queue');

        // update L1 assets and shares
        _updateL1Assets(l1Assets_, l1Shares_);

        // Initialize counter for number of iterations
        uint256 iterations = 0;
        // Store the starting nonce for completed deposit requests
        uint256 unlockFrom = depositRequestCompletedNonce;
        // Initialize total amount of deposits unlocked
        uint256 totalUnlockedDeposits;

        // Loop through deposit requests, limited by assets and maxIterations
        for (uint256 i = 0; i < assets && iterations < maxIterations;) {
            // Break if the deposit request queue becomes empty
            if (DoubleEndedQueue.empty(_depositRequestQueue)) {
                break;
            }

            // Get the next controller from the queue
            bytes32 b32controller = DoubleEndedQueue.popFront(_depositRequestQueue);

            // Convert bytes32 to address
            address controller = address(uint160(uint256(b32controller)));

            // Generate the request ID
            bytes32 requestId = keccak256(abi.encode(controller, depositRequestCompletedNonce));

            // Get the amount of deposits to unlock for this request
            uint256 unlockedDeposits = depositRequests[requestId];

            // Update the shares per asset multiplier for this controller
            sharesPerAssetMultiplier[controller] = updateMultiplier(
                sharesPerAssetMultiplier[controller],
                claimableDeposits[controller],
                sharesPerAsset(shares, assets) * unlockedDeposits,
                unlockedDeposits
            );

            // Clear the pending deposit request
            pendingDepositRequests[controller][uint256(requestId)] = 0;

            // Mark deposits as claimable
            claimableDepositRequests[controller][uint256(requestId)] = unlockedDeposits;

            // Increase the total claimable deposits for this controller
            claimableDeposits[controller] += unlockedDeposits;

            // Increase the total amount of unlocked deposits
            totalUnlockedDeposits += unlockedDeposits;

            // Increment the completed deposit request nonce
            depositRequestCompletedNonce += 1;

            // Increase the processed assets counter
            i += unlockedDeposits;

            // Increment the iterations counter
            iterations += 1;
        }

        // Update the completed deposit request nonce
        depositRequestCompletedNonce += iterations;

        // Emit an event with the details of unlocked deposits
        emit DepositsUnlocked(
            totalUnlockedDeposits,
            unlockFrom,
            depositRequestCompletedNonce
        );
    }

    /**
     * @dev Allows a user to claim their deposited assets and receive corresponding shares.
     * @param assets The amount of assets to claim.
     * @param receiver The address to receive the minted shares.
     * @param controller The address of the controller.
     * @return shares The amount of shares minted and transferred to the receiver.
     */
    function claimDeposit(uint256 assets, address receiver, address controller) public nonReentrant returns (uint256 shares) {
        require(assets <= claimableDeposits[controller], "Not enough claimable assets");
        require(controller == msg.sender || isOperator(controller, msg.sender), "Not authorized");

        claimableDeposits[controller] -= assets;

        shares = convertToShares(assets, controller);
        _mint(receiver, shares);

        emit Deposit(controller, receiver, assets, shares);
        return shares;
    }

    // === ERC7540 redeem flow ===

    /// @inheritdoc IERC7540
    function requestRedeem(uint256 shares, address controller, address owner) public nonReentrant returns (uint256 requestId) {
        require(owner == msg.sender || isOperator(owner, msg.sender), "Not authorized");
        require(balanceOf(owner) >= shares, "Insufficient balance");

        uint256 assets = convertToAssets(shares);
        require(assets <= maxRedeem(owner), "Insufficient balance");

        _burn(owner, shares);

        requestId = uint256(keccak256(abi.encode(controller, redeemRequestNonce)));
        redeemRequestNonce++;

        bytes32 addressToBytes32 = bytes32(uint256(uint160(controller)));
        DoubleEndedQueue.pushBack(_redeemRequestQueue, addressToBytes32);

        pendingRedeemRequests[controller][requestId] = shares;

        emit RedeemRequest(controller, owner, requestId, msg.sender, shares);

        return requestId;
    }

    /// @inheritdoc IERC7540
    function pendingRedeemRequest(uint256 requestId, address controller) external view returns (uint256 shares) {
        return pendingRedeemRequests[controller][requestId];
    }

    /// @inheritdoc IERC7540
    function claimableRedeemRequest(uint256 requestId, address controller) external view returns (uint256 shares) {
        return claimableRedeemRequests[controller][requestId];
    }

    /**
     * @dev Unlocks redeems based on the provided parameters. Can only be called by the CrossDomainMessenger from the remote contract.
     * @param shares The total amount of shares to unlock.
     * @param l1Assets_ The updated amount of assets on L1.
     * @param l1Shares_ The updated amount of shares on L1.
     * @param maxIterations The maximum number of iterations to process.
     */
    function unlockRedeems(uint256 shares, uint256 l1Assets_, uint256 l1Shares_, uint256 maxIterations) external onlyRemoteContract {
        require(DoubleEndedQueue.empty(_redeemRequestQueue) == false, 'No redeems in queue');

        _updateL1Assets(l1Assets_, l1Shares_);

        uint256 iterations = 0;
        uint256 unlockFrom = redeemRequestCompletedNonce;
        uint256 totalUnlockedRedeems;

        for (uint256 i = 0; i < shares && iterations < maxIterations;) {
            if (DoubleEndedQueue.empty(_redeemRequestQueue)) {
                break;
            }

            bytes32 b32controller = DoubleEndedQueue.popFront(_redeemRequestQueue);
            address controller = address(uint160(uint256(b32controller)));
            bytes32 requestId = keccak256(abi.encode(controller, redeemRequestCompletedNonce));

            uint256 unlockedRedeems = redeemRequests[requestId];

            pendingRedeemRequests[controller][uint256(requestId)] = 0;
            claimableRedeemRequests[controller][uint256(requestId)] = unlockedRedeems;
            claimableRedeems[controller] += unlockedRedeems;

            totalUnlockedRedeems += unlockedRedeems;
            redeemRequestCompletedNonce += 1;
            i += unlockedRedeems;
            iterations += 1;
        }

        redeemRequestCompletedNonce += iterations;

        emit RedeemsUnlocked(
            totalUnlockedRedeems,
            unlockFrom,
            redeemRequestCompletedNonce
        );
    }

    /**
     * @dev Allows a user to claim their redeemed shares and receive corresponding assets.
     * @param shares The amount of shares to claim.
     * @param receiver The address to receive the assets.
     * @param controller The address of the controller.
     * @return assets The amount of assets transferred to the receiver.
     */
    function claimRedeem(uint256 shares, address receiver, address controller) public nonReentrant returns (uint256 assets) {
        require(shares <= claimableRedeems[controller], "Not enough claimable redeems");
        require(controller == msg.sender || isOperator(controller, msg.sender), "Not authorized");

        claimableRedeems[controller] -= shares;

        assets = convertToAssets(shares, controller);

        _burn(controller, shares);

        _asset.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, controller, assets, shares);

        return assets;
    }

    // === L1 asset management functions ===

    /**
     * @dev Internal function to transfer assets to L1 via the FraxFerry.
     * @param assets The amount of assets to transfer.
     * @return ticket The amount of assets retained as a fee.
     */
    function shipToL1(uint256 assets) internal returns (uint256 ticket){
        bool success = _asset.approve(_fraxFerry, assets);
        require(success, "Approval failed");

        ticket = ferryTicket(assets);

        try IFraxFerry(_fraxFerry).embarkWithRecipient(assets, _remoteContract) {
            emit AssetsShippedToL1(
                _remoteContract,
                assets - ticket
            );
        }
        catch {
            revert("Failed to bridge assets");
        }

        return ticket;
    }

    /**
     * @dev keeper function to update the L1 asset and share balances.
     * @param l1Assets_ The updated amount of assets on L1.
     * @param l1Shares_ The updated amount of shares on L1.
     */
    function updateL1Assets(uint256 l1Assets_, uint256 l1Shares_) external onlyRemoteContract {
        _updateL1Assets(l1Assets_, l1Shares_);
    }

    /**
     * @dev Internal function to update the L1 asset and share balances.
     * @param l1Assets_ The updated amount of assets on L1.
     * @param l1Shares_ The updated amount of shares on L1.
     */
    function _updateL1Assets(uint256 l1Assets_, uint256 l1Shares_) internal {
        l1Assets = l1Assets_;
        l1Shares = l1Shares_;
    }

    // === ERC4626 overrides ===

    /**
     * @dev Overrides {IERC4626-totalAssets} to include assets on L1.
     * @return The total assets managed by this vault.
     */
    function totalAssets() public view override returns (uint256) {
        return _asset.balanceOf(address(this)) + l1Assets;
    }

    function previewDeposit(uint256 /*assets*/) public pure override returns (uint256) {
        revert("previewDeposit not supported");
    }

    function previewMint(uint256 /*shares*/) public pure override returns (uint256) {
        revert("previewMint not supported");
    }

    function previewRedeem(uint256 /*shares*/) public pure override returns (uint256) {
        revert("previewRedeem not supported");
    }

    function previewWithdraw(uint256 /*assets*/) public pure override returns (uint256) {
        revert("previewWithdraw not supported");
    }

    function withdraw(uint256 /*assets*/, address /*receiver*/, address /*owner*/) public pure override returns (uint256) {
        revert("withdraw not supported, use requestRedeem/claimRedeem instead");
    }

    function redeem(uint256 shares, address receiver, address controller) public override returns (uint256 assets) {
        assets = claimRedeem(shares, receiver, controller);
        return assets;
    }

    function mint(uint256 /*shares*/, address /*receiver*/) public pure override returns (uint256) {
        revert("mint not supported, use requestDeposit/claimDeposit instead");
    }

    function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
        shares = claimDeposit(assets, receiver, msg.sender);
        return shares;
    }

    // === Utility functions ===

    /**
     * @dev Calculates the assets per share based on the given multiplier.
     * @param multiplier The shares per asset multiplier.
     * @return The assets per share value.
     */
    function assetsPerShare(uint256 multiplier) internal pure returns (uint256) {
        // Ensure the multiplier is not zero to avoid division by zero
        require(multiplier > 0, "Multiplier cannot be zero");

        // Calculate the inverse multiplier
        uint256 assetPerShare = (1e18 * 1e18) / multiplier;

        return assetPerShare;
    }

    /**
     * @dev Calculates the assets based on the given shares and assets per share value.
     * @param shares The number of shares.
     * @param assetPerShare The assets per share value.
     * @return The calculated assets.
     */
    function calculateAssets(uint256 shares, uint256 assetPerShare) internal pure returns (uint256) {
        // Calculate assets from shares using the inverse multiplier
        uint256 assets = (shares * assetPerShare) / 1e18;

        return assets;
    }

    /**
     * @dev Updates the shares per asset multiplier based on new shares and assets.
     * @param currentMultiplier The current shares per asset multiplier.
     * @param currentAssets The total assets corresponding to the current multiplier.
     * @param newShares New shares to be included.
     * @param newAssets New assets to be included.
     * @return The updated multiplier.
     */
    function updateMultiplier(
        uint256 currentMultiplier, // The current sharesPerAsset multiplier
        uint256 currentAssets,     // The total assets corresponding to the current multiplier
        uint256 newShares,         // New shares to be included
        uint256 newAssets          // New assets to be included
    ) internal pure returns (uint256) {
        // Calculate the new shares per asset
        uint256 newSharesPerAsset = (newShares * 1e18) / newAssets;

        // Calculate the total assets after adding new assets
        uint256 assets = currentAssets + newAssets;

        // Update the multiplier using a weighted average
        uint256 updatedMultiplier = (
            (currentMultiplier * currentAssets) +
            (newSharesPerAsset * newAssets)
        ) / assets;

        return updatedMultiplier;
    }

    /**
     * @dev Calculates the shares per asset ratio.
     * @param shares The number of shares.
     * @param assets The amount of assets.
     * @return The shares per asset ratio.
     */
    function sharesPerAsset(uint256 shares, uint256 assets) public pure returns (uint256) {
        require(assets > 0, "Assets must be greater than zero");
        return (shares * 1e18) / assets;
    }

    /**
     * @dev Converts a given amount of assets to shares for a specific controller.
     * @param assets The amount of assets to convert.
     * @param controller The address of the controller.
     * @return The equivalent amount of shares.
     */
    function convertToShares(uint256 assets, address controller) public view returns (uint256) {
        return assets * 1e18 / sharesPerAssetMultiplier[controller];
    }

    /**
     * @dev Converts a given amount of shares to assets for a specific controller.
     * @param shares The amount of shares to convert.
     * @param controller The address of the controller.
     * @return The equivalent amount of assets.
     */
    function convertToAssets(uint256 shares, address controller) public view returns (uint256) {
        uint256 assetsPerShare_ = assetsPerShare(sharesPerAssetMultiplier[controller]);
        uint256 assets = calculateAssets(shares, assetsPerShare_);
        return assets;
    }

    // === Fee configuration ===

    /**
     * @dev Returns the entry fee in basis points.
     * @return The entry fee in basis points.
     */
    function _entryFeeBasisPoints() internal pure returns (uint256) {
        return 50; // 0.5%
    }

    /**
     * @dev Returns the address receiving the entry fee.
     * @return The address receiving the entry fee.
     */
    function _entryFeeRecipient() internal view returns (address) {
        return _treasury;
    }

    /**
     * @dev Calculates the fee in wei based on a given gas price in gwei.
     * Used as estimate for L1 transaction fees which are not charged by the bridgecontract 
     * (i.e. claiming from bridge contract and depositing into L1 strategy)
     * @param gasPriceGwei The gas price in gwei.
     * @return The estimated fee in wei.
     */
    function calculateL1GasFeeInWei(uint256 gasPriceGwei) public pure returns (uint256) {
        uint256 gasPriceWei = gasPriceGwei * _WEI_PER_GWEI;
        uint256 totalFee = _L1_GAS_ESTIMATE * gasPriceWei;
        return totalFee;
    }

    /**
     * @dev Calculates the ferry ticket fee for a given amount.
     * @param roundedAmount The amount for which to calculate the fee, rounded to an appropriate precision.
     * @return The calculated ferry ticket fee, bounded by the minimum and maximum fee limits.
     * @notice This function uses the FraxFerry contract's fee parameters to calculate the fee.
     * The fee is calculated as a percentage of the input amount, but is constrained between
     * a minimum and maximum value as defined by the FraxFerry contract.
     */
    function ferryTicket(uint256 roundedAmount) public view returns (uint) {
        return Math.min(Math.max(IFraxFerry(_fraxFerry).FEE_MIN(), roundedAmount * IFraxFerry(_fraxFerry).FEE_RATE()/10000), IFraxFerry(_fraxFerry).FEE_MAX());
    }

    /**
     * @dev Calculates the fees that should be added to an amount `assets` that does not already include fees.
     * Used in {IERC4626-mint} and/or {IERC4626-withdraw} operations.
     * @param assets The amount of assets.
     * @param feeBasisPoints The fee in basis points.
     * @return The fee to be added.
     */
    function _feeOnRaw(uint256 assets, uint256 feeBasisPoints) private pure returns (uint256) {
        return assets.mulDiv(feeBasisPoints, _BASIS_POINT_SCALE, Math.Rounding.Ceil) + calculateL1GasFeeInWei(_GAS_PRICE);
    }

    /**
     * @dev Calculates the fee part of an amount `assets` that already includes fees.
     * Used in {IERC4626-deposit} and/or {IERC4626-redeem} operations.
     * @param assets The amount of assets.
     * @param feeBasisPoints The fee in basis points.
     * @return The fee part of the assets.
     */
    function _feeOnTotal(uint256 assets, uint256 feeBasisPoints) private pure returns (uint256) {
        return assets.mulDiv(feeBasisPoints, feeBasisPoints + _BASIS_POINT_SCALE, Math.Rounding.Ceil) + calculateL1GasFeeInWei(_GAS_PRICE);
    }

    // keeper in case of cancelled ferry
    function forceShipToL1(uint256 assets) public onlyOwner {
        shipToL1(assets);
    }

    // for POC only
    function withdrawFunds(uint amount) external onlyOwner {
        require(_asset.transfer(msg.sender, amount), "Withdrawal failed");
    }
}