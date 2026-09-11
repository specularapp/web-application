/**
 * Sonda da ficha da tarefa no celular: abre o quadro, entra numa tarefa e mede a janela por dentro, que é
 * onde moram as decisões de 2026-09-11 (o seletor de metade, a barra flutuante por camada, o compositor).
 *
 * Ferramenta de conferência, como `probe-mobile.mjs`: não entra no pacote nem é importada pela aplicação.
 *
 *   node scripts/probe-ficha.mjs            # abre a ficha e descreve Informações
 *   node scripts/probe-ficha.mjs atividade  # troca para a conversa antes de medir
 */
const PORT = 9222;
const BASE = process.env.PROBE_BASE || "http://localhost:3000";
const ROUTE = process.env.PROBE_ROUTE || "/previa/tarefas";
const aba = (process.argv[2] || "").toLowerCase();

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
await session.send("Page.navigate", { url: `${BASE}${ROUTE}` });
await sleep(4500);

/* O cartão abre pelo teclado: o `role="button"` do cartão responde a Enter, e o foco é o caminho que não
   depende de o ponto estar visível na rolagem da coluna. */
const foco = await session.eval(`(() => {
  const card = [...document.querySelectorAll('li')].find((node) => [...(node.classList || [])].some((name) => name.includes('task-card-module')));
  if (!card) return 'sem cartao';
  const alvo = card.querySelector('[role="button"]');
  if (!alvo) return 'sem alvo';
  alvo.focus();
  return document.activeElement === alvo ? 'focado' : 'nao focou';
})()`);

await session.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
await session.send("Input.dispatchKeyEvent", { type: "char", key: "Enter", text: "\r", unmodifiedText: "\r" });
await session.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
await sleep(1800);

if (aba.startsWith("ativ")) {
  await session.eval(`(() => {
    const tab = [...document.querySelectorAll('[role="tab"]')].find((node) => /Atividade/i.test(node.textContent));
    if (tab) tab.click();
  })()`);
  await sleep(900);
}

const report = await session.eval(`(() => {
  const root = document.documentElement;
  const box = (node) => {
    const rect = node.getBoundingClientRect();
    return { l: Math.round(rect.left), t: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) };
  };
  const byClass = (part) => [...document.querySelectorAll('*')].filter((node) => [...(node.classList || [])].some((name) => name.includes(part)));
  const janela = document.querySelector('dialog') || document.querySelector('[role="dialog"]');

  const seletor = byClass('switcher').find((node) => node.getAttribute('role') === 'tablist');
  const barra = byClass('sidebar-module').find((node) => [...(node.classList || [])].some((name) => /__bar$/.test(name)));
  const compositor = byClass('composerCard')[0];

  return {
    fichaAberta: Boolean(janela),
    rolagemLateral: root.scrollWidth - root.clientWidth,
    janela: janela ? box(janela) : null,
    seletor: seletor ? { ...box(seletor), raio: getComputedStyle(seletor).borderRadius, forma: getComputedStyle(seletor).cornerShape || '(sem corner-shape)' } : null,
    abas: [...document.querySelectorAll('[role="tab"]')].map((tab) => ({
      texto: tab.textContent.trim(),
      ativa: tab.getAttribute('aria-selected') === 'true',
      ...box(tab),
    })),
    barra: barra
      ? {
          ...box(barra),
          modoAtivo: byClass('barMode').filter((m) => m.hasAttribute('data-active')).map((m) => m.innerText.replace(/\\n/g, ' | ').slice(0, 90))[0] ?? null,
        }
      : null,
    compositor: compositor ? { ...box(compositor), recuoFim: getComputedStyle(compositor).paddingBlockEnd } : null,
    propriedades: (() => {
      const grade = byClass('properties')[0];
      if (!grade) return null;
      return { ...box(grade), colunas: getComputedStyle(grade).gridTemplateColumns };
    })(),
  };
})()`);

console.log(JSON.stringify({ foco, aba: aba || "informacoes", ...report }, null, 2));
ws.close();
