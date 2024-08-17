// import floxiSfrxEth from '../../hardhat/artifacts/contracts/FloxiSfrxEth.sol/FloxiSfrxEth.json' assert { type: 'json' }
import dotenv from 'dotenv';
import { Log, decodeAbiParameters, encodeFunctionData, parseAbi, parseAbiItem, parseAbiParameters } from 'viem';
import { CronJob } from 'cron';
import { privateKeyToAccount } from 'viem/accounts';
import { getFraxtalClient, getMainnetClient, getMainnetWalletClient } from './client';
import addresses from './addresses';
import { setTimeout } from "timers/promises";
import delegationManagerAbi from './delegationManagerAbi.json';

dotenv.config();

const env = 'testnet';

const l1 = ((en) => {
    if (en === 'mainnet') {
        return addresses.mainnet;
    } else {
        return addresses.holesky;
    }
})(env)

const l2 = ((en) => {
    if (en === 'mainnet') {
        return addresses.fraxtal;
    } else {
        return addresses.fraxtalTestnet;
    }
})(env)

const l2Client = getFraxtalClient(env);
const l1Client = getMainnetClient(env);
const deployer = privateKeyToAccount(`0x${process.env.DEPLOYER_PRIVATE_KEY!.slice(2)}`);
const mWalletClient = getMainnetWalletClient(env);


// l2.fraxFerry = '0x1794Be9dFEdF17619386fE69C756448f9cF64734';
// l2.floxiL2 = '0xb0754B937bD306fE72264274A61BC03F43FB685F';
// l1.fraxFerry = '0x6014c4fD1BC5C8FC8c70838644b095AFCa53F568'


// const fraxFerryL1Abi = parseAbi([
//     'function transferOwnership(address newOwner) external',
// ]);

// console.log(deployer.address)

// const { request } = await l1Client.simulateContract({
//     address: l1.fraxFerry as `0x${string}`,
//     abi: fraxFerryL1Abi,
//     functionName: 'transferOwnership',
//     args:[l2.floxiL2 as `0x${string}`],
//     account: deployer,
//     gas: 200000n
// });

// const txhash = await mWalletClient.writeContract(request);

// console.log(txhash);

// const unwatch = l1Client.watchPendingTransactions( 
//     { onTransactions: hashes => console.log(hashes) }
// )
  

console.log(`account balance fraxtal: ${await l2Client.getBalance({
    address: deployer.address,
    blockTag: 'safe'
})}`)

console.log(`account balance mainnet: ${await l1Client.getBalance({
    address: deployer.address,
    blockTag: 'safe'
})}`)


// FloxiL1 events
const floxiL1Events = {
    assetsDepositedIntoStrategy: parseAbiItem('event AssetsDepositedIntoStrategy(uint256 assets, uint256 shares, address strategy)'),
    withdrawalInitiated: parseAbiItem('event WithdrawalInitiated(bytes32 indexed withdrawalId, address staker, address withdrawer, uint256 indexed nonce, uint256 startBlock, address strategy, uint256 shares, uint256 assets, bytes32 indexed withdrawalRoot)'),
    withdrawalCompleted: parseAbiItem('event WithdrawalCompleted(uint256 assets, uint256 shares, address strategy)'),
    // assetsShippedToL2: parseAbiItem('event AssetsShippedToL2(address indexed receiver, uint256 assets)'),
}

const eigenlayerEvents = {
    withdrawalQueued: parseAbiItem('event WithdrawalQueued(bytes32 withdrawalRoot,(address staker,address delegatedTo,address withdrawer,uint256 nonce,uint32 startBlock,address[] strategies,uint256[] shares))'),
}

// FloxiL2 events
const floxiL2Events = {
    deposit: parseAbiItem('event Deposit(address indexed from, uint256 amount)'),
    // assetsShippedToL1: parseAbiItem('event AssetsShippedToL1(address indexed receiver, uint256 assets)'),
    transfer: parseAbiItem('event Transfer(address from, address to, uint256 value)'),
    withdrawalQueued: parseAbiItem('event WithdrawalQueued(address indexed account, uint256 indexed nonce, uint256 assets)'),
    withdrawalsUnlocked: parseAbiItem('event WithdrawalsUnlocked(uint256 indexed assetsUnlocked, uint256 fromNonce, uint256 toNonce)'),
}

