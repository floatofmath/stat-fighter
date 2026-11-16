'use strict';
// Router: reads the hash, restores links (including legacy #setup / #results and retired district
// ids), renders a screen from journey/screens/, and wires shared behaviour.
{
  const kit = globalThis.StatFighter.kit;
  const { methods, content, stats, root } = kit;
  const stages = ['title', 'world', 'continent', 'select', 'profile', 'arena', 'scores', 'convert', 'setup', 'results'];
  let current = null;

  // ---- Dialogs. Modal dialogs centre in the viewport; closing returns focus and scroll position. ----
  // Watch the open attribute rather than the close event: the observer runs as a microtask right
  // after the browser's own close steps, whichever way the dialog was closed.
  function openDialog(dialog, trigger) {
    const y = window.scrollY;
    dialog.showModal();
    const observer = new MutationObserver(() => {
      if (dialog.open) return;
      observer.disconnect();
      trigger?.focus({ preventScroll: true }); window.scrollTo(0, y);
    });
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }
  function showHelp(id, trigger) {
    const m = kit.method, f = kit.fighter;
    const entry = m.help?.[id] ?? (id === 'assumptions' ? [`${f.name}’s study assumptions`, m.assumptions] : content.help[id] ?? content.help[/^groupMean\d+$/.test(id) ? 'groupMean' : id]);
    if (!entry) return;
    const dialog = document.querySelector('#journey-help'), general = id === 'play';
    dialog.querySelector('.j-dialog-avatar').innerHTML = general ? '' : kit.thumb(f);
    dialog.querySelector('.j-kicker').textContent = general ? 'FIELD MANUAL / STAT FIGHTER ’89' : `CORNER ADVICE / ${f.name.toUpperCase()}`;
    dialog.querySelector('h2').textContent = entry[0]; dialog.querySelector('.j-dialog-content').textContent = entry[1];
    openDialog(dialog, trigger);
  }
  function options(trigger) {
    const dialog = document.querySelector('#journey-options'), checkbox = dialog.querySelector('input'); checkbox.checked = kit.settings.effects;
    checkbox.onchange = () => { kit.settings.effects = checkbox.checked; document.body.classList.toggle('no-effects', !kit.settings.effects); kit.save(); };
    openDialog(dialog, trigger);
  }
  kit.openDialog = openDialog;

  kit.refreshHud = () => { const hud = root.querySelector('.j-hud'); if (hud) hud.outerHTML = kit.hud(); };

  // Up/Down in a tile grid move to the nearest tile in the next row; Left/Right follow reading order.
  function gridTarget(items, el, key) {
    const i = items.indexOf(el);
    if (key === 'ArrowLeft') return items[(i - 1 + items.length) % items.length];
    if (key === 'ArrowRight') return items[(i + 1) % items.length];
    const box = el.getBoundingClientRect(), cx = box.left + box.width / 2, cy = box.top + box.height / 2, down = key === 'ArrowDown';
    let best = null, bestScore = Infinity;
    for (const other of items) {
      const b = other.getBoundingClientRect(), dy = b.top + b.height / 2 - cy;
      if (down ? dy <= box.height / 2 : dy >= -box.height / 2) continue;
      const score = Math.abs(dy) * 4 + Math.abs(b.left + b.width / 2 - cx);
      if (score < bestScore) { best = other; bestScore = score; }
    }
    return best ?? el;
  }

  function wire(screen) {
    root.oninput = null;
    root.onclick = event => {
      const help = event.target.closest('[data-help]'); if (help) { showHelp(help.dataset.help, help); return; }
      const opts = event.target.closest('[data-options]'); if (opts) { options(opts); return; }
      const coin = event.target.closest('[data-coin]'); if (coin) { openDialog(document.querySelector('#about'), coin); return; }
      const preset = event.target.closest('[data-preset]');
      if (preset) { const [key, value] = preset.dataset.preset.split(':'); const input = root.querySelector(`#j-${key}`); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); return; }
      screen.click?.(event, rerender);
    };
    root.onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const grid = event.target.closest('[data-grid-nav]');
      if (grid) {
        const items = [...root.querySelectorAll('[data-tile]')]; if (!items.includes(event.target)) return;
        event.preventDefault();
        const next = gridTarget(items, event.target, event.key);
        if (next !== event.target) { next.focus(); screen.cursor?.(next); }
        return;
      }
      const group = event.target.closest('[data-arrow-nav]');
      if (!group) return;
      const items = [...group.querySelectorAll('a,button')], i = items.indexOf(event.target); if (i < 0) return;
      event.preventDefault(); items[(i + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + items.length) % items.length].focus();
    };
    screen.wire?.();
  }

  function paint(stage) {
    const screen = kit.screens[stage], f = kit.fighter;
    current?.leave?.();
    current = screen;
    document.body.classList.add('journey-active'); document.body.classList.toggle('no-effects', !kit.settings.effects);
    document.body.dataset.fighter = ['profile', 'arena'].includes(stage) ? kit.activeId : kit.firstId;
    document.body.dataset.stage = stage;
    const accent = ['profile', 'arena', 'continent', 'select'].includes(stage) ? f.accent : content.fighters[kit.firstId].accent;
    document.body.style.setProperty('--accent', accent);
    document.body.style.setProperty('--j-cyan', accent);
    root.innerHTML = screen.render();
    const labels = { title: 'Title', world: 'World', continent: 'District', profile: 'Fighter', arena: 'Arena' };
    document.querySelector('.stages').innerHTML = Object.entries(labels).map(([id, label]) => `<li ${id === stage ? 'aria-current="step"' : ''}><a href="${['profile', 'arena'].includes(id) ? kit.path(id) : id === 'continent' ? kit.regionPath() : '#' + id}">${label}</a></li>`).join('');
    document.title = `${stage === 'title' ? '' : (screen.title?.() ?? screen.label) + ' | '}STAT FIGHTER ’89`;
    wire(screen);
    screen.afterRender?.();
  }
  // Re-render the current screen in place, keeping the hash.
  function rerender() { paint(document.body.dataset.stage); }
  kit.rerender = rerender;

  function render(focus = false) {
    let [stage, search] = location.hash.slice(1).split('?');
    const query = new URLSearchParams(search);
    if (!stage || !stages.includes(stage)) stage = 'title';
    kit.routeError = '';
    const requestedId = query.get('test');
    if (requestedId && (!methods[requestedId] || !content.fighters[requestedId])) {
      kit.routeError = 'This link names an unavailable fighter. Choose a supported method below.'; stage = 'select';
    } else if (requestedId) {
      kit.choose(requestedId);
      if (['profile', 'arena', 'setup', 'results'].includes(stage)) kit.regionId = kit.fighter.region;
    }
    if (query.has('region')) {
      const wanted = query.get('region'), resolved = content.regionAliases?.[wanted] ?? wanted;
      const region = content.regions.find(r => r.id === resolved);
      if (!region) { stage = 'world'; kit.routeError = 'Unknown destination in this link. Choose a district from the world map.'; }
      else kit.regionId = region.id;
    }
    if (stage === 'continent' && !kit.playable(kit.regionId).length) stage = 'world';
    const method = kit.method, state = kit.state;
    if (['setup', 'results'].includes(stage)) {
      // Legacy forms only knew effect-size entry; methods without it use their default mode.
      const legacyMode = method.modes.some(mode => mode.id === 'effect') ? 'effect' : method.defaults.mode;
      const raw = { ...method.defaults };
      for (const key of Object.keys(raw)) if (query.has(key)) raw[key] = query.get(key);
      raw.mode = legacyMode; kit.replaceUrl(kit.urlFor(raw, stage === 'results')); return render(focus);
    }
    if (stage === 'arena' && search) {
      if (query.has('v') && query.get('v') !== '1') kit.routeError = 'This arena link uses an unsupported version. Choose a fighter from Quick Select.';
      const hasInputs = Object.keys(method.defaults).some(key => query.has(key));
      if (hasInputs || query.has('v')) {
        state.kept ??= state.draft; state.draft = { ...method.defaults };
        for (const key of Object.keys(state.draft)) if (query.has(key)) state.draft[key] = query.get(key);
        if (!method.modes.some(mode => mode.id === state.draft.mode)) { state.draft.mode = method.defaults.mode; kit.routeError = 'Unknown input mode in this link. Choose an input mode and check your values.'; }
        if (state.outcome) state.stale = JSON.stringify(kit.coreDraft(method, state.draft)) !== JSON.stringify(kit.coreDraft(method, state.outcome.raw));
      }
      // Shared results open directly on the result: no fight sequence is replayed.
      if (query.get('run') === '1') {
        state.outcome = null; state.stale = false;
        if (!kit.routeError) try {
          const parameters = method.normalize(state.draft);
          state.outcome = { parameters, result: method.solve(stats, parameters, method.id), raw: kit.coreDraft(method, state.draft) };
        } catch (error) { kit.routeError = error.message; }
      }
    }
    paint(stage);
    if (focus) { document.querySelector('#main-heading').focus({ preventScroll: true }); window.scrollTo(0, 0); }
    return true;
  }
  globalThis.StatFighter.journey = { render };
}
