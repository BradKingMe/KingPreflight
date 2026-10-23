import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { inspectFile } from '../src/scanner.js';
import { createPreviewServer } from '../scripts/preview-server.mjs';
const exec = promisify(execFile);
test('reports signals without retaining matched values', () => {
  const secret = 'a'.repeat(40);
  const result = inspectFile({path:'.npmrc', bytes:50, contentInspected:true, content:`token=${secret}`});
  assert.ok(result.findings.some(f => f.code === 'secret-assignment'));
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(inspectFile({path:'x.txt',contentInspected:true}).contentInspected,false);
});
test('CLI preserves files, rejects invalid UTF-8, and reports excluded bodies', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'preflight-audit-'));
  try {
    const original = Buffer.from('password=syntheticOnly123');
    await fs.writeFile(path.join(root,'config.txt'),original);
    await fs.writeFile(path.join(root,'invalid.txt'),Buffer.from([255,0,254]));
    await fs.mkdir(path.join(root,'node_modules'));
    await fs.writeFile(path.join(root,'large.txt'),Buffer.alloc(2*1024*1024+1,65));
    const {stdout} = await exec(process.execPath,['scripts/scan.mjs','--root',root,'--json']);
    const report = JSON.parse(stdout);
    assert.equal(report.summary.fileCount,3);
    assert.equal(report.summary.inspectedTextFiles,1);
    assert.equal(report.coverage.unreadableItems.length,1);
    assert.deepEqual(report.coverage.ignoredDirectories,['node_modules']);
    assert.ok(!stdout.includes('syntheticOnly123'));
    assert.deepEqual(await fs.readFile(path.join(root,'config.txt')),original);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
test('CLI rejects missing root values and unknown flags', async () => {
  for (const args of [['--root','--json'],['--root','.','--unknown']]) {
    await assert.rejects(exec(process.execPath,['scripts/scan.mjs',...args]),e => e.code === 2);
  }
});
test('preview serves only explicit assets regardless of working directory', async () => {
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base+'/app/')).status,200);
    assert.equal((await fetch(base+'/src/scanner.js')).status,200);
    for (const name of ['/.env','/.git/config','/package.json','/scripts/scan.mjs','/%2e%2e/.env']) assert.equal((await fetch(base+name)).status,404);
    assert.equal((await fetch(base+'/app/',{method:'POST'})).status,405);
    assert.equal(await new Promise(resolve => http.get(base+'/app/', {headers:{host:'attacker.example'}}, response => { response.resume(); resolve(response.statusCode); })),403);
    assert.equal((await fetch(base+'/app/',{method:'HEAD'})).headers.get('content-type'),'text/html; charset=utf-8');
  } finally { await new Promise(resolve => server.close(resolve)); }
});


test('browser scan/export omits values and a sample cancels an older scan', async () => {
  const { chromium } = await import('@playwright/test');
  const server = createPreviewServer();
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({channel:'chrome', headless:true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/app/`);
    await page.evaluate(async () => {
      const input = document.querySelector('#folderInput');
      const file = new File(['password=syntheticSecret123'],'config.txt');
      Object.defineProperty(file,'webkitRelativePath',{value:'handoff/config.txt'});
      Object.defineProperty(input,'files',{configurable:true,value:[file]});
      input.dispatchEvent(new Event('change'));
    });
    await page.waitForFunction(() => document.querySelector('#scan-status').textContent.startsWith('Scan finished'));
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportReport').click();
    const download = await downloadPromise;
    const reportText = await fs.readFile(await download.path(),'utf8');
    assert.ok(!reportText.includes('syntheticSecret123'));
    assert.equal(JSON.parse(reportText).summary.fileCount,1);
    await page.evaluate(() => {
      const input = document.querySelector('#folderInput');
      const file = new File(['stale'],'slow.txt');
      file.arrayBuffer = () => new Promise(resolve => setTimeout(() => resolve(new TextEncoder().encode('stale').buffer),200));
      Object.defineProperty(input,'files',{configurable:true,value:[file]});
      input.dispatchEvent(new Event('change'));
      document.querySelector('#exampleButton').click();
    });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#review-mode').textContent(),'Example review');
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
