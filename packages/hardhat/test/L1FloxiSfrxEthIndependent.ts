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
const l1CrossDomainMessengerMainnet = "0x126bcc31Bc076B3d515f60FBC81FddE0B0d542Ed";

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

  beforeEach(async () => {
    resetFork();

    // get test account with eth
    [owner, treasury] = await hre.ethers.getSigners();

    // deploy fsfrxEth
    const contractFactory = await ethers.getContractFactory("L1FloxiSfrxEth");
    contract = await contractFactory.deploy(
      sfrxEthEthereumMainnet,
      L2_sfrxEth,
      mainnet.l1StandardBridge,
      l1CrossDomainMessengerMainnet,
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

      // Step 1: Transfer sfrxEth to the contract
      await sfrxEth.transfer(contractAddress, ethers.parseEther("10"));
      const contractBalance = await sfrxEth.balanceOf(contractAddress);
      console.log(`Contract balance after transfer: ${contractBalance.toString()}`);
      expect(contractBalance).to.equal(ethers.parseEther("10"));

      // Step 2: Deposit into the Eigenlayer strategy
      const depositTx = await contract.connect(owner).depositIntoStrategy();
      const receipt = await depositTx.wait();
      console.log(`Deposit transaction successful, gas used: ${receipt?.gasUsed.toString()}`);

      // Step 3: Assertions
      const strategyListLength = await eigenStrategyMan.stakerStrategyListLength(contractAddress);
      const strategyShares = await eigenStrategyMan.stakerStrategyShares(contractAddress, eigenLayerStrategy);
      const totalStakedAssets = await contract.totalStakedAssets();
      const totalAssets = await contract.totalAssets();

      console.log(`Strategy List Length: ${strategyListLength.toString()}`);
      console.log(`Strategy Shares: ${strategyShares.toString()}`);
      console.log(`Total Staked Assets: ${totalStakedAssets.toString()}`);
      console.log(`Total Assets: ${totalAssets.toString()}`);

      expect(strategyListLength).to.equal(ethers.toBigInt("1"));
      expect(strategyShares).to.equal(ethers.parseEther("10"));
      expect(totalStakedAssets).to.equal(ethers.parseEther("10"));
      expect(totalAssets).to.equal(ethers.parseEther("10"));
    });

    it("should delegate to operator", async function () {
      const contractAddress = await contract.getAddress();

      // Ensure the contract has sfrxEth deposited into the strategy
      await sfrxEth.transfer(contractAddress, ethers.parseEther("10"));
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("10"));
      const depositTx = await contract.connect(owner).depositIntoStrategy();
      await depositTx.wait();

      // Delegate to the operator
      const delegateTx = await contract.connect(owner).setDelegate(eigenYields);
      await delegateTx.wait();

      // Assertions
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

    it("should log calldata", async function () {
      // const contractAddy = await contract.getAddress();
      // console.log(contractAddy)

      const queuedWithdrawalParams = [];
      queuedWithdrawalParams[0] = {
        strategies: [constants.holesky.eigen_strategy], // eigenLayerStrategy
        shares: [982669870000000000n],
        withdrawer: "0xe5cDe99ef123DF0E66e36332d40aF00Cf8bA18C1", // await contract.getAddress(),
      };

      const iface = new ethers.Interface(delegationManagerAbi);
      // console.log(iface.fragments.find(fragment => (fragment as FunctionFragment).name === "queueWithdrawals")?.inputs[0].arrayChildren?.components)
      const calldata = iface.encodeFunctionData("queueWithdrawals", [queuedWithdrawalParams]);
      console.log(calldata);
    });

    it("should set claimer", async function () {
      const contractAddress = await contract.getAddress();

      // Set the claimer to the owner
      const claimerTx = await contract.connect(owner).setClaimer(owner);
      await claimerTx.wait();

      // Assertion to ensure the claimer is correctly set
      expect(await eigenRewardsCoord.claimerFor(contractAddress)).to.equal(owner.address);
    });

    it("should initiate withdrawal and emit event (floxi)", async function () {
      const contractAddress = await contract.getAddress();

      // Step 1: Deposit sfrxEth into the contract to generate shares
      console.log("Depositing sfrxEth to generate shares...");
      await sfrxEth.transfer(contractAddress, ethers.parseEther("10"));
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("10"));
      const depositTx = await contract.connect(owner).depositIntoStrategy();
      await depositTx.wait();

      // Step 2: Delegate to the operator (required for withdrawal)
      console.log("Delegating to operator...");
      const delegateTx = await contract.connect(owner).setDelegate(eigenYields);
      await delegateTx.wait();

      // Step 3: Prepare calldata for withdrawal
      console.log("Preparing calldata for withdrawal...");
      const queuedWithdrawalParams = [
        {
          strategies: [eigenLayerStrategy],
          shares: [ethers.parseEther("10")], // Withdraw the correct number of shares
          withdrawer: contractAddress,
        },
      ];

      const iface = new ethers.Interface(delegationManagerAbi);
      const calldata = iface.encodeFunctionData("queueWithdrawals", [queuedWithdrawalParams]);

      // Step 4: Initiate withdrawal
      console.log("Initiating withdrawal...");
      const startBlock = await ethers.provider.getBlockNumber();
      const queueTx = await contract.connect(owner).initiateEigenlayerWithdrawal(calldata);
      const receipt = await queueTx.wait();

      // Step 5: Verify the emitted event
      const eventSignature = "WithdrawalQueued(bytes32,(address,address,address,uint256,uint32,address[],uint256[]))";
      const eventTopic = ethers.id(eventSignature);
      const event = receipt?.logs.find((log: any) => log.topics[0] === eventTopic);

      if (event) {
        const [withdrawalRoot, withdrawal] = ethers.AbiCoder.defaultAbiCoder().decode(
          ["bytes32", "tuple(address,address,address,uint256,uint32,address[],uint256[])"],
          event.data,
        );

        console.log(`Withdrawal root: ${withdrawalRoot}`);
        expect(withdrawal[0], "e1").to.equal(contractAddress);
        expect(withdrawal[1], "e2").to.equal(eigenYields); // Ensuring delegation to the correct operator
        expect(withdrawal[2], "e3").to.equal(contractAddress);
        expect(withdrawal[3], "e4").to.equal(ethers.toBigInt("0"));
        expect(withdrawal[4], "e5").to.equal(startBlock + 1);
        expect(withdrawal[5][0], "e6").to.equal(eigenLayerStrategy);
        expect(withdrawal[6][0], "e7").to.equal(ethers.parseEther("10")); // Ensure shares match
      }

      expect(event).to.not.be.undefined;
    });

    it("should finalize Withdrawal and emit event (floxi)", async function () {
      const contractAddress = await contract.getAddress();

      // Step 1: Deposit sfrxEth into the contract to generate shares
      console.log("Depositing sfrxEth to generate shares...");
      await sfrxEth.transfer(contractAddress, ethers.parseEther("10"));
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("10"));
      const depositTx = await contract.connect(owner).depositIntoStrategy();
      await depositTx.wait();

      // Step 2: Delegate to the operator (required for withdrawal)
      console.log("Delegating to operator...");
      const delegateTx = await contract.connect(owner).setDelegate(eigenYields);
      await delegateTx.wait();

      // Step 3: Prepare calldata for withdrawal
      console.log("Preparing calldata for withdrawal...");
      const queuedWithdrawalParams = [
        {
          strategies: [eigenLayerStrategy],
          shares: [ethers.parseEther("10")], // Withdraw the correct number of shares
          withdrawer: contractAddress,
        },
      ];

      const iface = new ethers.Interface(delegationManagerAbi);
      const calldata = iface.encodeFunctionData("queueWithdrawals", [queuedWithdrawalParams]);

      // Step 4: Initiate withdrawal
      console.log("Initiating withdrawal...");
      // const startBlock = await ethers.provider.getBlockNumber();
      const queueTx = await contract.connect(owner).initiateEigenlayerWithdrawal(calldata);
      const receipt = await queueTx.wait();

      const eventSignature = "WithdrawalQueued(bytes32,(address,address,address,uint256,uint32,address[],uint256[]))";
      const eventTopic = ethers.id(eventSignature);
      const event = receipt?.logs.find((log: any) => log.topics[0] === eventTopic);

      let withdrawal;
      if (event) {
        const [withdrawalRoot, decodedWithdrawal] = ethers.AbiCoder.defaultAbiCoder().decode(
          ["bytes32", "tuple(address,address,address,uint256,uint32,address[],uint256[])"],
          event.data,
        );

        console.log(withdrawalRoot);

        withdrawal = {
          staker: decodedWithdrawal[0],
          delegatedTo: decodedWithdrawal[1],
          withdrawer: decodedWithdrawal[2],
          nonce: decodedWithdrawal[3],
          startBlock: decodedWithdrawal[4],
          strategies: [decodedWithdrawal[5][0]],
          shares: [decodedWithdrawal[6][0]],
        };
      }

      // const abiCoder = ethers.AbiCoder.defaultAbiCoder()

      // const data = abiCoder

      expect(withdrawal).to.not.be.undefined;

      // Step 5: Advance blocks to simulate passing time
      await hre.network.provider.send("hardhat_mine", ["0xffffffffff"]);

      // Step 6: Finalize the withdrawal
      const finalizeTx = await contract.connect(owner).completeEigenlayerWithdrawal(withdrawal!);
      await finalizeTx.wait();

      // Assertions could be added here based on the event emitted or contract state changes
    });

    it("should revert if L2 contract is not set", async function () {
      await expect(contract.connect(owner).shipToL2()).to.be.revertedWith("Remote Contract not set");
    });

    it("should succeed if L2 contract is set", async function () {
      await contract.connect(owner).setRemoteContract("0x0000000000000000000000000000000000000001");
      await expect(contract.connect(owner).shipToL2()).to.not.be.reverted;
    });

    it("should return the correct total assets including staked assets", async function () {
      const contractAddress = await contract.getAddress();

      // Step 1: Transfer sfrxEth to the contract and deposit into strategy
      await sfrxEth.transfer(contractAddress, ethers.parseEther("10"));

      await contract.connect(owner).depositIntoStrategy();

      // Step 2: Calculate total assets (including staked assets)
      const totalAssets = await contract.totalAssets();

      // Step 3: Verify that the total assets include both balance and staked assets
      expect(totalAssets).to.equal(ethers.parseEther("10"));
    });

    it("should correctly track queued and reserved assets", async function () {
      const contractAddress = await contract.getAddress();

      // Step 1: Deposit sfrxEth and queue a withdrawal
      await sfrxEth.transfer(contractAddress, ethers.parseEther("10"));
      await contract.connect(owner).depositIntoStrategy();

      // Prepare calldata for withdrawal
      const queuedWithdrawalParams = [
        {
          strategies: [eigenLayerStrategy],
          shares: [ethers.parseEther("10")],
          withdrawer: contractAddress,
        },
      ];

      const iface = new ethers.Interface(delegationManagerAbi);
      const calldata = iface.encodeFunctionData("queueWithdrawals", [queuedWithdrawalParams]);

      // Initiate withdrawal
      await contract.connect(owner).initiateEigenlayerWithdrawal(calldata);

      // Step 2: Check queued and reserved assets
      const queuedAssets = await contract.queuedAssets();
      const reservedAssets = await contract.reservedAssets();

      // Step 3: Verify the correct tracking of queued and reserved assets
      expect(queuedAssets).to.equal(ethers.parseEther("10"));
      expect(reservedAssets).to.equal(ethers.toBigInt("0"));
    });

    it("should correctly convert shares to underlying assets", async function () {
      const contractAddress = await contract.getAddress();

      // Step 1: Transfer sfrxEth to the contract and deposit into strategy
      await sfrxEth.transfer(contractAddress, ethers.parseEther("10"));
      await contract.connect(owner).depositIntoStrategy();

      // Step 2: Convert shares to underlying assets
      const shares = ethers.parseEther("10");
      const underlyingAssets = await contract.sharesToUnderlying(shares);

      // Step 3: Verify that the conversion is correct
      expect(underlyingAssets).to.equal(shares);
    });

    it("should revert in `completeEigenlayerWithdrawal` if strategy shares are invalid", async function () {
      const contractAddress = await contract.getAddress();

      // Step 1: Prepare invalid withdrawal data
      const invalidWithdrawal = {
        staker: contractAddress,
        delegatedTo: eigenYields,
        withdrawer: contractAddress,
        nonce: 0,
        startBlock: 0,
        strategies: [eigenLayerStrategy],
        shares: [ethers.parseEther("20")], // Invalid number of shares, more than available
      };

      // Step 2: Attempt to complete withdrawal with invalid shares
      await expect(contract.connect(owner).completeEigenlayerWithdrawal(invalidWithdrawal)).to.be.revertedWith(
        "Complete Withdrawal failed",
      );
    });

    it("should revert if attempting to withdraw more shares than available", async function () {
      const contractAddress = await contract.getAddress();

      // Step 1: Transfer sfrxEth to the contract and deposit into strategy
      await sfrxEth.transfer(contractAddress, ethers.parseEther("10"));
      await contract.connect(owner).depositIntoStrategy();

      // Step 2: Prepare calldata for withdrawal with more shares than available
      const queuedWithdrawalParams = [
        {
          strategies: [eigenLayerStrategy],
          shares: [ethers.parseEther("20")], // Requesting more shares than available
          withdrawer: contractAddress,
        },
      ];

      const iface = new ethers.Interface(delegationManagerAbi);
      const calldata = iface.encodeFunctionData("queueWithdrawals", [queuedWithdrawalParams]);

      // Step 3: Attempt to initiate withdrawal with excess shares
      await expect(contract.connect(owner).initiateEigenlayerWithdrawal(calldata)).to.be.revertedWith(
        "Shares requested too high",
      );
    });

    it("should send cross domain message", async function () {
      const contractAddress = await contract.getAddress();

      // Step 1: Transfer sfrxEth to the contract
      await sfrxEth.transfer(contractAddress, ethers.parseEther("10"));
      const contractBalance = await sfrxEth.balanceOf(contractAddress);
      console.log(`Contract balance after transfer: ${contractBalance.toString()}`);
      expect(contractBalance).to.equal(ethers.parseEther("10"));

      // Step 2: Deposit into the Eigenlayer strategy
      const depositTx = await contract.connect(owner).depositIntoStrategy();
      const receipt = await depositTx.wait();
      console.log(`Deposit transaction successful, gas used: ${receipt?.gasUsed.toString()}`);

      // Step 3: Assertions
      const totalAssets = await contract.totalAssets();
      console.log(`Total Assets: ${totalAssets.toString()}`);
      expect(totalAssets).to.equal(ethers.parseEther("10"));

      // Step 4: Send cross domain message to update total assets on l2
      const xdomainTx = await contract.connect(owner).updateTotalAssetsL2();
      const xreceipt = await xdomainTx.wait();
      console.log(`Sent message to xDomainMessenger, gas used: ${xreceipt?.gasUsed.toString()}`);
    });
  });
});
