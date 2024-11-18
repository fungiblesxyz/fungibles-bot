import { createPublicClient, http, PublicClient } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({
  chain: base,
  transport: http("https://base.llamarpc.com"),
}) as PublicClient;

export default client;
