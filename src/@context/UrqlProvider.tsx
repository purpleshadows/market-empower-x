'use client'

import {
  createClient,
  Provider,
  Client,
  dedupExchange,
  fetchExchange,
  Exchange
} from 'urql'
import { refocusExchange } from '@urql/exchange-refocus'
import { useState, useEffect, ReactNode, ReactElement } from 'react'
import { LoggerInstance } from '@oceanprotocol/lib'
import { getOceanConfig } from '@utils/ocean'
import { useChainId } from 'wagmi'
import { getAllowedErc20ChainIds } from '@utils/runtimeConfig'
import { getSupportedChainIds } from 'chains.config.cjs'

function createUrqlClient(subgraphUri: string) {
  // Cast to the local Exchange type to avoid duplicate @urql/core instances in type checking.
  const refocus = refocusExchange() as unknown as Exchange
  return createClient({
    url: `${subgraphUri}/subgraphs/name/oceanprotocol/ocean-subgraph`,
    exchanges: [dedupExchange, refocus, fetchExchange]
  })
}

function getConfiguredOceanNetwork(preferredChainId?: number) {
  const candidates = [
    preferredChainId,
    ...getAllowedErc20ChainIds(),
    ...getSupportedChainIds()
  ]
    .filter((chainId): chainId is number => typeof chainId === 'number')
    .filter((chainId, index, chainIds) => chainIds.indexOf(chainId) === index)

  for (const chainId of candidates) {
    const oceanConfig = getOceanConfig(chainId)
    if (oceanConfig?.nodeUri) return { chainId, oceanConfig }
  }

  return null
}

export default function UrqlClientProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [client, setClient] = useState<Client>()
  const chainId = useChainId() // wagmi v2 hook

  useEffect(() => {
    if (!chainId) {
      LoggerInstance.error('No chainId found. Cannot create URQL client.')
      return
    }

    const configuredNetwork = getConfiguredOceanNetwork(chainId)

    if (!configuredNetwork) {
      LoggerInstance.error('[URQL] No configured Ocean network found.')
      return
    }

    if (configuredNetwork.chainId !== chainId) {
      LoggerInstance.warn(
        `[URQL] Falling back from chain ${chainId} to configured chain ` +
          `${configuredNetwork.chainId}.`
      )
    }

    const newClient = createUrqlClient(configuredNetwork.oceanConfig.nodeUri)
    setClient(newClient)
  }, [chainId]) // re-run when chain changes

  return client ? <Provider value={client}>{children}</Provider> : <></>
}
