import { expect } from "chai";
import hre, { ethers } from "hardhat";
import sfrxEthAbi from "../contracts/sfrxEthAbi.json";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { L1FloxiSfrxEth } from "../typechain-types/contracts/L1FloxiSfrxEth.sol";
import { IERC20 } from "../typechain-types";
import delegationManagerAbi from "./delegationManagerAbi.json";
import constants from "../addresses";

// const fraxtal = constants.fraxtal;
const mainnet = constants.mainnet;

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
// const floxiL2 = "0x0000000000000000000000000000000000000001";

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
  let withdrawalEventData: any;

  before(async () => {
    resetFork();

    // get test account with eth
    [owner, treasury] = await hre.ethers.getSigners();

    // deploy fsfrxEth
    const contractFactory = await ethers.getContractFactory("L1FloxiSfrxEth");
    contract = await contractFactory.deploy(
      sfrxEthEthereumMainnet,
      L2_sfrxEth,
      mainnet.l1StandardBridge,
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
      expect(await contract.totalStakedAssets()).to.equal(ethers.parseEther("10"));
      expect(await contract.totalAssets()).to.equal(ethers.parseEther("10"));
    });

    it("should delegate to operator", async function () {
      const contractAddress = await contract.getAddress();
      const delegateTx = await contract.connect(owner).delegate(eigenYields);
      await delegateTx.wait();
      expect(await eigenDelegationMan.isDelegated(contractAddress)).to.equal(true);
      expect(await eigenDelegationMan.delegatedTo(contractAddress)).to.equal(eigenYields);
    });

    xit("should undelegate and emit event (direct eigenlayer)", async function () {
      eigenStrategyMan.connect(signer);
      await sfrxEth.transfer(owner.address, ethers.parseEther("10"));
      const allowTx = await (sfrxEth as unknown as IERC20)
        .connect(owner)
        .approve(eigenlayerStrategyManager, ethers.parseEther("10"));
      await allowTx.wait();

      const depositTx = await eigenStrategyMan.depositIntoStrategy(
        eigenLayerStrategy,
        sfrxEthEthereumMainnet,
        ethers.parseEther("10"),
      );

      await depositTx.wait();

      const delegatetTx = await eigenDelegationMan.delegateTo(
        eigenYields,
        [ethers.ZeroHash, ethers.toBigInt(0)],
        ethers.ZeroHash,
      );

      await delegatetTx.wait();

      const queueTx = await eigenDelegationMan.undelegate(owner.address);

      const receipt = await queueTx.wait();

      const eventSignature = "StakerUndelegated(address,address)";

      const eventTopic = ethers.id(eventSignature);

      const event = receipt.logs.find((log: any) => log.topics[0] === eventTopic);

      if (event) {
        const staker = ethers.AbiCoder.defaultAbiCoder().decode(["address"], event.topics[1]);
        const operator = ethers.AbiCoder.defaultAbiCoder().decode(["address"], event.topics[2]);

        expect(staker[0]).to.equal(owner.address);
        expect(operator[0]).to.equal(eigenYields);
      }

      expect(event).to.not.be.undefined;
    });

    xit("should queue withdrawal and emit event (direct eigenlayer)", async function () {
      eigenStrategyMan.connect(signer);
      await sfrxEth.transfer(owner.address, ethers.parseEther("10"));
      const allowTx = await (sfrxEth as unknown as IERC20)
        .connect(owner)
        .approve(eigenlayerStrategyManager, ethers.parseEther("10"));
      await allowTx.wait();

      const depositTx = await eigenStrategyMan.depositIntoStrategy(
        eigenLayerStrategy,
        sfrxEthEthereumMainnet,
        ethers.parseEther("10"),
      );

      await depositTx.wait();

      const delegatetTx = await eigenDelegationMan.delegateTo(
        eigenYields,
        [ethers.ZeroHash, ethers.toBigInt(0)],
        ethers.ZeroHash,
      );

      await delegatetTx.wait();

      const queuedWithdrawalParams = [];
      queuedWithdrawalParams[0] = {
        strategies: [eigenLayerStrategy],
        shares: [ethers.parseEther("10")],
        withdrawer: owner.address,
      };

      const startBlock = await ethers.provider.getBlockNumber();

      const queueTx = await eigenDelegationMan.queueWithdrawals(queuedWithdrawalParams);

      const receipt = await queueTx.wait();

      const eventSignature = "WithdrawalQueued(bytes32,(address,address,address,uint256,uint32,address[],uint256[]))";

      const eventTopic = ethers.id(eventSignature);

      const event = receipt.logs.find((log: any) => log.topics[0] === eventTopic);

      if (event) {
        const [withdrawalRoot, withdrawal] = ethers.AbiCoder.defaultAbiCoder().decode(
          ["bytes32", "tuple(address,address,address,uint256,uint32,address[],uint256[])"],
          event.data,
        );

        console.log(withdrawalRoot);

        // struct Withdrawal {
        //     address staker;
        //     address delegatedTo;
        //     address withdrawer;
        //     uint256 nonce;
        //     uint32 startBlock;
        //     IStrategy[] strategies;
        //     uint256[] shares;
        // }

        expect(withdrawal[0], "e1").to.equal(owner.address);
        expect(withdrawal[1], "e2").to.equal(eigenYields);
        expect(withdrawal[2], "e3").to.equal(owner.address);
        expect(withdrawal[3], "e4").to.equal(ethers.toBigInt("1"));
        expect(withdrawal[4], "e5").to.equal(startBlock + 1);
        expect(withdrawal[5][0], "e6").to.equal(eigenLayerStrategy);
        expect(withdrawal[6][0], "e7").to.equal(ethers.parseEther("10"));

        // expect(withdrawal.withdrawer).to.equal(owner.address);
      }

      expect(event).to.not.be.undefined;
    });

    xit("should log calldata", async function () {
      // const contractAddy = await contract.getAddress();
      // console.log(contractAddy)

      const queuedWithdrawalParams = [];
      queuedWithdrawalParams[0] = {
        strategies: [eigenLayerStrategy],
        shares: [ethers.parseEther("10")],
        withdrawer: await contract.getAddress(),
      };

      const iface = new ethers.Interface(delegationManagerAbi);
      // console.log(iface.fragments.find(fragment => (fragment as FunctionFragment).name === "queueWithdrawals")?.inputs[0].arrayChildren?.components)
      const calldata = iface.encodeFunctionData("queueWithdrawals", [queuedWithdrawalParams]);
      console.log(calldata);
    });

    it("should set claimer", async function () {
      const contractAddress = await contract.getAddress();
      const claimerTx = await contract.connect(owner).setClaimer(owner);
      await claimerTx.wait();
      expect(await eigenRewardsCoord.claimerFor(contractAddress)).to.equal(owner.address);
    });

    it("should initiate withdrawal and emit event (floxi)", async function () {
      const contractAddress = await contract.getAddress();

      const queuedWithdrawalParams = [];
      queuedWithdrawalParams[0] = {
        strategies: [eigenLayerStrategy],
        shares: [ethers.parseEther("10")],
        withdrawer: contractAddress,
      };

      const iface = new ethers.Interface(delegationManagerAbi);
      const calldata = iface.encodeFunctionData("queueWithdrawals", [queuedWithdrawalParams]);

      const startBlock = await ethers.provider.getBlockNumber();

      const queueTx = await contract.connect(owner).initiateEigenlayerWithdrawal(calldata);
      const receipt = await queueTx.wait();

      const eventSignature = "WithdrawalQueued(bytes32,(address,address,address,uint256,uint32,address[],uint256[]))";
      const eventTopic = ethers.id(eventSignature);
      const event = receipt?.logs.find((log: any) => log.topics[0] === eventTopic);

      if (event) {
        const [withdrawalRoot, withdrawal] = ethers.AbiCoder.defaultAbiCoder().decode(
          ["bytes32", "tuple(address,address,address,uint256,uint32,address[],uint256[])"],
          event.data,
        );

        console.log(withdrawalRoot);

        // struct Withdrawal {
        //     address staker;
        //     address delegatedTo;
        //     address withdrawer;
        //     uint256 nonce;
        //     uint32 startBlock;
        //     IStrategy[] strategies;
        //     uint256[] shares;
        // }

        expect(withdrawal[0], "e1").to.equal(contractAddress);
        expect(withdrawal[1], "e2").to.equal(eigenYields);
        expect(withdrawal[2], "e3").to.equal(contractAddress);
        expect(withdrawal[3], "e4").to.equal(ethers.toBigInt("0"));
        expect(withdrawal[4], "e5").to.equal(startBlock + 1);
        expect(withdrawal[5][0], "e6").to.equal(eigenLayerStrategy);
        expect(withdrawal[6][0], "e7").to.equal(ethers.parseEther("10"));

        withdrawalEventData = withdrawal;
      }
      expect(event).to.not.be.undefined;
    });

    it("should finalize Withdrawal and emit event (floxi)", async function () {
      await hre.network.provider.send("hardhat_mine", ["0xffffffffff"]);

      // set during previous test
      const withdrawal: any = {};

      withdrawal.staker = withdrawalEventData[0];
      withdrawal.delegatedTo = withdrawalEventData[1];
      withdrawal.withdrawer = withdrawalEventData[2];
      withdrawal.nonce = withdrawalEventData[3];
      withdrawal.startBlock = withdrawalEventData[4];
      withdrawal.strategies = [withdrawalEventData[5][0]];
      withdrawal.shares = [withdrawalEventData[6][0]];

      const queueTx = await contract.connect(owner).completeEigenlayerWithdrawal(withdrawal);
      await queueTx.wait();

      // console.log(receipt);
    });

    it("should revert if L2 contract is not set", async function () {
      await expect(contract.connect(owner).shipToL2()).to.be.revertedWith("Remote Contract not set");
    });

    it("should succeed if L2 contract is set", async function () {
      await contract.connect(owner).setRemoteContract("0x0000000000000000000000000000000000000001");
      await expect(contract.connect(owner).shipToL2()).to.not.be.reverted;
    });

    xit("should revert on deposit on L1floxi", async function () {
      // await sfrxEth.transfer(owner.address, ethers.parseEther("2"));
      // expect(await sfrxEth.balanceOf(owner.address), "e1").to.equal(ethers.parseEther("2"));
      // await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("2"));
      // await expect(contract.connect(owner).deposit(ethers.parseEther("3"), owner.address), "e2").to.be.reverted;
    });
  });
});
