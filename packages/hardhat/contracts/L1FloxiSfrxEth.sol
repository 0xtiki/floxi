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

    struct QP {
    address[] strategies;
    uint256[] shares;
    address withdrawer;
}

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

    // POC, should receive shares as input and generate IDelegationManager.QueuedWithdrawalParams[] but not enough time to debug
    // Taking calldata from ethers for now
    function initiateEigenlayerWithdrawal(bytes calldata calldata_) external nonReentrant onlyOwner {

        (bool success, bytes memory result) = address(_eigenLayerDelegationManager).call(calldata_);
        require(success, "External call failed");

        bytes32[] memory withdrawalRoots = abi.decode(result, (bytes32[]));

        bytes32 withdrawalId = keccak256(abi.encodePacked(msg.sender, _withdrawQueueNonce));

        bytes calldata data = calldata_[4:];

        QP[] memory params = abi.decode(data, (QP[]));

        emit WithdrawalQueued(
            withdrawalId,
            address(this),
            params[0].withdrawer,
            _withdrawQueueNonce,
            block.number,
            address(_eigenLayerStrategy),
            params[0].shares[0],
            withdrawalRoots[0]
        );

        _withdrawQueueNonce += 1;

        // QP[] memory params2[0] = 
        // // Declare and initialize strategies array
        // address[] memory strategies = new address[](1);
        // strategies[0] = address(_eigenLayerStrategy);

        // // Declare and initialize shares array
        // uint256[] memory shares = new uint256[](1);
        // shares[0] = shares_;

        // // Declare and initialize queuedWithdrawalParams array
        // IDelegationManager.QueuedWithdrawalParams[] memory queuedWithdrawalParams = new IDelegationManager.QueuedWithdrawalParams[](1);

        // // Initialize the first element of the struct array
        // queuedWithdrawalParams[0] = IDelegationManager.QueuedWithdrawalParams({
        //     strategies: strategies,
        //     shares: shares,
        //     withdrawer: address(this)
        // });

        // // Encode the calldata
        // bytes memory dta = abi.encodeWithSignature(
        //     "queueWithdrawals((address[],uint256[],address)[])",
        //     queuedWithdrawalParams
        // );

        // console.logBytes(dta);


        // bytes memory dta = abi.encodeWithSignature(
        //     "queueWithdrawals((address[],uint256[],address)[])",
        //     queuedWithdrawalParams
        // );

        // console.logBytes(dta);

        // (bool success, bytes memory result) = address(_eigenLayerDelegationManager).call(
        //     hex"0dd8dd02000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000e5b6f5e695ba6e4aed92b68c4cc8df1160d69a8100000000000000000000000000000000000000000000000000000000000000010000000000000000000000008ca7a5d6f3acd3a7a8bc468a8cd0fb14b6bd28b600000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000008ac7230489e80000"
        // );
        // require(success, "External call failed");

        // bytes32[] memory withdrawalRoots = new bytes32[](1);

        // bytes32[] memory withdrawalRoots = _eigenLayerDelegationManager.queueWithdrawals(queuedWithdrawalParams);
    }
    
    function completeEigenlayerWithdrawal(IDelegationManager.Withdrawal calldata withdrawal) external {

        IERC20[] memory assets = new IERC20[](1);
        assets[0] = _asset;

        _eigenLayerDelegationManager.completeQueuedWithdrawal(
            withdrawal,
            assets,
            0, // uint256 middlewareTimesIndex,
            true // bool receiveAsTokens
        );
    }

    // will be done by keeper
    function initiateBridgeWithdrawal(uint256 shares) external nonReentrant onlyOwner{
        // TBD
    }

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
