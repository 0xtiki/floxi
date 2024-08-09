// import { expect } from "chai";
import hre, { ethers } from "hardhat";
import sfraxEthAbi from "../contracts/sfrxEthAbi.json";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const ADDR_SFRAXETH = "0xFC00000000000000000000000000000000000005";
const ADDR_USER = "0x1FB7Eb30eCBb27Ac735bc03C2f56c1B0A4402694"; //"0xebd293f2173082320d88533316f5964298de316e" //"0xb0754B937bD306fE72264274A61BC03F43FB685F"

xdescribe("FraxFerry", function () {
  let sfraxEth: Contract;
  let user: HardhatEthersSigner;
  //   let yourContract: YourContract;

  before(async () => {
    const [owner] = await ethers.getSigners();

    sfraxEth = new ethers.Contract(ADDR_SFRAXETH, sfraxEthAbi, owner);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ADDR_USER],
    });

    user = await ethers.getSigner(ADDR_USER);

    // const yourContractFactory = await ethers.getContractFactory("YourContract");
    // yourContract = (await yourContractFactory.deploy(owner.address)) as YourContract;
    // await yourContract.waitForDeployment();
  });

  describe("simulate ferry functionality", function () {
    it("Should embark", async function () {
      console.log(await ethers.provider.getBalance(user.address));
      console.log(await hre.ethers.provider.getBlockNumber());
      console.log(await sfraxEth.balanceOf(user.address));
      console.log(await sfraxEth.allowance(user.address, sfraxEth.getAddress()));
      // await sfraxEth.approve(sfraxEth.getAddress(), ethers.parseEther("1"))
      //   expect(await sfraxEth.balanceOf(user.address)).to.equal(ethers.toBigInt("16356571088845437412"));
      //   expect(await sfraxEth.allowance(user.address, sfraxEth.getAddress())).to.equal(0);
    });

    // it("Should approve amount", async function () {
    //     // const tx = await sfraxEth.approve(sfraxEth.getAddress(), ethers.parseEther("1"));
    //     // console.log(tx)
    //     // await hre.ethers.provider.send("evm_mine", []);

    //     await sfraxEth.mint(user.address, 3187621375);
    //     console.log(await sfraxEth.balanceOf(user.address))
    // //   expect(await sfraxEth.allowance(user.address, sfraxEth.getAddress())).to.equal(ethers.parseEther("1"));
    // });
  });

  //   describe("Deployment", function () {
  //     it("Should have the right message on deploy", async function () {
  //       expect(await yourContract.greeting()).to.equal("Building Unstoppable Apps!!!");
  //     });

  //     it("Should allow setting a new message", async function () {
  //       const newGreeting = "Learn Scaffold-ETH 2! :)";

  //       await yourContract.setGreeting(newGreeting);
  //       expect(await yourContract.greeting()).to.equal(newGreeting);
  //     });
  //   });
});

xdescribe("StandardBridge", function () {
  let sfraxEth: Contract;
  let user: HardhatEthersSigner;
  //   let yourContract: YourContract;

  before(async () => {
    const [owner] = await ethers.getSigners();

    sfraxEth = new ethers.Contract(ADDR_SFRAXETH, sfraxEthAbi, owner);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ADDR_USER],
    });

    user = await ethers.getSigner(ADDR_USER);

    // const yourContractFactory = await ethers.getContractFactory("YourContract");
    // yourContract = (await yourContractFactory.deploy(owner.address)) as YourContract;
    // await yourContract.waitForDeployment();
  });

  describe("sfraxEth", function () {
    it("Should get balance of user", async function () {
      console.log(await ethers.provider.getBalance(user.address));
      console.log(await hre.ethers.provider.getBlockNumber());
      console.log(await sfraxEth.balanceOf(user.address));
      console.log(await sfraxEth.allowance(user.address, sfraxEth.getAddress()));
      // await sfraxEth.approve(sfraxEth.getAddress(), ethers.parseEther("1"))
      //   expect(await sfraxEth.balanceOf(user.address)).to.equal(ethers.toBigInt("16356571088845437412"));
      //   expect(await sfraxEth.allowance(user.address, sfraxEth.getAddress())).to.equal(0);
    });

    // it("Should approve amount", async function () {
    //     // const tx = await sfraxEth.approve(sfraxEth.getAddress(), ethers.parseEther("1"));
    //     // console.log(tx)
    //     // await hre.ethers.provider.send("evm_mine", []);

    //     await sfraxEth.mint(user.address, 3187621375);
    //     console.log(await sfraxEth.balanceOf(user.address))
    // //   expect(await sfraxEth.allowance(user.address, sfraxEth.getAddress())).to.equal(ethers.parseEther("1"));
    // });
  });

  //   describe("Deployment", function () {
  //     it("Should have the right message on deploy", async function () {
  //       expect(await yourContract.greeting()).to.equal("Building Unstoppable Apps!!!");
  //     });

  //     it("Should allow setting a new message", async function () {
  //       const newGreeting = "Learn Scaffold-ETH 2! :)";

  //       await yourContract.setGreeting(newGreeting);
  //       expect(await yourContract.greeting()).to.equal(newGreeting);
  //     });
  //   });
});

xdescribe("StakedFraxEth", function () {
  let sfraxEth: Contract;
  let user: HardhatEthersSigner;
  //   let yourContract: YourContract;

  before(async () => {
    const [owner] = await ethers.getSigners();

    sfraxEth = new ethers.Contract(ADDR_SFRAXETH, sfraxEthAbi, owner);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ADDR_USER],
    });

    user = await ethers.getSigner(ADDR_USER);

    // const yourContractFactory = await ethers.getContractFactory("YourContract");
    // yourContract = (await yourContractFactory.deploy(owner.address)) as YourContract;
    // await yourContract.waitForDeployment();
  });

  describe("sfraxEth", function () {
    it("Should get balance of user", async function () {
      console.log(await ethers.provider.getBalance(user.address));
      console.log(await hre.ethers.provider.getBlockNumber());
      console.log(await sfraxEth.balanceOf(user.address));
      console.log(await sfraxEth.allowance(user.address, sfraxEth.getAddress()));
      // await sfraxEth.approve(sfraxEth.getAddress(), ethers.parseEther("1"))
      //   expect(await sfraxEth.balanceOf(user.address)).to.equal(ethers.toBigInt("16356571088845437412"));
      //   expect(await sfraxEth.allowance(user.address, sfraxEth.getAddress())).to.equal(0);
    });

    // it("Should approve amount", async function () {
    //     // const tx = await sfraxEth.approve(sfraxEth.getAddress(), ethers.parseEther("1"));
    //     // console.log(tx)
    //     // await hre.ethers.provider.send("evm_mine", []);

    //     await sfraxEth.mint(user.address, 3187621375);
    //     console.log(await sfraxEth.balanceOf(user.address))
    // //   expect(await sfraxEth.allowance(user.address, sfraxEth.getAddress())).to.equal(ethers.parseEther("1"));
    // });
  });

  //   describe("Deployment", function () {
  //     it("Should have the right message on deploy", async function () {
  //       expect(await yourContract.greeting()).to.equal("Building Unstoppable Apps!!!");
  //     });

  //     it("Should allow setting a new message", async function () {
  //       const newGreeting = "Learn Scaffold-ETH 2! :)";

  //       await yourContract.setGreeting(newGreeting);
  //       expect(await yourContract.greeting()).to.equal(newGreeting);
  //     });
  //   });
});