// L2StandardBridge events
const l2StandardBridgeEvents = {
    depositFinalized: parseAbiItem('event DepositFinalized(address indexed l1Token, address indexed l2Token, address indexed from, address to, uint256 amount, bytes extraData)')
};

// FraxFerryL2 events
const fraxFerryL2Events = {
    embark: parseAbiItem('event Embark(address indexed sender, uint index, uint amount, uint amountAfterFee, uint timestamp)'),
    depart: parseAbiItem('event Depart(uint batchNo, uint start, uint end, bytes32 hash)'),
    cancelled: parseAbiItem('event Cancelled(uint index, bool cancel)'),
}

// FraxFerryL1 events
const fraxFerryL1Events = {
    disembark: parseAbiItem('event Disembark(uint start, uint end, bytes32 hash)'),
}

const sfrxEthAbi = parseAbi([
    'function balanceOf(address owner) view returns (uint256)',
]);

const floxiL1Abi = parseAbi([
    'function depositIntoStrategy() external',
    'function initiateEigenlayerWithdrawal(bytes calldata calldata_) external',
    'function completeEigenlayerWithdrawal((address,address,address,uint256,uint32,address[],uint256[])) external',
    'function shipToL2() external',
]);

const l1QueuedWithdrawals: any[] = [];
// once a day check if there are withdrawals to finalize
const job = CronJob.from({
	cronTime: '0 0 0 * * *',
	onTick: async function () {
		const blockDelay: bigint = await l1Client.readContract({
            address: l1.eigen_delegationManager as `0x${string}`,
            abi: delegationManagerAbi,
            args: [[l1.eigen_strategy]],
            functionName: 'getWithdrawalDelay',
          }) as bigint;

        const lastSafe = (await l2Client.getBlock({
            blockTag: 'safe'
        })).number;

        for (const withdrawal of l1QueuedWithdrawals) {
            if (withdrawal.startBlock + blockDelay < lastSafe) {
                try {

                    const { request } = await l1Client.simulateContract({
                        address: l1.floxiL1 as `0x${string}`,
                        abi: floxiL1Abi,
                        functionName: 'completeEigenlayerWithdrawal',
                        args:[withdrawal],
                        account: deployer,
                    });
        
                    const txhash = await mWalletClient.writeContract(request);

                    console.log(`withdrawal from eigenlayer completed, nonce: ${withdrawal.nonce}, account: ${withdrawal.account}, tx ${txhash}`);
                    console.log(`account balance mainnet after tx: ${await l1Client.getBalance({
                        address: deployer.address,
                        blockTag: 'latest'
                    })}`)

                    l1QueuedWithdrawals.splice(l1QueuedWithdrawals.findIndex(entry => entry === withdrawal), 1);

                } catch (e) {
                    console.warn(`failed to complete withdrawal with nonce ${withdrawal.nonce}:`);
                    console.log(e);
                }

            }
        }

        bridgeToL2();
	},
	start: true,
	timeZone: 'America/Los_Angeles'
});

const bridgeToL2 = async () => {
    try {
        const { request } = await l1Client.simulateContract({
            address: l1.floxiL1 as `0x${string}`,
            abi: floxiL1Abi,
            functionName: 'shipToL2',
            account: deployer,
        });

        const txhash = await mWalletClient.writeContract(request);

        console.log(`successfully sent funds to L1StandardBridge, tx ${txhash}`);
        console.log(`account balance mainnet after tx: ${await l1Client.getBalance({
            address: deployer.address,
            blockTag: 'latest'
        })}`)

    } catch (e) {
        console.warn('Failed to bridge to L2');
        console.log(e);
    }

};


