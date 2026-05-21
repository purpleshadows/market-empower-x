import { Asset } from 'src/@types/Asset'

type TokenSymbolMap = Record<string, string>
type PriceToken = string | { symbol?: string; address?: string }

export type ServicePriceEntry = {
  price?: string | number
  token?: PriceToken
  baseToken?: { symbol?: string; address?: string }
}

export type ServiceStatsEntry = {
  serviceId?: string
  price?: { tokenSymbol?: string }
  prices?: ServicePriceEntry[]
}

export function getServiceStats(
  asset: Asset,
  serviceIndex: number,
  serviceId?: string
): ServiceStatsEntry | undefined {
  const stats = (asset.indexedMetadata?.stats || []) as ServiceStatsEntry[]
  const matched =
    serviceId != null
      ? stats.find((stat) => stat?.serviceId === serviceId)
      : undefined

  return matched || stats[serviceIndex]
}

export function resolveServiceTokenSymbol(
  asset: Asset,
  serviceIndex: number,
  serviceId?: string,
  tokenSymbolMap?: TokenSymbolMap
): string | undefined {
  const stat = getServiceStats(asset, serviceIndex, serviceId)

  if (stat?.price?.tokenSymbol) return stat.price.tokenSymbol

  const priceEntry = stat?.prices?.[0]
  if (priceEntry?.baseToken?.symbol) return priceEntry.baseToken.symbol
  if (priceEntry?.baseToken?.address) {
    return tokenSymbolMap?.[priceEntry.baseToken.address.toLowerCase()]
  }

  const priceToken = priceEntry?.token
  if (!priceToken) return undefined

  if (typeof priceToken === 'string') {
    return tokenSymbolMap?.[priceToken.toLowerCase()]
  }

  if (typeof priceToken === 'object') {
    if (priceToken.symbol) return priceToken.symbol
    if (priceToken.address) {
      return tokenSymbolMap?.[priceToken.address.toLowerCase()]
    }
  }

  return undefined
}
