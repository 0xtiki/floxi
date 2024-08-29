import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { CommonInputProps, InputBase, SIGNED_NUMBER_REGEX } from "~~/components/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { ContractName } from "~~/utils/scaffold-eth/contract";

export const EtherInput = ({
  value,
  name,
  placeholder,
  onChange,
  disabled,
  contractName,
}: CommonInputProps & { contractName: ContractName }) => {
  const { address: connectedAddress } = useAccount();
  const { data: tokenBalance, refetch: refetchTokenBalance } = useScaffoldReadContract({
    contractName: contractName,
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const state: Partial<Record<ContractName, string>> = {};
  state[contractName] = value;

  const [localValue, setLocalValue] = useState(state);

  useEffect(() => {
    if (value !== localValue[contractName]) {
      state[contractName] = value;
      setLocalValue(state || "");
    }
  }, [contractName, localValue, value]);

  const setMaxValue = async () => {
    if (!connectedAddress) {
      return;
    }

    await refetchTokenBalance();

    if (tokenBalance) {
      const etherValue = formatUnits(tokenBalance as unknown as bigint, 18);
      state[contractName] = etherValue;
      setLocalValue(state);
      onChange(state[contractName] ?? "");
    }
  };

  const handleChangeNumber = (newValue: string) => {
    if (newValue && !SIGNED_NUMBER_REGEX.test(newValue)) {
      return;
    }
    state[contractName] = newValue;
    setLocalValue(state);
    onChange(state[contractName] ?? "");
  };

  return (
    <InputBase
      name={name}
      value={localValue[contractName] ?? ""}
      placeholder={placeholder}
      onChange={handleChangeNumber}
      disabled={disabled}
      prefix={<span className="pl-4 -mr-2 text-accent self-center">Ξ</span>}
      suffix={
        <div
          className="tooltip tooltip-secondary before:content-[attr(data-tip)] before:right-[-10px] before:left-auto before:transform-none"
          data-tip="Available balance"
        >
          <button
            className="py-1.5 px-3 text-sm rounded-full gap-2 grid-flow-col w-20 text-center flex items-center justify-center"
            onClick={e => {
              e.preventDefault();
              setMaxValue();
            }}
          >
            <span>Max</span>
          </button>
        </div>
      }
    />
  );
};
