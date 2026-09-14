// Prints each guide's styled HTML in this folder to apps/web/public/guides/<slug>.pdf with
// the installed Chrome, driven by Playwright from apps/web:
//
//   node static-content/guides-glossary/pdf/print-guides.mjs
//
// Chrome is used rather than a downloaded browser because it is the one that is installed
// (CHROME below, or CHROME_PATH). After reprinting, check the page count it reports and
// update `pageCountLabel`, `gate.fileLabel` and the guides index, so the page never promises
// a length the file does not have; the snapshot test compares them.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const SOURCE = import.meta.dirname;
const OUT = path.resolve(SOURCE, '../../../public/guides');
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const FOOTER =
  '<div style="width:100%;font-size:7.5pt;color:#41536B;font-family:Segoe UI,sans-serif;padding:0 18mm;display:flex;justify-content:space-between;"><span>calwebtech.com</span><span class="pageNumber"></span></div>';

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
for (const file of fs.readdirSync(SOURCE).filter((name) => name.endsWith('.html'))) {
  const slug = file.replace(/\.html$/, '');
  await page.goto(pathToFileURL(path.join(SOURCE, file)).href, { waitUntil: 'load' });
  const target = path.join(OUT, `${slug}.pdf`);
  await page.pdf({
    path: target,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: FOOTER,
    margin: { top: '20mm', right: '18mm', bottom: '18mm', left: '18mm' },
  });
  const bytes = fs.readFileSync(target);
  const pages = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  console.log(`${slug}.pdf  ${(bytes.length / 1024).toFixed(0)} kB  ${pages} pages`);
}
await browser.close();