const handleL2WithdrawalRequest = async (
    logArgs: {
        account?: `0x${string}` | undefined;
        nonce?: bigint | undefined;
        assets?: bigint | undefined;
        },
    blockNumber: bigint
    ) => {
        let finalized = (await l2Client.getBlock({
            blockTag: 'finalized'
        })).number;

        while(blockNumber > finalized) {
            console.log(`Waiting for block finalization. Block ${blockNumber}, last finalized: ${finalized}`)
            await setTimeout(10 * 60000);
            
            const lastFinalized = (await l2Client.getBlock({
                blockTag: 'finalized'
            })).number;

            if (blockNumber <= lastFinalized) {

                console.log('Block finalized.')

                const queuedWithdrawalParams = [];
                queuedWithdrawalParams[0] = {
                    strategies: [l1.eigen_strategy],
                    shares: [logArgs.assets],
                    withdrawer: l1.floxiL1,
                }

                const callData = encodeFunctionData({
                    abi: delegationManagerAbi,
                    args:  [queuedWithdrawalParams],
                    functionName: 'queueWithdrawals',
                });

                try {
                    const { request } = await l1Client.simulateContract({
                        address: l1.floxiL1 as `0x${string}`,
                        abi: floxiL1Abi,
                        functionName: 'initiateEigenlayerWithdrawal',
                        args:[callData],
                        account: deployer,
                    });
        
                    const txhash = await mWalletClient.writeContract(request);

                    console.log(`successfully queued eigenlayer withdrawal, amount: ${logArgs.assets}, tx ${txhash}`);
                    console.log(`account balance mainnet after tx: ${await l1Client.getBalance({
                        address: deployer.address,
                        blockTag: 'latest'
                    })}`)

                } catch (e) {
                    console.warn(`failed to queue withdrawal for amount ${logArgs.assets}:`);
                    console.log(e);
                }
            }

            finalized = lastFinalized;
        }
}

// deposit flow functions

const handleDisembark = async (hash:`0x${string}`) => {
    const bal = await l1Client.readContract({
        address: l1.sfrxEth as `0x${string}`,
        abi: sfrxEthAbi,
        functionName: 'balanceOf',
        args: [l1.floxiL1  as `0x${string}`]
    });

    console.log(`Current contract sfrxEth balance: ${bal}`);

    if (bal > 0n) {
        try {
            const { request } = await l1Client.simulateContract({
                address: l1.floxiL1 as `0x${string}`,
                abi: floxiL1Abi,
                functionName: 'depositIntoStrategy',
                account: deployer,
            });

            const txhash = await mWalletClient.writeContract(request);

            console.log(`successfully disembarked ${hash}, deposit to eigen on tx ${txhash}`);
            console.log(`account balance mainnet after tx: ${await l1Client.getBalance({
                address: deployer.address,
                blockTag: 'latest'
            })}`)
    
        } catch (e) {
            console.log(`failed to deposit into strategy ${hash}:`);
            console.log(e);
        }

    } else {
        console.log(`failed to deposit into strategy ${hash} because no funds arrived`);
    }
}

// event listeners

