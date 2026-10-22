/* A Quote A Day — app.js aligned with the current deckOverlay HTML and style.css */
const CONFIG = { REPO: 'AndrewVeda/a-quote-a-day', DATA_FILE: 'quotes.json' };
let DB = [], currentView = [], deckIdx = 0, currentTab = 'all';

const $ = id => document.getElementById(id);
const mastheadEl = $('masthead');
const deckOverlay = $('deckOverlay');
const deckTrack = $('deckTrack');
const dirPanel = $('dirPanel');
const dirBackdrop = $('dirBackdrop');
const filterBackdrop = $('filterSheetBackdrop');

if (mastheadEl) window.addEventListener('scroll', () => mastheadEl.classList.toggle('scrolled', window.scrollY > 20), { passive: true });
if ($('mastDateline')) $('mastDateline').textContent = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

function syncScrollLock() {
  const locked = !!(deckOverlay?.classList.contains('open') || dirPanel?.classList.contains('open') || filterBackdrop?.classList.contains('open'));
  document.body.style.overflow = locked ? 'hidden' : '';
}
function resetScroll() { window.scrollTo({ top: 0, behavior: 'instant' }); }
function formatDateLabel(dateStr) {
  if (!dateStr || dateStr === 'Unknown') return dateStr || 'Unknown';
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function normalizeEntry(r) {
  if (!r || !r.quote) return null;
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(r.dateStr || '') ? r.dateStr : (/^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : 'Unknown');
  return { id: r.id, quote: String(r.quote), author: r.author || 'Unknown', contributor: r.contributor || 'Anonymous', department: r.department || 'English', about: r.about || r.what_it_means_to_me || '', date: new Date(dateStr === 'Unknown' ? 0 : `${dateStr}T00:00:00`), dateStr };
}
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
const PUZZLE_BASE = 'https://andrewveda.com/verve/jigsaw';
function puzzleUrl(q) { return `${PUZZLE_BASE}?id=quote-${encodeURIComponent(q.id)}`; }
function puzzleUrlShort(q) { return `andrewveda.com/verve/jigsaw?id=quote-${q.id}`; }

// Startup: initialise each feature independently so a missing optional element cannot stop the archive.
document.addEventListener('DOMContentLoaded', async () => {
  await fetchArchive();
  setupNavigation();
  setupCompactMasthead();
  setupSwipeEngine();
  setupSearch();
  setupExportButtons();
  const id = new URLSearchParams(location.search).get('id');
  if (id) jumpToQuote(id);
});

async function fetchArchive() {
  try {
    const response = await fetch(CONFIG.DATA_FILE, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Could not load ${CONFIG.DATA_FILE} (${response.status})`);
    const rows = await response.json();
    DB = rows.map(normalizeEntry).filter(Boolean);
    DB.sort((a, b) => (b.date - a.date) || (Number(b.id) - Number(a.id)));
    if (!DB.length) throw new Error('Empty archive');
    if ($('mastCount')) $('mastCount').textContent = `${DB.length} Quotes`;
    renderGrid(DB);
  } catch (err) {
    console.error('Archive fetch error:', err);
    const main = $('mainContent');
    if (main) main.innerHTML = `<div class="empty-state"><p>⚠️ Could not load archive.</p><button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;border:1px solid var(--gold-border);border-radius:30px;cursor:pointer;font-family:var(--sans);background:var(--gold);color:white">Retry</button></div>`;
  } finally {
    if ($('loader')) $('loader').style.display = 'none';
  }
}

function renderGrid(quotes) {
  currentView = quotes;
  const container = $('mainContent');
  if (!container) return;
  if (!quotes.length) { container.innerHTML = '<p class="no-results">No quotes found.</p>'; return; }
  container.innerHTML = '';
  const grid = document.createElement('div'); grid.className = 'col-grid';
  quotes.forEach((q, i) => {
    const card = document.createElement('div');
    card.className = 'q-card'; card.style.animationDelay = `${Math.min(i * 40, 400)}ms`;
    card.tabIndex = 0; card.setAttribute('role', 'button'); card.setAttribute('aria-label', `Quote by ${q.author}`);
    const snippet = q.about.trim() ? `<div class="q-card-reflection">“${escapeHTML(q.about.length > 120 ? q.about.slice(0,117) + '…' : q.about)}”<span class="q-card-reflection-by"> — ${escapeHTML(q.contributor)}</span></div>` : '';
    card.innerHTML = `<div class="q-card-num">No. ${escapeHTML(q.id)} · ${escapeHTML(q.dateStr)}</div>
      <div class="q-card-text">“${escapeHTML(q.quote)}”</div>${snippet}
      <div class="q-card-footer"><div><div class="q-card-author">${escapeHTML(q.author)} <span class="q-card-contrib">via ${escapeHTML(q.contributor)}</span></div>
      <div class="q-card-dept">${escapeHTML(q.department)}</div><a class="q-card-puzzle" href="${puzzleUrl(q)}" target="_blank" rel="noopener" title="Solve this quote as a jigsaw puzzle">🧩 Puzzle</a></div><div class="q-card-arrow">→</div></div>`;
    card.addEventListener('click', e => { if (e.target.closest('.q-card-puzzle')) return; openDeck(quotes, i); });
    card.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.q-card-puzzle')) { e.preventDefault(); openDeck(quotes, i); } });
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

function setupSearch() {
  const input = $('searchInput'); if (!input) return;
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const query = input.value.trim().toLowerCase();
      if (!query) { if (currentTab === 'all') renderGrid(DB); return; }
      renderGrid(DB.filter(q => [q.quote, q.author, q.contributor, q.department, q.about].some(v => v.toLowerCase().includes(query))));
    }, 220);
  });
}

function setupNavigation() {
  document.querySelectorAll('.quick-tab').forEach(btn => btn.addEventListener('click', () => {
    const tab = btn.dataset.tab; currentTab = tab; resetScroll();
    if ($('searchInput')) $('searchInput').value = '';
    if ($('compactSearchInput')) $('compactSearchInput').value = '';
    document.querySelectorAll('.quick-tab').forEach(b => b.classList.toggle('active', b === btn));
    if (tab === 'all') { closeDirectory(); renderGrid(DB); }
    else if (tab === 'departments') { renderGroupedGrid('department'); openDirectory(tab); }
    else if (tab === 'contributors') { renderContributors(); openDirectory(tab); }
    else openDirectory(tab);
  }));
  $('deckClose')?.addEventListener('click', closeDeck);
  $('arrowPrev')?.addEventListener('click', () => moveDeck(-1));
  $('arrowNext')?.addEventListener('click', () => moveDeck(1));
  $('dirClose')?.addEventListener('click', closeDirectory);
  dirBackdrop?.addEventListener('click', closeDirectory);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (deckOverlay?.classList.contains('open')) closeDeck(); else if (dirPanel?.classList.contains('open')) closeDirectory(); else if (filterBackdrop?.classList.contains('open')) closeFilterSheet(); return; }
    if (!deckOverlay?.classList.contains('open') || e.target.closest('input,textarea,button,a')) return;
    if (e.key === 'ArrowRight') moveDeck(1);
    if (e.key === 'ArrowLeft') moveDeck(-1);
  });
}

