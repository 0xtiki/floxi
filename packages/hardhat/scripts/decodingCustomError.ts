import ethers from "ethers";

// Define possible error signatures
const errorSignatures = [
  "TransferFailed()",
  "InsufficientAllowance(uint256 requested, uint256 available)",
  "InsufficientBalance(uint256 requested, uint256 available)",
  "SafeERC20FailedOperation(address token)",
  "SafeERC20FailedDecreaseAllowance(address spender, uint256 currentAllowance, uint256 requestedDecrease)",
  "AddressInsufficientBalance(address account)",
  "AddressEmptyCode(address target)",
  "FailedInnerCall()",
  "ERC2612ExpiredSignature(uint256 deadline)",
  "ERC2612InvalidSigner(address signer, address owner)",
  "OwnerCannotBeZero()",
  "InvalidOwnershipAcceptance()",
  "OnlyOwner()",
  "ECDSAInvalidSignature()",
  "ECDSAInvalidSignatureLength(uint256 length)",
  "ECDSAInvalidSignatureS(bytes32 s)",
  "ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "ERC20InvalidSender(address sender)",
  "ERC20InvalidReceiver(address receiver)",
  "ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "ERC20InvalidApprover(address approver)",
  "ERC20InvalidSpender(address spender)",
  "ERC721InvalidOwner(address owner)",
  "ERC721NonexistentToken(uint256 tokenId)",
  "ERC721IncorrectOwner(address sender, uint256 tokenId, address owner)",
  "ERC721InvalidSender(address sender)",
  "ERC721InvalidReceiver(address receiver)",
  "ERC721InsufficientApproval(address operator, uint256 tokenId)",
  "ERC721InvalidApprover(address approver)",
  "ERC721InvalidOperator(address operator)",
  "ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId)",
  "ERC1155InvalidSender(address sender)",
  "ERC1155InvalidReceiver(address receiver)",
  "ERC1155MissingApprovalForAll(address operator, address owner)",
  "ERC1155InvalidApprover(address approver)",
  "ERC1155InvalidOperator(address operator)",
  "ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength)",
  // Add other possible custom error signatures here
];

// Calculate the selector for each error signature
errorSignatures.forEach(signature => {
  const selector = ethers.keccak256(ethers.toUtf8Bytes(signature)).slice(0, 10);
  console.log(`${signature}: ${selector}`);
  if (selector === "0xec442f05") {
    console.log(`Found signature ${signature}`);
  }
});
