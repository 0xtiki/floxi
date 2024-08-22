// import floxiSfrxEth from '../../hardhat/artifacts/contracts/FloxiSfrxEth.sol/FloxiSfrxEth.json' assert { type: 'json' }
import dotenv from 'dotenv';
import { Log, decodeAbiParameters, encodeFunctionData, parseAbi, parseAbiItem, parseAbiParameters } from 'viem';
import { CronJob } from 'cron';
import { privateKeyToAccount } from 'viem/accounts';
import { getFraxtalClient, getFraxtalWalletClient, getMainnetClient, getMainnetWalletClient } from './client';
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
const l1WalletClient = getMainnetWalletClient(env);
const l2WalletClient = getFraxtalWalletClient(env);


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

// const txhash = await l1WalletClient.writeContract(request);

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

const transactionCount = await l1Client.getTransactionCount({  
    address: deployer.address,
})

console.log(transactionCount)


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
    'function completeEigenlayerWithdrawal((address staker,address delegatedTo,address withdrawer,uint256 nonce,uint32 startBlock,address[] strategies,uint256[] shares)) external',
    'function shipToL2() external',
]);

const floxiL2Abi = parseAbi([
    'function unlockWithdrawals(uint256 assets, uint256 maxIterations) external',
    'function setL1Assets(uint256 amount) external',
    'function getL1Assets() view returns (uint256)',
]);

