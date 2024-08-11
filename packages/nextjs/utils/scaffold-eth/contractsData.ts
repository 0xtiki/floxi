import scaffoldConfig from "~~/scaffold.config";
import { contracts } from "~~/utils/scaffold-eth/contract";

export function getAllContracts() {
  const contractsData1 = contracts?.[scaffoldConfig.targetNetworks[0].id];
  const contractsData2 = contracts?.[scaffoldConfig.targetNetworks[1].id];
  const contractsData = {
    ...contractsData1,
    ...contractsData2,
  };
  return contractsData ? contractsData : {};
}
