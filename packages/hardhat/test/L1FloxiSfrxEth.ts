import { expect } from "chai";
import hre, { ethers } from "hardhat";
import sfrxEthAbi from "../contracts/sfrxEthAbi.json";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { L1FloxiSfrxEth } from "../typechain-types/contracts/L1FloxiSfrxEth.sol";
import { IERC20 } from "../typechain-types";

const providerApiKey = process.env.ALCHEMY_API_KEY || "oKxs-03sij-U_N0iOlrSsZFr29-IqbuF";
const L2_sfrxEth = "0xFC00000000000000000000000000000000000005";
const sfrxEthEthereumMainnet = "0xac3E018457B222d93114458476f3E3416Abbe38F";
const bigSFraxHolderMainnet = "0x46782D268FAD71DaC3383Ccf2dfc44C861fb4c7D";
const eigenlayerStrategyManager = "0x858646372CC42E1A627fcE94aa7A7033e7CF075A";
const eigenLayerStrategy = "0x8CA7A5d6f3acd3A7A8bC468a8CD0FB14B6BD28b6";
const eigenLayerDelegationManager = "0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A";
const FORK_BLOCK = 20476083; // mainnet
const ethereumMainnetRPC = `https://eth-mainnet.alchemyapi.io/v2/${providerApiKey}`;
const eigenYields = "0x5ACCC90436492F24E6aF278569691e2c942A676d";
const eigenLayerRewardsCoordinator = "0x7750d328b314EfFa365A0402CcfD489B80B0adda";

const resetFork = async () => {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: ethereumMainnetRPC,
          blockNumber: FORK_BLOCK,
        },
      },
    ],
  });
};

