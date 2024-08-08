// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {IDelegationManager} from "./IDelegationManager.sol";
import {IStrategy} from "./IStrategy.sol";
import "hardhat/console.sol";

interface A {
  function shares(address user) external returns (uint256);
}

interface IFraxtalL1StandardBridge {
    function finalizeERC20Withdrawal(
        address _l1Token,
        address _l2Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _extraData
    )
        external;

    function paused() external view returns (bool);
}

interface IEigenLayerStrategyManager {
    function depositIntoStrategy(
        address strategy,
        address underlyingToken,
        uint256 amount
    ) 
        external returns (uint256);

    function paused() external view returns (bool);

    function stakerStrategyListLength(address staker) external view returns (uint256);

    function stakerStrategyShares(address staker, address strategy) external view returns (uint256);
}

 interface IEigenLayerRewardsCoordinator {
    function setClaimerFor(address claimer) external;

    function claimerFor(address earner) external view returns (address);
 }
 
contract L1FloxiSfrxEth is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 private immutable _asset; // sfraxEth l1
    address private immutable _l2Asset; // sfraxEth l2
    address private immutable _remoteContract; // floxi l2
    // address private immutable _keeperContract;
    address private immutable _l1StandardBridgeProxy;
    address private immutable _eigenLayerStrategyManager;
    IStrategy private immutable _eigenLayerStrategy;
    IDelegationManager private immutable _eigenLayerDelegationManager;
    address private immutable _eigenLayerRewardsCoordinator;

    event WithdrawalQueued(
        bytes32 indexed withdrawalId,
        address indexed staker,
        address indexed withdrawer,
        uint256 nonce,
        uint256 startBlock,
        address strategy,
        uint256 shares,
        bytes32 withdrawalRoot
    );

    constructor(
        IERC20 asset_,
        address l2Asset_,
        address remoteContract_,
        // address keeperContract_,
        address l1StandardBridgeProxy_,
        address eigenLayerStrategyManager_,
        address eigenLayerStrategy_,
        address eigenLayerDelegationManager_,
        address eigenLayerRewardsCoordinator_
    ) 
        Ownable(msg.sender)
    {
        _asset = asset_;
        _l2Asset = l2Asset_;
        _remoteContract = remoteContract_;
        // _keeperContract = keeperContract_;
        _l1StandardBridgeProxy = l1StandardBridgeProxy_;
        _eigenLayerStrategyManager = eigenLayerStrategyManager_;
        _eigenLayerStrategy = IStrategy(eigenLayerStrategy_);
        _eigenLayerDelegationManager = IDelegationManager(eigenLayerDelegationManager_);
        _eigenLayerRewardsCoordinator = eigenLayerRewardsCoordinator_;
    }

    address private _claimer;
    uint256 private _stakedAssets;
    address private _eignelayerOperator;
    mapping(address => uint256) private _balances;
    uint256 private _totalShares;
    uint256 private _reservedAssets;
    uint256 private _withdrawQueueNonce;

    function asset() public view returns (address) {
        return address(_asset);
    }

    // inclusive of deposited assest
    function totalAssets() public view returns (uint256) {
        return _asset.balanceOf(address(this)) + _stakedAssets;
    }

    function assetsInStrategy() public view returns (uint256) {
        return _stakedAssets;
    }

    function stratgyShares() public view returns (uint256) {
        return IEigenLayerStrategyManager(_eigenLayerStrategyManager).stakerStrategyShares(address(this), address(_eigenLayerStrategy));
    }

    // called by keeper
    function depositIntoStrategy() external onlyOwner {
        _depositIntoStrategy();
    }

    function delegate(address operator_) external nonReentrant onlyOwner {
        require (_eigenLayerDelegationManager.paused() == false, "Delegation Manager Paused");

        IDelegationManager.SignatureWithExpiry memory emptySig;
        emptySig.signature = "";
        emptySig.expiry = 0;

        _eigenLayerDelegationManager.delegateTo(operator_, emptySig, "");

        require(_eigenLayerDelegationManager.delegatedTo(address(this)) == operator_, "Delegation failed");

        _eignelayerOperator = operator_;
    }

    function setClaimer(address claimer_) external nonReentrant onlyOwner {
        IEigenLayerRewardsCoordinator(_eigenLayerRewardsCoordinator).setClaimerFor(claimer_);

        require (IEigenLayerRewardsCoordinator(_eigenLayerRewardsCoordinator).claimerFor(address(this)) == claimer_, "Failed to set claimer");

        _claimer = claimer_;
    }

    function _depositIntoStrategy() internal nonReentrant returns (uint256 shares) {
        require(IEigenLayerStrategyManager(_eigenLayerStrategyManager).paused() == false, "Strategy Manager Paused");

        uint256 balance = _asset.balanceOf(address(this));

        require(balance > _reservedAssets, "No assets to deposit");

        uint256 deposit = balance - _reservedAssets;

        _asset.safeIncreaseAllowance(_eigenLayerStrategyManager, deposit);

        require(_asset.allowance(address(this), _eigenLayerStrategyManager) == deposit, "Token approval failed");

        shares = IEigenLayerStrategyManager(_eigenLayerStrategyManager).depositIntoStrategy(address(_eigenLayerStrategy), address(_asset), deposit);

        require(shares == deposit, "Strategy deposit failed");

        _stakedAssets += deposit;

        return shares;
    }

    // POC, can be batched on l2 and triggered by cross domain messenger
    function initiateEigenlayerWithdrawal(uint256 shares_) external nonReentrant onlyOwner {

        IStrategy[] memory strategies = new IStrategy[](1);
        uint256[] memory shares = new uint256[](1);
        IDelegationManager.QueuedWithdrawalParams[] memory queuedWithdrawalParams = new IDelegationManager.QueuedWithdrawalParams[](1);

        queuedWithdrawalParams[0] = IDelegationManager.QueuedWithdrawalParams ({
            strategies: strategies,
            shares: shares,
            withdrawer: address(this)
        });

        queuedWithdrawalParams[0].strategies[0] = _eigenLayerStrategy;
        queuedWithdrawalParams[0].shares[0] = shares_;

        console.log(address(queuedWithdrawalParams[0].strategies[0]));
        console.log(queuedWithdrawalParams[0].shares[0]);

        console.log(_eigenLayerDelegationManager.delegatedTo(address(this)));

        console.log(1);

        console.log(queuedWithdrawalParams.length);

        console.log(queuedWithdrawalParams[0].strategies.length == queuedWithdrawalParams[0].shares.length);

        console.log(queuedWithdrawalParams[0].withdrawer == msg.sender);

        console.log(A(0x8CA7A5d6f3acd3A7A8bC468a8CD0FB14B6BD28b6).shares(address(this)));

        bytes32[] memory withdrawalRoots = _eigenLayerDelegationManager.queueWithdrawals(queuedWithdrawalParams);

        bytes32 withdrawalId = keccak256(abi.encodePacked(msg.sender, _withdrawQueueNonce));

        emit WithdrawalQueued(
            withdrawalId,
            msg.sender,
            address(this),
            _withdrawQueueNonce,
            block.number,
            address(_eigenLayerStrategy),
            shares_,
            withdrawalRoots[0]
        );

        _withdrawQueueNonce += 1;
    }
    
    // function completeEigenlayerWithdrawal(uint256 shares) external {

    //     // Complete the withdrawal
    //     IDelegationManager.Withdrawal memory withdrawal = IDelegationManager.Withdrawal({
    //         staker: address(this),
    //         withdrawer: address(this),
    //         strategies: [_eigenLayerStrategy],
    //         shares: [shares]
    //     });

    //     _eigenLayerDelegationManager.completeQueuedWithdrawal(
    //         withdrawal,
    //         [_asset],
    //         0, // uint256 middlewareTimesIndex,
    //         true // bool receiveAsTokens
    //     );
    // }

    // will be done by keeper
    function initiateBridgeWithdrawal(uint256 shares) external nonReentrant onlyOwner{
        // TBD
    }

    // will be done by keeper in production
    // function finalizeErc20Bridgel(
    //     uint256 _amount
    //     // bytes calldata _extraData
    // ) external nonReentrant onlyOwner {

    //     require (! IFraxtalL1StandardBridge(_l1StandardBridgeProxy).paused());

    //     try IFraxtalL1StandardBridge(_l1StandardBridgeProxy).finalizeERC20Withdrawal(
    //         address(_asset),
    //         _l2Asset,
    //         _remoteContract,
    //         address(this),
    //         _amount,
    //         "" // _extraData
    //     ) {
    //         _depositIntoStrategy();
    //     } catch {
    //             revert("Bridge transfer failed");
    //     }
    // }
}
