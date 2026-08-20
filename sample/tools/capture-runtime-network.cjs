const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ORIGIN = 'https://peteroravec.com/';
const PORT = 9337;
const WIDTH = 1920;
const HEIGHT = 1080;
const OUT_FILE = path.join(
  __dirname,
  '..',
  'analysis',
  'runtime-network.json',
);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestJson(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}${endpoint}`, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

async function waitForChrome() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await requestJson('/json/version');
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Chrome CDP port ${PORT} did not start`);
}

async function main() {
  const profile = path.join(os.tmpdir(), `vc-cdp-${Date.now()}`);
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });

  try {
    await waitForChrome();
    const targets = await requestJson('/json/list');
    const page = targets.find((target) => target.type === 'page');
    if (!page) throw new Error('No Chrome page target');

    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });

    let nextId = 0;
    const pending = new Map();
    const responses = [];
    const exceptions = [];
    const consoleMessages = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const request = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
        return;
      }
      if (message.method === 'Network.responseReceived') {
        const response = message.params.response;
        responses.push({
          url: response.url,
          status: response.status,
          mimeType: response.mimeType,
          fromDiskCache: response.fromDiskCache,
          fromServiceWorker: response.fromServiceWorker,
          timestamp: message.params.timestamp,
        });
      }
      if (message.method === 'Runtime.exceptionThrown') {
        exceptions.push(message.params.exceptionDetails);
      }
      if (message.method === 'Runtime.consoleAPICalled') {
        consoleMessages.push({
          type: message.params.type,
          text: (message.params.args || [])
            .map((arg) => arg.value ?? arg.description ?? '')
            .join(' '),
        });
      }
    });

    function call(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const result = await call('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return result.result?.value ?? null;
    }

    async function press(key, durationMs) {
      await call('Input.dispatchKeyEvent', {
        type: 'keyDown', key, code: key, windowsVirtualKeyCode: 0,
      });
      await sleep(durationMs);
      await call('Input.dispatchKeyEvent', {
        type: 'keyUp', key, code: key, windowsVirtualKeyCode: 0,
      });
      await sleep(500);
    }

    await call('Runtime.enable');
    await call('Network.enable', { cacheDisabled: true });
    await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await call('Page.navigate', { url: ORIGIN });
    await sleep(14000);

    const ready = await evaluate(`({
      href: location.href,
      title: document.title,
      playVisible: Boolean([...document.querySelectorAll('button,a')]
        .find((el) => (el.textContent || '').trim().toLowerCase() === 'play')),
      canvas: Boolean(document.querySelector('canvas'))
    })`);
    const play = await evaluate(`(() => {
      const element = [...document.querySelectorAll('button,a')]
        .find((el) => (el.textContent || '').trim().toLowerCase() === 'play');
      if (!element) return false;
      element.click();
      return true;
    })()`);
    await sleep(3000);
    for (const key of ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) {
      await press(key, 1500);
    }

    const uniqueResponses = [...new Map(
      responses.map((item) => [`${item.url}\n${item.status}`, item]),
    ).values()];
    fs.writeFileSync(OUT_FILE, JSON.stringify({
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      origin: ORIGIN,
      viewport: { width: WIDTH, height: HEIGHT },
      states: ['navigation', 'ready', 'play', 'up', 'right', 'down', 'left'],
      ready,
      play,
      responseCount: responses.length,
      responses: uniqueResponses,
      consoleMessages,
      exceptions,
    }, null, 2) + '\n');
    socket.close();
    console.log(JSON.stringify({
      output: OUT_FILE,
      responses: uniqueResponses.length,
      play,
    }));
  } finally {
    chrome.kill();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
