const providerNames: Record<string, string> = { google: "Google", github: "GitHub", apple: "Apple" };

const notices: Record<string, string> = {
  limite: "Muitas tentativas. Aguarde um instante e tente de novo.",
  provedor: "Esse provedor de login não está disponível.",
  callback: "Não foi possível concluir o login. Tente de novo.",
};

export function loginNotice(code: string | undefined) {
  if (!code) return undefined;
  if (code in providerNames) return `Não foi possível entrar com ${providerNames[code]}. Tente de novo.`;
  return notices[code];
}
