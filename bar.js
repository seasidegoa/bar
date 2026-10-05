// Google Sheet → File → Share → Publish to web → CSV. Not the /edit URL.
const SHEET = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQTgxgiHNx-zlHCBL-M-7OxIBFudZ0jL1djx22jqvBBCxk6NqKgBl80mTNp-5PxDb257Jr2jCZ2zqi8/pub';
const tab = gid => `${SHEET}?gid=${gid}&single=true&output=csv`;
const ITEMS_URL = tab(0);
// "Sections" tab: section,title_ru,hide,alcohol.
const SECTIONS_URL = tab(973943221);
// "Dry Day" tab: one checkbox. Ticked → every alcohol section is hidden.
const DRY_DAY_URL = tab(1979368057);
const LANG_KEY = 'menu-lang';
const LANG_NAMES = { en: 'English', ru: 'Русский' };
const TAGS = { spicy: 'spicy', new: 'new', gf: 'GF' };
// FSSAI food marks: green circle in a square = veg, brown triangle in a square = non-veg.
const MARKS = { veg: 'Vegetarian', nonveg: 'Non-vegetarian' };

// Handles quoted fields, embedded commas/newlines, "" escapes, CRLF.
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Rows → objects keyed by trimmed, lower-cased header. Unknown columns are harmless.
function records(text) {
  if (!text) return [];
  const [head = [], ...rows] = parseCSV(text);
  const keys = head.map(h => h.trim().toLowerCase());
  return rows.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  // An unpublished sheet answers with an HTML page, not CSV.
  if (!res.ok || text.trimStart().startsWith('<')) throw new Error(`bad response from ${url}`);
  return text;
}

function pickLang(langs) {
  const want = [
    new URLSearchParams(location.search).get('lang'),
    localStorage.getItem(LANG_KEY),
    ...(navigator.languages || [navigator.language]).map(l => l && l.slice(0, 2)),
  ];
  return want.find(l => langs.includes(l)) || 'en';
}

let lang = null; // resolved against the sheet's actual language columns on first render

function render(data, note) {
  const all = records(data.items);
  const sections = records(data.sections);
  const titles = Object.fromEntries(sections.map(s => [s.section, s]));
  // Whole-section switch, e.g. hide every alcohol section on a dry day.
  const dry = parseCSV(data.dry || '').flat().some(c => /^(true|x|yes)$/i.test(c.trim()));
  const hidden = new Set(sections.filter(s => s.hide || (dry && s.alcohol)).map(s => s.section));
  const dishes = all.filter(d => d.name_en && !d.hide && !hidden.has(d.section));
  const langs = Object.keys(all[0] || { name_en: 1 })
    .map(k => k.match(/^name_(\w+)$/)?.[1]).filter(Boolean);
  if (!langs.includes(lang)) lang = pickLang(langs);
  document.documentElement.lang = lang;

  const groups = new Map();
  for (const d of dishes) {
    const key = d.section || '—';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  }
  const title = s => (lang !== 'en' && titles[s]?.[`title_${lang}`]) || s;

  document.getElementById('langs').innerHTML = langs.length < 2 ? '' : langs.map(l =>
    `<button data-lang="${esc(l)}" aria-pressed="${l === lang}">${esc(LANG_NAMES[l] || l.toUpperCase())}</button>`).join('');

  document.getElementById('nav').innerHTML = [...groups.keys()].map(s =>
    `<a href="#${slug(s)}">${esc(title(s))}</a>`).join('');

  document.getElementById('menu').innerHTML = (dry ? document.getElementById('dry').innerHTML : '') + [...groups].map(([s, items]) => `
    <section id="${slug(s)}">
      <h2>${esc(title(s))}</h2>
      ${items.map(d => {
        const name = d[`name_${lang}`] || d.name_en;
        const desc = d[`desc_${lang}`] || d.desc_en;
        const tags = (d.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        const pills = tags.filter(t => !MARKS[t]);
        return `<article class="dish">
          ${d.photo ? `<img src="${esc(new URL('img/' + d.photo, import.meta.url))}" alt="" loading="lazy">` : ''}
          <div class="body"><div class="line"><h3>${tags.filter(t => MARKS[t]).map(t =>
            `<span class="mark mark-${t}" role="img" aria-label="${MARKS[t]}" title="${MARKS[t]}"></span>`).join('')}${esc(name)}</h3><span class="dots"></span>${d.price ? `<span class="price">${esc(d.price)}</span>` : ''}</div>
          ${desc ? `<p>${esc(desc)}</p>` : ''}
          ${pills.length ? `<ul class="tags">${pills.map(t =>
            `<li class="${TAGS[t] ? 'tag-' + t : ''}">${esc(TAGS[t] || t)}</li>`).join('')}</ul>` : ''}
        </div></article>`;
      }).join('')}
    </section>`).join('');

  document.getElementById('note').textContent = note || '';
  // Content arrives after load, so the browser's own #anchor jump already missed.
  if (!rendered && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  rendered = true;
}
let rendered = false;

function renderError() {
  document.getElementById('menu').innerHTML = `<div class="error">
    <p>The menu could not be loaded. Please ask your waiter.</p>
    <p>Не удалось загрузить меню. Спросите официанта.</p></div>`;
}

async function main() {
  const cacheKey = 'bar-cache-v2';
  let data = JSON.parse(localStorage.getItem(cacheKey) || 'null');
  const draw = note => render(data, note);

  document.getElementById('langs').addEventListener('click', e => {
    const l = e.target.closest('[data-lang]')?.dataset.lang;
    if (!l || !data) return;
    lang = l;
    localStorage.setItem(LANG_KEY, l);
    draw(document.getElementById('note').textContent);
  });

  if (data) draw();
  try {
    // No .catch on the extra tabs: if the dry-day state can't be read, fall back to the cached menu
    // rather than show alcohol by mistake.
    const [items, sections, dry] = await Promise.all([
      fetchText(ITEMS_URL),
      fetchText(SECTIONS_URL),
      DRY_DAY_URL ? fetchText(DRY_DAY_URL) : '',
    ]);
    data = { items, sections, dry, at: Date.now() };
    localStorage.setItem(cacheKey, JSON.stringify(data));
    draw();
  } catch {
    if (data) draw(`Updated ${new Date(data.at).toLocaleString()}`);
    else renderError();
  }
}

if (typeof document !== 'undefined') main();
