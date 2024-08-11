import sfraxEthAbi from "./sfraxEthAbi.json";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const externalContracts = {
  1: {
    sFraxEth: {
      address: "0xac3E018457B222d93114458476f3E3416Abbe38F",
      abi: JSON.parse(sfraxEthAbi),
    },
  },
  252: {
    sFraxEth: {
      address: "0xfc00000000000000000000000000000000000005",
      abi: JSON.parse(sfraxEthAbi),
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
