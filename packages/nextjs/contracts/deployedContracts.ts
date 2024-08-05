/**
 * This file is autogenerated by Scaffold-ETH.
 * You should not edit it manually or your changes might be overwritten.
 */
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const deployedContracts = {
  31337: {
    FloxiSfraxEth: {
      address: "0x0B306BF915C4d645ff596e518fAf3F9669b97016",
      abi: [
        {
          inputs: [
            {
              internalType: "contract IERC20",
              name: "asset_",
              type: "address",
            },
            {
              internalType: "address",
              name: "treasury_",
              type: "address",
            },
          ],
          stateMutability: "nonpayable",
          type: "constructor",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "target",
              type: "address",
            },
          ],
          name: "AddressEmptyCode",
          type: "error",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "account",
              type: "address",
            },
          ],
          name: "AddressInsufficientBalance",
          type: "error",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "spender",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "allowance",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "needed",
              type: "uint256",
            },
          ],
          name: "ERC20InsufficientAllowance",
          type: "error",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "sender",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "balance",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "needed",
              type: "uint256",
            },
          ],
          name: "ERC20InsufficientBalance",
          type: "error",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "approver",
              type: "address",
            },
          ],
          name: "ERC20InvalidApprover",
          type: "error",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "receiver",
              type: "address",
            },
          ],
          name: "ERC20InvalidReceiver",
          type: "error",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "sender",
              type: "address",
            },
          ],
          name: "ERC20InvalidSender",
          type: "error",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "spender",
              type: "address",
            },
          ],
          name: "ERC20InvalidSpender",
          type: "error",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "receiver",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "assets",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "max",
              type: "uint256",
            },
          ],
          name: "ERC4626ExceededMaxDeposit",
          type: "error",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "receiver",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "shares",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "max",
              type: "uint256",
            },
          ],
          name: "ERC4626ExceededMaxMint",
          type: "error",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "owner",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "shares",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "max",
              type: "uint256",
            },
          ],
          name: "ERC4626ExceededMaxRedeem",
          type: "error",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "owner",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "assets",
              type: "uint256",
            },
            {
              internalType: "uint256",
              name: "max",
              type: "uint256",
            },
          ],
          name: "ERC4626ExceededMaxWithdraw",
          type: "error",
        },
        {
          inputs: [],
          name: "FailedInnerCall",
          type: "error",
        },
        {
          inputs: [],
          name: "MathOverflowedMulDiv",
          type: "error",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "token",
              type: "address",
            },
          ],
          name: "SafeERC20FailedOperation",
          type: "error",
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: "address",
              name: "owner",
              type: "address",
            },
            {
              indexed: true,
              internalType: "address",
              name: "spender",
              type: "address",
            },
            {
              indexed: false,
              internalType: "uint256",
              name: "value",
              type: "uint256",
            },
          ],
          name: "Approval",
          type: "event",
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: "address",
              name: "sender",
              type: "address",
            },
            {
              indexed: true,
              internalType: "address",
              name: "owner",
              type: "address",
            },
            {
              indexed: false,
              internalType: "uint256",
              name: "assets",
              type: "uint256",
            },
            {
              indexed: false,
              internalType: "uint256",
              name: "shares",
              type: "uint256",
            },
          ],
          name: "Deposit",
          type: "event",
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: "address",
              name: "from",
              type: "address",
            },
            {
              indexed: true,
              internalType: "address",
              name: "to",
              type: "address",
            },
            {
              indexed: false,
              internalType: "uint256",
              name: "value",
              type: "uint256",
            },
          ],
          name: "Transfer",
          type: "event",
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: "address",
              name: "sender",
              type: "address",
            },
            {
              indexed: true,
              internalType: "address",
              name: "receiver",
              type: "address",
            },
            {
              indexed: true,
              internalType: "address",
              name: "owner",
              type: "address",
            },
            {
              indexed: false,
              internalType: "uint256",
              name: "assets",
              type: "uint256",
            },
            {
              indexed: false,
              internalType: "uint256",
              name: "shares",
              type: "uint256",
            },
          ],
          name: "Withdraw",
          type: "event",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "owner",
              type: "address",
            },
            {
              internalType: "address",
              name: "spender",
              type: "address",
            },
          ],
          name: "allowance",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "spender",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "value",
              type: "uint256",
            },
          ],
          name: "approve",
          outputs: [
            {
              internalType: "bool",
              name: "",
              type: "bool",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [],
          name: "asset",
          outputs: [
            {
              internalType: "address",
              name: "",
              type: "address",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "account",
              type: "address",
            },
          ],
          name: "balanceOf",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "uint256",
              name: "shares",
              type: "uint256",
            },
          ],
          name: "convertToAssets",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "uint256",
              name: "assets",
              type: "uint256",
            },
          ],
          name: "convertToShares",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [],
          name: "decimals",
          outputs: [
            {
              internalType: "uint8",
              name: "",
              type: "uint8",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "uint256",
              name: "assets",
              type: "uint256",
            },
            {
              internalType: "address",
              name: "receiver",
              type: "address",
            },
          ],
          name: "deposit",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "",
              type: "address",
            },
          ],
          name: "maxDeposit",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "",
              type: "address",
            },
          ],
          name: "maxMint",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "owner",
              type: "address",
            },
          ],
          name: "maxRedeem",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "owner",
              type: "address",
            },
          ],
          name: "maxWithdraw",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "uint256",
              name: "shares",
              type: "uint256",
            },
            {
              internalType: "address",
              name: "receiver",
              type: "address",
            },
          ],
          name: "mint",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [],
          name: "name",
          outputs: [
            {
              internalType: "string",
              name: "",
              type: "string",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "uint256",
              name: "assets",
              type: "uint256",
            },
          ],
          name: "previewDeposit",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "uint256",
              name: "shares",
              type: "uint256",
            },
          ],
          name: "previewMint",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "uint256",
              name: "shares",
              type: "uint256",
            },
          ],
          name: "previewRedeem",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "uint256",
              name: "assets",
              type: "uint256",
            },
          ],
          name: "previewWithdraw",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "uint256",
              name: "shares",
              type: "uint256",
            },
            {
              internalType: "address",
              name: "receiver",
              type: "address",
            },
            {
              internalType: "address",
              name: "owner",
              type: "address",
            },
          ],
          name: "redeem",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [],
          name: "symbol",
          outputs: [
            {
              internalType: "string",
              name: "",
              type: "string",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [],
          name: "totalAssets",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [],
          name: "totalSupply",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "to",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "value",
              type: "uint256",
            },
          ],
          name: "transfer",
          outputs: [
            {
              internalType: "bool",
              name: "",
              type: "bool",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "address",
              name: "from",
              type: "address",
            },
            {
              internalType: "address",
              name: "to",
              type: "address",
            },
            {
              internalType: "uint256",
              name: "value",
              type: "uint256",
            },
          ],
          name: "transferFrom",
          outputs: [
            {
              internalType: "bool",
              name: "",
              type: "bool",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [
            {
              internalType: "uint256",
              name: "assets",
              type: "uint256",
            },
            {
              internalType: "address",
              name: "receiver",
              type: "address",
            },
            {
              internalType: "address",
              name: "owner",
              type: "address",
            },
          ],
          name: "withdraw",
          outputs: [
            {
              internalType: "uint256",
              name: "",
              type: "uint256",
            },
          ],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      inheritedFunctions: {
        allowance: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        approve: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        asset: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        balanceOf: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        convertToAssets: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        convertToShares: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        decimals: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        deposit: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        maxDeposit: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        maxMint: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        maxRedeem: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        maxWithdraw: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        mint: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        name: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        previewDeposit: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        previewMint: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        previewRedeem: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        previewWithdraw: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        redeem: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        symbol: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        totalAssets: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        totalSupply: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        transfer: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        transferFrom: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
        withdraw: "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol",
      },
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
