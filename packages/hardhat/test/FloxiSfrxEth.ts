import { expect } from "chai";
import hre, { ethers } from "hardhat";
import sfrxEthAbi from "../contracts/sfrxEthAbi.json";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FloxiSfrxEth } from "../typechain-types/contracts/FloxiSfrxEth.sol";
import { IERC20 } from "../typechain-types";
// import constants from "../constants";

// const fraxtal = constants.fraxtal;
// const mainnet = constants.mainnet;

const ADDR_sfrxEth = "0xFC00000000000000000000000000000000000005";
// const sFrxEthHoleskyMain = "0xa63f56985F9C7F3bc9fFc5685535649e0C1a55f3";
const sfrxEthEthereumMainnet = "0xac3E018457B222d93114458476f3E3416Abbe38F";
const bigSFraxHolderFraxtal = "0x66d9AF69E6845E8666f355676a267a726c04Ea4e";
// const l2StandardBridge = "0x4200000000000000000000000000000000000010";
const floxiMainnet = "0x0000000000000000000000000000000000000000";
const FORK_BLOCK = 7891572;
const fraxtalMainnetRPC = "https://rpc.frax.com";
// "https://github.com/FraxFinance/frax-solidity/blob/master/src/types/constants.ts#L4341C60-L4341C102"
const fraxferry = "0x67c6A8A715fc726ffD0A40588701813d9eC04d9C";

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
  let entryFee: bigint;

  before(async () => {
    resetFork();

    // get test account with eth
    [owner, treasury] = await hre.ethers.getSigners();

    // const functionSignature = "_deposit(address,uint256,uint256)";
    // selector = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(functionSignature)).slice(0, 10);

    // deploy fsfrxEth
    const contractFactory = await ethers.getContractFactory("FloxiSfrxEth");
    contract = await contractFactory.deploy(
      ADDR_sfrxEth,
      sfrxEthEthereumMainnet,
      floxiMainnet,
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
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("1")); // Insufficient allowance
      await expect(contract.connect(owner).deposit(ethers.parseEther("2"), owner.address)).to.be.reverted;
    });

    it("should increase allowance to spend owners sfrxEth", async function () {
      const spender = await contract.getAddress();
      const allowTx = await (sfrxEth as unknown as IERC20).connect(owner).approve(spender, ethers.parseEther("2"));
      await allowTx.wait();
      expect(await sfrxEth.allowance(owner.address, spender)).to.equal(ethers.parseEther("2"));
    });

    it("should deplosit into floxi vault and receive correct amount of shares", async function () {
      expect(await sfrxEth.balanceOf(owner.address), "e0").to.equal(ethers.parseEther("2"));
      expect(await sfrxEth.balanceOf(treasury.address), "e1").to.equal(ethers.toBigInt("0"));
      entryFee = ethers.parseEther("2") - (await contract.connect(owner).previewDeposit(ethers.parseEther("2")));
      const depositTx = await contract.connect(owner).deposit(ethers.parseEther("2"), owner.address);
      await depositTx.wait();
      expect(await sfrxEth.balanceOf(treasury.address), "e2").to.equal(entryFee);
      expect(await sfrxEth.balanceOf(owner.address), "e3").to.equal(ethers.toBigInt("0"));
      expect(await contract.balanceOf(owner.address), "e4").to.equal(ethers.parseEther("2") - entryFee);
      expect(await contract.getL1Assets(), "e4").to.equal(ethers.parseEther("2") - entryFee);
    });

    it("should revert on deposit with insufficient balance", async function () {
      await sfrxEth.transfer(owner.address, ethers.parseEther("2"));
      expect(await sfrxEth.balanceOf(owner.address), "e1").to.equal(ethers.parseEther("2"));
      await (sfrxEth as unknown as IERC20).connect(owner).approve(await contract.getAddress(), ethers.parseEther("2"));
      await expect(contract.connect(owner).deposit(ethers.parseEther("3"), owner.address), "e2").to.be.reverted;
    });

    xit("should withdraw from floxi vault and receive correct amount of asset and fees", async function () {
      const shares = await contract.balanceOf(owner.address);
      const fee = ethers.parseEther("2") - (await contract.connect(owner).previewRedeem(shares));
      const redeemTx = await contract.connect(owner).redeem(shares, owner.address, owner.address);
      await redeemTx.wait();
      expect(fee, "e1").to.equal(entryFee);
      expect(fee + shares, "e2").to.equal(ethers.parseEther("2"));
      expect(await sfrxEth.balanceOf(owner.address), "e3").to.equal(ethers.parseEther("2") - entryFee);
      expect(await sfrxEth.balanceOf(treasury.address), "e4").to.equal(entryFee);
      expect(await contract.balanceOf(owner.address), "e5").to.equal(ethers.parseEther("0"));
    });

    xit("should revert on withdrawal with insufficient shares", async function () {
      const shares = ethers.parseEther("2");
      await expect(contract.connect(owner).redeem(shares, owner.address, owner.address)).to.be.reverted;
    });

    it("should revert on bridge transfer failure", async function () {
      // Simulate bridge failure by using a non-existent address for the bridge contract
      const l1Balance_before = await contract.getL1Assets();
      const invalidBridgeContractFactory = await ethers.getContractFactory("FloxiSfrxEth");
      const invalidContract = await invalidBridgeContractFactory.deploy(
        ADDR_sfrxEth,
        sfrxEthEthereumMainnet,
        floxiMainnet,
        treasury.address,
        // l2StandardBridge,
        "0x0000000000000000000000000000000000000000",
      );
      await invalidContract.waitForDeployment();
      await sfrxEth.transfer(owner.address, ethers.parseEther("2"));
      await (sfrxEth as unknown as IERC20)
        .connect(owner)
        .approve(await invalidContract.getAddress(), ethers.parseEther("2"));
      await expect(invalidContract.connect(owner).deposit(ethers.parseEther("2"), owner.address), "e1").to.be.reverted;
      expect(await contract.getL1Assets(), "e2").to.equal(l1Balance_before);
    });

    // it("should revert on deposit below minimum amount", async function () {
    //   const minimumDeposit = ethers.parseEther("0.001"); // Assuming 0.1 ETH is the minimum deposit amount
    //   const lowAmount = minimumDeposit - ethers.toBigInt('1')
    //   await expect(contract.connect(owner).deposit(lowAmount, owner.address)).to.be.revertedWith("Minimum deposit amount not met");
    // });

    it("should emit events on deposit and withdrawal", async function () {
      const depositTx = await contract.connect(owner).deposit(ethers.parseEther("2"), owner.address);
      await expect(depositTx).to.emit(contract, "Deposit"); // .withArgs(owner.address, ethers.parseEther("2"));

      // const shares = await contract.balanceOf(owner.address);
      // const redeemTx = await contract.connect(owner).redeem(shares, owner.address, owner.address);
      // await expect(redeemTx).to.emit(contract, "Withdraw").withArgs(owner.address, ethers.parseEther("2"), shares);
    });

    xit("should correctly calculate total assets including L1", async function () {});
  });
});
