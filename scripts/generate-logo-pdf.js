import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const iconPath = path.join(repoRoot, 'frontend', 'src', 'app', 'icon.svg');
const outputPath = path.join(repoRoot, 'meridian-logo.png');

const buildHtml = (dataUrl) => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 512px;
        height: 512px;
        background: transparent;
      }
      .wrap {
        width: 512px;
        height: 512px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      img {
        width: 512px;
        height: 512px;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <img src="${dataUrl}" alt="Meridian Logo" />
    </div>
  </body>
</html>`;

const run = async () => {
  const iconBuffer = await fs.readFile(iconPath);
  const dataUrl = `data:image/svg+xml;base64,${iconBuffer.toString('base64')}`;

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
  await page.setContent(buildHtml(dataUrl), { waitUntil: 'load' });

  await page.screenshot({
    path: outputPath,
    type: 'png',
    omitBackground: true
  });

  await browser.close();
  console.log(`Saved PDF: ${outputPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
