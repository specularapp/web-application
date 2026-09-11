/**
 * Sonda das janelas de acrescentar (vínculo, subtarefa, anexo) abertas por cima da ficha: confere que a
 * barra flutuante passa a refletir a janela de cima, que é o contrato de camada da casa.
 *
 * Ferramenta de conferência, como as outras sondas: fora do pacote e da aplicação.
 */
const PORT = 9222;
const BASE = process.env.PROBE_BASE || "http://localhost:3000";
const ROUTE = process.env.PROBE_ROUTE || "/previa/tarefas";

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
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

const session = new Session(ws);
await session.send("Page.enable");
await session.send("Runtime.enable");
await session.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
await session.send("Page.navigate", { url: `${BASE}${ROUTE}` });
await sleep(4500);

await session.eval(`(() => {
  const card = [...document.querySelectorAll('li')].find((n) => [...(n.classList || [])].some((c) => c.includes('task-card-module')));
  card.querySelector('[role="button"]').focus();
})()`);
await session.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
await session.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
await sleep(1800);

const leBarra = `(() => {
  const bar = [...document.querySelectorAll('*')].find((n) => [...(n.classList || [])].some((c) => c.includes('sidebar-module') && /__bar$/.test(c)));
  const modo = [...document.querySelectorAll('*')].filter((n) => [...(n.classList || [])].some((c) => c.includes('barMode'))).find((m) => m.hasAttribute('data-active'));
  const janelas = [...document.querySelectorAll('dialog')].filter((d) => d.open).length;
  return {
    janelasAbertas: janelas,
    barra: bar ? Math.round(bar.getBoundingClientRect().width) : null,
    acoes: modo ? modo.innerText.replace(/\\n/g, ' | ').slice(0, 90) : null,
  };
})()`;

const passos = [{ nome: "ficha aberta", abrir: null }];
for (const alvo of ["Vincular", "Nova subtarefa", "Anexar"]) {
  passos.push({ nome: alvo, abrir: alvo });
}

const saida = [];
for (const passo of passos) {
  if (passo.abrir) {
    const clicou = await session.eval(`(() => {
      const botao = [...document.querySelectorAll('button')].find((b) => {
        const texto = (b.getAttribute('aria-label') || b.textContent || '').trim();
        return new RegExp(${JSON.stringify(passo.abrir)}, 'i').test(texto);
      });
      if (!botao) return 'nao achou';
      botao.click();
      return 'clicou';
    })()`);
    await sleep(1200);
    saida.push({ passo: passo.nome, clicou, ...(await session.eval(leBarra)) });
    /* fecha pelo Esc para o próximo passo partir da ficha limpa */
    await session.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await session.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await sleep(900);
  } else {
    saida.push({ passo: passo.nome, ...(await session.eval(leBarra)) });
  }
}

console.log(JSON.stringify(saida, null, 2));
ws.close();