function moveDeck(direction) {
  const next = deckIdx + direction;
  if (next < 0 || next >= currentView.length) return;
  deckIdx = next; updateDeckPosition();
}
function openDeck(quotes, index) {
  currentView = quotes; deckIdx = index;
  closeDirectory();
  if (!deckOverlay) { console.error('Missing #deckOverlay'); return; }
  deckOverlay.classList.add('open'); syncScrollLock(); updateDeckPosition();
}
function closeDeck() {
  deckOverlay?.classList.remove('open'); syncScrollLock();
  history.replaceState(null, '', location.pathname + location.hash);
}
function updateDeckPosition() {
  const q = currentView[deckIdx]; if (!q || !deckTrack) return;
  const reflection = q.about.trim() ? `<div class="dc-divider"></div><div class="dc-reflection-label">What this means to me</div><div class="dc-reflection">“${escapeHTML(q.about)}”</div>` : '';
  deckTrack.innerHTML = `<section class="deck-slide"><div class="deck-layout"><div class="deck-left"><article class="deck-card"><div class="dc-body">
    <div class="dc-kicker">Quote No. ${escapeHTML(q.id)} · ${escapeHTML(formatDateLabel(q.dateStr))}</div>
    <div class="dc-quote">“${escapeHTML(q.quote)}”</div><div class="dc-byline"><div class="dc-author">${escapeHTML(q.author)}</div><div class="dc-role">Quoted Author</div></div>
    <div class="dc-envelope"><div class="dc-env-label">Contributed by</div><div class="dc-contrib-name">${escapeHTML(q.contributor)}</div><div class="dc-contrib-dept">${escapeHTML(q.department)}</div>${reflection}</div></div>
    <div class="deck-action-row"><button class="btn-premium-action btn-whatsapp" id="shareQuoteBtn">📲 Share</button><a href="${puzzleUrl(q)}" target="_blank" rel="noopener" class="btn-premium-action">🧩 Solve as Puzzle</a><a href="https://andrewveda.github.io/a-quote-a-day/submissions" target="_blank" rel="noopener" class="btn-premium-action btn-submit">✏️ Add a Quote</a></div></article></div>
    <aside class="deck-right"><div class="deck-comments-label">Discussion</div><div class="giscus-mount" id="giscus-slot"></div></aside></div></section>`;
  if ($('deckCounter')) $('deckCounter').textContent = `${deckIdx + 1} / ${currentView.length}`;
  if ($('arrowPrev')) $('arrowPrev').disabled = deckIdx === 0;
  if ($('arrowNext')) $('arrowNext').disabled = deckIdx === currentView.length - 1;
  const progress = $('deckProgressWrap');
  if (progress) {
    progress.innerHTML = '';
    const maxDots = Math.min(currentView.length, 20);
    for (let i = 0; i < maxDots; i++) { const dot = document.createElement('span'); dot.className = 'progress-dot' + (i === Math.min(deckIdx, maxDots - 1) ? ' active' : ''); progress.appendChild(dot); }
  }
  history.replaceState(null, '', `?id=${encodeURIComponent(q.id)}`);
  $('shareQuoteBtn')?.addEventListener('click', shareCurrentQuote);
  loadGiscus();
}
function jumpToQuote(id) { const i = DB.findIndex(q => String(q.id) === String(id)); if (i >= 0) openDeck(DB, i); }

