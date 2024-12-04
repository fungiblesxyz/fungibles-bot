import { createPublicClient, http, PublicClient } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({
  chain: base,
  transport: http(
    "https://rpc.ankr.com/base/a889495c40c52cceed37f260717b69733a0096a76216e1b8817651ab0d9aac94"
  ),
}) as PublicClient;

export default client;
