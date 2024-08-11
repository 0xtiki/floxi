import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";
import sfraxEthAbi from "../contracts/sfrxEthAbi.json";
// import constants from "../constants";

// const fraxtal = constants.fraxtal;
// const mainnet = constants.mainnet;

// const sFrxEthHoleskyMain = "0xa63f56985F9C7F3bc9fFc5685535649e0C1a55f3";
// const sfrxEthEthereumMainnet = "0xac3E018457B222d93114458476f3E3416Abbe38F";
// const sFraxEthFraxtal = "0xfc00000000000000000000000000000000000005";
// const bigSFraxHolderFraxtal = "0x66d9AF69E6845E8666f355676a267a726c04Ea4e";
// const burner = "0x2aa499509b9c9F9ac8086ff0e8Dd39c54b1e63aA";
// const l2StandardBridge = "0x4200000000000000000000000000000000000010";
// const treasury = "0x2aa499509b9c9F9ac8086ff0e8Dd39c54b1e63aA";
// const floxiMainnet = "0x0000000000000000000000000000000000000000";

/**
 * Deploys a contract named "YourContract" using the deployer account and
 * constructor arguments set to the deployer address
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployYourContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
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

  await deploy("FloxiSfrxEth", {
    from: deployer,
    // Contract constructor arguments
    args: [sFraxEthFraxtal, sfrxEthEthereumMainnet, floxiMainnet, treasury, fraxFerry],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    autoMine: true,
  });

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [bigSFraxHolderFraxtal],
  });

  const [owner] = await hre.ethers.getSigners();
  await owner.sendTransaction({
    to: bigSFraxHolderFraxtal,
    value: hre.ethers.parseEther("1.0"),
  });

  const signer = await hre.ethers.getSigner(bigSFraxHolderFraxtal);

  const sfraxEth = new Contract(sFraxEthFraxtal, sfraxEthAbi, signer);

  console.log(await sfraxEth.balanceOf(signer.address));

  await sfraxEth.transfer(burner, hre.ethers.parseEther("10"));

  // const floxiSfraxEth = await hre.ethers.getContract<Contract>("FloxiSfraxEth", deployer);
};

export default deployYourContract;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags YourContract
deployYourContract.tags = ["FloxiSfrxEth"];