function loadGiscus() {
  const slot = $('giscus-slot'); const q = currentView[deckIdx]; if (!slot || !q) return;
  slot.replaceChildren();
  const script = document.createElement('script'); script.src = 'https://giscus.app/client.js';
  script.setAttribute('data-repo', CONFIG.REPO);
  script.setAttribute('data-repo-id', 'R_kgDORI8-yw');
  script.setAttribute('data-category', 'General');
  script.setAttribute('data-category-id', 'DIC_kwDORI8-y84C1-Jq');
  script.setAttribute('data-mapping', 'specific');
  script.setAttribute('data-term', `Quote ${q.id}: ${q.author} — ${q.contributor}`);
  script.setAttribute('data-strict', '1');
  script.setAttribute('data-reactions-enabled', '1');
  script.setAttribute('data-emit-metadata', '0');
  script.setAttribute('data-input-position', 'top');
  script.setAttribute('data-theme', 'dark_dimmed');
  script.setAttribute('data-lang', 'en'); script.crossOrigin = 'anonymous'; script.async = true;
  slot.appendChild(script);
}

function setupSwipeEngine() {
  if (!deckOverlay) return;
  let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
  deckOverlay.addEventListener('touchstart', e => { if (!e.touches[0]) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = dy = 0; dragging = true; }, { passive: true });
  deckOverlay.addEventListener('touchmove', e => { if (!dragging || !e.touches[0]) return; dx = e.touches[0].clientX - sx; dy = e.touches[0].clientY - sy; }, { passive: true });
  deckOverlay.addEventListener('touchend', () => { if (!dragging) return; dragging = false; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) moveDeck(dx < 0 ? 1 : -1); });
}

