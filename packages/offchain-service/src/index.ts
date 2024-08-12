// import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { createPublicClient, createTestClient, createWalletClient, formatEther, http, parseAbiItem, publicActions } from 'viem';
import { fraxtal, mainnet, fraxtalTestnet, holesky } from 'viem/chains';
import { CronJob } from 'cron';
// import floxiSfrxEth from '../../hardhat/artifacts/contracts/FloxiSfrxEth.sol/FloxiSfrxEth.json' assert { type: 'json' }
import { privateKeyToAccount } from 'viem/accounts';
import {getFraxtalClient, getMainnetClient} from './client';


dotenv.config();

const fClient = getFraxtalClient('testnet');
const mClient = getMainnetClient('testnet');
const deployer = privateKeyToAccount(`0x${process.env.DEPLOYER_PRIVATE_KEY!.slice(2)}`);


// const balance = await fraxtalClient.getBalance({
//     address: account.address,
//     blockTag: 'safe'
// })

// FloxiL1 events
const floxiL1Events = parseAbiItem([
'event AssetsDepositedIntoStrategy(uint256 assets, uint256 shares, address strategy)',
'event WithdrawalInitiated(bytes32 indexed withdrawalId, address staker, address withdrawer, uint256 indexed nonce, uint256 startBlock, address strategy, uint256 shares, uint256 assets, bytes32 indexed withdrawalRoot)',
'event WithdrawalCompleted(uint256 assets, uint256 shares, address strategy)',
'event AssetsShippedToL2(address indexed receiver, uint256 assets)'
]);

// FloxiL2 events
const floxiL2Events = parseAbiItem([
'event Deposit(address indexed from, uint256 amount)',
'event AssetsShippedToL1(address indexed receiver, uint256 assets)',
'event WithdrawalQueued(address indexed account, uint256 indexed nonce, uint256 assets)',
'event WithdrawalsUnlocked(uint256 indexed assetsUnlocked, uint256 fromNonce, uint256 toNonce)'
]);

// FraxFerryL2 events
const fraxFerryL2Events = parseAbiItem([
'event Embark(address indexed sender, uint index, uint amount, uint amountAfterFee, uint timestamp)',
'event Depart(uint batchNo, uint start, uint end, bytes32 hash)'
]);

// FraxFerryL1 events
const fraxFerryL1Events = parseAbiItem([
'event Disembark(uint start, uint end, bytes32 hash)'
]);

// L2StandardBridge events
const l2StandardBridgeEvents = parseAbiItem([
'event DepositFinalized(address indexed l1Token, address indexed l2Token, address indexed from, address to, uint256 amount, bytes extraData)'
]);

//https://github.com/FraxFinance/frax-solidity/blob/master/src/types/constants.ts#L4341C60-L4341C102
// const fraxFerryL2 = '0x67c6A8A715fc726ffD0A40588701813d9eC04d9C';
const fraxFerryL1 = '0x5c5f05cF8528FFe925A2264743bFfEdbAB2b0FE3'; // mainnet
// const l2StandardBridge = '0x4200000000000000000000000000000000000010'
const floxiL2 = '0x4d28a5a7c92de4adb27f52a0c402108842028962' // testnet

const main = async () => {

    console.log((await fraxtalClient.getBlock()).number)
    console.log((await fraxtalClient.getBlock({
        blockTag: 'safe'
      })).number)
    console.log((await fraxtalClient.getBlock({
    blockTag: 'finalized'
    })).number)

    // const unwatchFloxiL1 = mainnetClient.watchEvent({
    //     address: floxiL1,
    //     event: floxiL1Events,
    //     onLogs: logs => console.log(logs[0].eventName)
    // })

    // const unwatchFloxiL2 = fraxtalClient.watchEvent({
    //     address: floxiL2,
    //     event: floxiL2Events,
    //     onLogs: logs => console.log(logs[0].eventName)
    // })

    const unwatchFraxFerryL1 = mainnetClient.watchEvent({
        address: fraxFerryL1,
        event: fraxFerryL1Events,
        onLogs: (logs) => {
           for (const log in logs) {
                console.log(log)
           }
        }
    })

    // const unwatchStandardBridgeL2 = fraxtalClient.watchEvent({
    //     address: l2StandardBridge,
    //     event: l2StandardBridgeEvents,
    //     onLogs: logs => console.log(logs[0].eventName)
    // })

    // const unwatchFraxFerryL2 = fraxtalClient.watchEvent({
    //     address: fraxFerryL2,
    //     event: fraxFerryL2Events,
    //     onLogs: (logs) => {
    //         for (const log in logs) {
    //              console.log(log)
    //         }
    //      }
    // })
}


main();

// L2 events
const floxiL2_Deposit = parseAbiItem('event Deposit(address indexed from, uint256 amount)');
const floxiL2_AssetsShippedToL1 = parseAbiItem('event AssetsShippedToL1(address indexed receiver, uint256 assets)');
const floxiL2_WithdrawalQueued = parseAbiItem('event WithdrawalQueued(address indexed account, uint256 indexed nonce, uint256 assets)');
const floxiL2_WithdrawalsUnlocked = parseAbiItem('event WithdrawalsUnlocked(uint256 indexed assetsUnlocked, uint256 fromNonce, uint256 toNonce)');

