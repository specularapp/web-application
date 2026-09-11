/**
 * Sonda da janela de vincular registro, aberta por cima da ficha da tarefa no celular: confere o contrato de
 * camada da casa nos três pontos que só o navegador sabe dizer.
 *
 * 1. A barra flutuante passa a ser a da janela de cima, e não a da ficha atrás.
 * 2. A barra não repete a mesma ação duas vezes (a principal "Fechar" ao lado do X de sair).
 * 3. A lista de registros reserva no fim o espaço da barra, para o último item fechar acima dela.
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

/* O que a barra está mostrando agora: quantos botões, com que nomes, e quantos deles fecham a mesma coisa. */
const readBar = `(() => {
  const byClass = (part) => [...document.querySelectorAll('*')].filter((node) =>
    [...(node.classList || [])].some((name) => name.includes(part)));
  const mode = byClass('barMode').find((node) => node.hasAttribute('data-active'));
  if (!mode) return { barra: null };
  const buttons = [...mode.querySelectorAll('button')].map((node) =>
    (node.getAttribute('aria-label') || node.textContent || '').trim()).filter(Boolean);
  return {
    modo: mode.innerText.replace(/\\n/g, ' | ').slice(0, 60),
    botoes: buttons,
    fechares: buttons.filter((name) => /fechar/i.test(name)).length,
  };
})()`;

const steps = [];

steps.push({ passo: "quadro", ...(await session.eval(readBar)) });

/* Abre a ficha pelo primeiro cartão do quadro. */
await session.eval(`(() => {
  const card = [...document.querySelectorAll('li')].find((node) =>
    [...(node.classList || [])].some((name) => name.includes('task-card-module')));
  const button = card?.matches('[role="button"], button') ? card : card?.querySelector('[role="button"], button');
  (button || card)?.click();
})()`);
await sleep(1400);
steps.push({ passo: "ficha", ...(await session.eval(readBar)) });

/* Vai para a metade de informações, rola até Vínculos e aperta o "+" daquele bloco. */
const opened = await session.eval(`(() => {
  const tab = [...document.querySelectorAll('[role="tab"]')].find((node) => /informa/i.test(node.textContent || ''));
  tab?.click();

  const heads = [...document.querySelectorAll('h3, h4, p, span')].filter((node) => /^v[ií]nculos/i.test((node.textContent || '').trim()));
  for (const head of heads) {
    const block = head.closest('section, div');
    const plus = block && [...block.querySelectorAll('button')].find((node) =>
      /vincular|adicionar|acrescentar/i.test(node.getAttribute('aria-label') || ''));
    if (plus) {
      plus.scrollIntoView({ block: 'center' });
      plus.click();
      return 'abriu por ' + (plus.getAttribute('aria-label') || '');
    }
  }
  return 'nao achou o + de vinculos';
})()`);
console.log(opened);
await sleep(1400);

/* Com a janela aberta: a barra dela, a superfície da bandeja e a folga da lista que rola. */
const report = await session.eval(`(() => {
  const byClass = (part) => [...document.querySelectorAll('*')].filter((node) =>
    [...(node.classList || [])].some((name) => name.includes(part)));
  const px = (value) => Math.round(parseFloat(value) * 100) / 100;

  const panels = [...document.querySelectorAll('[role="dialog"]')];
  const top = panels[panels.length - 1];
  const picker = byClass('record-picker-module').find((node) => [...(node.classList || [])].some((name) => /__picker/.test(name)));
  const results = byClass('record-picker-module').find((node) => [...(node.classList || [])].some((name) => /__results/.test(name)));

  const barBox = (() => {
    const bar = byClass('sidebar-module').find((node) => [...(node.classList || [])].some((name) => /__bar$/.test(name)));
    return bar ? bar.getBoundingClientRect() : null;
  })();

  const inset = results ? px(getComputedStyle(results).paddingBottom) : null;
  const barH = barBox ? Math.round(barBox.height) : null;

  return {
    janelasAbertas: panels.length,
    bandeja: top ? {
      rotulo: top.getAttribute('aria-label'),
      superficie: top.getAttribute('data-surface'),
      tamanho: top.getAttribute('data-size'),
      modo: top.getAttribute('data-mode'),
      recuoFim: px(getComputedStyle(top).paddingBottom),
    } : null,
    dialogo: (() => {
      const form = top && top.querySelector('form');
      return form ? { recuoFim: px(getComputedStyle(form).paddingBottom) } : null;
    })(),
    listaQueRola: results ? {
      folgaNoFim: inset,
      rolaPorDentro: results.scrollHeight > results.clientHeight,
      cobreABarra: barH !== null && inset >= barH,
    } : null,
    seletorTemAltura: picker ? Math.round(picker.getBoundingClientRect().height) : null,
    alturaDaBarra: barH,
  };
})()`);

steps.push({ passo: "vinculos aberto", ...(await session.eval(readBar)), detalhe: report });

/* Fechar a de cima devolve a barra à ficha, que é a outra metade do contrato: a de baixo volta sozinha, sem
   depender de um render novo para se registrar de novo. */
await session.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
await session.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
await sleep(1200);
steps.push({
  passo: "vinculos fechado",
  ...(await session.eval(readBar)),
  janelasAbertas: await session.eval(`document.querySelectorAll('[role="dialog"]').length`),
});

console.log(JSON.stringify(steps, null, 2));
ws.close();
