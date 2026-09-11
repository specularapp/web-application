/**
 * Sonda de tela no celular: abre uma rota no Chrome pelo protocolo de depuração e mede o que só o navegador
 * sabe dizer, como rolagem lateral que não devia existir e a caixa de cada peça da ficha.
 *
 * Roda contra o `next dev` já de pé e contra um Chrome aberto com `--remote-debugging-port=9222`. Não entra
 * no pacote e não é importado por nada da aplicação: é ferramenta de conferência, como `probe-billing.mjs`.
 *
 *   node scripts/probe-mobile.mjs /tarefas
 */
const PORT = 9222;
const BASE = process.env.PROBE_BASE || "http://localhost:3000";
/* A rota entra sem a barra (`tarefas`), porque o Git Bash converte um argumento iniciado por barra em
   caminho do Windows antes de o Node vê-lo. A barra é posta aqui. */
const route = `/${(process.argv[2] || "tarefas").replace(/^\/+/, "")}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const waiting = message.id && this.pending.get(message.id);
      if (!waiting) return;
      this.pending.delete(message.id);
      if (message.error) waiting.reject(new Error(JSON.stringify(message.error)));
      else waiting.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => this.pending.has(id) && (this.pending.delete(id), reject(new Error(`timeout em ${method}`))), 30000);
    });
  }

  async eval(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? "erro no eval");
    return result.result.value;
  }
}

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = tabs.find((tab) => tab.type === "page");
if (!page) throw new Error("nenhuma aba aberta no Chrome de depuração");

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

const session = new Session(ws);
await session.send("Page.enable");
await session.send("Runtime.enable");
await session.send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
  screenWidth: 390,
  screenHeight: 844,
});
const target = `${BASE}${route}`;
console.log(`abrindo ${target}`);
await session.send("Page.navigate", { url: target });
await sleep(4500);

const report = await session.eval(`(() => {
  const root = document.documentElement;
  const box = (node) => {
    const rect = node.getBoundingClientRect();
    return { l: Math.round(rect.left), t: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) };
  };
  const byClass = (part) => [...document.querySelectorAll('*')].filter((node) => [...(node.classList || [])].some((name) => name.includes(part)));

  const rail = byClass('__rail')[0];
  const cards = [...document.querySelectorAll('li')].filter((node) => [...(node.classList || [])].some((name) => name.includes('task-card-module')));

  return {
    url: location.href,
    titulo: document.title,
    rolagemLateral: root.scrollWidth - root.clientWidth,
    documento: { scrollW: root.scrollWidth, clientW: root.clientWidth },
    trilho: rail ? { largura: rail.clientWidth, conteudo: rail.scrollWidth, colunas: rail.children.length } : null,
    cartoes: cards.length,
    barra: (() => {
      const bar = byClass('sidebar-module').find((node) => [...(node.classList || [])].some((name) => /__bar$/.test(name)));
      if (!bar) return null;
      const modos = byClass('barMode').map((mode) => ({
        ativo: mode.hasAttribute('data-active'),
        texto: mode.innerText.replace(/\\n/g, ' | ').slice(0, 80),
        ...box(mode),
      }));
      return { ...box(bar), texto: bar.innerText.replace(/\\n/g, ' | ').slice(0, 120), modos };
    })(),
  };
})()`);

console.log(JSON.stringify(report, null, 2));
ws.close();