function closeFilterSheet() { filterBackdrop?.classList.remove('open'); syncScrollLock(); }
function setupCompactMasthead() {
  const searchBtn = $('compactSearchBtn'), searchBar = $('compactSearchBar'), compactInput = $('compactSearchInput'), mainInput = $('searchInput'), filterBtn = $('compactFilterBtn'), sheetTabs = $('filterSheetTabs');
  searchBtn?.addEventListener('click', () => {
    const opened = searchBar?.classList.toggle('open');
    if (opened) compactInput?.focus(); else { if (compactInput) compactInput.value = ''; if (mainInput) { mainInput.value = ''; mainInput.dispatchEvent(new Event('input')); } }
  });
  compactInput?.addEventListener('input', () => { if (mainInput) { mainInput.value = compactInput.value; mainInput.dispatchEvent(new Event('input')); } });
  filterBtn?.addEventListener('click', () => { filterBackdrop?.classList.add('open'); syncScrollLock(); });
  filterBackdrop?.addEventListener('click', e => { if (e.target === filterBackdrop) closeFilterSheet(); });
  sheetTabs?.addEventListener('click', e => { const btn = e.target.closest('.filter-sheet-tab'); if (!btn) return; const mainTab = document.querySelector(`.quick-tab[data-tab="${btn.dataset.tab}"]`); mainTab?.click(); closeFilterSheet(); });
  document.querySelectorAll('.quick-tab').forEach(btn => btn.addEventListener('click', () => sheetTabs?.querySelectorAll('.filter-sheet-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === btn.dataset.tab))));
  const from = $('sheetFromDateInput'), to = $('sheetToDateInput');
  if (from && to && DB.length) { const dated = DB.filter(q => q.dateStr !== 'Unknown').map(q => q.dateStr).sort(); if (dated.length) { from.value = dated[0]; to.value = dated[dated.length - 1]; } }
  $('sheetDownloadHtmlBtn')?.addEventListener('click', () => { const r = getSheetDateRange(); if (r) { downloadRangeAsHTML(r.from, r.to); closeFilterSheet(); } });
  $('sheetDownloadPdfBtn')?.addEventListener('click', () => { const r = getSheetDateRange(); if (r) { downloadRangeAsPDF(r.from, r.to); closeFilterSheet(); } });
}
function getSheetDateRange() {
  const fromInput = $('sheetFromDateInput'), toInput = $('sheetToDateInput');
  if (!fromInput?.value || !toInput?.value) { alert('Please choose both a "from" and "to" date.'); return null; }
  let from = fromInput.value, to = toInput.value; if (from > to) [from, to] = [to, from]; return { from, to };
}

function getInitials(name) { return String(name).trim().split(/\s+/).map(w => w[0]?.toUpperCase() || '').slice(0, 2).join(''); }
const CONTRIB_ACCENTS = [{bg:'#b8913a',fg:'#fff'},{bg:'#6b0f1a',fg:'#fff'},{bg:'#2d5a3d',fg:'#fff'},{bg:'#1a3a5c',fg:'#fff'},{bg:'#5c3d1a',fg:'#fff'},{bg:'#4a2060',fg:'#fff'},{bg:'#1c4a4a',fg:'#fff'}];
function accentForName(name) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return CONTRIB_ACCENTS[h % CONTRIB_ACCENTS.length]; }
function renderContributors() {
  const container = $('mainContent'); if (!container) return; container.innerHTML = '';
  const index = {};
  DB.forEach(q => { const key = q.contributor; if (!index[key]) index[key] = { name: key, department: q.department, quotes: [], latest: q.date }; index[key].quotes.push(q); if (q.date > index[key].latest) index[key].latest = q.date; });
  const contributors = Object.values(index).sort((a,b) => b.quotes.length - a.quotes.length);
  const podium = document.createElement('div'); podium.className = 'hof-section';
  podium.innerHTML = '<div class="hof-masthead"><div class="hof-rule"></div><div class="hof-title-wrap"><div class="hof-eyebrow">English Department</div><div class="hof-title">Hall of Fame</div><div class="hof-sub">Our most prolific voices</div></div><div class="hof-rule"></div></div>';
  const row = document.createElement('div'); row.className = 'hof-podium';
  const medals = ['🥇','🥈','🥉'];
  [1,0,2].forEach((rank,pos) => { const c = contributors[rank]; if (!c) return; const a = accentForName(c.name), latest = c.quotes[0]; const card = document.createElement('div'); card.className = `hof-card hof-rank-${rank+1}`; card.style.animationDelay = `${pos*100}ms`;
    card.innerHTML = `<div class="hof-medal">${medals[rank]}</div><div class="hof-avatar" style="background:${a.bg};color:${a.fg}">${escapeHTML(getInitials(c.name))}</div><div class="hof-name">${escapeHTML(c.name)}</div><div class="hof-dept">${escapeHTML(c.department)}</div><div class="hof-count"><span class="hof-count-num">${c.quotes.length}</span><span class="hof-count-label">${c.quotes.length===1?'quote':'quotes'}</span></div><div class="hof-preview">“${escapeHTML(latest.quote.length>80?latest.quote.slice(0,77)+'…':latest.quote)}”</div><button class="hof-view-btn">View all →</button>`;
    const show = () => { currentTab = 'all'; renderGrid(c.quotes); closeDirectory(); resetScroll(); }; card.querySelector('button').addEventListener('click', e => { e.stopPropagation(); show(); }); card.addEventListener('click', show); row.appendChild(card);
  });
  podium.appendChild(row); container.appendChild(podium);
  if (contributors.length > 3) { const h = document.createElement('div'); h.className = 'results-header'; h.style.marginTop = '48px'; h.textContent = `All ${contributors.length} Contributors`; container.appendChild(h); const grid = document.createElement('div'); grid.className = 'contrib-grid'; contributors.slice(3).forEach((c,i) => { const a = accentForName(c.name), latest = c.quotes[0], card = document.createElement('div'); card.className = 'contrib-card'; card.tabIndex = 0; card.setAttribute('role','button'); card.style.animationDelay = `${Math.min(i*30,400)}ms`; card.innerHTML = `<div class="contrib-card-top"><div class="contrib-avatar" style="background:${a.bg};color:${a.fg}">${escapeHTML(getInitials(c.name))}</div><div class="contrib-info"><div class="contrib-name">${escapeHTML(c.name)}</div><div class="contrib-dept">${escapeHTML(c.department)}</div></div><div class="contrib-badge">${c.quotes.length}</div></div><div class="contrib-preview">“${escapeHTML(latest.quote.length>100?latest.quote.slice(0,97)+'…':latest.quote)}”</div><div class="contrib-footer"><span class="contrib-author-tag">— ${escapeHTML(latest.author)}</span><span class="contrib-arrow">→</span></div>`; const show=()=>{renderGrid(c.quotes);closeDirectory();resetScroll();}; card.addEventListener('click',show); card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}}); grid.appendChild(card); }); container.appendChild(grid); }
}
function renderGroupedGrid(groupBy) {
  const container = $('mainContent'); if (!container) return; container.innerHTML = ''; const groups = {};
  DB.forEach(q => { const key = q[groupBy] || 'Other'; (groups[key] ||= []).push(q); });
  Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length).forEach(name => { const section=document.createElement('section'); section.className='dept-section'; const heading=document.createElement('div'); heading.className='dept-heading'; heading.innerHTML=`<span class="dept-heading-name">${escapeHTML(name)}</span><span class="dept-heading-count">${groups[name].length} ${groups[name].length===1?'quote':'quotes'}</span>`; section.appendChild(heading); const holder=document.createElement('div'); holder.className='col-grid'; const old=currentView; currentView=groups[name]; groups[name].forEach((q,i)=>{ const tmp=document.createElement('div'); tmp.className='q-card'; tmp.tabIndex=0; tmp.setAttribute('role','button'); tmp.style.animationDelay=`${Math.min(i*30,300)}ms`; const snippet=q.about.trim()?`<div class="q-card-reflection">“${escapeHTML(q.about.length>120?q.about.slice(0,117)+'…':q.about)}”<span class="q-card-reflection-by"> — ${escapeHTML(q.contributor)}</span></div>`:''; tmp.innerHTML=`<div class="q-card-num">No. ${escapeHTML(q.id)} · ${escapeHTML(q.dateStr)}</div><div class="q-card-text">“${escapeHTML(q.quote)}”</div>${snippet}<div class="q-card-footer"><div><div class="q-card-author">${escapeHTML(q.author)} <span class="q-card-contrib">via ${escapeHTML(q.contributor)}</span></div><div class="q-card-dept">${escapeHTML(q.department)}</div><a class="q-card-puzzle" href="${puzzleUrl(q)}" target="_blank" rel="noopener">🧩 Puzzle</a></div><div class="q-card-arrow">→</div></div>`; tmp.addEventListener('click',e=>{if(!e.target.closest('.q-card-puzzle'))openDeck(groups[name],i);}); tmp.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('.q-card-puzzle')){e.preventDefault();openDeck(groups[name],i);}}); holder.appendChild(tmp); }); currentView=old; section.appendChild(holder); container.appendChild(section); });
}
function openDirectory(category) {
  const list = $('dirList'); if (!list) return; list.innerHTML = '';
  const titleMap={authors:'Authors',contributors:'Contributors',departments:'Departments'}; if($('dirTitle')) $('dirTitle').textContent=titleMap[category]||'Directory';
  closeDeck(); const index={}; DB.forEach(q=>{const key=category==='authors'?q.author:category==='contributors'?q.contributor:q.department; (index[key] ||= []).push(q);});
  const names=Object.keys(index).sort((a,b)=>index[b].length-index[a].length); const noun={authors:'author',contributors:'contributor',departments:'department'}[category]||'entry';
  // dirSub is optional in the supplied HTML.
  if($('dirSub')) $('dirSub').textContent=`${names.length} ${noun}${names.length===1?'':'s'} · ${DB.length} quotes`;
  names.forEach(name=>{const row=document.createElement('div');row.className='dir-row';row.tabIndex=0;row.setAttribute('role','button');row.innerHTML=`<span class="dir-row-name">${escapeHTML(name)}</span><span class="dir-badge">${index[name].length}</span>`;const pick=()=>{currentTab='all';renderGrid(index[name]);closeDirectory();resetScroll();};row.addEventListener('click',pick);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();}});list.appendChild(row);});
  list.scrollTop=0; dirPanel?.classList.add('open'); dirBackdrop?.classList.add('open'); syncScrollLock();
}
function closeDirectory(){dirPanel?.classList.remove('open');dirBackdrop?.classList.remove('open');syncScrollLock();}

