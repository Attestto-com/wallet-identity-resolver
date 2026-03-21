export { resolveIdentities } from './resolve'
export type {
  Chain,
  ResolvedIdentity,
  IdentityType,
  ResolveContext,
  IdentityProvider,
  ResolveOptions,
} from './types'

// Built-in providers (zero dependencies, always available)
export { caip10, sns } from './providers'
