'use strict';
{
  const { methods, content, stats } = globalThis.StatFighter;
  const root = document.querySelector('#screen');
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = new Intl.NumberFormat('en-US');
  const pct = value => `${(value * 100).toFixed(2)}%`;
  const storageKey = 'stat-fighter:journey:v2';
  const firstId = Object.keys(content.fighters).find(id => methods[id]);
  const states = Object.fromEntries(Object.values(methods).map(m => [m.id, { draft: { ...m.defaults }, outcome: null, stale: false }]));
  let activeId = firstId;
  const settings = { effects: true };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved) {
      for (const m of Object.values(methods)) for (const key of Object.keys(m.defaults)) {
        if (typeof saved.drafts?.[m.id]?.[key] === 'string') states[m.id].draft[key] = saved.drafts[m.id][key];
      }
      if (methods[saved.activeId]) activeId = saved.activeId;
      if (typeof saved.effects === 'boolean') settings.effects = saved.effects;
    } else {
      const legacy = JSON.parse(localStorage.getItem('stat-fighter:journey:v1'));
      if (legacy?.draft) for (const key of Object.keys(methods[firstId].defaults)) if (typeof legacy.draft[key] === 'string') states[firstId].draft[key] = legacy.draft[key];
      if (typeof legacy?.effects === 'boolean') settings.effects = legacy.effects;
    }
  } catch { /* Local-file/private contexts may not provide storage. */ }
  for (const m of Object.values(methods)) if (!m.modes.some(mode => mode.id === states[m.id].draft.mode)) states[m.id].draft.mode = m.defaults.mode;
  let method = methods[activeId], fighter = content.fighters[activeId], state = states[activeId];
  let regionId = fighter.region;
  let routeError = '';
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify({ activeId, effects: settings.effects, drafts: Object.fromEntries(Object.entries(states).map(([id, s]) => [id, s.kept ?? s.draft])) })); } catch {} };
  const choose = id => { activeId = id; method = methods[id]; fighter = content.fighters[id]; state = states[id]; save(); };
  const emit = name => window.dispatchEvent(new CustomEvent(`statfighter:${name}`, { detail: { method: activeId } }));
  const helpButton = (id, label = 'Help') => `<button type="button" class="j-help" data-help="${id}" aria-label="${escape(label)}">?</button>`;
  const action = (href, label, primary = false) => `<a class="j-button${primary ? ' hot' : ''}" href="${href}">${label}<span aria-hidden="true">▶</span></a>`;
  const regionBy = id => content.regions.find(region => region.id === id) ?? content.regions[0];
  const regionPath = (id = regionId) => `#continent?region=${encodeURIComponent(id)}`;
  const path = (stage, id = activeId) => `#${stage}?test=${encodeURIComponent(id)}`;
  const heading = (kicker, title, sub = '') => `<header class="j-heading"><p class="j-kicker">${kicker}</p><h1 id="main-heading" tabindex="-1">${title}</h1>${sub ? `<p>${sub}</p>` : ''}</header>`;
  const portrait = (person = fighter, className = '') => `<div class="j-portrait ${className}"><img src="${person.image}" width="1024" height="1536" alt="${escape(person.alt)}"></div>`;
  const cabinet = (body, hint = 'EXPLORE THE WORLD. FIND YOUR FIGHT.') => `<div class="cabinet"><div class="j-hud"><span>1P <b>READY</b></span><a href="#world">STAT FIGHTER ’89</a><span>TOUR STOP <b>${regionBy(regionId).number}</b></span></div>${body}<div class="j-bottom"><span aria-hidden="true">◆</span> ${hint} <span aria-hidden="true">◆</span></div></div>`;
  const playable = (region = null) => Object.entries(content.fighters).filter(([id, f]) => methods[id] && (!region || f.region === region));
  const isOpen = region => playable(region.id).length > 0;
  function rosterStrip(region = fighter.region) {
    return `<nav class="j-roster-strip" aria-label="${regionBy(region).name} fighters" data-arrow-nav>${playable(region).map(([id, f]) => `<a class="j-roster-slot ${id === activeId ? 'selected' : ''}" href="${path('profile', id)}" ${id === activeId ? 'aria-current="true"' : ''}><img src="${f.image}" width="1024" height="1536" loading="lazy" decoding="async" alt=""><span><b>${f.number} ${f.name}</b><small>${f.test}</small><em>MEET FIGHTER ▶</em></span></a>`).join('')}</nav>`;
  }
  function title() {
    const featured = content.fighters[firstId];
    return cabinet(`<section class="j-title-screen"><div class="j-title-copy"><p class="j-kicker">AN ARCADE FOR CURIOUS MINDS</p><h1 class="j-logo" id="main-heading" tabindex="-1">STAT<br>FIGHTER<span>’89</span></h1><p class="j-tagline">Big hair. Small p-values.<br>A world of statistical characters awaits.</p><nav class="j-menu" aria-label="Main menu" data-arrow-nav>${action('#world', 'START JOURNEY', true)}${action('#select', 'QUICK SELECT')}<button class="j-button" data-help="play">HOW TO PLAY <span>?</span></button><button class="j-button" data-options>OPTIONS <span>⚙</span></button></nav><p class="j-small">WORLD TOUR — ${playable().length} FIGHTERS / ${content.regions.filter(isOpen).length} PLAYABLE DISTRICTS</p></div>${portrait(featured, 'title-portrait')}</section>`, 'PRESS START. BRING YOUR CURIOSITY.');
  }
  function world() {
    const selected = regionBy(regionId);
    return cabinet(`${heading('WORLD SELECT / EARTH', 'Choose your continent', 'A world tour of statistical questions. One very questionable dress code.')}${routeError ? `<p class="j-error">${escape(routeError)}</p>` : ''}<div class="j-world-layout"><div class="j-map frame"><img src="${content.worldMap.image}" width="${content.worldMap.width}" height="${content.worldMap.height}" alt="${content.worldMap.alt}"><div class="j-map-pins" data-arrow-nav>${content.regions.map(r => `<button class="j-pin ${isOpen(r) ? 'open' : ''}" style="left:${r.x}%;top:${r.y}%" data-region="${r.id}" aria-label="${r.name}${isOpen(r) ? ', playable' : ', coming later'}" aria-pressed="${r.id === regionId}">${r.number}</button>`).join('')}</div><span class="j-map-caption">EARTH / WORLD TOUR / SELECT A SIGNAL</span></div><aside class="j-region-detail frame"><p class="j-kicker">TRANSMISSION ${selected.number}</p><h2>${selected.name}</h2><p class="j-region-tag">${selected.tag}</p><p>${selected.description}</p><p class="j-status">${isOpen(selected) ? '● DISTRICT AVAILABLE' : '○ COMING LATER'}</p>${isOpen(selected) ? action(regionPath(selected.id), `ENTER ${selected.name.toUpperCase()}`, true) : '<p class="j-small">This district opens in a later chapter. Choose a playable signal to meet its fighters.</p>'}</aside></div><nav class="j-region-list" aria-label="Continents" data-arrow-nav>${content.regions.map(r => `<button data-region="${r.id}" aria-pressed="${r.id === regionId}"><span>${r.number}</span>${r.name}<small>${isOpen(r) ? 'PLAYABLE' : 'LATER'}</small></button>`).join('')}</nav>`, 'SELECT A SIGNAL • ENTER A DISTRICT');
  }
  function continent() {
    const region = regionBy(regionId), roster = playable(region.id);
    return cabinet(`${heading(`TOUR STOP ${region.number} / ${region.name.toUpperCase()}`, `Welcome to ${region.name}`, region.tagline)}<div class="j-continent-layout"><div class="j-local-map frame"><img src="${content.worldMap.image}" width="${content.worldMap.width}" height="${content.worldMap.height}" alt="${content.worldMap.alt}"><div class="j-location"><span class="j-kicker">NEXT DESTINATION</span><h2>${fighter.stage}</h2><p>${fighter.name} is waiting. Choose a fighter below or continue your visit.</p>${action(path('profile'), `MEET ${fighter.name.toUpperCase()}`, true)}</div></div><aside class="j-arrival frame"><p class="j-kicker">YOUR FIRST OPPONENT?</p><h2>Uncertainty.</h2><p>${roster.length} ${roster.length === 1 ? 'fighter' : 'fighters'}. A clear study question.</p><blockquote>“${region.quote}”</blockquote><p>${region.introduction}</p><a class="j-text-link" href="#world">← Back to the world</a></aside></div>${rosterStrip(region.id)}`, `${region.name.toUpperCase()} / PICK YOUR STUDY QUESTION`);
  }
  function select() {
    return cabinet(`${heading('QUICK SELECT / WORLD TOUR', 'Choose your fighter', 'Meet the character or go straight to their arena. Each fighter keeps a separate draft.')}${routeError ? `<p class="j-error">${escape(routeError)}</p>` : ''}<div class="j-quick-grid" data-arrow-nav>${playable().map(([id, f]) => `<article class="j-quick-card frame"><a class="j-quick-portrait" href="${path('profile', id)}"><img src="${f.image}" width="1024" height="1536" loading="lazy" decoding="async" alt="${escape(f.alt)}"></a><div><p class="j-kicker">FIGHTER ${f.number} / ${regionBy(f.region).name.toUpperCase()}</p><h2>${f.name}</h2><p>${f.test}</p><p class="j-small">${f.choose}</p>${action(path('arena', id), 'ENTER ARENA', true)}<a class="j-text-link" href="${path('profile', id)}">Meet ${f.name} →</a></div></article>`).join('')}</div>`, `${playable().length} FIGHTERS / CHOOSE YOUR METHOD`);
  }
  function profile() {
    const fighters = playable(fighter.region), index = fighters.findIndex(([id]) => id === activeId);
    const previous = fighters[(index - 1 + fighters.length) % fighters.length], next = fighters[(index + 1) % fighters.length];
    return cabinet(`<nav class="j-profile-nav" aria-label="Browse fighters">${action(path('profile', previous[0]), `← ${previous[1].name}`)}<a class="j-text-link" href="#select">QUICK SELECT</a>${action(path('profile', next[0]), `${next[1].name} →`)}</nav><div class="j-profile-layout">${portrait()}<section class="j-profile-copy">${heading(`FIGHTER ${fighter.number} / ${regionBy(fighter.region).name.toUpperCase()}`, fighter.name, fighter.title)}<p class="j-test-label">${fighter.test}</p><blockquote class="j-speech">“${fighter.quote}”</blockquote><div class="j-move"><span>SPECIAL MOVE</span><strong>${fighter.move}</strong><span aria-hidden="true">↗</span></div><p>${fighter.bio}</p><p class="j-aside">${fighter.joke}</p><div class="j-flavour"><span>${fighter.trait}</span><span class="j-segments" aria-label="Maximum ${fighter.trait.toLowerCase()}">▰▰▰▰▰▰▰▰</span><span>${fighter.weakness}</span><span class="j-segments" aria-label="Very little ${fighter.weakness.toLowerCase()}">▰▰<i>▰▰▰▰▰▰</i></span></div><div class="j-briefing"><h2>Pick me when…</h2><p>${fighter.choose}</p><p class="j-small">${fighter.avoid}</p>${helpButton('assumptions', 'Read study assumptions')}</div>${action(path('arena'), 'ENTER THE ARENA', true)}<a class="j-text-link" href="${regionPath(fighter.region)}">← Return to ${regionBy(fighter.region).name}</a></section></div>${rosterStrip()}`, `${fighter.name.toUpperCase()} / ${fighter.move.toUpperCase()} / READY`);
  }
  function field(id) {
    const f = method.fields[id];
    return `<div class="j-field"><div class="j-field-label"><label for="j-${id}">${f.label}</label>${helpButton(id, `Help with ${f.label}`)}</div>${f.options ? `<select id="j-${id}" name="${id}" required aria-describedby="j-hint-${id}">${f.options.map(option => `<option value="${escape(option.value)}" ${state.draft[id] === option.value ? 'selected' : ''}>${escape(option.label)}</option>`).join('')}</select>` : `<input id="j-${id}" name="${id}" type="number" step="${f.step}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} value="${escape(state.draft[id])}" required aria-describedby="j-hint-${id}">`}<small id="j-hint-${id}">${f.hint}</small>${f.presets ? `<div class="j-presets" aria-label="${f.label} presets">${f.presets.map(value => `<button type="button" data-preset="${id}:${value}" aria-label="Set ${f.label} to ${value}">${value}</button>`).join('')}</div>` : ''}</div>`;
  }
  function resultPanel() {
    const { outcome, stale } = state;
    if (!outcome) return `<div class="j-waiting"><div class="j-versus" aria-hidden="true">VS</div><h2>THE UNKNOWN</h2><p>${fighter.waiting}</p><p>Set your parameters.<br>${method.waitingAction ?? 'Find the sample size.'}<br>Make a grand entrance.</p><div class="j-empty-score">N = ?</div><span class="j-kicker">AWAITING YOUR MOVE</span></div>`;
    const { parameters: p, result: r, raw } = outcome;
    return `<div class="j-result-head"><p class="j-kicker">${stale ? 'PARAMETERS CHANGED' : 'CALCULATION COMPLETE'}</p><h2>${stale ? 'Ready for a rematch?' : fighter.resultTitle}</h2></div>${stale ? '<p class="j-stale" role="status">Previous result — recalculate to update. Copy and share are paused.</p>' : ''}<div class="j-score"><span>${method.scoreLabel ?? 'REQUIRED SAMPLE SIZE'}</span><strong>${fmt.format(r.total)}</strong><span>${method.totalLabel}</span></div><div class="j-group-counts">${method.allocations(r, p).map(([label, value]) => `<div>${escape(label.toUpperCase())}<strong>${fmt.format(value)}</strong></div>`).join('')}</div><div class="j-power-label"><span>${method.powerLabel ?? 'ACHIEVED POWER'}</span><b>${pct(r.power)}</b></div><meter min="0" max="1" value="${r.power}" aria-label="Achieved power">${pct(r.power)}</meter><p class="j-small">Target ${pct(p.power)} · Complete, analyzable ${method.unit}. No dropout allowance.</p>${method.calculationNote ? `<p class="j-small j-calculation-note">${escape(method.calculationNote)}</p>` : ''}<details class="j-receipt"><summary>View the calculation receipt</summary><dl><dt>Method</dt><dd>${method.name}</dd>${method.receipt(raw, p, r).map(([label, value]) => `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join('')}<dt>Engine / method</dt><dd>${stats.version ?? '1'} / ${method.version}</dd></dl><p>${method.allocationRule}</p></details><button class="j-edit-inputs j-text-link" data-edit-inputs type="button">↑ Edit parameters / Rematch</button><div class="j-result-actions"><button class="j-button" data-copy="result" ${stale ? 'disabled' : ''}>COPY RESULT</button><button class="j-button" data-copy="link" ${stale ? 'disabled' : ''}>COPY LINK</button></div><p id="j-copy-status" class="j-small" role="status"></p><textarea id="j-manual-copy" aria-label="Result or link to copy" readonly hidden></textarea>`;
  }
  function effectFields() {
    const selected = method.modes.find(mode => mode.id === state.draft.mode);
    return `<div class="j-fields effect-fields${selected?.repeat ? ' j-repeat-fields' : ''}">${method.inputFields(state.draft).map(field).join('')}</div>${selected?.repeat ? '<p class="j-small">All group means have equal weight. Change the group count above; hidden group values are retained.</p>' : ''}`;
  }
  function arena() {
    return cabinet(`<div class="j-arena-header"><div class="j-avatar"><img src="${fighter.image}" width="1024" height="1536" alt="${fighter.name}"></div><div><p class="j-kicker">${fighter.stage.toUpperCase()} / ${method.missionLabel ?? 'SAMPLE SIZE MISSION'}</p><h1 id="main-heading" tabindex="-1">${fighter.name}’s arena</h1><p>${method.name}</p></div><a href="${path('profile')}" class="j-text-link">← Profile</a><a href="#select" class="j-text-link">Switch fighter</a></div><div class="j-stage-banner" data-framing="${fighter.stageFraming ?? 'banner'}" style="background-image:url('${fighter.stageImage}')" role="img" aria-label="${escape(fighter.stage + ': ' + fighter.stageAlt)}"><span>${fighter.stage.toUpperCase()} <b>ROUND 01</b></span></div><div class="j-arena-layout"><section class="j-console frame"><form id="j-arena-form" novalidate><div class="j-console-heading"><h2>01 / SET YOUR MOVE</h2>${helpButton('assumptions', 'Study assumptions')}</div>${method.notice ? `<p class="j-method-notice">${escape(method.notice)}</p>` : ''}${method.designFields.length ? `<div class="j-fields j-design-fields">${method.designFields.map(field).join('')}</div>` : ''}<fieldset class="j-mode"><legend>Enter your effect</legend><div>${method.modes.map(mode => `<label><input type="radio" name="mode" value="${mode.id}" ${state.draft.mode === mode.id ? 'checked' : ''}><span>${mode.label}</span></label>`).join('')}</div></fieldset><div id="j-effect-fields">${effectFields()}</div><p id="j-derived" class="j-derived"></p>${method.signed ? `<fieldset class="j-alternative"><legend>Alternative hypothesis ${helpButton('alternative', 'Help with alternative hypothesis')}</legend><div>${[['two-sided', '≠ TWO-SIDED'], ['greater', '> GREATER'], ['less', '< LESS']].map(([value, label]) => `<label><input type="radio" name="alternative" value="${value}" ${state.draft.alternative === value ? 'checked' : ''}><span>${escape(label)}</span></label>`).join('')}</div></fieldset>` : ''}<h2 class="j-subhead">02 / TUNE YOUR POWER</h2><div class="j-fields">${method.tuningFields.map(field).join('')}</div><details><summary>Study assumptions & limits</summary><p>${method.assumptions} This plans sample size, not a p-value. Search limit: one million total units.</p></details><p id="j-error" class="j-error" role="alert" ${routeError ? '' : 'hidden'}>${escape(routeError)}</p><button class="j-button hot j-fight" type="submit">${state.outcome ? 'REMATCH / RECALCULATE' : 'FIGHT! / CALCULATE'} <span aria-hidden="true">▶</span></button><p class="j-small">${fighter.name}’s draft is kept separately on this device when storage is available.</p></form></section><section class="j-scoreboard frame" aria-label="Calculation result"><div class="j-console-heading"><h2>03 / ${fighter.scoreTitle}</h2>${helpButton('verification', 'How the calculation engine is verified')}</div><div id="j-result" aria-live="polite">${resultPanel()}</div></section></div>`, 'NO GUTS. JUST GOOD ASSUMPTIONS.');
  }
  const urlFor = (raw, run = false) => '#arena?' + new URLSearchParams({ v: '1', test: activeId, ...raw, ...(run ? { run: '1' } : {}) }).toString();
  function syncDraft(form) {
    const raw = Object.fromEntries(new FormData(form));
    for (const key of Object.keys(method.defaults)) if (Object.hasOwn(raw, key)) state.draft[key] = raw[key];
    if (state.outcome) state.stale = true;
    delete state.kept; save(); history.replaceState(null, '', urlFor(state.draft));
  }
  function derived() { const target = document.querySelector('#j-derived'); if (target) target.textContent = method.derive(state.draft); }
  async function copy(kind) {
    if (!state.outcome || state.stale) return;
    const { result: r, parameters: p, raw } = state.outcome;
    const text = kind === 'link' ? location.href.split('#')[0] + urlFor(raw, true) : [
      `STAT FIGHTER ’89 — ${method.name}`, `Required: ${r.total} ${method.unit}`,
      ...method.allocations(r, p).map(([label, value]) => `${label}: ${value}`), `Achieved power: ${pct(r.power)}; target: ${pct(p.power)}`,
      ...method.receipt(raw, p, r).map(([label, value]) => `${label}: ${value}`), method.assumptions,
      method.allocationRule, `Engine ${stats.version ?? '1'} / method ${method.version}; objective: sample size.`,
    ].join('\n');
    try { await navigator.clipboard.writeText(text); document.querySelector('#j-copy-status').textContent = `${kind === 'link' ? 'Link' : 'Result'} copied.`; }
    catch { const area = document.querySelector('#j-manual-copy'); area.hidden = false; area.value = text; area.focus(); area.select(); document.querySelector('#j-copy-status').textContent = 'Select and copy the text below.'; }
  }
  function refreshResult() {
    document.querySelector('#j-result').innerHTML = resultPanel();
    document.querySelector('.j-fight').innerHTML = `${state.outcome ? 'REMATCH / RECALCULATE' : 'FIGHT! / CALCULATE'} <span aria-hidden="true">▶</span>`;
  }
  function showHelp(id, trigger) {
    const entry = method.help?.[id] ?? (id === 'assumptions' ? [`${fighter.name}’s study assumptions`, method.assumptions] : content.help[id] ?? content.help[/^groupMean\d+$/.test(id) ? 'groupMean' : id]);
    if (!entry) return;
    const dialog = document.querySelector('#journey-help');
    dialog.querySelector('h2').textContent = entry[0]; dialog.querySelector('.j-dialog-content').textContent = entry[1];
    dialog.showModal(); dialog.addEventListener('close', () => trigger?.focus(), { once: true });
  }
  function options(trigger) {
    const dialog = document.querySelector('#journey-options'), checkbox = dialog.querySelector('input'); checkbox.checked = settings.effects;
    checkbox.onchange = () => { settings.effects = checkbox.checked; document.body.classList.toggle('no-effects', !settings.effects); save(); };
    dialog.showModal(); dialog.addEventListener('close', () => trigger?.focus(), { once: true });
  }
  function wire(stage) {
    root.onclick = event => {
      const help = event.target.closest('[data-help]'); if (help) { showHelp(help.dataset.help, help); return; }
      const opts = event.target.closest('[data-options]'); if (opts) { options(opts); return; }
      const region = event.target.closest('[data-region]');
      if (region) { const fromMap = region.classList.contains('j-pin'); regionId = region.dataset.region; emit('selectionChanged'); render(); root.querySelector(`${fromMap ? '.j-pin' : '.j-region-list button'}[data-region="${regionId}"]`)?.focus(); return; }
      const preset = event.target.closest('[data-preset]');
      if (preset) { const [key, value] = preset.dataset.preset.split(':'); const input = document.querySelector(`#j-${key}`); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); return; }
      if (event.target.closest('[data-edit-inputs]')) { document.querySelector('#j-arena-form').scrollIntoView({ block: 'start' }); document.querySelector('#j-arena-form input[type=number]').focus({ preventScroll: true }); return; }
      const copyButton = event.target.closest('[data-copy]'); if (copyButton) copy(copyButton.dataset.copy);
    };
    root.onkeydown = event => {
      const group = event.target.closest('[data-arrow-nav]');
      if (!group || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const items = [...group.querySelectorAll('a,button')], i = items.indexOf(event.target); if (i < 0) return;
      event.preventDefault(); items[(i + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + items.length) % items.length].focus();
    };
    if (stage !== 'arena') return;
    derived();
    const form = document.querySelector('#j-arena-form');
    form.oninput = event => {
      if (event.target.name === 'mode') return;
      syncDraft(form); derived();
      for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
      document.querySelector('#j-error').hidden = true;
      if (state.outcome && !document.querySelector('.j-stale')) refreshResult();
    };
    form.onchange = event => {
      if (event.target.name === 'mode') {
        const mode = event.target.value; syncDraft(form); state.draft.mode = mode; save();
        history.replaceState(null, '', urlFor(state.draft)); root.innerHTML = arena(); wire('arena');
        root.querySelector(`input[name="mode"][value="${mode}"]`)?.focus();
      } else {
        const repeat = method.modes.find(mode => mode.id === state.draft.mode)?.repeat;
        if (repeat?.count === event.target.name) {
          syncDraft(form); document.querySelector('#j-effect-fields').innerHTML = effectFields(); derived();
        }
      }
    };
    form.onsubmit = event => {
      event.preventDefault(); syncDraft(form); emit('calculationStarted');
      const errorBox = document.querySelector('#j-error'); errorBox.hidden = true;
      for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
      try {
        const parameters = method.normalize(state.draft), result = method.solve(stats, parameters, method.id);
        state.outcome = { parameters, result, raw: { ...state.draft } }; state.stale = false; routeError = '';
        history.replaceState(null, '', urlFor(state.draft, true)); refreshResult(); emit('calculationSucceeded');
        if (window.matchMedia('(max-width: 760px)').matches) document.querySelector('.j-scoreboard').scrollIntoView({ block: 'start' });
      } catch (error) {
        errorBox.textContent = error.message; errorBox.hidden = false;
        const input = form.querySelector(error.field === 'alternative' ? 'input[name="alternative"]:checked' : `#j-${error.field}`);
        if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
        if (state.outcome) refreshResult(); emit('validationFailed');
      }
    };
  }
  function render(focus = false) {
    let [stage, search] = location.hash.slice(1).split('?');
    const query = new URLSearchParams(search);
    if (!stage) stage = 'title';
    if (!['title', 'world', 'continent', 'select', 'profile', 'arena', 'setup', 'results'].includes(stage)) stage = 'title';
    routeError = '';
    const requestedId = query.get('test');
    if (requestedId && (!methods[requestedId] || !content.fighters[requestedId])) {
      routeError = 'This link names an unavailable fighter. Choose a supported method below.'; stage = 'select';
    } else if (requestedId) {
      choose(requestedId);
      if (['profile', 'arena', 'setup', 'results'].includes(stage)) regionId = fighter.region;
    }
    if (query.has('region')) {
      const requestedRegion = content.regions.find(region => region.id === query.get('region'));
      if (!requestedRegion) { stage = 'world'; routeError = 'Unknown destination in this link. Choose a district from the world map.'; }
      else regionId = requestedRegion.id;
    }
    if (stage === 'continent') {
      const candidates = playable(regionId);
      if (!candidates.length) stage = 'world';
      else if (fighter.region !== regionId) choose(candidates[0][0]);
    }
    if (['setup', 'results'].includes(stage)) {
      const raw = { ...method.defaults, mode: 'effect' };
      for (const key of Object.keys(raw)) if (query.has(key)) raw[key] = query.get(key);
      raw.mode = 'effect'; history.replaceState(null, '', urlFor(raw, stage === 'results')); return render(focus);
    }
    if (stage === 'arena' && search) {
      if (query.has('v') && query.get('v') !== '1') routeError = 'This arena link uses an unsupported version. Choose a fighter from Quick Select.';
      const hasInputs = Object.keys(method.defaults).some(key => query.has(key));
      if (hasInputs || query.has('v')) {
        state.kept ??= state.draft; state.draft = { ...method.defaults };
        for (const key of Object.keys(state.draft)) if (query.has(key)) state.draft[key] = query.get(key);
        if (!method.modes.some(mode => mode.id === state.draft.mode)) { state.draft.mode = method.defaults.mode; routeError = 'Unknown input mode in this link. Choose an input mode and check your values.'; }
        if (state.outcome) state.stale = JSON.stringify(state.draft) !== JSON.stringify(state.outcome.raw);
      }
      if (query.get('run') === '1') {
        state.outcome = null; state.stale = false;
        if (!routeError) try {
          const parameters = method.normalize(state.draft);
          state.outcome = { parameters, result: method.solve(stats, parameters, method.id), raw: { ...state.draft } };
        } catch (error) { routeError = error.message; }
      }
    }
    document.body.classList.add('journey-active'); document.body.classList.toggle('no-effects', !settings.effects);
    document.body.dataset.fighter = ['profile', 'arena'].includes(stage) ? activeId : firstId;
    root.innerHTML = ({ title, world, continent, select, profile, arena })[stage]();
    const labels = { title: 'Title', world: 'World', continent: 'Continent', profile: 'Fighter', arena: 'Arena' };
    document.querySelector('.stages').innerHTML = Object.entries(labels).map(([id, label]) => `<li ${id === stage ? 'aria-current="step"' : ''}><a href="${['profile', 'arena'].includes(id) ? path(id) : id === 'continent' ? regionPath() : '#' + id}">${label}</a></li>`).join('');
    document.title = `${stage === 'title' ? '' : stage === 'select' ? 'Quick Select | ' : ['profile', 'arena'].includes(stage) ? fighter.name + ' / ' + labels[stage] + ' | ' : labels[stage] + ' | '}STAT FIGHTER ’89`;
    wire(stage);
    if (focus) { document.querySelector('#main-heading').focus({ preventScroll: true }); window.scrollTo(0, 0); }
    return true;
  }
  globalThis.StatFighter.journey = { render };
}
