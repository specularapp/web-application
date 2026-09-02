export const MFA_SKIP_COOKIE = "sp-mfa-skip";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

// Cadastrar autenticador é convite, não pedágio: quem pula segue para o produto e o convite volta
// em 30 dias. O cookie silencia só o convite. Verificação de quem já tem fator não olha para ele,
// porque isso é o `mfaPending` do proxy, e verificação não se pula.
export function mfaSkipCookie() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS,
  };
}

export function hasSkippedMfa(value: string | undefined) {
  return value === "1";
}