const main = async () => {

    console.log((await l2Client.getBlock()).number)
    console.log((await l2Client.getBlock({
        blockTag: 'safe'
      })).number)
    console.log((await l2Client.getBlock({
    blockTag: 'finalized'
    })).number);

    // withdraw flow listeners

    // const l2QueuedWithdrawals = []; 
    const unwatchFloxiL2WithdrawalQueued = l2Client.watchEvent({
        address: l2.floxiL2 as `0x${string}` | undefined,
        event: floxiL2Events.withdrawalQueued,
        onLogs: (logs) => {
            for (const log of logs) {
                console.log(`Withdrawal queued by ${log.args.account}, amount: ${log.args.assets}, nonce: ${log.args.nonce} tx: ${log.transactionHash}`);

                // for batching. First implementation is one by one.
                // const data = {
                //     blockNumber: log.blockNumber,
                //     ...log.args,
                // }
                // l2QueuedWithdrawals.push(data);

                handleL2WithdrawalRequest(log.args, log.blockNumber);
           }
        }
    });
    
    const unwatchFloxiL1WithdrawalInitiated = l1Client.watchEvent({
        address: l1.floxiL1 as `0x${string}` | undefined,
        event: floxiL1Events.withdrawalInitiated,
        onLogs: async (logs) => {
            for (const log of logs) {
                console.log(`Withdrawal ${log.args.nonce} initiated. WithdrawalId ${log.args.withdrawalId}, amount: ${log.args.assets}, shares: ${log.args.shares} tx: ${log.transactionHash}`);
                const eigenLogs = await l1Client.getLogs({  
                    address: l1.eigen_delegationManager as `0x${string}` | undefined,
                    event: eigenlayerEvents.withdrawalQueued,
                    // not indexed.. 
                    // args: [{
                    //     staker: log.args.staker
                    // }],
                    fromBlock: log.blockNumber,
                    toBlock: log.blockNumber,
                });

                for (const eigenLog of eigenLogs) {
                    console.log(`EigenLayer withdrawal: ${eigenLog}`);
                    if (eigenLog.args[1]?.staker === log.args.staker) {
                        l1QueuedWithdrawals.push(eigenLog.args);
                    }
                }
                console.log(l1QueuedWithdrawals);
           }
        }
    });

    const l1CompletedWithdrawals = []; 

    const unwatchFloxiL1WithdrawalCompleted = l1Client.watchEvent({
        address: l1.floxiL1 as `0x${string}` | undefined,
        event: floxiL1Events.withdrawalCompleted,
        onLogs: (logs) => {
            for (const log of logs) {
                console.log(`Eigenlayer withdrawal completed, amount: ${log.args.assets}, shares: ${log.args.shares} tx: ${log.transactionHash}`);
                l1CompletedWithdrawals.push(log.args)
           }
        }
    });

    const unwatchL2StandardBridgeDepositFinalized = l2Client.watchEvent({
        address: l2.l2StandardBridge as `0x${string}` | undefined,
        event: l2StandardBridgeEvents.depositFinalized,
        args:{
            l1Token: l1.sfrxEth as `0x${string}`,
            l2Token: l2.sfrxEth as `0x${string}`,
            from: l1.floxiL1 as `0x${string}`,
        },
        onLogs: (logs) => {
            for (const log of logs) {
                console.log(`L2StandardBridge deposit finalized, amount: ${log.args.amount}, tx: ${log.transactionHash}`);
                l1CompletedWithdrawals.push(log.args)
           }
        }
    });

    /// Deposit flow listeners

    const unwatchFloxiL2Deposit = l2Client.watchEvent({
        address: l2.floxiL2 as `0x${string}` | undefined,
        event: floxiL2Events.deposit,
        onLogs: (logs) => {
            for (const log of logs) {
                console.log(`Deposit received from ${log.args.from}, amount: ${log.args.amount}, tx: ${log.transactionHash}`);
           }
        }
    });

    const unwatchFloxiL2Mint = l2Client.watchEvent({
        address: l2.floxiL2 as `0x${string}` | undefined,
        event: floxiL2Events.transfer,
        onLogs: (logs) => {
            for (const log of logs) {
                if (log.args.from === '0x0000000000000000000000000000000000000000') {
                    console.log(`Minted ${log.args.value} shares to: ${log.args.to}, tx: ${log.transactionHash}`);
                }
           }
        }
    });

    const embarked: { sender?: `0x${string}` | undefined; index?: bigint | undefined; amount?: bigint | undefined; amountAfterFee?: bigint | undefined; timestamp?: bigint | undefined; }[] = []; 
    const departed: (`0x${string}` | undefined)[] = [];
    const unwatchFraxFerryL2embark = l2Client.watchEvent({
        address: l2.fraxFerry as `0x${string}` | undefined,
        event: fraxFerryL2Events.embark,
        onLogs: (logs) => {
            // console.log(logs)
            for (const log of logs) {
                if (log.args.sender === l2.floxiL2) {
                    console.log(`Embark, index: ${log.args.index}, tx: ${log.transactionHash}`);
                    embarked.push(log.args);
                    console.log(embarked)
                }
           }
        }
    });

    const unwatchFraxFerryL2depart = l2Client.watchEvent({
        address: l2.fraxFerry as `0x${string}` | undefined,
        event: fraxFerryL2Events.depart,
        onLogs: (logs) => {
            for (const log of logs) {
                // console.log(log);
                for (const passenger of embarked) {
                    if ((log.args.start! < passenger.index!) && (passenger.index! < log.args.end!)) {
                        console.log(`Depart, hash: ${log.args.hash}, tx: ${log.transactionHash}`);
                        departed.push(log.args.hash);
                        embarked.splice(embarked.findIndex(entry => entry === passenger), 1);
                        console.log(embarked)
                        console.log(departed)
                    }
                }
            }
        }
    });

    const unwatchFraxFerryL2cancelled = l2Client.watchEvent({
        address: l2.fraxFerry as `0x${string}` | undefined,
        event: fraxFerryL2Events.cancelled,
        onLogs: (logs) => {
            for (const log of logs) {
                // console.log(log);
                for (const passenger of embarked) {
                    if (passenger.index! === log.args.index) {
                        console.warn(`Ferry cancelled for index: ${log.args.index}, tx: ${log.transactionHash}`);
                    }
                }
            }
        }
    });

    const unwatchFraxFerryL1Disembark = l1Client.watchEvent({
        address: l1.fraxFerry as `0x${string}` | undefined,
        event: fraxFerryL1Events.disembark,
        onLogs: (logs) => {
           for (const log of logs) {
                console.log(log);
                for (const hash of departed) {
                    if (hash === log.args.hash) {
                       console.log(`Disembarked: ${hash}`);
                       handleDisembark(hash!);
                       departed.splice(departed.findIndex(entry => entry === hash), 1);
                       console.log(departed)
                    }
                }
           }
        }
    });

    const unwatchFloxiL1InStrategy = l2Client.watchEvent({
        address: l1.floxiL1 as `0x${string}` | undefined,
        event: floxiL1Events.assetsDepositedIntoStrategy,
        onLogs: (logs) => {
            for (const log of logs) {
                console.log(`Deposit ${log.args.assets} sfrxEth into eigenlayer strategy ${log.args.strategy}, received shares: ${log.args.shares}, tx: ${log.transactionHash}`);
           }
        }
    });
}