const l1QueuedWithdrawals: any[] = [];
//checks if there are withdrawals to finalize
const job = CronJob.from({
	cronTime: '1 * * * * *',
	onTick: async function () {
		const blockDelay: bigint = await l1Client.readContract({
            address: l1.eigen_delegationManager as `0x${string}`,
            abi: delegationManagerAbi,
            args: [[l1.eigen_strategy]],
            functionName: 'getWithdrawalDelay',
          }) as bigint;

        const lastSafe = (await l1Client.getBlock({
            blockTag: 'safe'
        })).number;

        console.log(`cron checking withdrawals: ${l1QueuedWithdrawals}`)

        if (l1QueuedWithdrawals.length === 0) return;

        for (const withdrawal of l1QueuedWithdrawals) {
            console.log(`checking if withdrawal is safe ${withdrawal}`);
            console.log(`start block ${withdrawal.startBlock} block delay ${blockDelay} latest safe ${lastSafe}`)
            console.log(BigInt(withdrawal.startBlock) + blockDelay < lastSafe)
            if (BigInt(withdrawal.startBlock) + blockDelay < lastSafe) {
                try {

                    const { request } = await l1Client.simulateContract({
                        address: l1.floxiL1 as `0x${string}`,
                        abi: floxiL1Abi,
                        functionName: 'completeEigenlayerWithdrawal',
                        //[withdrawal.staker as `0x${string}`, withdrawal.delegatedTo as `0x${string}`, withdrawal.withdrawer as `0x${string}`, withdrawal.nonce as bigint, withdrawal.startBlock as number, withdrawal.strategies as `0x${string}`[], withdrawal.shares as bigint[]]
                        args: [withdrawal],
                        account: deployer,
                        maxFeePerGas: 10000000000n,
                        maxPriorityFeePerGas: 10000000000n,
                        gas: 3500000n,
                    });

                    const txhash = await l1WalletClient.writeContract(request);
            
                    const transaction = await l1Client.waitForTransactionReceipt({ hash: txhash })
        
                    console.log(`withdrawal from eigenlayer completed, nonce: ${withdrawal.nonce}, account: ${withdrawal.account}, tx ${txhash}, receipt: ${transaction}`);
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
            maxFeePerGas: 10000000000n,
            maxPriorityFeePerGas: 10000000000n,
            gas: 3500000n,
        });

        const txhash = await l1WalletClient.writeContract(request);

        const transaction = await l1Client.waitForTransactionReceipt({ hash: txhash });

        console.log(`successfully sent funds to L1StandardBridge, tx ${txhash}, receipt: ${transaction}`);
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

            finalized = lastFinalized;
        }

        console.log('Block finalized.');

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

        console.log(`calldata ${callData}`);

        try {
            const { request } = await l1Client.simulateContract({
                address: l1.floxiL1 as `0x${string}`,
                abi: floxiL1Abi,
                functionName: 'initiateEigenlayerWithdrawal',
                args:[callData],
                account: deployer,
                maxFeePerGas: 10000000000n,
                maxPriorityFeePerGas: 10000000000n,
                gas: 3500000n,
            });
    
            const txhash = await l1WalletClient.writeContract(request);
    
            const transaction = await l1Client.waitForTransactionReceipt({ hash: txhash });

            console.log(`successfully queued eigenlayer withdrawal, amount: ${logArgs.assets}, tx ${txhash}, receipt: ${transaction}`);
            console.log(`account balance mainnet after tx: ${await l1Client.getBalance({
                address: deployer.address,
                blockTag: 'latest'
            })}`)

        } catch (e) {
            console.warn(`failed to queue withdrawal for amount ${logArgs.assets}:`);
            console.log(e);
        }
}

const getEigenLayerQueuedWithdrawals = async (blockNumber: bigint, staker: `0x${string}`) => {
    const eigenLogs = await l1Client.getLogs({  
        address: l1.eigen_delegationManager as `0x${string}` | undefined,
        event: eigenlayerEvents.withdrawalQueued,
        // not indexed.. 
        // args: [{
        //     staker: log.args.staker
        // }],
        fromBlock: blockNumber,
        toBlock: blockNumber,
    });

    for (const eigenLog of eigenLogs) {
        console.log(`EigenLayer withdrawal: ${eigenLog}`);
        if (eigenLog.args[1]?.staker === staker) {
            l1QueuedWithdrawals.push(eigenLog.args[1]);

            console.log(eigenLog.args[1].delegatedTo);
            console.log(eigenLog.args[1].nonce);
            console.log(eigenLog.args[1].shares);
            console.log(eigenLog.args[1].staker);
            console.log(eigenLog.args[1].startBlock);
            console.log(eigenLog.args[1].strategies);
            console.log(eigenLog.args[1].withdrawer);
        }
    }
    console.log(`eigenwithdrawals ${l1QueuedWithdrawals}`);
}

// deposit flow functions

const handleDisembark = async (hash:`0x${string}`, blockNumber: bigint) => {
    let lastSafe = (await l1Client.getBlock({
        blockTag: 'safe'
    })).number;

    while (blockNumber > lastSafe) {
        console.log(`handleDisembark waiting for block finalization of block ${blockNumber}, last safe: ${lastSafe}`);

        await setTimeout(2 * 60000);

        lastSafe = (await l1Client.getBlock({
            blockTag: 'safe'
        })).number;
    }

    console.log(`Block is safe now, checking balance.`);

    const bal = await l1Client.readContract({
        address: l1.sfrxEth as `0x${string}`,
        abi: sfrxEthAbi,
        functionName: 'balanceOf',
        args: [l1.floxiL1  as `0x${string}`]
    });

    console.log(`Current contract sfrxEth balance: ${bal}`);

    if (bal > 0n) {
        try {

            const {
                maxFeePerGas,
                maxPriorityFeePerGas
            } = await l1Client.estimateFeesPerGas();

            console.log(maxFeePerGas);
            console.log(maxPriorityFeePerGas);

            const result = await l1Client.simulateContract({
                address: l1.floxiL1 as `0x${string}`,
                abi: floxiL1Abi,
                functionName: 'depositIntoStrategy',
                account: deployer,
                maxFeePerGas: 10000000000n,
                maxPriorityFeePerGas: 10000000000n,
                gas: 3500000n,
            });

            const txhash = await l1WalletClient.writeContract(result.request);

            const transaction = await l1Client.waitForTransactionReceipt({ hash: txhash })

            console.log(`successfully disembarked ${hash}, deposit to eigen on tx ${txhash}, receipt: ${transaction}`);
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
                console.log(`Withdrawal ${log.args.nonce} initiated. WithdrawalId ${log.args.withdrawalId}, amount: ${log.args.assets}, shares: ${log.args.shares}, block: ${log.blockNumber} tx: ${log.transactionHash}`);
                const transaction = await l1Client.waitForTransactionReceipt({ hash: log.transactionHash });
                getEigenLayerQueuedWithdrawals(transaction.blockNumber, log.args.staker!);
           }
        }
    });

    const l1CompletedWithdrawals: { assets?: bigint | undefined; shares?: bigint | undefined; strategy?: `0x${string}` | undefined; }[] = []; 

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
        onLogs: async (logs) => {

            let amount: bigint = 0n;
            let count: bigint = 0n;

            for (const log of logs) {
                console.log(`L2StandardBridge deposit finalized, amount: ${log.args.amount}, tx: ${log.transactionHash}`);
                const withdrawal = l1CompletedWithdrawals.find((withdrawal) => {
                    return withdrawal.assets === log.args.amount;
                });

                if (withdrawal && withdrawal.assets && (count < 800n)) {
                    amount += withdrawal.assets;
                    l1CompletedWithdrawals.splice(l1CompletedWithdrawals.findIndex(entry => entry === withdrawal), 1);
                    count += 1n;
                }
            }

            try {

                const l1Assets = await l2Client.readContract({
                    address: l2.floxiL2 as `0x${string}`,
                    abi: floxiL2Abi,
                    functionName: 'getL1Assets',
                });

                const updatedL1Assets = l1Assets - amount;

                console.log(`updating L1Assets to: ${updatedL1Assets}`);

                const { request: rq1 } = await l2Client.simulateContract({
                    address: l2.floxiL2 as `0x${string}`,
                    abi: floxiL2Abi,
                    functionName: 'setL1Assets',
                    args: [updatedL1Assets],
                    account: deployer,
                    maxFeePerGas: 10000000000n,
                    maxPriorityFeePerGas: 10000000000n,
                    gas: 3500000n,
                });

                const txhash1 = await l2WalletClient.writeContract(rq1);
        
                const transaction1 = await l2Client.waitForTransactionReceipt({ hash: txhash1 })

                console.log(`L1 assets update successful, tx ${txhash1}, receipt: ${transaction1}`);

                const { request: rq2 } = await l2Client.simulateContract({
                    address: l2.floxiL2 as `0x${string}`,
                    abi: floxiL2Abi,
                    functionName: 'unlockWithdrawals',
                    args: [amount, count],
                    account: deployer,
                    maxFeePerGas: 10000000000n,
                    maxPriorityFeePerGas: 10000000000n,
                    gas: 3500000n,
                });

                const txhash2 = await l2WalletClient.writeContract(rq2);
        
                const transaction2 = await l2Client.waitForTransactionReceipt({ hash: txhash2 })

                console.log(`withdrawals unlocked, amount: ${amount}, tx ${txhash2}, receipt: ${transaction2}`);
                console.log(`account balance L2 after tx: ${await l2Client.getBalance({
                    address: deployer.address,
                    blockTag: 'latest'
            })}`)

            } catch (e) {
                console.warn(`failed to complete withdrawal unlock ${l1CompletedWithdrawals}`);
                console.log(e);
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
                       handleDisembark(hash!, log.blockNumber);
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
