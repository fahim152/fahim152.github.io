import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const html = await readFile(join(root, 'index.html'), 'utf8');
const files = await readdir(root);
assert.deepEqual(files.sort(), ['_headers', 'favicon.svg', 'index.html', 'script.js', 'styles.css']);
const source = (await Promise.all(files.map(file => readFile(join(root, file), 'utf8')))).join('\n');
assert(!/tel:|mailto:|\b\S+@\S+\.\w+|\b(?:phone|postal|street|address)\b/i.test(source), 'No private contact information');
assert(!/\d[\d ()+.-]{6,}\d/.test(html.replace(/<[^>]*>/g, ' ')), 'No phone-number-like strings in page text');
assert(!/\.pdf\b|localStorage|sessionStorage|document\.cookie|<iframe|<form\b/i.test(source), 'No private PDFs, storage, embeds, or forms');
assert(!/<(?:script|link)[^>]+(?:src|href)="https?:/i.test(html.replace(/<link rel="canonical"[^>]+>/, '')), 'No third-party scripts or styles');
assert.equal((html.match(/class="job"/g) || []).length, 5);
assert(!/job-mark|lego-mark|degree-icon/.test(source), 'No invented employer or university logos');
assert(!/>Intelligence<|'Intelligence'|THE WAY I THINK/.test(source), 'Diagram describes work, not personal attributes');
assert(html.includes('Aarhus University') && html.includes('American International University-Bangladesh'));
assert(html.includes('prefers-reduced-motion') || source.includes('prefers-reduced-motion'));
assert(source.includes("frame-ancestors 'none'"));
console.log('PASS: source content, publishing boundary, and privacy checks');

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!files.includes(name) || name === '_headers') { res.writeHead(404).end(); return; }
  try {
    res.writeHead(200, { 'Content-Type': types[extname(name)], 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(join(root, name)));
  } catch { res.writeHead(500).end(); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const artifacts = await mkdtemp(join(tmpdir(), 'fahim-site-check-'));
const profile = join(artifacts, 'chrome-profile');
const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
const deadline = setTimeout(() => { console.error('Browser check timed out.'); chrome.kill(); server.close(); process.exit(1); }, 60000);
try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    chrome.on('error', reject);
    chrome.on('exit', code => reject(new Error(`Chrome exited early: ${code}`)));
    chrome.stderr.on('data', data => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
  });
  const targets = await (await fetch(`http://${new URL(endpoint).host}/json/list`)).json();
  const target = targets.find(item => item.type === 'page');
  assert(target, 'Chrome created a page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await once(socket, 'open');
  const pending = new Map();
  const errors = [];
  const requests = [];
  let sequence = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Network.enable');
  await command('Log.enable');
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const navigate = async () => {
    await command('Page.navigate', { url: origin });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(`document.readyState === 'complete' && !!document.querySelector('.site-footer')`)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail('Page did not finish loading');
  };
  await navigate();
  assert.equal(await evaluate(`document.querySelector('.system-controls').hidden`), false);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.flow')).animationName`), 'none');
  assert.equal(await evaluate(`getComputedStyle(document.documentElement).scrollBehavior`), 'auto');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('a[href^="#"]')].filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash)`), []);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('a[target="_blank"]')].filter(a => !a.rel.includes('noopener') || !a.rel.includes('noreferrer')).map(a => a.href)`), []);
  assert.equal(await evaluate(`document.querySelectorAll('h1').length`), 1);
  assert.equal(await evaluate(`/manufacturing|moulding/i.test(document.querySelector('#home').textContent + document.querySelector('.credentials').textContent + document.querySelector('meta[name="description"]').content + document.querySelector('meta[property="og:description"]').content)`), false, 'General positioning is industry-neutral');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.job-location')].map(node => node.textContent)`), [
    'Billund, Denmark', 'Billund, Denmark',
    'Copenhagen, Denmark',
    'Dhaka, Bangladesh', 'Dhaka, Bangladesh'
  ], 'Every employer has a sourced city and country');
  assert.equal(await evaluate(`document.querySelectorAll('.job')[2].querySelector('summary').textContent.includes('Dhaka')`), false);
  assert.equal(await evaluate(`document.querySelectorAll('.job')[2].querySelectorAll('.job-project')[1].querySelector('.project-context').textContent`), 'Previously remote from Dhaka, Bangladesh · Until 2023');
  const expectedNodes = {
    systems: ['Software', 'Services', 'Data', 'Interfaces'],
    products: ['Web apps', 'APIs', 'Integrations', 'Users'],
    research: ['Raw data', 'LLMs', 'Shared meaning', 'Integration']
  };
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-node]')].map(node => node.textContent)`), expectedNodes.systems);
  for (const mode of ['products', 'research', 'systems']) {
    await evaluate(`document.querySelector('button[data-mode="${mode}"]').click()`);
    assert.equal(await evaluate(`document.querySelector('.system-map').dataset.mode`), mode);
    assert.equal(await evaluate(`document.querySelectorAll('button[aria-pressed="true"]').length`), 1);
    assert.equal(await evaluate(`document.querySelector('button[data-mode="${mode}"]').getAttribute('aria-pressed')`), 'true');
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-node]')].map(node => node.textContent)`), expectedNodes[mode]);
    assert.equal(await evaluate(`document.querySelector('.system-version').textContent`), { systems: '01 / 03', products: '02 / 03', research: '03 / 03' }[mode]);
  }
  await evaluate(`document.querySelector('.system-controls').click()`);
  await evaluate(`document.querySelectorAll('.job summary')[1].focus()`);
  assert.equal(await evaluate(`document.activeElement === document.querySelectorAll('.job summary')[1]`), true, 'Career summary receives keyboard focus');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  assert.equal(await evaluate(`document.querySelectorAll('.job')[1].open`), true);
  await evaluate(`document.querySelectorAll('.job')[1].open = false; document.querySelector('.skip-link').focus()`);
  assert.equal(await evaluate(`document.activeElement.className`), 'skip-link');
  assert((await evaluate(`document.activeElement.getBoundingClientRect().top`)) >= 0);
  await evaluate(`document.activeElement.blur(); window.scrollTo(0, 0)`);
  console.log('PASS: diagram modes, accordion keyboard access, links, reduced motion, skip link');

  for (const width of [320, 375, 390, 600, 768, 1024, 1440]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: width > 800 ? 1000 : 844, deviceScaleFactor: 1, mobile: width < 600 });
    await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `No overflow at ${width}px`);
    const clipped = await evaluate(`[...document.querySelectorAll('h1,h2,h3,nav,.job summary,.system-controls')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.tagName + '.' + el.className)`);
    assert.deepEqual(clipped, [], `No clipped key content at ${width}px`);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.hero-intro, .section-heading>p, .job-body, .degree-description, .about-copy>p')].filter(el => parseFloat(getComputedStyle(el).fontSize) < 16).map(el => el.className)`), [], `Body text remains at least 16px at ${width}px`);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.credentials span, .job-location, .text-link')].filter(el => parseFloat(getComputedStyle(el).fontSize) < 14).map(el => el.className)`), [], `Supporting text remains at least 14px at ${width}px`);
    await evaluate(`document.querySelectorAll('details').forEach(detail => { detail.open = true; })`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `Expanded chapters fit at ${width}px`);
    await evaluate(`document.querySelectorAll('details').forEach((detail, index) => { detail.open = index === 0; })`);
    if (width === 390 || width === 1440) {
      const metrics = await command('Page.getLayoutMetrics');
      const image = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: metrics.cssContentSize.height, scale: 1 } });
      await writeFile(join(artifacts, `${width === 390 ? 'mobile' : 'desktop'}.png`), Buffer.from(image.data, 'base64'));
    }
  }
  console.log('PASS: responsive layout at 320, 375, 390, 600, 768, 1024, and 1440px');
  await evaluate(`document.querySelector('#education').scrollIntoView()`);
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(await evaluate(`document.querySelector('nav a[href="#education"]').getAttribute('aria-current')`), 'location');
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await navigate();
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.map-orbit')).animationName`), 'orbit');
  await evaluate(`document.querySelector('button[data-mode="research"]').click()`);
  assert.equal(await evaluate(`document.querySelector('.flow').getAnimations().some(animation => animation.playState === 'running')`), true, 'Mode changes animate the data path');
  await evaluate(`document.querySelector('#education').scrollIntoView({behavior:'instant'})`);
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(await evaluate(`document.querySelector('#education .section-heading').classList.contains('has-entered')`), true, 'Visible sections receive entrance motion');
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(await evaluate(`document.getAnimations().filter(animation => animation.playState === 'running').length`), 0, 'Changing to reduced motion stops running animations');
  await evaluate(`document.querySelector('button[data-mode="products"]').click()`);
  assert.equal(await evaluate(`document.querySelector('.flow').getAnimations().filter(animation => animation.playState === 'running').length`), 0, 'Reduced-motion interactions stay still');
  console.log('PASS: project-specific locations, entrance motion, interactive animation, live reduced-motion preference');
  await command('Emulation.setScriptExecutionDisabled', { value: true });
  await navigate();
  assert.equal(await evaluate(`document.querySelector('.system-controls').hidden`), true);
  assert.equal(await evaluate(`document.querySelectorAll('.job').length`), 5);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.hero-intro')).display !== 'none'`), true);
  assert.deepEqual(errors, [], 'No JavaScript, CSP, or resource errors');
  assert(requests.every(url => url.startsWith(origin)), 'No third-party page requests');
  console.log('PASS: active navigation, no-JavaScript content, no browser errors, local-only requests');
  console.log(`Screenshots: ${artifacts}`);
} finally {
  clearTimeout(deadline);
  socket?.close();
  const stopped = once(chrome, 'exit');
  chrome.kill();
  await stopped;
  server.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