main();

// L2 events
// const floxiL2_Deposit = parseAbiItem('event Deposit(address indexed from, uint256 amount)');
// const floxiL2_AssetsShippedToL1 = parseAbiItem('event AssetsShippedToL1(address indexed receiver, uint256 assets)');
// const floxiL2_WithdrawalQueued = parseAbiItem('event WithdrawalQueued(address indexed account, uint256 indexed nonce, uint256 assets)');
// const floxiL2_WithdrawalsUnlocked = parseAbiItem('event WithdrawalsUnlocked(uint256 indexed assetsUnlocked, uint256 fromNonce, uint256 toNonce)');

// const fraxFerryL2_Embark = parseAbiItem('event Embark(address indexed sender, uint index, uint amount, uint amountAfterFee, uint timestamp)');
// const fraxFerryL2_Depart = parseAbiItem('event Depart(uint batchNo, uint start, uint end, bytes32 hash)');

// const l2StandardBridge_DepositFinalized = parseAbiItem('event DepositFinalized(address indexed l1Token, address indexed l2Token, address indexed from, address to, uint256 amount, bytes extraData)');

// // L1 events
// const floxiL1_AssetsDepositedIntoStrategy = parseAbiItem('event AssetsDepositedIntoStrategy(uint256 assets, uint256 shares, address strategy)');
// const floxiL1_WithdrawalInitiated = parseAbiItem('event WithdrawalInitiated(bytes32 indexed withdrawalId, address staker, address withdrawer, uint256 indexed nonce, uint256 startBlock, address strategy, uint256 shares, uint256 assets, bytes32 indexed withdrawalRoot)');
// const floxiL1_WithdrawalCompleted = parseAbiItem('event WithdrawalCompleted(uint256 assets, uint256 shares, address strategy)');
// const floxiL1_AssetsShippedToL2 = parseAbiItem('event AssetsShippedToL2(address indexed receiver, uint256 assets)');

// const fraxFerryL1_Disembark = parseAbiItem('event Disembark(uint start, uint end, bytes32 hash)');




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