async function shareCurrentQuote(event) {
  const q=currentView[deckIdx]; const btn=event?.currentTarget; if(!q||!btn)return; const original=btn.innerHTML; btn.disabled=true; btn.textContent='Preparing…';
  try {
    const canvasHost=$('share-canvas-container'); if(!canvasHost) throw new Error('Share canvas container missing');
    canvasHost.innerHTML=`<div id="poster-export" style="width:540px;height:960px;background:#f5f0e8;display:flex;flex-direction:column;overflow:hidden;font-family:Georgia,serif;color:#1c1a16"><div style="background:#1c1a16;color:#b8913a;padding:22px 30px;font-style:italic;font-size:24px">A Quote A Day <span style="float:right;font:10px monospace">SRM VEC · No.${escapeHTML(q.id)}</span></div><div style="flex:1;padding:38px;display:flex;flex-direction:column;justify-content:center"><div style="font-size:${q.quote.length<90?42:30}px;line-height:1.25;font-style:italic">“${escapeHTML(q.quote)}”</div><div style="border-top:2px solid #b8913a;margin-top:28px;padding-top:18px;font-size:28px;font-weight:bold">${escapeHTML(q.author)}</div><div style="font:10px monospace;color:#b8913a;margin-top:8px">QUOTED AUTHOR</div></div><div style="background:#b8913a;padding:22px 36px;font-size:26px;font-weight:bold">${escapeHTML(q.contributor)}<div style="font:10px monospace;margin-top:6px">${escapeHTML(q.department)}</div></div>${q.about?`<div style="background:#1c1a16;color:#f5f0e8;padding:22px 32px;font-style:italic">${escapeHTML(q.about)}</div>`:''}<div style="background:#1c1a16;color:#b8913a;padding:12px 30px;font:9px monospace">andrewveda.github.io/a-quote-a-day · ${escapeHTML(q.dateStr)}<br>${puzzleUrlShort(q)}</div></div>`;
    const canvas=await html2canvas($('poster-export'),{scale:2,useCORS:true,backgroundColor:'#f5f0e8'}); const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92)); if(!blob) throw new Error('Could not create image'); const file=new File([blob],`Quote-${q.id}.jpg`,{type:'image/jpeg'}); const shareUrl=`https://andrewveda.github.io/a-quote-a-day/?id=${encodeURIComponent(q.id)}`; const text=`Check out this reflection by ${q.contributor.toUpperCase()} on SRM VEC English Archive.\n\n🔗 ${shareUrl}\n🧩 Solve it as a puzzle: ${puzzleUrl(q)}`;
    if(navigator.canShare?.({files:[file]})) await navigator.share({files:[file],text}); else {const a=document.createElement('a');a.href=canvas.toDataURL('image/jpeg',0.92);a.download=`Quote-${q.id}.jpg`;a.click();}
  } catch(err){if(err.name!=='AbortError') {console.error('Share error:',err);alert('Could not prepare the share image.');}} finally{btn.innerHTML=original;btn.disabled=false;}
}

