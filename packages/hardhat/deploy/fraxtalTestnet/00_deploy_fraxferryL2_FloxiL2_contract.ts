import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";
import constants from "../../addresses";
import { setTimeout } from "timers/promises";

const l2 = constants.fraxtalTestnet;
const l1 = constants.holesky;

/**
 * Deploys a contract named "YourContract" using the deployer account and
 * constructor arguments set to the deployer address
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployFloxiL2: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
    On localhost, the deployer account is the one that comes with Hardhat, which is already funded.

    When deploying to live networks (e.g `yarn deploy --network sepolia`), the deployer account
    should have sufficient balance to pay for the gas fees for contract creation.

    You can generate a random account with `yarn generate` which will fill DEPLOYER_PRIVATE_KEY
    with a random private key in the .env file (then used on hardhat.config.ts)
    You can run the `yarn account` command to check your balance in every network.
  */
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("FraxFerryMockL2", {
    from: deployer,
    // Contract constructor arguments
    args: [l2.sfrxEth],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    // autoMine: true,
  });

  const fraxFerryMock = await hre.ethers.getContract<Contract>("FraxFerryMockL2", deployer);

  l2.fraxFerry = await fraxFerryMock.getAddress();

  console.log(`FraxFerryL2: ${l2.fraxFerry}`);

  const tx1 = await fraxFerryMock.transferOwnership(l2.treasury);
  await tx1.wait();

  console.log(`FraxFerryL2 ownership transferred to: ${await fraxFerryMock.owner()}`);

  await setTimeout(10000);

  console.log("waited for 10s");

  await deploy("FloxiSfrxEth", {
    from: deployer,
    // Contract constructor arguments
    args: [l2.sfrxEth, l1.sfrxEth, l1.floxiL1, l2.xDomainMessenger, l2.treasury, l2.fraxFerry],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    // autoMine: true,
  });

  const floxiSfraxEth = await hre.ethers.getContract<Contract>("FloxiSfrxEth", deployer);

  // l2.floxiL2 = await floxiSfraxEth.getAddress();

  console.log(`FloxiL2: ${await floxiSfraxEth.getAddress()}`);

  await floxiSfraxEth.transferOwnership(l2.treasury);
  // await tx2.wait();

  // console.log(`FloxiL2 ownerhip transferred to: ${await floxiSfraxEth.owner()}`);
};

export default deployFloxiL2;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags YourContract
deployFloxiL2.tags = ["FloxiL2"];
