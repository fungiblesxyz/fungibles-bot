import { createPublicClient, http, PublicClient } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({
  chain: base,
  transport: http(
    "https://api.developer.coinbase.com/rpc/v1/base/HGhJ7LjQj9AFXDwVbVinHj5yIYEsuhUu"
  ),
}) as PublicClient;

export default client;
