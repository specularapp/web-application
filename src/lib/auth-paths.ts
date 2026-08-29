export const MFA_PATH = "/mfa";

export const publicAuthPaths = ["/login", "/cadastro", "/recuperar-senha", "/redefinir-senha"] as const;

const authPaths = new Set<string>([...publicAuthPaths, MFA_PATH]);

export function isAuthPath(pathname: string | null | undefined) {
  return pathname !== null && pathname !== undefined && authPaths.has(pathname);
}
