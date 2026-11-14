'use strict';
// World map. The first click or tap on a district selects it and shows its briefing; a second
// click on the same district enters it. The list under the map and Enter on a pin follow the same rule.
{
  const kit = globalThis.StatFighter.kit;
  const { content, escape } = kit;

  function briefing(region) {
    const roster = kit.playable(region.id);
    return `<p class="j-kicker">TRANSMISSION ${region.number}</p>
      <h2>${region.name}</h2>
      <p class="j-region-tag">${region.tag}</p>
      <p>${region.description}</p>
      <ul class="j-brief-roster" aria-label="${escape(region.name)} fighters">${roster.map(([id, f]) => `<li><a href="${kit.path('profile', id)}" title="${escape(f.name)} · ${escape(f.test)}">${kit.thumb(f)}<span>${escape(f.name)}</span></a></li>`).join('')}</ul>
      <p class="j-status">● ${roster.length} ${roster.length === 1 ? 'FIGHTER' : 'FIGHTERS'} · TAP THE SIGNAL AGAIN TO ENTER</p>
      ${kit.action(kit.regionPath(region.id), `ENTER ${region.name.toUpperCase()}`, true)}`;
  }

  kit.screens.world = {
    label: 'World',
    render() {
      const selected = kit.regionBy(kit.regionId);
      return kit.cabinet(`${kit.heading('WORLD SELECT / EARTH', 'Choose your district', 'Tap a signal to read its briefing. Tap it again to enter.')}
        ${kit.routeError ? `<p class="j-error">${escape(kit.routeError)}</p>` : ''}
        <div class="j-world-layout">
          <div class="j-map frame">
            <img src="${content.worldMap.image}" width="${content.worldMap.width}" height="${content.worldMap.height}" alt="${content.worldMap.alt}">
            <div class="j-map-pins" data-arrow-nav>${content.regions.map(r => `<button class="j-pin open" style="left:${r.x}%;top:${r.y}%" data-region="${r.id}" aria-label="${r.name}, ${kit.playable(r.id).length} fighters${r.id === selected.id ? '. Selected: activate again to enter' : ''}" aria-pressed="${r.id === selected.id}">${r.number}</button>`).join('')}</div>
            <span class="j-map-caption">EARTH / WORLD TOUR / SELECT A SIGNAL</span>
          </div>
          <aside class="j-region-detail frame" aria-live="polite">${briefing(selected)}</aside>
        </div>
        <nav class="j-region-list" aria-label="Districts" data-arrow-nav>${content.regions.map(r => `<button data-region="${r.id}" aria-pressed="${r.id === selected.id}"><span>${r.number}</span>${r.name}<small>${kit.playable(r.id).length} FIGHTERS${r.id === selected.id ? ' · TAP TO ENTER' : ''}</small></button>`).join('')}</nav>`, 'SELECT A SIGNAL • TAP AGAIN TO ENTER');
    },
    // Returns true when it handled the click.
    click(event, render) {
      const button = event.target.closest('[data-region]');
      if (!button) return false;
      const id = button.dataset.region, fromMap = button.classList.contains('j-pin');
      if (id === kit.regionId && button.getAttribute('aria-pressed') === 'true') { location.hash = kit.regionPath(id); return true; }
      kit.regionId = id; kit.emit('selectionChanged'); render();
      kit.root.querySelector(`${fromMap ? '.j-pin' : '.j-region-list button'}[data-region="${id}"]`)?.focus();
      return true;
    },
  };
}
