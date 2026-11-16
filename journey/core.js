'use strict';
// Shared state and helpers for the journey screens. Classic script: every screen file reads
// globalThis.StatFighter.kit, so the app still runs from file:// without modules or a build step.
{
  const { methods, content, stats } = globalThis.StatFighter;
  const kit = { methods, content, stats, screens: {} };
  globalThis.StatFighter.kit = kit;

  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = new Intl.NumberFormat('en-US');
  const pct = value => `${(value * 100).toFixed(2)}%`;
  Object.assign(kit, { escape, fmt, pct, root: document.querySelector('#screen') });

  // ---- Fighters and districts ----
  // A fighter is listed when it has a method, content and finished art.
  const listed = id => Boolean(methods[id] && content.fighters[id] && !content.fighters[id].artPending);
  const regionBy = id => content.regions.find(region => region.id === (content.regionAliases?.[id] ?? id)) ?? content.regions[0];
  const playable = (regionId = null) => (regionId ? regionBy(regionId).roster : content.regions.flatMap(region => region.roster))
    .filter(listed).map(id => [id, content.fighters[id]]);
  const firstId = playable()[0][0];
  Object.assign(kit, { listed, regionBy, playable, firstId });

  // ---- Per-fighter drafts and settings ----
  const storageKey = 'stat-fighter:journey:v2';
  const scoresKey = 'stat-fighter:scores:v1';
  const states = Object.fromEntries(Object.values(methods).map(m => [m.id, { draft: { ...m.defaults }, outcome: null, stale: false }]));
  const settings = { effects: true };
  let activeId = firstId;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved) {
      for (const m of Object.values(methods)) for (const key of Object.keys(m.defaults)) {
        if (typeof saved.drafts?.[m.id]?.[key] === 'string') states[m.id].draft[key] = saved.drafts[m.id][key];
      }
      if (methods[saved.activeId] && content.fighters[saved.activeId]) activeId = saved.activeId;
      if (typeof saved.effects === 'boolean') settings.effects = saved.effects;
    } else {
      const legacy = JSON.parse(localStorage.getItem('stat-fighter:journey:v1'));
      if (legacy?.draft) for (const key of Object.keys(methods[firstId].defaults)) if (typeof legacy.draft[key] === 'string') states[firstId].draft[key] = legacy.draft[key];
      if (typeof legacy?.effects === 'boolean') settings.effects = legacy.effects;
    }
  } catch { /* Local-file/private contexts may not provide storage. */ }
  for (const m of Object.values(methods)) if (!m.modes.some(mode => mode.id === states[m.id].draft.mode)) states[m.id].draft.mode = m.defaults.mode;
  kit.states = states;
  kit.settings = settings;

  // Draft keys that never change the verified number (dropout allowance, enrolment step).
  kit.extraKeys = m => [...(m.dropout === false ? [] : ['dropout']), ...(m.extraFields ?? [])];
  kit.coreDraft = (m, raw) => Object.fromEntries(Object.entries(raw).filter(([key]) => !kit.extraKeys(m).includes(key)));

  // Rotating lines: one stable pick per fighter until the next successful calculation. The seed
  // is never re-rolled on input events and is not saved.
  kit.newSeed = () => Math.floor(Math.random() * 1e6);
  kit.pool = (f, key) => [f[key], ...(f[key + 'More'] ?? [])].filter(Boolean);
  kit.pick = (list, salt = 0) => list[(kit.state.seed + salt) % list.length];
  kit.save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ activeId: kit.activeId, effects: settings.effects, drafts: Object.fromEntries(Object.entries(states).map(([id, s]) => [id, s.kept ?? s.draft])) }));
    } catch { /* storage unavailable */ }
  };
  kit.choose = id => {
    kit.activeId = id; kit.method = methods[id]; kit.fighter = content.fighters[id]; kit.state = states[id];
    if (!Number.isInteger(kit.state.seed)) kit.state.seed = kit.newSeed();
    kit.save();
  };
  kit.choose(activeId);
  kit.regionId = kit.fighter.region;
  kit.routeError = '';
  kit.emit = name => window.dispatchEvent(new CustomEvent(`statfighter:${name}`, { detail: { method: kit.activeId } }));
  kit.motion = () => settings.effects && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Hi-score table: the last ten plans, on this device only ----
  kit.scores = () => {
    try {
      const list = JSON.parse(localStorage.getItem(scoresKey));
      return Array.isArray(list) ? list.filter(entry => entry && methods[entry.id] && Number.isFinite(entry.total)) : [];
    } catch { return []; }
  };
  kit.recordScore = entry => {
    try { localStorage.setItem(scoresKey, JSON.stringify([entry, ...kit.scores()].slice(0, 10))); } catch { /* storage unavailable */ }
  };
  kit.clearScores = () => { try { localStorage.removeItem(scoresKey); } catch { /* storage unavailable */ } };
  kit.scoreText = value => String(value).padStart(6, '0');

  // ---- Paths ----
  kit.path = (stage, id = kit.activeId) => `#${stage}?test=${encodeURIComponent(id)}`;
  kit.regionPath = (id = kit.regionId) => `#continent?region=${encodeURIComponent(id)}`;
  kit.urlFor = (raw, run = false) => '#arena?' + new URLSearchParams({ v: '1', test: kit.activeId, ...raw, ...(run ? { run: '1' } : {}) }).toString();
  // Keep the address bar in step with the draft. Safari throws a SecurityError when replaceState is
  // called too often (holding ▲ on a number field), so a refused update is retried once things settle.
  let urlTimer = 0;
  kit.replaceUrl = url => {
    clearTimeout(urlTimer);
    try { history.replaceState(null, '', url); } catch { urlTimer = setTimeout(() => kit.replaceUrl(url), 2000); }
  };
  window.addEventListener('hashchange', () => clearTimeout(urlTimer));

  // ---- Markup helpers ----
  kit.helpButton = (id, label = 'Help') => `<button type="button" class="j-help" data-help="${id}" aria-label="${escape(label)}">?</button>`;
  kit.action = (href, label, primary = false, extra = '') => `<a class="j-button${primary ? ' hot' : ''}" href="${href}" ${extra}>${label}<span aria-hidden="true">▶</span></a>`;
  kit.heading = (kicker, title, sub = '') => `<header class="j-heading"><p class="j-kicker">${kicker}</p><h1 id="main-heading" tabindex="-1">${title}</h1>${sub ? `<p>${sub}</p>` : ''}</header>`;
  // Portrait, or an accent-coloured silhouette while a fighter's art is still being made.
  kit.portrait = (person, className = '', { alt = person.alt, lazy = false } = {}) => person.artPending
    ? `<div class="j-portrait j-silhouette ${className}" style="--accent:${person.accent}" role="img" aria-label="${escape(alt)} Artwork coming soon."><i></i><b>${escape(person.name)}</b></div>`
    : `<div class="j-portrait ${className}"><img src="${person.image}" width="1024" height="1536" ${lazy ? 'loading="lazy" decoding="async"' : ''} alt="${escape(alt)}"></div>`;
  // Small tier for tiles and avatars: assets/thumb/ holds 192 × 288 copies (scripts/make-thumbs.sh).
  kit.thumbPath = image => image.replace('/assets/web/', '/assets/thumb/');
  kit.thumb = person => person.artPending
    ? `<span class="j-thumb j-silhouette" style="--accent:${person.accent}" aria-hidden="true"><i></i></span>`
    : `<img class="j-thumb" src="${kit.thumbPath(person.image)}" width="192" height="288" decoding="async" alt="">`;
  kit.stageStyle = person => person.artPending ? '' : `background-image:url('${person.stageImage}')`;
  // The Null: a faceless hooded figure drawn in CSS until its portrait arrives.
  kit.nullFigure = (className = '') => content.cpu.image
    ? `<div class="j-null ${className}"><img src="${content.cpu.image}" width="1024" height="1536" alt="${escape(content.cpu.alt)}"></div>`
    : `<div class="j-null ${className}" role="img" aria-label="${escape(content.cpu.alt)}"><i class="hood"></i><i class="face"></i><i class="coat"></i><i class="arms"></i></div>`;
  kit.bubble = (html, className = '') => `<div class="j-bubble ${className}">${html}</div>`;

  // Link other fighters named in a sentence (e.g. "Two unrelated groups need Maverick").
  kit.linkFighters = text => {
    let html = escape(text);
    for (const [id, f] of playable()) {
      if (id === kit.activeId) continue;
      html = html.replace(new RegExp(`\\b${f.name}\\b`, 'g'), `<a class="j-inline-link" href="${kit.path('profile', id)}">${f.name}</a>`);
    }
    return html;
  };

  // ---- Shared arcade frame ----
  kit.hud = () => {
    const mine = kit.scores().find(entry => entry.id === kit.activeId), all = kit.scores();
    const hi = all.length ? Math.max(...all.map(entry => entry.total)) : 0;
    return `<div class="j-hud"><span class="j-hud-1up">1UP <b>${escape(kit.fighter.name.toUpperCase())}</b> <span>${kit.scoreText(mine?.total ?? 0)}</span></span><a class="j-hud-hi" href="#scores">HI<span class="j-hud-long">-SCORE</span> <b>${kit.scoreText(hi)}</b></a><button type="button" class="j-hud-coin" data-coin><span class="j-hud-long">2UP </span><b>INSERT COIN</b></button></div>`;
  };
  kit.cabinet = (body, hint = 'EXPLORE THE WORLD. FIND YOUR FIGHT.') => `<div class="cabinet">${kit.hud()}${body}<div class="j-bottom"><span aria-hidden="true">◆</span> ${hint} <span aria-hidden="true">◆</span></div></div>`;

  // Five stat bars: four honest method properties, then the fighter's flavour trait, always full.
  kit.statBars = (f, idPrefix = 'stat') => {
    const rows = [['CALC ACCURACY', f.stats.accuracy[0], `How this app computes power and sample size: ${f.stats.accuracy[1]}`], ['ROBUSTNESS', ...f.stats.robustness], ['EFFICIENCY', ...f.stats.efficiency], ['FLEXIBILITY', ...f.stats.flexibility], [f.trait, 10, 'Flavour trait. Always maxed out.']];
    return `<ul class="j-stats" aria-label="${escape(f.name)} stats">${rows.map(([label, value, reason], i) => `<li class="j-stat" tabindex="0" aria-describedby="${idPrefix}-${i}"><span class="j-stat-label">${escape(label)}</span><span class="j-stat-bar" style="--v:${value}" aria-hidden="true"></span><b>${value}<span class="sr-only"> out of 10</span></b><small id="${idPrefix}-${i}" class="j-stat-why">${escape(reason)}</small></li>`).join('')}</ul>`;
  };
}
