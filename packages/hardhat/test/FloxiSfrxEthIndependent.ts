import { expect } from "chai";
import hre, { ethers } from "hardhat";
import sfrxEthAbi from "../contracts/sfrxEthAbi.json";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FloxiSfrxEth } from "../typechain-types/contracts/FloxiSfrxEth.sol";
import { IERC20 } from "../typechain-types";

// Constants
const ADDR_sfrxEth = "0xFC00000000000000000000000000000000000005";
const sfrxEthEthereumMainnet = "0xac3E018457B222d93114458476f3E3416Abbe38F";
const bigSFraxHolderFraxtal = "0x66d9AF69E6845E8666f355676a267a726c04Ea4e";
const floxiMainnet = "0x0000000000000000000000000000000000000000";
const FORK_BLOCK = 7891572;
const fraxtalMainnetRPC = "https://rpc.frax.com";
const fraxferry = "0x67c6A8A715fc726ffD0A40588701813d9eC04d9C";
const l2CrossDomainMessenger = "0x4200000000000000000000000000000000000007";

const resetFork = async () => {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: fraxtalMainnetRPC,
          blockNumber: FORK_BLOCK,
        },
      },
    ],
  });
};

describe("Floxi", function () {
  let sfrxEth: Contract;
  let signer: HardhatEthersSigner;
  let contract: FloxiSfrxEth;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;

  beforeEach(async () => {
    await resetFork();

    // get test account with eth
    [owner, treasury] = await hre.ethers.getSigners();

    // deploy fsfrxEth
    const contractFactory = await ethers.getContractFactory("FloxiSfrxEth");
    contract = await contractFactory.deploy(
      ADDR_sfrxEth,
      sfrxEthEthereumMainnet,
      floxiMainnet,
      l2CrossDomainMessenger,
      treasury.address,
      fraxferry,
    );
    await contract.waitForDeployment();

    // impersonate sfrxEth holder
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [bigSFraxHolderFraxtal],
    });
    signer = await hre.ethers.getSigner(bigSFraxHolderFraxtal);

    // fund sfrxEth holder
    await owner.sendTransaction({
      to: bigSFraxHolderFraxtal,
      value: hre.ethers.parseEther("1.0"),
    });

    // get sfrxEth contract
    sfrxEth = new ethers.Contract(ADDR_sfrxEth, sfrxEthAbi, signer);
  });

  describe("Floxi Staked Frax Ether contract", function () {
    it("should be the correct block", async function () {
      expect(await hre.ethers.provider.getBlockNumber()).to.be.above(FORK_BLOCK);
    });

    it("should deploy Floxi Staked Frax Eth", async function () {
      expect(await contract.symbol()).to.equal("fsfrxEth");
      expect(await contract.decimals()).to.equal(18);
      expect(await contract.asset()).to.equal(ADDR_sfrxEth);
    });

    it("should correctly initialize contract parameters in the constructor", async function () {
      expect(await contract._remoteAsset()).to.equal(sfrxEthEthereumMainnet);
      expect(await contract._remoteContract()).to.equal(floxiMainnet);
      expect(await contract._treasury()).to.equal(treasury.address);
      expect(await contract._fraxFerry()).to.equal(fraxferry);
    });

    it("should initiate balances correctly", async function () {
      // signer should now have 1 eth and 108453869999710112327 sfrxEth
      expect(await ethers.provider.getBalance(signer.address)).to.equal(ethers.parseEther("1"));
      expect(await sfrxEth.balanceOf(signer.address)).to.equal(ethers.toBigInt("108453869999710112327"));
      expect(await sfrxEth.balanceOf(owner.address)).to.equal(ethers.toBigInt("0"));
      expect(await sfrxEth.balanceOf(treasury.address)).to.equal(ethers.toBigInt("0"));
    });

    it("should send sfrxEth to owner account", async function () {
      await sfrxEth.transfer(owner.address, ethers.parseEther("2"));
      expect(await sfrxEth.balanceOf(owner.address)).to.equal(ethers.parseEther("2"));
    });

    it("should revert on deposit with insufficient allowance", async function () {
      await sfrxEth.transfer(owner.address, ethers.parseEther("2"));
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("1")); // Insufficient allowance
      await expect(contract.connect(owner).deposit(ethers.parseEther("2"), owner.address)).to.be.reverted;
    });

    it("should increase allowance to spend owner's sfrxEth", async function () {
      await sfrxEth.transfer(owner.address, ethers.parseEther("2"));
      const spender = await contract.getAddress();
      const allowTx = await (sfrxEth as unknown as IERC20).connect(owner).approve(spender, ethers.parseEther("2"));
      await allowTx.wait();
      expect(await sfrxEth.allowance(owner.address, spender)).to.equal(ethers.parseEther("2"));
    });

    it("should deposit into floxi vault and receive correct amount of shares", async function () {
      // Step 1: Transfer sfrxEth to owner
      await sfrxEth.transfer(owner.address, ethers.parseEther("2"));

      // Step 2: Approve the Floxi contract to spend sfrxEth
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("2"));

      // Step 3: Make the deposit
      const totalFees = ethers.parseEther("2") - (await contract.connect(owner).previewDeposit(ethers.parseEther("2")));
      console.log(`totalFees ${totalFees}`);
      const depositTx = await contract.connect(owner).deposit(ethers.parseEther("2"), owner.address);
      await depositTx.wait();

      // Step 4: Assertions
      expect(await sfrxEth.balanceOf(treasury.address), "e1").to.equal(totalFees - 10000000000000000n);
      expect(await sfrxEth.balanceOf(owner.address), "e2").to.equal(ethers.toBigInt("0"));
      expect(await contract.balanceOf(owner.address), "e3").to.equal(ethers.parseEther("2") - totalFees);
      expect(await contract.getL1Assets(), "e4").to.equal(ethers.parseEther("2") - totalFees);
      expect(await sfrxEth.balanceOf(await contract.getAddress()), "e5").to.equal(ethers.toBigInt("0"));
    });

    it("should revert on deposit with insufficient balance", async function () {
      await sfrxEth.transfer(owner.address, ethers.parseEther("2"));
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("2"));
      await expect(contract.connect(owner).deposit(ethers.parseEther("3"), owner.address)).to.be.reverted;
    });

    it("should revert on bridge transfer failure", async function () {
      const l1Balance_before = await contract.getL1Assets();
      const invalidBridgeContractFactory = await ethers.getContractFactory("FloxiSfrxEth");
      const invalidContract = await invalidBridgeContractFactory.deploy(
        ADDR_sfrxEth,
        sfrxEthEthereumMainnet,
        floxiMainnet,
        l2CrossDomainMessenger,
        treasury.address,
        "0x0000000000000000000000000000000000000000", // Invalid bridge address
      );
      await invalidContract.waitForDeployment();
      await sfrxEth.transfer(owner.address, ethers.parseEther("2"));
      await (sfrxEth as unknown as IERC20)
        .connect(owner)
        .approve(await invalidContract.getAddress(), ethers.parseEther("2"));
      await expect(invalidContract.connect(owner).deposit(ethers.parseEther("2"), owner.address)).to.be.reverted;
      expect(await contract.getL1Assets()).to.equal(l1Balance_before);
    });

    it("should emit events on deposit", async function () {
      // Step 1: Transfer sfrxEth to owner
      await sfrxEth.transfer(owner.address, ethers.parseEther("2"));

      // Step 2: Approve the Floxi contract to spend sfrxEth
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("2"));

      // Step 3: Perform the deposit and check for emitted event
      const depositTx = await contract.connect(owner).deposit(ethers.parseEther("2"), owner.address);
      await expect(depositTx).to.emit(contract, "Deposit");
    });

    it("should queue a withdrawal and emit the correct event", async function () {
      // Step 1: Transfer sfrxEth to the contract
      await sfrxEth.transfer(owner.address, ethers.parseEther("5"));
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("5"));

      // Step 2: Deposit sfrxEth to generate shares
      await contract.connect(owner).deposit(ethers.parseEther("5"), owner.address);

      // Step 3: Queue a withdrawal
      const queueTx = await contract.connect(owner).queueWithdrawal(ethers.parseEther("2"));
      const receipt = await queueTx.wait();

      // Step 4: Verify the event was emitted
      expect(receipt).to.emit(contract, "WithdrawalQueued").withArgs(owner.address, 0, ethers.parseEther("2"));

      // Step 5: Check that the withdrawal was queued
      const queuedAssets = await contract._queuedAssets(owner.address);
      expect(queuedAssets).to.equal(ethers.parseEther("2"));
    });

    it("should unlock withdrawals up to the maximum iterations", async function () {
      // Step 1: Transfer sfrxEth to the contract and queue withdrawals
      await sfrxEth.transfer(owner.address, ethers.parseEther("10"));
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("10"));
      await contract.connect(owner).deposit(ethers.parseEther("10"), owner.address);
      await contract.connect(owner).queueWithdrawal(ethers.parseEther("4"));
      await contract.connect(owner).queueWithdrawal(ethers.parseEther("4"));

      const queuedAssetsBefore = await contract._queuedAssets(owner.address);
      expect(queuedAssetsBefore, "e1").to.equal(ethers.parseEther("8"));

      // simulate arrival from bridge
      await sfrxEth.transfer(await contract.getAddress(), ethers.parseEther("9"));

      // Step 2: Unlock withdrawals with maxIterations = 1
      const unlockTx = await contract.connect(owner).unlockWithdrawals(ethers.parseEther("4"), 1);
      const receipt = await unlockTx.wait();

      // Step 3: Check that the first withdrawal was unlocked
      const unlockedAssets = await contract._unlockedAssets(owner.address);
      expect(unlockedAssets, "e2").to.equal(ethers.parseEther("4"));

      const queuedAssetsAfter = await contract._queuedAssets(owner.address);
      expect(queuedAssetsAfter, "e3").to.equal(ethers.parseEther("4"));

      // Step 4: Verify the event was emitted correctly
      expect(receipt, "e4").to.emit(contract, "WithdrawalsUnlocked").withArgs(ethers.parseEther("4"), 0, 1);
    });

    it("should allow withdrawal of unlocked assets", async function () {
      // Step 1: Transfer sfrxEth to the contract and queue/unlock withdrawals
      await sfrxEth.transfer(owner.address, ethers.parseEther("5"));
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("5"));

      await contract.connect(owner).deposit(ethers.parseEther("5"), owner.address);

      const shares = await contract.connect(owner).balanceOf(owner.address);
      console.log(`shares: ${shares}`);
      const assets = await contract.connect(owner).convertToAssets(shares);
      console.log(`assets ${assets}`);
      await contract.connect(owner).queueWithdrawal(assets);

      // simulate arrival from bridge
      await sfrxEth.transfer(await contract.getAddress(), assets);
      await contract.connect(owner).setL1Assets((await contract.connect(owner).getL1Assets()) - assets);

      const unlockTx = await contract.connect(owner).unlockWithdrawals(assets, 1);
      await unlockTx.wait();

      console.log(await contract._unlockedAssets(owner.address));

      const bal = await (sfrxEth as unknown as IERC20).balanceOf(await contract.getAddress());
      console.log(`bal ${bal}`);

      // Step 2: Withdraw unlocked assets
      const withdrawTx = await contract.connect(owner).withdraw(assets, owner.address, owner.address);
      await withdrawTx.wait();

      // Step 3: Verify that the assets were withdrawn
      const ownerBalance = await sfrxEth.balanceOf(owner.address);
      expect(ownerBalance, "e1").to.equal(shares);

      // Step 4: Check that unlocked assets are zero
      const unlockedAssets = await contract._unlockedAssets(owner.address);
      expect(unlockedAssets, "e2").to.equal(0n);

      // Step 4: Verify that shares are 0
      const ownerBalanceFloxi = await contract.balanceOf(owner.address);
      expect(ownerBalanceFloxi, "e3").to.equal(0n);
    });

    it("should allow redemption of unlocked assets", async function () {
      // Step 1: Transfer sfrxEth to the contract and queue/unlock withdrawals
      await sfrxEth.transfer(owner.address, ethers.parseEther("5"));
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("5"));

      await contract.connect(owner).deposit(ethers.parseEther("5"), owner.address);

      const shares = await contract.connect(owner).balanceOf(owner.address);
      console.log(`shares: ${shares}`);
      const assets = await contract.connect(owner).convertToAssets(shares);
      console.log(`assets ${assets}`);
      await contract.connect(owner).queueWithdrawal(assets);

      // simulate arrival from bridge
      await sfrxEth.transfer(await contract.getAddress(), assets);
      await contract.connect(owner).setL1Assets((await contract.connect(owner).getL1Assets()) - assets);

      const unlockTx = await contract.connect(owner).unlockWithdrawals(assets, 1);
      await unlockTx.wait();

      console.log(await contract._unlockedAssets(owner.address));

      const bal = await (sfrxEth as unknown as IERC20).balanceOf(await contract.getAddress());
      console.log(`bal ${bal}`);

      // Step 2: Withdraw unlocked assets
      const withdrawTx = await contract.connect(owner).redeem(shares, owner.address, owner.address);
      await withdrawTx.wait();

      // Step 3: Verify that the assets were withdrawn
      const ownerBalance = await sfrxEth.balanceOf(owner.address);
      expect(ownerBalance, "e1").to.equal(shares);

      // Step 4: Check that unlocked assets are zero
      const unlockedAssets = await contract._unlockedAssets(owner.address);
      expect(unlockedAssets, "e2").to.equal(0n);

      // Step 4: Verify that shares are 0
      const ownerBalanceFloxi = await contract.balanceOf(owner.address);
      expect(ownerBalanceFloxi, "e3").to.equal(0n);
    });

    it("should return the correct total assets including L1 assets", async function () {
      // Step 1: Transfer sfrxEth to the contract and force ship to L1
      await sfrxEth.transfer(owner.address, ethers.parseEther("5"));

      await sfrxEth.transfer(await contract.getAddress(), ethers.parseEther("5"));

      await contract.connect(owner).forceShipToL1(ethers.parseEther("5"));

      const ferryTicket = 10000000000000000n;

      // Step 2: Check total assets, should include L1 assets
      const totalAssets = await contract.totalAssets();
      expect(totalAssets).to.equal(ethers.parseEther("5") - ferryTicket);
    });

    it("should revert when queueing more withdrawals than allowed", async function () {
      // Step 1: Queue the maximum number of withdrawals
      for (let i = 0; i < 5; i++) {
        await sfrxEth.transfer(owner.address, ethers.parseEther("1"));
        await (sfrxEth as unknown as IERC20)
          .connect(owner)
          .approve(await contract.getAddress(), ethers.parseEther("1"));
        await contract.connect(owner).deposit(ethers.parseEther("1"), owner.address);
        await contract.connect(owner).queueWithdrawal(ethers.parseEther("0.5"));
      }

      // Step 2: Attempt to queue one more withdrawal
      await expect(contract.connect(owner).queueWithdrawal(ethers.parseEther("1"))).to.be.reverted;
    });

    it("should handle cases where no withdrawals are in the queue", async function () {
      // Step 1: Transfer sfrxEth to the contract and deposit without queuing any withdrawals
      await sfrxEth.transfer(owner.address, ethers.parseEther("5"));
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("5"));
      await contract.connect(owner).deposit(ethers.parseEther("5"), owner.address);

      // Step 2: Attempt to unlock withdrawals when the queue is empty
      const unlockTx = contract.connect(owner).unlockWithdrawals(ethers.parseEther("5"), 1);

      // Step 3: Expect the unlock attempt to have no effect (since the queue is empty)
      await expect(unlockTx).to.be.reverted;

      // Alternatively, check for state changes if no revert is expected:
      const unlockedAssets = await contract._unlockedAssets(owner.address);
      expect(unlockedAssets).to.equal(ethers.toBigInt("0"));
    });

    it("should estimate gas consumption for unlockWithdrawals function", async function () {
      // Get sfrxEth contract and transfer to Floxi contract
      sfrxEth = new ethers.Contract(ADDR_sfrxEth, sfrxEthAbi, signer);
      await sfrxEth.transfer(owner.address, ethers.parseEther("11"));

      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("11"));

      await contract.connect(owner).deposit(ethers.parseEther("11"), owner.address);

      // Queue multiple withdrawals
      for (let i = 0; i < 5; i++) {
        console.log(i);
        const tx = await contract.connect(owner).queueWithdrawal(ethers.parseEther("1"));
        await tx.wait();
      }

      // Step 2: Measure gas consumption for different maxIterations
      const gasEstimates = [];

      for (const maxIterations of [1, 2, 5, 10]) {
        console.log(maxIterations);
        const tx = await contract.connect(owner).unlockWithdrawals(ethers.parseEther("10"), maxIterations);
        const receipt = await tx.wait();

        console.log(`Gas used for maxIterations = ${maxIterations}: ${receipt?.gasUsed.toString()}`);
        gasEstimates.push({ maxIterations, gasUsed: receipt?.gasUsed });
      }

      // Step 3: Calculate and log the gas per iteration
      gasEstimates.forEach(({ maxIterations, gasUsed }) => {
        const gasPerIteration = gasUsed ?? 0n / ethers.toBigInt(maxIterations);
        console.log(`Gas per iteration for maxIterations = ${maxIterations}: ${gasPerIteration}`);
        console.log(`max iterations without running out of gas: ${30000000n / gasPerIteration}`);
      });

      // Ensure that gas estimates are recorded
      expect(gasEstimates.length).to.be.gt(0);
    });
  });
});
