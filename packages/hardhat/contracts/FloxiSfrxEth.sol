// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
// import "hardhat/console.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/DoubleEndedQueue.sol";

interface IFraxFerry {
    function embarkWithRecipient(uint amount, address recipient) external;

    function paused() external view returns (bool);
}

/**
 * @title FloxiSfrxEth
 * @dev ERC4626 vault that handles deposits, minting, and bridging of ERC20 tokens to another chain.
 *  Fees expressed in basis points (bp).
 */
contract FloxiSfrxEth is ERC4626, ReentrancyGuard, Ownable {
    using Math for uint256;

    event AssetsShippedToL1(
        address indexed receiver,
        uint256 assets
    );

    event WithdrawalQueued(
        address indexed account,
        uint256 indexed nonce,
        uint256 assets
    );

    event WithdrawalsUnlocked(
        uint256 indexed assetsUnlocked,
        uint256 fromNonce,
        uint256 toNonce
    );

    // === Constants and immutables ===

    // The vaults underlying asset on local chain (sfrxEth)
    IERC20 private immutable _asset;

    // Remote asset address on the destination chain (sfrxEth)
    address private immutable _remoteAsset;

    // Floxi vault contract address on the destination chain
    address private immutable _remoteContract;

    // Treasury address for collecting fees
    address private immutable _treasury;

    // Address of the L2 Standard Bridge proxy
    // address private immutable _l2StandardBridgeProxy;

    // FraxFerry V2 Fraxtal https://github.com/FraxFinance/frax-solidity/blob/master/src/types/constants.ts#L4341C60-L4341C102
    address private immutable _fraxFerry;

    // Scale for basis point calculations
    uint256 private constant _BASIS_POINT_SCALE = 1e4;

    // Conversion factor from gwei to wei (for gas estimates)
    uint256 private constant _WEI_PER_GWEI = 1e9;

    // Estimated gas for L1 transactions
    uint256 private constant _L1_GAS_ESTIMATE = 78500;

    // Placeholder gas price, intended to be fetched from an oracle in a production setup
    uint256 private constant _GAS_PRICE = 30;

    // Placeholder, will be defined more appropriately in production (probably adding a batcher at some point)
    uint256 private constant _MIN_DEPOSIT = 1000000000000000; // 0.001 ether

    uint256 private constant _MAX_QUEUED_WITHDRAWALS = 5;


    constructor(
        IERC20 asset_,
        address remoteAsset_,
        address remoteContract_,
        address treasury_,
        // address l2StandardBridgeProxy_,
        address fraxFerry_
    )
        ERC20("Floxi Staked Frax ETH", "fsfrxEth")
        ERC4626(asset_)
        Ownable(msg.sender)
    {
        _asset = asset_;
        _remoteAsset = remoteAsset_;
        _remoteContract = remoteContract_;
        _treasury = treasury_;
        // _l2StandardBridgeProxy = l2StandardBridgeProxy_;
        _fraxFerry = fraxFerry_;
    }

    // === Variables ===

    // Tracks assets on L1
    uint256 private _l1Assets = 0;

    DoubleEndedQueue.Bytes32Deque private _withdrawalQueue;

    mapping(address account => uint256) private _unlockedAssets;

    mapping(address account => uint256) private _queuedAssets;

    mapping(bytes32 id => uint256) private _queuedWithdrawals;

    mapping(address account => uint256) private _activeWithdrawalsCount;

    // uint256 private _reservedAssets;

    uint256 private _withdrawalNonce;

    uint256 private _unlockNonce;

    /**
     * @dev Handles deposits into the vault, charges an entry fee, and bridges assets to L1.
     * @param caller The address initiating the deposit.
     * @param receiver The address receiving the shares.
     * @param assets The amount of assets being deposited.
     * @param shares The amount of shares being minted.
     */    
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal virtual override nonReentrant {

        require (assets > _MIN_DEPOSIT, "Minimum deposit amount not met");

        require (IFraxFerry(_fraxFerry).paused() == false);

        uint256 fee = _feeOnTotal(assets, _entryFeeBasisPoints());
        address recipient = _entryFeeRecipient();

        super._deposit(caller, receiver, assets, shares);

        uint256 feeInclusive = assets - fee;

        if (fee > 0 && recipient != address(this)) {
            _asset.transfer(recipient, fee);
        }

        shipToL1(feeInclusive);
    }

    function shipToL1(uint256 assets) internal {

        bool success = _asset.approve(_fraxFerry, assets + _asset.allowance(address(this), _fraxFerry));

        require(success, "Approval failed");

        try IFraxFerry(_fraxFerry).embarkWithRecipient(assets, _remoteContract) {
             _l1Assets += assets;

            emit AssetsShippedToL1(
                _remoteContract,
                assets
            );
        }
        catch {
            revert("Failed to bridge assets");
        }
    }

    // keeper in case of cancelled ferry or dust (ferry does some rounding on amount)
    function forceShipToL1(uint256 assets) public onlyOwner {
        shipToL1(assets);
    }

    function queueWithdrawal(uint256 assets) public returns (uint256) {
        uint256 maxAssets = maxWithdraw(msg.sender) - _queuedAssets[msg.sender];

        require(assets > maxAssets, "requested withdrawal exceeds balance");

        require(_activeWithdrawalsCount[msg.sender] < _MAX_QUEUED_WITHDRAWALS);

        bytes32 addressToBytes32 = bytes32(uint256(uint160(msg.sender)));

        DoubleEndedQueue.pushBack(_withdrawalQueue, addressToBytes32);

        bytes32 uniqueId = keccak256(abi.encode(msg.sender, _withdrawalNonce));

        _queuedWithdrawals[uniqueId] = assets;

        _queuedAssets[msg.sender] += assets;

        _activeWithdrawalsCount[msg.sender] += 1;

        emit WithdrawalQueued(
            msg.sender,
            _withdrawalNonce,
            assets
        );

        _withdrawalNonce += 1;

        return assets;
    }

    // only xDomainMessenger from remoteContract
    function unlockWithdrawals(uint256 assets, uint256 maxIterations) external onlyOwner {
        uint256 iterations = 0;
        uint256 availableAssets = _asset.balanceOf(address(this));
        uint256 unlockFrom = _unlockNonce;
        uint256 totalUnlockedAssets;

        for (uint256 i = 0; i < availableAssets && iterations < maxIterations;) {

            if (DoubleEndedQueue.empty(_withdrawalQueue)) {
                break;
            }

            bytes32 withdrawer = DoubleEndedQueue.popFront(_withdrawalQueue);

            address bytes32ToAddress = address(uint160(uint256(withdrawer)));

            bytes32 uniqueId = keccak256(abi.encode(bytes32ToAddress, _unlockNonce));

            assets = _queuedWithdrawals[uniqueId];

            _unlockedAssets[bytes32ToAddress] += assets;

            totalUnlockedAssets += assets;

            _queuedAssets[bytes32ToAddress] -= assets;

            _unlockNonce += 1;

            i += assets;

            iterations += 1;
        }

        uint256 unlockTo = _unlockNonce;

        emit WithdrawalsUnlocked(
            totalUnlockedAssets,
            unlockFrom,
            unlockTo
        );
    }

    modifier onlyUnlocked(uint256 assets) {
        require(_unlockedAssets[msg.sender] >= assets, "Not enough assets unlocked for withdrawal");
        _;
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares ) internal override onlyUnlocked(assets) {
        _unlockedAssets[msg.sender] -= assets;
        
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    /**
     * @dev Overrides {IERC4626-totalAssets} to include assets on L1.
     * @return The total assets managed by this vault.
     */
    function totalAssets() public view override returns (uint256) {
        return _asset.balanceOf(address(this)) + _l1Assets;
    }

    /**
     * @dev Convenience function to see L1 assets managed by this vault.
     * @return L1 assets managed by this vault.
     */
    function getL1Assets() external view returns (uint256) {
        return _l1Assets;
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
     * @dev Preview taking an entry fee on deposit. Overrides {IERC4626-previewDeposit}.
     * @param assets The amount of assets to deposit.
     * @return The number of shares corresponding to the deposited assets after fees.
     */
    function previewDeposit(uint256 assets) public view virtual override returns (uint256) {
        uint256 fee = _feeOnTotal(assets, _entryFeeBasisPoints());
        return super.previewDeposit(assets - fee);
    }

    /**
     * @dev Preview adding an entry fee on mint. Overrides {IERC4626-previewMint}.
     * @param shares The number of shares to mint.
     * @return The number of assets required to mint the shares, including fees.
     */
    function previewMint(uint256 shares) public view virtual override returns (uint256) {
        uint256 assets = super.previewMint(shares);
        return assets + _feeOnRaw(assets, _entryFeeBasisPoints());
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
}