import { createPublicClient, http, PublicClient } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({
  chain: base,
  transport: http(),
}) as PublicClient;

export default client;
