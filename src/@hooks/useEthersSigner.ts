// hooks/useEthersSigner.ts
import { BrowserProvider, JsonRpcSigner } from 'ethers'
import { useMemo } from 'react'
import type { Client, Transport, Chain, Account } from 'viem'
import { type Config, useChainId, useConnectorClient } from 'wagmi'

function clientToSigner(
  client: Client<Transport, Chain, Account>
): JsonRpcSigner {
  const { account, chain, transport } = client as any
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address
  }

  const provider = new BrowserProvider(transport, network)

  // Strip EIP-1559 fields for networks that only support legacy transactions.
  // ethers.js v6 always tries EIP-1559 first; this converts to type-0 before
  // the call reaches MetaMask / the RPC node.
  const originalSend = provider.send.bind(provider)
  provider.send = async (method: string, params: Array<any>) => {
    if (method === 'eth_sendTransaction' && params?.[0]) {
      const tx = { ...params[0] }
      if (
        tx.maxFeePerGas !== undefined ||
        tx.maxPriorityFeePerGas !== undefined
      ) {
        tx.gasPrice = tx.maxFeePerGas ?? tx.maxPriorityFeePerGas
        delete tx.maxFeePerGas
        delete tx.maxPriorityFeePerGas
        delete tx.type
        params = [tx]
      }
    }
    return originalSend(method, params)
  }

  const signer = new JsonRpcSigner(provider, account?.address)

  return signer
}

export function useEthersSigner() {
  const chainId = useChainId()
  const { data } = useConnectorClient<Config>({ chainId })

  return useMemo(
    () =>
      data
        ? clientToSigner(data as Client<Transport, Chain, Account>)
        : undefined,
    [data]
  )
}