const fraxFerryL2_Embark = parseAbiItem('event Embark(address indexed sender, uint index, uint amount, uint amountAfterFee, uint timestamp)');
const fraxFerryL2_Depart = parseAbiItem('event Depart(uint batchNo, uint start, uint end, bytes32 hash)');

const l2StandardBridge_DepositFinalized = parseAbiItem('event DepositFinalized(address indexed l1Token, address indexed l2Token, address indexed from, address to, uint256 amount, bytes extraData)');

// L1 events
const floxiL1_AssetsDepositedIntoStrategy = parseAbiItem('event AssetsDepositedIntoStrategy(uint256 assets, uint256 shares, address strategy)');
const floxiL1_WithdrawalInitiated = parseAbiItem('event WithdrawalInitiated(bytes32 indexed withdrawalId, address staker, address withdrawer, uint256 indexed nonce, uint256 startBlock, address strategy, uint256 shares, uint256 assets, bytes32 indexed withdrawalRoot)');
const floxiL1_WithdrawalCompleted = parseAbiItem('event WithdrawalCompleted(uint256 assets, uint256 shares, address strategy)');
const floxiL1_AssetsShippedToL2 = parseAbiItem('event AssetsShippedToL2(address indexed receiver, uint256 assets)');

const fraxFerryL1_Disembark = parseAbiItem('event Disembark(uint start, uint end, bytes32 hash)');




// dotenv.config();

// const {
//   L2_RPC_URL,
//   L1_RPC_URL,
//   DEPLOYER_PRIVATE_KEY,
//   L1_FLOXI_ADDRESS,
//   L2_FLOXI_ADDRESS,
//   FRA_FERRY_L1_ADDRESS,
//   FRA_FERRY_L2_ADDRESS,
// } = process.env;

// const l1Provider = new ethers.JsonRpcProvider(L1_RPC_URL);
// const l2Provider = new ethers.JsonRpcProvider(L2_RPC_URL);
// const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY!);
// const l1Signer = wallet.connect(l1Provider);
// const l2Signer = wallet.connect(l2Provider);

// const optimismMessenger = new CrossChainMessenger({
//   l1SignerOrProvider: l1Signer,
//   l2SignerOrProvider: l2Signer,
//   l1ChainId: 1,
//   l2ChainId: 10,
//   bedrock: true,
// });

// const FloxiL1ABI = [
//   'event AssetsDepositedIntoStrategy(uint256 assets, uint256 shares, address strategy)',
//   'event WithdrawalInitiated(bytes32 indexed withdrawalId, address staker, address withdrawer, uint256 indexed nonce, uint256 startBlock, address strategy, uint256 shares, uint256 assets, bytes32 indexed withdrawalRoot)',
//   'event WithdrawalCompleted(uint256 assets, uint256 shares, address strategy)',
//   'event AssetsShippedToL2(address indexed receiver, uint256 assets)',
//   'function completeEigenlayerWithdrawal((address,address,address,uint256,uint32,address[],uint256[])) external',
//   'function shipToL2() external',
// ];

// const FloxiL2ABI = [
//   'event AssetsDeposited(address indexed caller, address indexed receiver, uint256 assets, uint256 shares, uint256 fee)',
//   'event AssetsShippedToL1(address indexed receiver, uint256 assets)',
//   'event WithdrawalQueued(address indexed account, uint256 indexed nonce, uint256 assets)',
//   'event WithdrawalsUnlocked(uint256 indexed assetsUnlocked, uint256 fromNonce, uint256 toNonce)',
//   'function unlockWithdrawals(uint256 assets, uint256 maxIterations) external',
// ];

// const fraxFerryL2ABI = [
//   'event Embark(address indexed sender, uint index, uint amount, uint amountAfterFee, uint timestamp)',
//   'event Depart(uint batchNo, uint start, uint end, bytes32 hash)',
//   'event RemoveBatch(uint batchNo)',
//   'event Cancelled(uint index, bool cancel)',
// ];

// const fraxFerryL1ABI = [
//   'event Disembark(uint start, uint end, bytes32 hash)',
// ];

// const floxiL1 = new ethers.Contract(L1_FLOXI_ADDRESS, FloxiL1ABI, l1Signer);
// const floxiL2 = new ethers.Contract(L2_FLOXI_ADDRESS, FloxiL2ABI, l2Signer);
// const fraxFerryL2 = new ethers.Contract(FRA_FERRY_L2_ADDRESS, fraxFerryL2ABI, l2Signer);
// const fraxFerryL1 = new ethers.Contract(FRA_FERRY_L1_ADDRESS, fraxFerryL1ABI, l1Signer);

// // Variables to store state
// let departEvents: any = {};
// const withdrawalQueue: any = [];

// // Deposit Flow

// // Listen to AssetsDeposited event on Floxi L2
// floxiL2.on('Deposit', (caller, receiver, assets, shares, fee) => {
//     console.log(`AssetsDeposited on L2: caller=${caller}, receiver=${receiver}, assets=${assets}, shares=${shares}, fee=${fee}`);
// });

