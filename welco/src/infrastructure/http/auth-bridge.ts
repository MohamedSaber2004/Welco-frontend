import type { TokenSet } from './token-store'

export interface AuthHandlers {
  onSessionExpired: () => void
  onTokensRefreshed?: (tokens: TokenSet) => void
}

export class AuthBridge implements AuthHandlers {
  onSessionExpired = (): void => {}
  onTokensRefreshed = (_tokens: TokenSet): void => {}

  bind(handlers: AuthHandlers): void {
    this.onSessionExpired = handlers.onSessionExpired
    if (handlers.onTokensRefreshed) {
      this.onTokensRefreshed = handlers.onTokensRefreshed
    }
  }
}
