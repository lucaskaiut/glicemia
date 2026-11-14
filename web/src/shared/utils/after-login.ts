const KEY = 'glicemia:after-login'

/** Destino para onde voltar depois de entrar (ex.: a tela de conectar o app). */
export function rememberAfterLogin(path: string): void {
  if (path.startsWith('/auth')) return
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    // sem sessionStorage: volta para o início
  }
}

/** Lê o destino sem consumir (o GuestGuard redireciona antes do fluxo de login terminar). */
export function peekAfterLogin(): string {
  try {
    const path = sessionStorage.getItem(KEY)
    return path && path.startsWith('/') && !path.startsWith('//') ? path : '/'
  } catch {
    return '/'
  }
}

/** Esquece o destino — chamado quando uma página protegida já carregou. */
export function clearAfterLogin(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
