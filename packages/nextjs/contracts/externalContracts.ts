import sfraxEthAbi from "./sfraxEthAbi.json";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const externalContracts = {
  31337: {
    sFraxEth: {
      address: "0xFC00000000000000000000000000000000000005",
      abi: JSON.parse(sfraxEthAbi),
    },
  },
} as const;

// const externalContracts = {} as const;

export default externalContracts satisfies GenericContractsDeclaration;
