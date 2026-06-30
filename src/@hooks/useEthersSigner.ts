// hooks/useEthersSigner.ts
import { BrowserProvider, JsonRpcSigner } from 'ethers'
import { useMemo, useSyncExternalStore } from 'react'
import type { Client, Transport, Chain, Account } from 'viem'
import { type Config, useAccount, useChainId, useConnectorClient } from 'wagmi'
import {
  getActiveDfnsEoaSigner,
  subscribeToActiveDfnsEoaSigner
} from '@utils/wallet/dfnsEoaSigner'
import {
  getActiveSignerServerEoaSigner,
  subscribeToActiveSignerServerEoaSigner
} from '@utils/wallet/signerServerEoaSigner'

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
  const { connector } = useAccount()
  const { data } = useConnectorClient<Config>({ chainId })
  const activeDfnsSigner = useSyncExternalStore(
    subscribeToActiveDfnsEoaSigner,
    getActiveDfnsEoaSigner,
    () => undefined
  )
  const activeSignerServerSigner = useSyncExternalStore(
    subscribeToActiveSignerServerEoaSigner,
    getActiveSignerServerEoaSigner,
    () => undefined
  )

  return useMemo(() => {
    if (connector?.id === 'dfns') {
      return activeDfnsSigner
    }
    if (connector?.id === 'signerServer') {
      return activeSignerServerSigner
    }

    return data
      ? clientToSigner(data as Client<Transport, Chain, Account>)
      : undefined
  }, [activeDfnsSigner, activeSignerServerSigner, connector?.id, data])
}
