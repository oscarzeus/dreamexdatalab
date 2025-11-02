const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const alreadyPresentRegex = /data-feature="security_level_evaluation_view"/i;
const insertion = '\n\t\t\t\t\t\t<li data-feature="security_level_evaluation_view" data-requires-permission="security_level_evaluation_view"><a href="seclevel.html">Security Level Evaluation<\/a><\/li>';

function updateHtml(html) {
  if (!/class="menu-dropdown"[^>]*data-feature="security_view"/i.test(html)) return html;
  if (alreadyPresentRegex.test(html)) return html;

  // Find first Security menu dropdown
  let idx = html.search(/<li[^>]*class="menu-dropdown"[^>]*data-feature="security_view"[^>]*>/i);
  if (idx === -1) return html;

  const ulStart = html.indexOf('<ul class="submenu">', idx);
  if (ulStart === -1) return html;
  const ulEnd = html.indexOf('</ul>', ulStart);
  if (ulEnd === -1) return html;

  const beforeUl = html.slice(0, ulStart + '<ul class="submenu">'.length);
  const submenu = html.slice(ulStart + '<ul class="submenu">'.length, ulEnd);
  const afterUl = html.slice(ulEnd);

  let newSubmenu;
  if (/data-feature="security_site_map_view"/i.test(submenu)) {
    newSubmenu = submenu.replace(/(<li[^>]*data-feature="security_site_map_view"[\s\S]*?<\/li>)/i, `$1${insertion}`);
  } else {
    newSubmenu = submenu + insertion;
  }

  return beforeUl + newSubmenu + afterUl;
}

function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.html') return;
  const html = fs.readFileSync(filePath, 'utf8');
  const updated = updateHtml(html);
  if (updated !== html) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('Updated:', path.basename(filePath));
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'scripts') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else processFile(full);
  }
}

walk(rootDir);
