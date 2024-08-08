// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

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

interface ISignatureUtils {
    // @notice Struct that bundles together a signature and an expiration time for the signature. Used primarily for stack management.
    struct SignatureWithExpiry {
        // the signature itself, formatted as a single bytes object
        bytes signature;
        // the expiration timestamp (UTC) of the signature
        uint256 expiry;
    }
}

interface IEigenLayerDelegationManager {
    function delegateTo(
        address operato,
        ISignatureUtils.SignatureWithExpiry memory approverSignatureAndExpiry,
        bytes32 approverSaltr
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
}

contract L1FloxiSfrxEth is ERC4626, ReentrancyGuard, Ownable {
    IERC20 private immutable _asset; // sfraxEth l1
    address private immutable _l2Asset; // sfraxEth l2
    address private immutable _remoteContract; // floxi l2
    // address private immutable _keeperContract;
    address private immutable _l1StandardBridgeProxy;
    address private immutable _eigenLayerStrategyManager;
    address private immutable _eigenLayerStrategy;
    address private immutable _eigenLayerDelegationManager;

    constructor(
        IERC20 asset_,
        address l2Asset_,
        address remoteContract_,
        // address keeperContract_,
        address l1StandardBridgeProxy_,
        address eigenLayerStrategyManager_,
        address eigenLayerStrategy_,
        address eigenLayerDelegationManager_
    ) 
        Ownable(msg.sender)
        ERC20("Floxi Staked Frax ETH", "fsfrxEth")
        ERC4626(asset_)
    {
        _asset = asset_;
        _l2Asset = l2Asset_;
        _remoteContract = remoteContract_;
        // _keeperContract = keeperContract_;
        _l1StandardBridgeProxy = l1StandardBridgeProxy_;
        _eigenLayerStrategyManager = eigenLayerStrategyManager_;
        _eigenLayerStrategy = eigenLayerStrategy_;
        _eigenLayerDelegationManager = eigenLayerDelegationManager_;
    }

    uint256 public stakedAssets = 0;
    address private _eignelayerOperator;

    // will be done by keeper in production
    function finalizeWithdrawal(
        uint256 _amount
        // bytes calldata _extraData

    ) external onlyOwner {

        require (! IFraxtalL1StandardBridge(_l1StandardBridgeProxy).paused());

        try IFraxtalL1StandardBridge(_l1StandardBridgeProxy).finalizeERC20Withdrawal(
            address(_asset),
            _l2Asset,
            _remoteContract,
            address(this),
            _amount,
            "" // _extraData
        ) {
            _depositIntoStrategy();
        } catch {
                revert("Bridge transfer failed");
        }
    }

    function totalAssets() public view override returns (uint256) {
        return _asset.balanceOf(address(this)) + stakedAssets;
    }

    // just for POC until bridge works
    function depositIntoStrategy() external onlyOwner {
        _depositIntoStrategy();
    }

    function delegate(address operator_) external nonReentrant onlyOwner {
        require (IEigenLayerDelegationManager(_eigenLayerDelegationManager).paused() == false, "Delegation Manager Paused");

        ISignatureUtils.SignatureWithExpiry memory emptySig;
        emptySig.signature = "";
        emptySig.expiry = 0;

        IEigenLayerDelegationManager(_eigenLayerDelegationManager).delegateTo(operator_, emptySig, "");

        _eignelayerOperator = operator_;
    }

    function _depositIntoStrategy() internal nonReentrant returns (uint256 shares){
        require (IEigenLayerStrategyManager(_eigenLayerStrategyManager).paused() == false, "Strategy Manager Paused");

        uint256 balance = _asset.balanceOf(address(this));
        require (balance > 0, "No assets to deposit");

        // Approve and deposit sfrxETH into EigenLayer
        _asset.approve(_eigenLayerStrategyManager, balance);

        require (_asset.allowance(address(this), _eigenLayerStrategyManager) == balance, "Token approval failed");

        shares = IEigenLayerStrategyManager(_eigenLayerStrategyManager).depositIntoStrategy(_eigenLayerStrategy, address(_asset), balance);

        require (shares == balance, "Strategy deposit failed");

        stakedAssets += balance;

        return (shares);
    }
}
