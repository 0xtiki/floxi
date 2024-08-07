import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// L1 (Ethereum) provider
const l1RpcUrl = process.env.L1_RPC_URL;
const l1Provider = new ethers.JsonRpcProvider(l1RpcUrl);

// L2 (Optimism) provider
const l2RpcUrl = process.env.L2_RPC_URL;
const l2Provider = new ethers.JsonRpcProvider(l2RpcUrl);

// Contracts addresses and ABIs
const l2BridgeAddress = "0x4200000000000000000000000000000000000010"; // L2 Bridge contract address
const l2BridgeAbi = ["event bridgeERC20To(address indexed sender, address indexed receiver, uint256 amount)"];

const l2MessagePasserAddress = "0x4200000000000000000000000000000000000016"; // L2ToL1MessagePasser address
// const l2MessagePasserAbi = [
//     "event MessagePassed(uint256 indexed nonce, address indexed sender, address indexed target, uint256 value, uint256 gasLimit, bytes data, bytes32 withdrawalHash)"
// ];

const l1PortalAddress = "0x5fb30336a8d0841cf15d452afa297cb6d10877d7"; // OptimismPortal contract address
const l1PortalAbi = ["function getMessageStatus(bytes32 messageHash) external view returns (bool)"];

// Instantiate contract objects
const l2Bridge = new ethers.Contract(l2BridgeAddress, l2BridgeAbi, l2Provider);
// const l2MessagePasser = new ethers.Contract(l2MessagePasserAddress, l2MessagePasserAbi, l2Provider);
const l1Portal = new ethers.Contract(l1PortalAddress, l1PortalAbi, l1Provider);

// L1 contract to receive the withdrawal
// const l1Contract = '0x...';

async function main() {
  // Listen for bridgeERC20To events on the L2 Bridge
  l2Bridge.on("bridgeERC20To", async (sender, receiver, amount, event) => {
    console.log(`Detected bridgeERC20To event: ${event.transactionHash}`);

    // Fetch transaction receipt to get the MessagePassed event
    const receipt = await l2Provider.getTransactionReceipt(event.transactionHash);

    if (!receipt) {
      console.error(`Failed to fetch transaction receipt for ${event.transactionHash}`);
      return;
    }

    // Extract the messageHash from the MessagePassed event
    const messagePassedEvent = receipt.logs.find(
      log =>
        log.address === l2MessagePasserAddress &&
        log.topics[0] === ethers.id("MessagePassed(uint256,address,address,uint256,uint256,bytes,bytes32)"),
    );

    if (!messagePassedEvent) {
      console.error(`MessagePassed event not found in transaction receipt for ${event.transactionHash}`);
      return;
    }

    const messageHash = ethers.keccak256(messagePassedEvent.data);

    console.log(`Message hash: ${messageHash}`);

    // Poll for message status on L1
    const interval = setInterval(async () => {
      const status = await l1Portal.getMessageStatus(messageHash);
      if (status) {
        console.log(`Message is ready for finalization: ${messageHash}`);

        // Clear interval once message is ready
        clearInterval(interval);
      } else {
        console.log(`Message not ready yet: ${messageHash}`);
      }
    }, 60000); // Check every 60 seconds
  });
}

main().catch(console.error);
