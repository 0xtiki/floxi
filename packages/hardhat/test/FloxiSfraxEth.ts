import { expect } from "chai";
import hre, { ethers } from "hardhat";
import sfraxEthAbi from "../contracts/sfraxEthAbi.json";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FloxiSfraxEth } from "../typechain-types/contracts/FloxiSfraxEth";
import { IERC20 } from "../typechain-types";

const ADDR_SFRAXETH = "0xFC00000000000000000000000000000000000005";
const bigSFraxHolderFraxtal = "0x66d9AF69E6845E8666f355676a267a726c04Ea4e";
const FORK_BLOCK = 7891572;

describe("Floxi", function () {
  let sfraxEth: Contract;
  let signer: HardhatEthersSigner;
  let contract: FloxiSfraxEth;
  let owner: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;

  before(async () => {
    // get test account with eth
    [owner, treasury] = await hre.ethers.getSigners();

    // deploy fsfraxEth
    const contractFactory = await ethers.getContractFactory("FloxiSfraxEth");
    contract = await contractFactory.deploy(ADDR_SFRAXETH, treasury.address);
    await contract.waitForDeployment();

    // impersonate sfraxEth holder
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [bigSFraxHolderFraxtal],
    });
    signer = await hre.ethers.getSigner(bigSFraxHolderFraxtal);

    // fund sfraxEth holder
    await owner.sendTransaction({
      to: bigSFraxHolderFraxtal,
      value: hre.ethers.parseEther("1.0"),
    });

    // get sfraxEth contract
    sfraxEth = new ethers.Contract(ADDR_SFRAXETH, sfraxEthAbi, signer);
  });

  describe("Floxi Staked Frax Ether contract", function () {
    it("should be the correct block", async function () {
      expect(await hre.ethers.provider.getBlockNumber()).to.be.above(FORK_BLOCK);
    });

    it("should deploy Floxi Staked Frax Eth", async function () {
      expect(await contract.symbol()).to.equal("fsFraxEth");
      expect(await contract.decimals()).to.equal(18);
      expect(await contract.asset()).to.equal(ADDR_SFRAXETH);
    });

    it("should initiate balances correctly", async function () {
      // signer should now have 1 eth and 108453869999710112327 sfraxEth
      expect(await ethers.provider.getBalance(signer.address)).to.equal(ethers.parseEther("1"));
      expect(await sfraxEth.balanceOf(signer.address)).to.equal(ethers.toBigInt("108453869999710112327"));
      expect(await sfraxEth.balanceOf(owner.address)).to.equal(ethers.toBigInt("0"));
      expect(await sfraxEth.balanceOf(treasury.address)).to.equal(ethers.toBigInt("0"));
    });

    it("should send sfraxEth to owner account", async function () {
      await sfraxEth.transfer(owner.address, ethers.parseEther("2"));
      expect(await sfraxEth.balanceOf(owner.address)).to.equal(ethers.parseEther("2"));
    });

    it("should increase allowance to spend owners sfraxeth", async function () {
      const spender = await contract.getAddress();
      const allowTx = await (sfraxEth as unknown as IERC20).connect(owner).approve(spender, ethers.parseEther("2"));
      await allowTx.wait();
      expect(await sfraxEth.allowance(owner.address, spender)).to.equal(ethers.parseEther("2"));
    });

    it("should deplosit into floxi vault and receive correct amount of shares", async function () {
      const depositTx = await contract.connect(owner).deposit(ethers.parseEther("2"), owner.address);
      await depositTx.wait();
      expect(await sfraxEth.balanceOf(owner.address)).to.equal(ethers.toBigInt("0"));
      expect(await contract.balanceOf(owner.address)).to.equal(ethers.parseEther("2"));
    });

    it("should withdraw from floxi vault and receive correct amount of asset and fees", async function () {
      const fee = ethers.parseEther("2") - (await contract.connect(owner).previewRedeem(ethers.parseEther("2")));
      const redeemTx = await contract.connect(owner).redeem(ethers.parseEther("2"), owner.address, owner.address);
      await redeemTx.wait();
      expect(await sfraxEth.balanceOf(owner.address)).to.equal(ethers.parseEther("2") - fee);
      expect(await sfraxEth.balanceOf(treasury.address)).to.equal(fee);
      expect(await contract.balanceOf(owner.address)).to.equal(ethers.parseEther("0"));
    });
  });
});
