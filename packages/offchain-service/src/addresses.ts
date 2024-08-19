import dotenv from 'dotenv';

dotenv.config();
const addresses = {
  mainnet: {
    sfrxEth: "0xac3E018457B222d93114458476f3E3416Abbe38F",
    treasury: process.env.TREASURY_WALLET_ADDRESS,
    floxiL1: process.env.FLOXI_L1,
    l1StandardBridge: "0x34C0bD5877A5Ee7099D0f5688D65F4bB9158BDE2",
    xDomainMessenger: "0x126bcc31Bc076B3d515f60FBC81FddE0B0d542Ed",
    //https://github.com/FraxFinance/frax-solidity/blob/master/src/types/constants.ts#L4341C60-L4341C102
    fraxFerry: "0x5c5f05cF8528FFe925A2264743bFfEdbAB2b0FE3",
    eigen_strategyManager: "0x858646372CC42E1A627fcE94aa7A7033e7CF075A",
    eigen_strategy: "0x8CA7A5d6f3acd3A7A8bC468a8CD0FB14B6BD28b6",
    eigen_delegationManager: "0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A",
    eigen_operator: "0x5ACCC90436492F24E6aF278569691e2c942A676d",
    eigen_rewardsCoordinator: "0x7750d328b314EfFa365A0402CcfD489B80B0adda",
  },
  fraxtal: {
    sfrxEth: "0xfc00000000000000000000000000000000000005",
    l2StandardBridge: "0x4200000000000000000000000000000000000010",
    xDomainMessenger: "0x4200000000000000000000000000000000000007",
    treasury: process.env.TREASURY_WALLET_ADDRESS,
    floxiL2: process.env.FLOXI_L2,
    fraxFerry: "0x67c6A8A715fc726ffD0A40588701813d9eC04d9C",
  },
  holesky: {
    sfrxEth: "0xa63f56985F9C7F3bc9fFc5685535649e0C1a55f3",
    treasury: process.env.TREASURY_WALLET_ADDRESS,
    floxiL1: process.env.FLOXI_L1_HOLESKY,
    l1StandardBridge: "0x0BaafC217162f64930909aD9f2B27125121d6332",
    xDomainMessenger: "0x45A98115D5722C6cfC48D711e0053758E7C0b8ad",
    fraxFerry: process.env.FRAX_FERRY_HOLESKY,
    eigen_strategyManager: "0xdfB5f6CE42aAA7830E94ECFCcAd411beF4d4D5b6",
    eigen_strategy: "0x9281ff96637710Cd9A5CAcce9c6FAD8C9F54631c",
    eigen_delegationManager: "0xA44151489861Fe9e3055d95adC98FbD462B948e7",
    eigen_operator: "0x5ACCC90436492F24E6aF278569691e2c942A676d",
    eigen_rewardsCoordinator: "0xAcc1fb458a1317E886dB376Fc8141540537E68fE",
  },
  fraxtalTestnet: {
    sfrxEth: "0xfc00000000000000000000000000000000000005",
    l2StandardBridge: "0x4200000000000000000000000000000000000010",
    xDomainMessenger: "0x4200000000000000000000000000000000000007",
    treasury: process.env.TREASURY_WALLET_ADDRESS,
    floxiL2: process.env.FLOXI_L2_TESTNET,
    fraxFerry: process.env.FRAX_FERRY_TESTNET,
  },
};

export default addresses;
