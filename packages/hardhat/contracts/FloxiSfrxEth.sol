// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
// import "hardhat/console.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IL2StandardBridge {
    function bridgeERC20To(
        address _localToken,
        address _remoteToken,
        address __to,
        uint256 _amount,
        uint32 _minGasLimit,
        bytes calldata _extraData
    ) external;

    function paused() external view returns (bool);
}

/**
 * @title FloxiSfrxEth
 * @dev ERC4626 vault that handles deposits, minting, and bridging of ERC20 tokens to another chain.
 *  Fees expressed in basis points (bp).
 */
contract FloxiSfrxEth is ERC4626, ReentrancyGuard {
    using Math for uint256;

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
    address private immutable _l2StandardBridgeProxy;

    // Function selector for the L1 deposit function (on remote Floxi vault contract)
    bytes4 private immutable _l1Selector;

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

    constructor(
        IERC20 asset_,
        address remoteAsset_,
        address remoteContract_,
        address treasury_,
        address l2StandardBridgeProxy_,
        bytes4 l1Selector_
    )
        ERC20("Floxi Staked Frax ETH", "fsfrxEth")
        ERC4626(asset_)
    {
        _asset = asset_;
        _remoteAsset = remoteAsset_;
        _remoteContract = remoteContract_;
        _treasury = treasury_;
        _l2StandardBridgeProxy = l2StandardBridgeProxy_;
        _l1Selector = l1Selector_;
    }

    // === Variables ===

    // Tracks assets on L1
    uint256 private _l1Assets = 0;

    // === Overrides ===

    /// @dev Make more resistant against inflation attacks by overriding default offset
    // function _decimalsOffset() internal pure override returns (uint8) {
    //     return 10;
    // }

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
     * @dev Handles deposits into the vault, charges an entry fee, and bridges assets to L1.
     * @param caller The address initiating the deposit.
     * @param receiver The address receiving the shares.
     * @param assets The amount of assets being deposited.
     * @param shares The amount of shares being minted.
     */    
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal virtual override nonReentrant {

        require (assets > _MIN_DEPOSIT, "Minimum deposit amount not met");

        require (IL2StandardBridge(_l2StandardBridgeProxy).paused() == false);

        uint256 fee = _feeOnTotal(assets, _entryFeeBasisPoints());
        address recipient = _entryFeeRecipient();

        super._deposit(caller, receiver, assets, shares);

        if (fee > 0 && recipient != address(this)) {
            SafeERC20.safeTransfer(IERC20(asset()), recipient, fee);
        }

        // bytes memory extraData = abi.encodeWithSelector(
        //     _l1Selector,
        //     assets - fee,
        //     _remoteContract
        // );

        try IL2StandardBridge(_l2StandardBridgeProxy).bridgeERC20To(
            address(_asset),
            _remoteAsset,
            _remoteContract,
            assets - fee,
            120000,
            ""
        ) {
            _l1Assets += assets - fee;
        } catch {
                revert("Bridge transfer failed");
        }
    }

    // /// @dev Send exit fee to {_exitFeeRecipient}. See {IERC4626-_deposit}.
    // function _withdraw(
    //     address caller,
    //     address receiver,
    //     address owner,
    //     uint256 assets,
    //     uint256 shares
    // ) internal virtual override {
    //     uint256 fee = _feeOnRaw(assets, _exitFeeBasisPoints());
    //     address recipient = _exitFeeRecipient();

    //     super._withdraw(caller, receiver, owner, assets, shares);

    //     if (fee > 0 && recipient != address(this)) {
    //         SafeERC20.safeTransfer(IERC20(asset()), recipient, fee);
    //     }
    // }

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