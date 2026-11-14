'use strict';
// Fighting-game character select. Tiles hold portraits; the highlighted fighter is previewed beside
// the grid. Arrow keys move the cursor, a second click or Enter confirms. Quick Select is the same
// screen with every district.
{
  const kit = globalThis.StatFighter.kit;
  const { content, escape } = kit;

  function preview(id) {
    const f = content.fighters[id];
    return `<div class="j-preview-art">${kit.portrait(f, 'j-preview-portrait', { lazy: true })}</div>
      <div class="j-preview-copy">
        <p class="j-kicker">FIGHTER ${f.number} / ${kit.regionBy(f.region).name.toUpperCase()}</p>
        <h2 class="j-preview-name">${escape(f.name)}</h2>
        <p class="j-slant j-preview-test">${escape(f.headline)}</p>
        <p class="j-preview-pick"><b>PICK ME WHEN</b> ${escape(f.choose)}</p>
        <div class="j-preview-actions">${kit.action(kit.path('profile', id), 'SELECT', true, 'data-confirm')}${kit.action(kit.path('arena', id), 'ARENA')}</div>
      </div>`;
  }
  const tile = ([id, f]) => `<button type="button" class="j-tile" role="option" data-tile="${id}" style="--accent:${f.accent}" aria-selected="${id === kit.activeId}" tabindex="${id === kit.activeId ? 0 : -1}" aria-label="${escape(f.name)}, ${escape(f.test)}">${kit.thumb(f)}<span>${escape(f.name)}</span></button>`;
  const grid = (fighters, label) => `<div class="j-tiles" role="listbox" aria-label="${escape(label)}" data-grid-nav>${fighters.map(tile).join('')}</div>`;

  function layout(sections) {
    return `<div class="j-select">
      <div class="j-select-grid">${sections}</div>
      <section class="j-preview frame" aria-live="polite" aria-label="Highlighted fighter">${preview(kit.activeId)}</section>
    </div>`;
  }
  // Keep the cursor on a fighter that is shown on this screen.
  function ensureCursor(ids) { if (!ids.includes(kit.activeId)) kit.choose(ids[0]); }

  kit.screens.continent = {
    label: 'District',
    render() {
      const region = kit.regionBy(kit.regionId), roster = kit.playable(region.id);
      ensureCursor(roster.map(([id]) => id));
      return kit.cabinet(`${kit.heading(`TOUR STOP ${region.number} / ${region.name.toUpperCase()}`, 'Choose your fighter', `${region.tagline} ${region.introduction}`)}
        ${layout(grid(roster, `${region.name} fighters`))}
        <p class="j-select-foot"><a class="j-text-link" href="#world">← Back to the world</a><a class="j-text-link" href="#select">Quick Select: all districts →</a></p>`, `${region.name.toUpperCase()} / ${roster.length} FIGHTERS / TAP TWICE TO PICK`);
    },
  };

  kit.screens.select = {
    label: 'Quick Select',
    render() {
      ensureCursor(kit.playable().map(([id]) => id));
      const sections = content.regions.map(region => `<section class="j-select-district"><h2><span>${region.number}</span> ${escape(region.name)}</h2>${grid(kit.playable(region.id), `${region.name} fighters`)}</section>`).join('');
      return kit.cabinet(`${kit.heading('QUICK SELECT / WORLD TOUR', 'Choose your fighter', 'Every district on one screen. Tap a fighter to preview, tap again to pick. Each fighter keeps a separate draft.')}
        ${kit.routeError ? `<p class="j-error">${escape(kit.routeError)}</p>` : ''}
        ${layout(sections)}`, `${kit.playable().length} FIGHTERS / CHOOSE YOUR METHOD`);
    },
  };

  // Shared behaviour for both screens.
  function highlight(id) {
    kit.choose(id);
    for (const tileEl of kit.root.querySelectorAll('[data-tile]')) {
      const on = tileEl.dataset.tile === id;
      tileEl.setAttribute('aria-selected', on); tileEl.tabIndex = on ? 0 : -1;
    }
    kit.root.querySelector('.j-preview').innerHTML = preview(id);
    document.body.style.setProperty('--accent', content.fighters[id].accent);
    kit.refreshHud();
  }
  const click = event => {
    const tileEl = event.target.closest('[data-tile]');
    if (!tileEl) return false;
    const id = tileEl.dataset.tile;
    if (id === kit.activeId && tileEl.getAttribute('aria-selected') === 'true') location.hash = kit.path('profile', id);
    else highlight(id);
    return true;
  };
  // Moving the cursor with the arrow keys highlights the fighter it lands on. (Not on focus:
  // a mouse click focuses first, which would turn one click into a confirmation.)
  const cursor = tileEl => { if (tileEl.dataset.tile && tileEl.dataset.tile !== kit.activeId) highlight(tileEl.dataset.tile); };
  kit.screens.continent.click = kit.screens.select.click = click;
  kit.screens.continent.cursor = kit.screens.select.cursor = cursor;
}
