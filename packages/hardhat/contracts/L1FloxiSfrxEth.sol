// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {IDelegationManager} from "./IDelegationManager.sol";
import {IStrategy} from "./IStrategy.sol";
import "hardhat/console.sol";

interface ICrossDomainMessenger {
    function xDomainMessageSender() external view returns (address);
    function sendMessage(
        address _target,
        bytes calldata _message,
        uint32 _gasLimit
    ) external;
}

interface IL1StandardBridge {
    function depositERC20To(
        address _l1Token,
        address _l2Token,
        address _to,
        uint256 _amount,
        uint32 _minGasLimit,
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

    IERC20 private immutable _asset; // sfraxEth l1
    address private immutable _remoteAsset; // sfraxEth l2
    address private immutable _l1StandardBridgeProxy;
    address private immutable _l1CrossDomainMessenger;
    address private immutable _eigenLayerStrategyManager;
    IStrategy private immutable _eigenLayerStrategy;
    IDelegationManager private immutable _eigenLayerDelegationManager;
    address private immutable _eigenLayerRewardsCoordinator;

    event AssetsDepositedIntoStrategy(
        uint256 assets,
        uint256 shares,
        address strategy
    );

    event WithdrawalInitiated(
        bytes32 indexed withdrawalId,
        address staker,
        address withdrawer,
        uint256 indexed nonce,
        uint256 startBlock,
        address strategy,
        uint256 shares,
        uint256 assets,
        bytes32 indexed withdrawalRoot
    );

    event WithdrawalCompleted(
        uint256 assets,
        uint256 shares,
        address strategy
    );

    event AssetsShippedToL2(
        address indexed receiver,
        uint256 assets
    );

    struct QueueParams {
        address[] strategies;
        uint256[] shares;
        address withdrawer;
    }

    constructor(
        IERC20 asset_,
        address remoteAsset_,
        address l1StandardBridgeProxy_,
        address l1CrossDomainMessenger_,
        address eigenLayerStrategyManager_,
        address eigenLayerStrategy_,
        address eigenLayerDelegationManager_,
        address eigenLayerRewardsCoordinator_
    ) 
        Ownable(msg.sender)
    {
        _asset = asset_;
        _remoteAsset = remoteAsset_;
        _l1StandardBridgeProxy = l1StandardBridgeProxy_;
        _l1CrossDomainMessenger = l1CrossDomainMessenger_;
        _eigenLayerStrategyManager = eigenLayerStrategyManager_;
        _eigenLayerStrategy = IStrategy(eigenLayerStrategy_);
        _eigenLayerDelegationManager = IDelegationManager(eigenLayerDelegationManager_);
        _eigenLayerRewardsCoordinator = eigenLayerRewardsCoordinator_;
    }

    address private _claimer;
    address private _eignelayerOperator;
    uint256 private _queuedAssets;
    uint256 private _reservedAssets;
    uint256 private _withdrawQueueNonce;
    uint256 private _bridgeDepositNonce;
    address private _remoteContract; // floxi l2

    function setRemoteContract(address floxiL2) public onlyOwner {
        _remoteContract = floxiL2;
    }

    function asset() public view returns (address) {
        return address(_asset);
    }

    // inclusive of deposited assest
    function totalAssets() public view returns (uint256) {
        return _asset.balanceOf(address(this)) + totalStakedAssets();
    }

    function queuedAssets() public view returns (uint256) {
        return _queuedAssets;
    }

    function reservedAssets() public view returns (uint256) {
        return _reservedAssets;
    }

    function totalStakedAssets() public view returns (uint256) {
        return _eigenLayerStrategy.sharesToUnderlyingView(totalShares());
    }

    function totalShares() public view returns (uint256) {
        return IEigenLayerStrategyManager(_eigenLayerStrategyManager).stakerStrategyShares(address(this), address(_eigenLayerStrategy));
    }

    function sharesToUnderlying(uint256 shares_) public view returns (uint256) {
        return _eigenLayerStrategy.sharesToUnderlyingView(shares_);
    }

    // called by keeper
    function depositIntoStrategy() external onlyOwner {
        _depositIntoStrategy();
    }

    function isDelegate() public view returns (address) {
        return _eignelayerOperator;
    }

    function setDelegate(address operator_) external nonReentrant onlyOwner {
        require (_eigenLayerDelegationManager.paused() == false, "Delegation Manager Paused");

        IDelegationManager.SignatureWithExpiry memory emptySig;
        emptySig.signature = "";
        emptySig.expiry = 0;

        _eigenLayerDelegationManager.delegateTo(operator_, emptySig, "");

        require(_eigenLayerDelegationManager.delegatedTo(address(this)) == operator_, "Delegation failed");

        _eignelayerOperator = operator_;
    }

    function calimer() public view returns (address) {
        return _claimer;
    }

    function setClaimer(address claimer_) external nonReentrant onlyOwner {
        IEigenLayerRewardsCoordinator(_eigenLayerRewardsCoordinator).setClaimerFor(claimer_);

        require (IEigenLayerRewardsCoordinator(_eigenLayerRewardsCoordinator).claimerFor(address(this)) == claimer_, "Failed to set claimer");

        _claimer = claimer_;
    }

    function _depositIntoStrategy() internal nonReentrant {
        require(IEigenLayerStrategyManager(_eigenLayerStrategyManager).paused() == false, "Strategy Manager Paused");

        uint256 balance = _asset.balanceOf(address(this));

        require(balance > _reservedAssets, "No assets to deposit");

        uint256 deposit = balance - _reservedAssets;

        _asset.approve(_eigenLayerStrategyManager, deposit);

        require(_asset.allowance(address(this), _eigenLayerStrategyManager) == deposit, "Token approval failed");

        uint256 shares = IEigenLayerStrategyManager(_eigenLayerStrategyManager).depositIntoStrategy(address(_eigenLayerStrategy), address(_asset), deposit);

        require(shares == deposit, "Strategy deposit failed");

        emit AssetsDepositedIntoStrategy(
            deposit,
            shares,
            address(_eigenLayerStrategy)
        );
    }

    // POC, should receive shares as input and generate IDelegationManager.QueuedWithdrawalParams[] but not enough time to debug
    // Taking calldata from ethers for now
    function initiateEigenlayerWithdrawal(bytes calldata calldata_) external nonReentrant onlyOwner {

        require(bytes4(calldata_[:4]) == 0x0dd8dd02, "Function selector missmatch");

        bytes calldata data = calldata_[4:];

        QueueParams[] memory params = abi.decode(data, (QueueParams[]));

        uint256 shares = params[0].shares[0];

        require(params[0].withdrawer == address(this), "Withdrawer must be this contract");

        require(shares > 0, "Must be bigger than 0");

        require(shares <= IEigenLayerStrategyManager(_eigenLayerStrategyManager).stakerStrategyShares(address(this), address(_eigenLayerStrategy)), "Shares requested too high");

        uint256 assets = _eigenLayerStrategy.sharesToUnderlyingView(shares);

        require(assets > 0, "no assets in strategy");

        (bool success, bytes memory result) = address(_eigenLayerDelegationManager).call(calldata_);
        require(success, "External call failed");

        bytes32[] memory withdrawalRoots = abi.decode(result, (bytes32[]));

        bytes32 withdrawalId = keccak256(abi.encodePacked(msg.sender, _withdrawQueueNonce));

        emit WithdrawalInitiated(
            withdrawalId,
            address(this),
            params[0].withdrawer,
            _withdrawQueueNonce,
            block.number,
            address(_eigenLayerStrategy),
            shares,
            assets,
            withdrawalRoots[0]
        );

        _withdrawQueueNonce += 1;
        _queuedAssets += assets;
        
    }
    
    function completeEigenlayerWithdrawal(IDelegationManager.Withdrawal calldata withdrawal) external nonReentrant onlyOwner {

        IERC20[] memory underlying = new IERC20[](1);
        underlying[0] = _asset;

        uint256 assets = _eigenLayerStrategy.sharesToUnderlyingView(withdrawal.shares[0]);

        try _eigenLayerDelegationManager.completeQueuedWithdrawal(
            withdrawal,
            underlying,
            0, // uint256 middlewareTimesIndex,
            true // bool receiveAsTokens
        ) {
            _queuedAssets -= assets;
            _reservedAssets += assets;
        } catch {
                revert("Complete Withdrawal failed");
        }

        emit WithdrawalCompleted(
            assets,
            withdrawal.shares[0],
            address(_eigenLayerStrategy)
        );
    }

    function shipToL2() external nonReentrant onlyOwner {
        require (IL1StandardBridge(_l1StandardBridgeProxy).paused() == false, "Delegation Manager Paused");

        require (_remoteContract != address(0), "Remote Contract not set");

        bytes memory extraData = abi.encode(_bridgeDepositNonce);

        _asset.approve(_l1StandardBridgeProxy, _reservedAssets);

        require(_asset.allowance(address(this), _l1StandardBridgeProxy) == _reservedAssets, "Token approval failed");

        try IL1StandardBridge(_l1StandardBridgeProxy).depositERC20To(
            address(_asset),
            _remoteAsset,
            _remoteContract,
            _reservedAssets,
            220000,
            extraData
        ) {
            _reservedAssets = 0;
        } 
        catch {
            revert("Failed to bridge");
        }

        emit AssetsShippedToL2(
            _remoteContract,
            _reservedAssets
        );

        require(updateTotalAssetsL2() == true, "Failed to update L2 assets");
    }

    function updateTotalAssetsL2() internal returns (bool) {
        bytes memory message = abi.encodeWithSignature("updateL1Assets(uint256)", totalAssets());

        // Send the message to L2 via the Cross Domain Messenger
        try ICrossDomainMessenger(_l1CrossDomainMessenger).sendMessage(
            _remoteContract, // Address of the L2 contract to call
            message, // Encoded message data
            2000000  // Gas limit for the message execution on L2
        ) {
            return true;
        } 
        catch {
            revert("Failed to send xDomain message");
        }
    }

    // for POC only
    function withdrawFunds(uint amount) external onlyOwner {
        require(_asset.transfer(msg.sender, amount), "Withdrawal failed");
    }


}