function getQuotesInRange(from,to){return DB.filter(q=>q.dateStr!=='Unknown'&&q.dateStr>=from&&q.dateStr<=to).sort((a,b)=>a.dateStr.localeCompare(b.dateStr)||Number(a.id)-Number(b.id));}
function quoteBlockHTML(q){return `<article style="margin:0 0 3rem;page-break-inside:avoid"><div style="font:11px monospace;color:#b8913a;letter-spacing:2px">QUOTE #${escapeHTML(q.id)} · ${escapeHTML(formatDateLabel(q.dateStr))}</div><blockquote style="font-size:24px;font-weight:600;font-style:italic;line-height:1.4">“${escapeHTML(q.quote)}”</blockquote><strong style="font-size:18px">${escapeHTML(q.author)}</strong><div style="font:11px monospace;color:#6b3f10">Contributed by ${escapeHTML(q.contributor)} · ${escapeHTML(q.department)}</div>${q.about?`<div style="background:#1c1a16;color:#f5f0e8;padding:1.5rem;margin-top:1rem"><div style="font:10px monospace;color:#b8913a">WHAT THIS MEANS TO ME</div><div style="font-style:italic">“${escapeHTML(q.about)}”</div></div>`:''}<p style="margin-top:1rem"><a href="${puzzleUrl(q)}" style="color:#b8913a">🧩 Solve this as a puzzle</a></p></article><hr style="border:0;border-top:1px dashed #d3cec4;margin:2rem 0">`;}
function generateRangeTemplate(from,to){const quotes=getQuotesInRange(from,to);if(!quotes.length)return null;let sections='';const grouped={};quotes.forEach(q=>(grouped[q.dateStr] ||= []).push(q));Object.keys(grouped).sort().forEach(date=>{sections+=`<h2 style="font:11px monospace;color:#b8913a;letter-spacing:3px;border-bottom:1px solid #d3cec4;padding-bottom:.5rem">${escapeHTML(formatDateLabel(date))}</h2>${grouped[date].map(quoteBlockHTML).join('')}`;});return `<main style="background:white;padding:4rem;max-width:800px;margin:auto;font-family:Georgia,serif;color:#1c1a16"><header style="text-align:center;border-bottom:2px solid #b8913a;padding-bottom:1rem;margin-bottom:2rem"><h1 style="font-style:italic">A Quote A Day</h1><p>${escapeHTML(formatDateLabel(from))} — ${escapeHTML(formatDateLabel(to))}</p><p>${quotes.length} ${quotes.length===1?'Quote':'Quotes'}</p></header>${sections}<footer style="text-align:center;font:10px monospace;color:#888">andrewveda.github.io/a-quote-a-day</footer></main>`;}
function downloadRangeAsHTML(from,to){const body=generateRangeTemplate(from,to);if(!body){alert('No quotes found in that date range.');return;}const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Quotes ${from} to ${to}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#f5f0e8;padding:2rem 1rem;margin:0;line-height:1.6} @media(max-width:600px){main{padding:1.25rem!important}}</style></head><body>${body}</body></html>`;downloadBlob(html,`Quotes_${from}_to_${to}.html`,'text/html');}
function downloadBlob(content,filename,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function downloadRangeAsPDF(from,to){const quotes=getQuotesInRange(from,to);if(!quotes.length){alert('No quotes found in that date range.');return;}if(!window.jspdf?.jsPDF||!window.html2canvas){alert('PDF libraries did not load. Please refresh and try again.');return;}const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;width:800px';document.body.appendChild(host);try{const {jsPDF}=window.jspdf;const pdf=new jsPDF('p','pt','a4');const pages=[{cover:true},...quotes.map(q=>({q}))];for(let i=0;i<pages.length;i++){host.innerHTML=pages[i].cover?`<div style="width:800px;height:1131px;box-sizing:border-box;background:#f5f0e8;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:4rem;font-family:Georgia,serif"><div style="font:11px monospace;letter-spacing:4px;color:#b8913a">ENGLISH DEPARTMENT WISDOM ARCHIVE</div><h1 style="font-size:56px;font-style:italic">A Quote A Day</h1><p>${escapeHTML(formatDateLabel(from))} — ${escapeHTML(formatDateLabel(to))}</p><p>${quotes.length} quotes</p></div>`:`<div style="width:800px;min-height:1131px;box-sizing:border-box;background:#fff;padding:5rem 4.5rem;font-family:Georgia,serif;color:#1c1a16"><div style="font:11px monospace;color:#b8913a">QUOTE #${escapeHTML(pages[i].q.id)} · ${escapeHTML(formatDateLabel(pages[i].q.dateStr))}</div><blockquote style="font-size:32px;font-weight:bold;font-style:italic;line-height:1.42">“${escapeHTML(pages[i].q.quote)}”</blockquote><h2>${escapeHTML(pages[i].q.author)}</h2><div style="font:11px monospace;color:#6b3f10">CONTRIBUTED BY ${escapeHTML(pages[i].q.contributor)} · ${escapeHTML(pages[i].q.department)}</div>${pages[i].q.about?`<div style="border-top:2px solid #b8913a;margin-top:2rem;padding-top:1rem"><div style="font:10px monospace;color:#b8913a">WHAT THIS MEANS TO ME</div><p style="font-style:italic;font-size:17px">“${escapeHTML(pages[i].q.about)}”</p></div>`:''}<p style="margin-top:2rem;color:#b8913a">🧩 Solve as a puzzle: ${escapeHTML(puzzleUrlShort(pages[i].q))}</p></div>`;await new Promise(r=>setTimeout(r,80));const canvas=await html2canvas(host.firstElementChild,{scale:1.5,backgroundColor:pages[i].cover?'#f5f0e8':'#ffffff'});if(i)pdf.addPage();const pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight();const ratio=Math.min(pw/canvas.width,ph/canvas.height);const w=canvas.width*ratio,h=canvas.height*ratio;pdf.addImage(canvas.toDataURL('image/jpeg',0.92),'JPEG',(pw-w)/2,(ph-h)/2,w,h);}pdf.save(`Quotes_${from}_to_${to}.pdf`);}catch(err){console.error('PDF generation failed:',err);alert('Failed to generate PDF.');}finally{host.remove();}}
function setupExportButtons(){ $('btnDownloadHtml')?.addEventListener('click',()=>{const q=currentView[deckIdx];if(q&&q.dateStr!=='Unknown')downloadRangeAsHTML(q.dateStr,q.dateStr);}); $('btnDownloadPdf')?.addEventListener('click',()=>{const q=currentView[deckIdx];if(q&&q.dateStr!=='Unknown')downloadRangeAsPDF(q.dateStr,q.dateStr);}); }
