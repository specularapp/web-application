/**
 * Uma sessão temporária para conferir tela autenticada com o olho (2026-09-22).
 *
 * As sondas de `probe-application.mjs` provam que a página **renderiza**, lendo o HTML. O que elas não fazem
 * é deixar alguém olhar: a aplicação só abre com sessão, e sem isso a conferência visual parava em
 * `/componentes`. Este script cria a conta, a equipe e alguns registros, e imprime os cookies da sessão, para
 * colar no navegador e abrir a tela de verdade.
 *
 * Os dados são de mentira e a conta é descartável. Para apagar depois:
 *   node --env-file-if-exists=.env scripts/probe-session.mjs limpar <id-da-equipe> <id-do-usuario>
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const base = process.env.PROBE_BASE_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || !publicKey) throw new Error("Configure as chaves do Supabase antes de abrir a sessão");

const admin = createClient(url, key, { auth: { persistSession: false } });

if (process.argv[2] === "limpar") {
  const [, , , organizationId, userId] = process.argv;
  if (organizationId) {
    const { error } = await admin.from("organizations").delete().eq("id", organizationId);
    console.log(error ? `Equipe não removida: ${error.message}` : "Equipe removida");
  }
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    console.log(error ? `Usuário não removido: ${error.message}` : "Usuário removido");
  }
  process.exit(0);
}

const cookieJar = new Map([["sp-mfa-skip", "1"]]);
const client = createServerClient(url, publicKey, {
  cookies: {
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    setAll: (cookies) => cookies.forEach(({ name, value }) => cookieJar.set(name, value)),
  },
});

let token;
const api = async (path, method = "GET", body) => {
  const response = await fetch(`${base}/api/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  if (!response.ok) console.log(`  aviso: ${method} ${path} devolveu ${response.status} ${text.slice(0, 120)}`);
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

const email = `visual-${randomUUID()}@example.com`;
const password = `${randomUUID()}Aa1!`;
const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Conferência visual" },
});
if (created.error) throw created.error;
const userId = created.data.user.id;

const login = await client.auth.signInWithPassword({ email, password });
if (login.error) throw login.error;
token = login.data.session.access_token;

const team = await api("organizacoes", "POST", { name: `Conferência ${randomUUID().slice(0, 8)}`, industry: "web_development" });
const organizationId = team?.id;
if (!organizationId) throw new Error("A equipe temporária não foi criada");
await api("organizacoes/atual", "PUT", { organizationId });
const done = await client.rpc("complete_onboarding", { p_organization_id: organizationId });
if (done.error) throw done.error;

/* Gente e dinheiro suficientes para as telas não caírem no estado vazio. */
const nomes = [
  ["Aurora Studio", "aurora@exemplo.com.br", "11988887777"],
  ["Clínica Vitalis", "contato@vitalis.com.br", "1133224455"],
  ["Padaria do Bairro", "padaria@exemplo.com.br", "11999991111"],
  ["Construtora Horizonte", "horizonte@exemplo.com.br", "1144556677"],
  ["Mercado Central", "central@exemplo.com.br", "11955554444"],
];

const clientes = [];
for (const [name, mail, phone] of nomes) {
  const row = await api("clientes", "POST", {
    kind: "both",
    name,
    company: name,
    role: "Diretoria",
    email: mail,
    phone,
    website: "exemplo.com.br",
    city: "São Paulo",
    about: "Contato criado para conferência visual.",
    tags: [],
    active: true,
    favorite: clientes.length === 0,
  });
  if (row?.id) clientes.push(row.id);
}

for (const [index, clientId] of clientes.entries()) {
  await api("cobrancas", "POST", {
    direction: "incoming",
    clientId,
    partyName: "",
    title: `Mensalidade ${index + 1}`,
    description: "Cobrança de conferência",
    amount: 120000 + index * 35000,
    installments: index === 0 ? 3 : 1,
    firstDueDate: `2026-10-${String(5 + index * 3).padStart(2, "0")}`,
    method: "pix",
    paymentInfo: "",
    notes: "",
    quoteId: null,
    recurrence: "none",
  });
}

await api("despesas", "POST", {
  direction: "outgoing",
  clientId: null,
  partyName: "Provedor de nuvem",
  title: "Servidores",
  description: "",
  amount: 48000,
  installments: 1,
  firstDueDate: "2026-10-10",
  method: "pix",
  paymentInfo: "",
  notes: "",
  quoteId: null,
  recurrence: "none",
});

for (const [kind, title, amount] of [
  ["income", "Entrada de projeto", 250000],
  ["income", "Consultoria", 90000],
  ["expense", "Licenças de software", 32000],
  ["expense", "Deslocamento", 8000],
]) {
  await api("financeiro", "POST", { kind, title, description: "", amount, date: "2026-09-18", method: "pix" });
}

console.log("");
console.log("Equipe .......... " + organizationId);
console.log("Usuário ......... " + userId);
console.log("Clientes ........ " + clientes.length);
console.log("");
console.log("Cole isto no console do navegador, na origem " + base + ":");
console.log("");
const script = [...cookieJar]
  .map(([name, value]) => `document.cookie=${JSON.stringify(`${name}=${value}; path=/; max-age=3600`)};`)
  .join("");
console.log(script);
console.log("");
console.log("Para apagar depois:");
console.log(`  node --env-file-if-exists=.env scripts/probe-session.mjs limpar ${organizationId} ${userId}`);
