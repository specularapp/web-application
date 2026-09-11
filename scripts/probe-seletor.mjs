/**
 * Sonda do seletor de metade da ficha de tarefa (Informações / Atividade): mede, no navegador, o raio de fora
 * e o de dentro e confere a conta concêntrica da casa, que é raio do pai menos o recuo que os separa.
 *
 * O que só o navegador sabe dizer: o valor resolvido de `border-radius` depois dos tokens, o recuo real da
 * caixa e o `data-squircle-radius` que o motor do fallback vai desenhar. Folha e motor discordando é
 * justamente o defeito que a leitura do CSS não pega.
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

console.log(`abrindo ${BASE}${ROUTE}`);
await session.send("Page.navigate", { url: `${BASE}${ROUTE}` });
await sleep(4500);

/* Abre a ficha pelo primeiro cartão do quadro, que é o caminho de verdade: no celular a janela é a bandeja e
   o seletor só existe com ela aberta. */
const opened = await session.eval(`(() => {
  const card = [...document.querySelectorAll('li')].find((node) =>
    [...(node.classList || [])].some((name) => name.includes('task-card-module')));
  if (!card) return 'nenhum cartão no quadro';
  const button = card.matches('[role="button"], button') ? card : card.querySelector('[role="button"], button');
  (button || card).click();
  return 'cartão aberto';
})()`);
console.log(opened);
await sleep(1200);

const report = await session.eval(`(() => {
  const px = (value) => Math.round(parseFloat(value) * 100) / 100;
  const byClass = (part) => [...document.querySelectorAll('*')].filter((node) =>
    [...(node.classList || [])].some((name) => name.includes(part)));

  const box = byClass('switcher').find((node) => node.getAttribute('role') === 'tablist');
  if (!box) return { erro: 'seletor não está na tela' };

  const thumb = [...box.children].find((node) => node.getAttribute('aria-hidden') === 'true');
  const options = [...box.querySelectorAll('[role="tab"]')];

  const read = (node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return {
      raioCss: px(style.borderTopLeftRadius),
      raioMotor: node.getAttribute('data-squircle-radius'),
      cantoNativo: style.cornerShape || '(sem corner-shape)',
      caixa: { l: Math.round(rect.left), t: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
    };
  };

  const fora = read(box);
  const dentro = read(thumb);
  const recuo = px(getComputedStyle(box).paddingTop);
  const esperado = fora.raioCss - recuo;

  return {
    fora,
    recuo,
    dentro,
    opcoes: options.map((node) => ({ texto: node.textContent.trim(), ...read(node) })),
    concentrico: {
      conta: fora.raioCss + ' menos ' + recuo + ' = ' + esperado,
      medido: dentro.raioCss,
      confere: Math.abs(dentro.raioCss - esperado) < 0.5,
    },
    motorBateComCss: options.every((node) => Number(node.getAttribute('data-squircle-radius')) === dentro.raioCss)
      && Number(dentro.raioMotor) === dentro.raioCss,
    dentroDaTela: box.getBoundingClientRect().left >= 0
      && box.getBoundingClientRect().right <= document.documentElement.clientWidth,
  };
})()`);

console.log(JSON.stringify(report, null, 2));
ws.close();
