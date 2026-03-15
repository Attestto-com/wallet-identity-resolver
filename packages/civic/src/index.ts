/**
 * @attestto/wir-civic — Civic Pass provider
 *
 * Checks whether a Solana wallet holds an active Civic gateway token (SBT).
 *
 * No hardcoded endpoints — consumer must provide all URLs.
 */

import type { IdentityProvider, ResolvedIdentity, ResolveContext } from 'wallet-identity-resolver'

export interface CivicOptions {
  /** Civic API endpoint (required) */
  apiUrl: string
  /** Civic gateway network to check */
  gatekeeperNetwork?: string
}

const CIVIC_MAINNET_NETWORK = 'ignREusXmGrscGNUesoU9mxfds9AiYTezUKex2PsZV6'

export function civic(options: CivicOptions): IdentityProvider {
  const { apiUrl, gatekeeperNetwork = CIVIC_MAINNET_NETWORK } = options

  return {
    name: 'civic',
    chains: ['solana'],

    async resolve(ctx: ResolveContext): Promise<ResolvedIdentity[]> {
      if (!apiUrl) return []

      const token = await findGatewayToken(ctx.address, gatekeeperNetwork, apiUrl, ctx.signal)
      if (!token) return []

      return [{
        provider: 'civic',
        did: null,
        label: 'Civic Pass',
        type: 'sbt',
        meta: {
          gatekeeperNetwork,
          state: token.state,
          expiry: token.expiry,
          tokenAddress: token.address,
        },
      }]
    },
  }
}

interface GatewayToken {
  address: string
  state: string
  expiry: string | null
}

async function findGatewayToken(
  address: string,
  gatekeeperNetwork: string,
  apiUrl: string,
  signal?: AbortSignal,
): Promise<GatewayToken | null> {
  try {
    const res = await fetch(`${apiUrl}/token/${address}/${gatekeeperNetwork}`, { signal })
    if (!res.ok) return null
    const data = await res.json() as { token?: string; state?: string; expiry?: string }
    if (!data.token) return null
    return {
      address: data.token,
      state: data.state ?? 'active',
      expiry: data.expiry ?? null,
    }
  } catch {
    return null
  }
}
