# wallet-identity-resolver

Pluggable on-chain identity discovery for wallet addresses. Given a wallet address and chain, discover all DIDs, SBTs, attestations, and credentials attached to it.

The consumer decides which identity types to accept and in what priority — no hardcoded assumptions, no hardcoded endpoints.

## Monorepo Structure

```
packages/
  core/           → wallet-identity-resolver       (engine + pkh fallback)
  sns/            → @attestto/wir-sns              (SNS .sol domains → did:sns)
  ens/            → @attestto/wir-ens              (ENS .eth domains → did:ens)
  attestto-creds/ → @attestto/wir-attestto-creds   (KYC, SBTs, VCs)
  civic/          → @attestto/wir-civic            (Civic Pass gateway tokens)
  sas/            → @attestto/wir-sas              (Solana Attestation Service)
```

## Install

```bash
# Core (required)
npm install wallet-identity-resolver

# Pick the providers you need
npm install @attestto/wir-sns @attestto/wir-attestto-creds @attestto/wir-civic
```

## Quick Start

```ts
import { resolveIdentities } from 'wallet-identity-resolver'
import { sns } from '@attestto/wir-sns'
import { attesttoCreds } from '@attestto/wir-attestto-creds'
import { civic } from '@attestto/wir-civic'
import { pkh } from 'wallet-identity-resolver'

const identities = await resolveIdentities({
  chain: 'solana',
  address: 'ATTEstto1234567890abcdef...',
  providers: [
    attesttoCreds({
      programId: 'YOUR_PROGRAM_ID',
      rpcUrl: 'https://api.yourapp.com/solana-rpc',
    }),
    sns({
      apiUrl: 'https://api.yourapp.com/sns',
      resolverUrl: 'https://api.yourapp.com/resolver',
    }),
    civic({ apiUrl: 'https://api.yourapp.com/civic' }),
    pkh(),  // Fallback — always resolves, no network calls
  ],
})
```

### Ethereum

```ts
import { resolveIdentities, pkh } from 'wallet-identity-resolver'
import { ens } from '@attestto/wir-ens'

const identities = await resolveIdentities({
  chain: 'ethereum',
  address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  providers: [
    ens({ resolverUrl: 'https://api.yourapp.com/resolver' }),
    pkh(),
  ],
})
```

## See It In Action

The [DID Landscape Explorer](https://github.com/chongkan/did-landscape-explorer) uses this package in its self-assessment wizard. When a user connects a Web3 wallet, the explorer resolves all identities attached to their address and lets them pick which DID to sign with.

## Security

**No hardcoded endpoints.** Every provider requires explicit URLs from the consumer. No provider ever makes a network call to an endpoint you didn't configure. See [SECURITY.md](SECURITY.md) for the full security model.

**Recommended architecture:**

```
Browser (no keys, no direct RPC)
  → Your backend proxy (holds API keys, validates origin)
    → Solana RPC / Bonfida / UniResolver / Civic
```

## API

### `resolveIdentities(options): Promise<ResolvedIdentity[]>`

```ts
interface ResolveOptions {
  chain: Chain                    // 'solana', 'ethereum', or custom
  address: string                 // Wallet address / public key
  providers: IdentityProvider[]   // Ordered list — defines priority
  rpcUrl?: string                 // Global RPC override (passed to providers)
  timeoutMs?: number              // Per-provider timeout (default 5000ms)
  stopOnFirst?: boolean           // Stop after first provider returns results
  signal?: AbortSignal            // Cancellation
}
```

### `ResolvedIdentity`

```ts
interface ResolvedIdentity {
  provider: string                // Which provider found this
  did: string | null              // Resolved DID, if applicable
  label: string                   // Human-readable label
  type: IdentityType              // 'domain' | 'sbt' | 'attestation' | 'credential' | 'did' | 'score'
  meta: Record<string, unknown>   // Provider-specific metadata
}
```

## Packages

| Package | Chain | What it resolves | Required options |
|---|---|---|---|
| `wallet-identity-resolver` | any | Core engine + `pkh()` fallback | — |
| `@attestto/wir-sns` | Solana | SNS `.sol` domains → `did:sns` | `apiUrl`, `resolverUrl` |
| `@attestto/wir-ens` | Ethereum | ENS `.eth` domains → `did:ens` | `resolverUrl` |
| `@attestto/wir-attestto-creds` | Solana | Attestto KYC, identity SBTs, VCs | `programId`, `rpcUrl` |
| `@attestto/wir-civic` | Solana | Civic Pass gateway tokens | `apiUrl` |
| `@attestto/wir-sas` | Solana | Solana Attestation Service | `programId`, `rpcUrl` |

## Writing a Custom Provider

```ts
import type { IdentityProvider, ResolvedIdentity, ResolveContext } from 'wallet-identity-resolver'

export function myProvider(options: { apiUrl: string }): IdentityProvider {
  return {
    name: 'my-provider',
    chains: ['solana'],

    async resolve(ctx: ResolveContext): Promise<ResolvedIdentity[]> {
      if (!options.apiUrl) return []
      const res = await fetch(`${options.apiUrl}/lookup/${ctx.address}`, { signal: ctx.signal })
      if (!res.ok) return []
      const data = await res.json()
      return [{ provider: 'my-provider', did: data.did, label: data.name, type: 'credential', meta: data }]
    },
  }
}
```

### Provider Rules

- **No hardcoded URLs** — accept all endpoints via options
- **Never throw** — return empty array on failure
- **Pass `ctx.signal`** to all fetch calls
- **One provider = one identity source**

## Development

```bash
pnpm install
pnpm run build    # Build all packages
pnpm run lint     # Type-check all packages
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
