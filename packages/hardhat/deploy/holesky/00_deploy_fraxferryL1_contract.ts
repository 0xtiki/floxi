import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";
import constants from "../../addresses";

// const l2 = constants.fraxtalTestnet;
const l1 = constants.holesky;

/**
 * Deploys a contract named "YourContract" using the deployer account and
 * constructor arguments set to the deployer address
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployFerryL1: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
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

  // const functionSignature = "_deposit(address,uint256,uint256)";
  // const selector = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(functionSignature)).slice(0, 10);

  await deploy("FraxFerryMockL1", {
    from: deployer,
    // Contract constructor arguments
    args: [l1.sfrxEth],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    // autoMine: true,
  });

  const fraxFerryMock = await hre.ethers.getContract<Contract>("FraxFerryMockL1", deployer);

  l1.fraxFerry = await fraxFerryMock.getAddress();

  console.log(`FraxFerryL1: ${l1.fraxFerry}`);

  await fraxFerryMock.transferOwnership(l1.treasury);
  // await tx.wait();

  console.log(`FraxFerryL1 ownerhip transferred to: ${await fraxFerryMock.owner()}`);
};

export default deployFerryL1;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags YourContract
deployFerryL1.tags = ["FraxFerryL1"];