describe("L1Floxi", function () {
  let sfrxEth: Contract;
  let eigenStrategyMan: Contract;
  let eigenDelegationMan: Contract;
  let eigenRewardsCoord: Contract;
  let signer: HardhatEthersSigner;
  let contract: L1FloxiSfrxEth;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;

  before(async () => {
    resetFork();

    // get test account with eth
    [owner, treasury] = await hre.ethers.getSigners();

    // deploy fsfrxEth
    const contractFactory = await ethers.getContractFactory("L1FloxiSfrxEth");
    contract = await contractFactory.deploy(
      sfrxEthEthereumMainnet,
      L2_sfrxEth,
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000001",
      eigenlayerStrategyManager,
      eigenLayerStrategy,
      eigenLayerDelegationManager,
      eigenLayerRewardsCoordinator,
    );
    await contract.waitForDeployment();

    // impersonate sfrxEth holder
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [bigSFraxHolderMainnet],
    });
    signer = await hre.ethers.getSigner(bigSFraxHolderMainnet);

    // fund sfrxEth holder
    await owner.sendTransaction({
      to: bigSFraxHolderMainnet,
      value: hre.ethers.parseEther("1.0"),
    });

    // get sfrxEth contract
    sfrxEth = new ethers.Contract(sfrxEthEthereumMainnet, sfrxEthAbi, signer);

    const strategyManagerAbi = [
      "function stakerStrategyShares(address, address) external view returns (uint256)",
      "function depositIntoStrategy(address,address,uint256)external returns (uint256)",
      "function paused() external view returns (bool)",
      "function stakerStrategyListLength(address) external view returns (uint256)",
      "function delegation() external view returns (address)",
    ];
    eigenStrategyMan = new ethers.Contract(eigenlayerStrategyManager, strategyManagerAbi, owner);

    const delegationManagerAbi = [
      "function isDelegated(address) external view returns (bool)",
      "function delegatedTo(address) external view returns (address)",
      "function isOperator(address) external view returns (bool)",
      "function delegateTo(address operato, (bytes signature, uint256 expiry) approverSignatureAndExpiry, bytes32 approverSaltr) external",
      "function paused() view returns (bool)",
      "function queueWithdrawals((address withdrawer, address[] strategies, uint256[] shares)[] queuedWithdrawalParams) external returns (bytes32[] withdrawalRoots)",
      "function completeQueuedWithdrawal((address staker, address delegatedTo, address withdrawer, uint256 nonce, uint32 startBlock, address[] strategies, uint256[] shares) withdrawal, address[] tokens, uint256 middlewareTimesIndex, bool receiveAsTokens) external",
      "function completeQueuedWithdrawals((address staker, address delegatedTo, address withdrawer, uint256 nonce, uint32 startBlock, address[] strategies, uint256[] shares)[] withdrawals, address[][] tokens, uint256[] middlewareTimesIndexes, bool[] receiveAsTokens) external",
      "function undelegate(address staker) external returns (bytes32[] memory withdrawalRoots)",
    ];

    eigenDelegationMan = new ethers.Contract(eigenLayerDelegationManager, delegationManagerAbi, owner);

    const eigenRewardsCoordAbi = [
      "function setClaimerFor(address) external",
      "function claimerFor(address) external view returns (address)",
    ];

    eigenRewardsCoord = new ethers.Contract(eigenLayerRewardsCoordinator, eigenRewardsCoordAbi, owner);
  });

  describe("Floxi Staked Frax Ether contract", function () {
    it("should be the correct block", async function () {
      expect(await hre.ethers.provider.getBlockNumber()).to.be.above(FORK_BLOCK);
    });

    it("should deploy Floxi Staked Frax Eth", async function () {
      expect(await contract.asset()).to.equal(sfrxEthEthereumMainnet);
    });

    it("should initiate balances correctly", async function () {
      // signer should now have 1 eth and 108453869999710112327 sfrxEth
      expect(await ethers.provider.getBalance(signer.address)).to.equal(ethers.toBigInt("1831446157890255360"));
      expect(await sfrxEth.balanceOf(signer.address)).to.equal(ethers.toBigInt("2523004812144586027030"));
      expect(await sfrxEth.balanceOf(owner.address)).to.equal(ethers.toBigInt("0"));
      expect(await sfrxEth.balanceOf(treasury.address)).to.equal(ethers.toBigInt("0"));
    });

    it("should send sfrxEth to contract", async function () {
      const contractAddress = await contract.getAddress();
      await sfrxEth.transfer(contractAddress, ethers.parseEther("10"));
      expect(await sfrxEth.balanceOf(contractAddress)).to.equal(ethers.parseEther("10"));
    });

    it("should deposit sfrxEth into eigenlayer contract", async function () {
      const contractAddress = await contract.getAddress();
      const depositTx = await contract.connect(owner).depositIntoStrategy();
      await depositTx.wait();
      expect(await eigenStrategyMan.stakerStrategyListLength(contractAddress)).to.equal(ethers.toBigInt("1"));
      expect(await eigenStrategyMan.stakerStrategyShares(contractAddress, eigenLayerStrategy)).to.equal(
        ethers.parseEther("10"),
      );
      expect(await contract.assetsInStrategy()).to.equal(ethers.parseEther("10"));
      expect(await contract.totalAssets()).to.equal(ethers.parseEther("10"));
    });

    it("should delegate to operator", async function () {
      const contractAddress = await contract.getAddress();
      const delegateTx = await contract.connect(owner).delegate(eigenYields);
      await delegateTx.wait();
      expect(await eigenDelegationMan.isDelegated(contractAddress)).to.equal(true);
      expect(await eigenDelegationMan.delegatedTo(contractAddress)).to.equal(eigenYields);
    });

    it("should queue withdrawal", async function () {
      // const queueTx = await contract.connect(owner).initiateEigenlayerWithdrawal(ethers.parseEther("5"));
      // await queueTx.wait();

      // eigenStrategyMan.connect(signer);

      console.log(1);

      // sfrxEth.connect(signer);

      // const spender = eigenStrategyMan.address;
      const allowTx = await (sfrxEth as unknown as IERC20)
        .connect(signer)
        .approve(eigenlayerStrategyManager, ethers.parseEther("2"));
      await allowTx.wait();

      console.log(2);

      console.log(await (sfrxEth as unknown as IERC20).allowance(signer.address.toString(), eigenlayerStrategyManager));

      const depositTx = await eigenStrategyMan
        .connect(owner)
        .depositIntoStrategy(eigenLayerStrategy, sfrxEthEthereumMainnet, ethers.parseEther("1"));

      await depositTx.wait();

      console.log(await eigenStrategyMan.stakerStrategyShares(signer.address, eigenLayerStrategy));

      const delegatetTx = await eigenDelegationMan.delegatedTo(signer.address);

      await delegatetTx.wait();

      console.log(await eigenDelegationMan.delegatedTo(signer.address));

      const queuedWithdrawalParams = [];
      queuedWithdrawalParams[0] = {
        strategies: [eigenLayerStrategy],
        shares: [ethers.parseEther("10")],
        withdrawer: signer.address,
      };

      const queueTx = await eigenDelegationMan.undelegate(signer.address);

      const receipt = await queueTx.wait();

      console.log(receipt);

      // const queueTx = await eigenDelegationMan.queueWithdrawals(queuedWithdrawalParams);

      // const receipt = await queueTx.wait();

      // console.log(receipt);

      // await expect(await contract.connect(owner).initiateEigenlayerWithdrawal(ethers.parseEther("10")))
      // .to.emit(contract, "WithdrawalQueued")
      // .withArgs(42, "foo");
    });

    // contract.on("WithdrawalQueued", (withdrawalId, staker, withdrawer, nonce, startBlock, strategy, shares, withdrawalRoot) => {
    //   console.log(`withdrawalId: ${withdrawalId}`);
    //   console.log(`staker: ${staker}`);
    //   console.log(`withdrawer: ${withdrawer}`);
    //   console.log(`nonce: ${nonce}`);
    //   console.log(`startBlock: ${startBlock}`);
    //   console.log(`strategy: ${strategy}`);
    //   console.log(`shares: ${shares}`);
    //   console.log(`withdrawalRoot: ${withdrawalRoot}`);
    // });

    it("should set claimer", async function () {
      const contractAddress = await contract.getAddress();
      const claimerTx = await contract.connect(owner).setClaimer(owner);
      await claimerTx.wait();
      expect(await eigenRewardsCoord.claimerFor(contractAddress)).to.equal(owner.address);
    });

    xit("should revert on deposit on L1floxi", async function () {
      // await sfrxEth.transfer(owner.address, ethers.parseEther("2"));
      // expect(await sfrxEth.balanceOf(owner.address), "e1").to.equal(ethers.parseEther("2"));
      // await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("2"));
      // await expect(contract.connect(owner).deposit(ethers.parseEther("3"), owner.address), "e2").to.be.reverted;
    });
  });
});
