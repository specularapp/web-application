export const MFA_PATH = "/mfa";

export const CONFIRM_EMAIL_PATH = "/confirmar-email";

export const RESET_PASSWORD_PATH = "/redefinir-senha";

export const publicAuthPaths = ["/login", "/cadastro", "/recuperar-senha", RESET_PASSWORD_PATH, CONFIRM_EMAIL_PATH] as const;

const authPaths = new Set<string>([...publicAuthPaths, MFA_PATH]);

export function isAuthPath(pathname: string | null | undefined) {
  return pathname !== null && pathname !== undefined && authPaths.has(pathname);
}
