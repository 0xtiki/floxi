import sfrxEthL1Abi from "./sfrxEthL1Abi.json";
import sfrxEthL2Abi from "./sfrxEthL2Abi.json";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const externalContracts = {
  1: {
    sFraxEth: {
      address: "0xac3E018457B222d93114458476f3E3416Abbe38F",
      abi: JSON.parse(JSON.stringify(sfrxEthL1Abi)),
    },
  },
  17000: {
    sFraxEth: {
      address: "0xa63f56985F9C7F3bc9fFc5685535649e0C1a55f3",
      abi: JSON.parse(JSON.stringify(sfrxEthL1Abi)),
    },
  },
  252: {
    sFraxEth: {
      address: "0xfc00000000000000000000000000000000000005",
      abi: JSON.parse(JSON.stringify(sfrxEthL2Abi)),
    },
  },
  2522: {
    sFraxEth: {
      address: "0xfc00000000000000000000000000000000000005",
      abi: JSON.parse(JSON.stringify(sfrxEthL2Abi)),
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
