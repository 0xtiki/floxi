import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";
import constants from "../../addresses";

const l2 = constants.fraxtal;
const l1 = constants.mainnet;

/**
 * Deploys a contract named "YourContract" using the deployer account and
 * constructor arguments set to the deployer address
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployFloxiL1: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
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

  await deploy("L1FloxiSfrxEth", {
    from: deployer,
    // Contract constructor arguments
    args: [
      l1.sfrxEth,
      l2.sfrxEth,
      l1.l1StandardBridge,
      l1.eigen_strategyManager,
      l1.eigen_strategy,
      l1.eigen_delegationManager,
      l1.eigen_rewardsCoordinator,
    ],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    // autoMine: true,
  });

  const floxiSfraxEth = await hre.ethers.getContract<Contract>("L1FloxiSfrxEth", deployer);

  l1.floxiL1 = await floxiSfraxEth.getAddress();

  console.log(`FloxiL1: ${l1.floxiL1}`);

  // await floxiSfraxEth.setRemoteContract(l2.floxiL2)

  // console.log(`FloxiL1 remote contract set to: ${l2.floxiL2}`);

  // await floxiSfraxEth.setClaimer(l1.treasury);

  // console.log(`FloxiL1 claimer set to: ${l1.treasury}`);

  // await floxiSfraxEth.delegate(l1.eigen_operator);

  // console.log(`FloxiL1 delegate set to: ${l1.eigen_operator}`);

  await floxiSfraxEth.transferOwnership(l1.treasury);

  console.log(`FloxiL1 ownerhip transferred to: ${l1.treasury}`);
};

export default deployFloxiL1;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags YourContract
deployFloxiL1.tags = ["FloxiL1-live"];
