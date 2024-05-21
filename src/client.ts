const { createWalletClient, http } = require("viem");
// const { privateKeyToAccount } = require("viem/accounts");
const { baseSepolia } = require("viem/chains");

export const client = createWalletClient({
  chain: baseSepolia,
  transport: http(),
});

// const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY);
