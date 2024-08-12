import { createPublicClient, createTestClient, createWalletClient, formatEther, http, parseAbiItem, publicActions } from 'viem';
import { fraxtal, mainnet, fraxtalTestnet, holesky } from 'viem/chains';

// hardhat
// testnet
// mainnet
 
export const getFraxtalClient = (env: string) => {
    if (env === 'hardhat') {
        return createTestClient({ 
            chain: fraxtal, 
            mode: 'hardhat',
            transport: http('https://rpc.frax.com'), 
        })
        .extend(publicActions) 
    } else if (env === 'mainnet') {
        return createPublicClient({ 
            chain: fraxtal, 
            transport: http('https://rpc.frax.com'), 
        });
    } else {
        return createPublicClient({ 
            chain: fraxtalTestnet, 
            transport: http('https://rpc.testnet.frax.com'), 
        });
    }
};

export const getMainnetClient = (env: string) => {
    if (env === 'hardhat') {
        return createTestClient({ 
            chain: mainnet, 
            mode: 'hardhat',
            transport: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`), 
        })
        .extend(publicActions) 
    } else if (env === 'mainnet') {
        return createPublicClient({ 
            chain: mainnet, 
            transport: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`), 
        });
    } else {
        return createPublicClient({ 
            chain: holesky, 
            transport: http('https://rpc.holesky.ethpandaops.io'), 
        });
    }
};


// const walletClient = createWalletClient({
//     chain: fraxtalTestnet,
//     transport: http('https://rpc.testnet.frax.com')
//     // chain: holesky,
//     // transport: http('https://rpc.holesky.ethpandaops.io')
// })