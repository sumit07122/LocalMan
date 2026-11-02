const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

async function captureScreenshot({ url, outputPath, width = 430, height = 932, delay = 5000 }) {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const debuggingPort = 9300 + Math.floor(Math.random() * 500);
  const tempProfileDir = path.join(os.tmpdir(), `chrome_preview_${debuggingPort}`);

  const chromeProc = spawn(chromePath, [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--user-data-dir=${tempProfileDir}`,
    `--remote-debugging-port=${debuggingPort}`,
    `--window-size=${width},${height}`,
    'about:blank'
  ]);

  chromeProc.stderr.on('data', (d) => {
    // console.error('[Chrome Err]', d.toString());
  });

  // Helper: wait ms
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Helper: poll until debugging endpoint is responsive
  let versionData = null;
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    try {
      versionData = await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${debuggingPort}/json/version`, (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          });
        });
        req.on('error', reject);
      });
      if (versionData && versionData.webSocketDebuggerUrl) {
        console.log('[CDP] Chrome debugging ready on port', debuggingPort);
        break;
      }
    } catch (e) {
      // Retry
    }
  }

  if (!versionData || !versionData.webSocketDebuggerUrl) {
    chromeProc.kill();
    throw new Error(`Chrome debugging port ${debuggingPort} failed to respond`);
  }

  // Query existing targets
  console.log('[CDP] Querying targets on port', debuggingPort);
  let targets = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${debuggingPort}/json/list`, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
  console.log('[CDP] Targets found:', targets.map(t => `${t.type}:${t.title || t.url}`));

  const pageTarget = targets.find(t => t.type === 'page');
  const wsUrl = pageTarget ? pageTarget.webSocketDebuggerUrl : null;
  if (!wsUrl) {
    throw new Error('No page target found');
  }
  console.log('[CDP] Connecting to page wsUrl:', wsUrl);

  const ws = new WebSocket(wsUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = () => {
      console.log('[CDP] WebSocket connected');
      resolve();
    };
    ws.onerror = reject;
  });

  let messageId = 1;
  const send = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          if (msg.error) {
            reject(new Error(msg.error.message));
          } else {
            resolve(msg.result);
          }
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  console.log('[CDP] Enabling Page, Runtime & Console...');
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Console.enable');

  ws.addEventListener('message', (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value || a.description).join(' ');
      console.log(`[Browser Console] ${msg.params.type}: ${args}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error(`[Browser Exception]`, msg.params.exceptionDetails);
    }
  });

  const isMobile = width <= 800;
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: isMobile ? 2 : 1,
    mobile: isMobile,
  });

  console.log('[CDP] Navigating to', url);
  await send('Page.navigate', { url });

  console.log(`[CDP] Waiting ${delay}ms for Flutter Web render...`);
  await sleep(delay);

  console.log('[CDP] Capturing screenshot...');
  const result = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });

  const buffer = Buffer.from(result.data, 'base64');
  fs.writeFileSync(outputPath, buffer);
  console.log(`[Captured] ${outputPath} (${buffer.length} bytes)`);

  ws.close();
  chromeProc.kill();
}

const [,, url, outputPath, width, height, delay] = process.argv;
if (!url || !outputPath) {
  console.error('Usage: node cdp-screenshot.js <url> <outputPath> [width] [height] [delay]');
  process.exit(1);
}

captureScreenshot({
  url,
  outputPath,
  width: width ? parseInt(width, 10) : 430,
  height: height ? parseInt(height, 10) : 932,
  delay: delay ? parseInt(delay, 10) : 5000,
}).catch((err) => {
  console.error('[Capture Error]', err);
  process.exit(1);
});