// // Listen to AssetsShippedToL1 event on Floxi L2
// floxiL2.on('AssetsShippedToL1', (receiver, assets) => {
//     console.log(`Assets shipped to L1: receiver=${receiver}, assets=${assets}`);
// });

// // Listen to Embark event on FraxFerry L2
// fraxFerryL2.on('Embark', (sender, index, amount, amountAfterFee, timestamp) => {
//     console.log(`Embark event on L2: sender=${sender}, index=${index}, amount=${amount}, amountAfterFee=${amountAfterFee}, timestamp=${timestamp}`);
// });

// // Listen to Depart event on FraxFerry L2
// fraxFerryL2.on('Depart', (batchNo, start, end, hash) => {
//     console.log(`Depart event on L2: batchNo=${batchNo}, start=${start}, end=${end}, hash=${hash}`);
//     departEvents[batchNo] = { start, end, hash };
// });

// // Listen to RemoveBatch event on FraxFerry L2
// fraxFerryL2.on('RemoveBatch', (batchNo) => {
//     console.log(`RemoveBatch event on L2: batchNo=${batchNo}`);
//     delete departEvents[batchNo];
// });

// // Listen to Cancelled event on FraxFerry L2
// fraxFerryL2.on('Cancelled', (index, cancel) => {
//     console.log(`Cancelled event on L2: index=${index}, cancel=${cancel}`);
// });

// // Listen to Disembark event on FraxFerry L1
// fraxFerryL1.on('Disembark', (start, end, hash) => {
//     console.log(`Disembark event on L1: start=${start}, end=${end}, hash=${hash}`);
//     for (const batchNo in departEvents) {
//         const { start: recordedStart, end: recordedEnd, hash: recordedHash } = departEvents[batchNo];
//         if (recordedStart === start && recordedEnd === end && recordedHash === hash) {
//             console.log(`Match found for batchNo=${batchNo}. Proceeding with L1 deposit.`);
//             floxiL1.depositAssetsIntoStrategy();
//             delete departEvents[batchNo];
//             break;
//         }
//     }
// });


// // Withdrawal Flow

// // Listen to WithdrawalQueued event on Floxi L2
// floxiL2.on('WithdrawalQueued', (account, nonce, assets) => {
//     console.log(`WithdrawalQueued on L2: account=${account}, nonce=${nonce}, assets=${assets}`);
// });

// // Listen to WithdrawalsUnlocked event on Floxi L2
// floxiL2.on('WithdrawalsUnlocked', (assetsUnlocked, fromNonce, toNonce) => {
//     console.log(`WithdrawalsUnlocked on L2: assetsUnlocked=${assetsUnlocked}, fromNonce=${fromNonce}, toNonce=${toNonce}`);
// });


// floxiL2.on('WithdrawalQueued', async (account, nonce, assets, event) => {
//   const withdrawalHash = event.transactionHash;
//   console.log(`WithdrawalQueued on L2: ${withdrawalHash}`);

//   const messageStatus = await optimismMessenger.getMessageStatus(withdrawalHash);
//   if (messageStatus === MessageStatus.RELAYED) {
//     console.log(`Withdrawal safe on L1 for account: ${account}, assets: ${assets}`);
//     await floxiL1.initiateEigenlayerWithdrawal([account, nonce, assets]);
//   }
// });

// floxiL1.on('WithdrawalInitiated', (withdrawalId, staker, withdrawer, nonce, startBlock, strategy, shares, assets, withdrawalRoot) => {
//   console.log(`WithdrawalInitiated on L1: ${withdrawalId}`);
//   withdrawalQueue.push({ withdrawalId, staker, withdrawer, nonce, startBlock, strategy, shares, assets, withdrawalRoot, timestamp: Date.now() });
// });

// floxiL1.on('WithdrawalCompleted', async (assets, shares, strategy) => {
//   console.log(`WithdrawalCompleted: assets=${assets}, shares=${shares}, strategy=${strategy}`);
//   const currentTime = Date.now();

//   for (const record of withdrawalQueue) {
//     if (currentTime - record.timestamp > 30 * 24 * 60 * 60 * 1000) { // 1 month
//       try {
//         await floxiL1.completeEigenlayerWithdrawal(record);
//         withdrawalQueue.splice(withdrawalQueue.indexOf(record), 1);
//         console.log(`Withdrawal ${record.withdrawalId} processed and removed from queue`);
//       } catch (error) {
//         console.error(`Error processing withdrawal ${record.withdrawalId}:`, error);
//       }
//     }
//   }

//   try {
//     await floxiL1.shipToL2();
//     console.log('Assets shipped back to L2.');
//   } catch (error) {
//     console.error('Error shipping assets to L2:', error);
//   }
// });

// floxiL2.on('WithdrawalsUnlocked', async (assetsUnlocked, fromNonce, toNonce) => {
//   console.log(`WithdrawalsUnlocked: assetsUnlocked=${assetsUnlocked}, fromNonce=${fromNonce}, toNonce=${toNonce}`);
// });
