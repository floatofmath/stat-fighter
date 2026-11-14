'use strict';
// Challenge card, after the owner's concept boards: slanted test title, the fighter over their
// stage, a "DO YOU WANT TO …?" bubble, five stat bars, VS The Null and PRESS START.
{
  const kit = globalThis.StatFighter.kit;
  const { escape } = kit;

  kit.screens.profile = {
    label: 'Fighter',
    title: () => `${kit.fighter.name} / Fighter`,
    render() {
      const f = kit.fighter, m = kit.method, region = kit.regionBy(f.region);
      const fighters = kit.listed(kit.activeId) ? kit.playable(f.region) : [[kit.activeId, f], ...kit.playable(f.region)];
      const index = fighters.findIndex(([id]) => id === kit.activeId);
      const previous = fighters[(index - 1 + fighters.length) % fighters.length], next = fighters[(index + 1) % fighters.length];
      const nav = fighters.length > 1
        ? `<nav class="j-profile-nav" aria-label="Browse fighters">${kit.action(kit.path('profile', previous[0]), `← ${previous[1].name}`)}<a class="j-text-link" href="${kit.regionPath(f.region)}">${escape(region.name.toUpperCase())}</a>${kit.action(kit.path('profile', next[0]), `${next[1].name} →`)}</nav>`
        : `<nav class="j-profile-nav" aria-label="Browse fighters"><a class="j-text-link" href="${kit.regionPath(f.region)}">← ${escape(region.name.toUpperCase())}</a><a class="j-text-link" href="#select">QUICK SELECT</a></nav>`;
      return kit.cabinet(`${nav}
        <article class="j-card" aria-labelledby="main-heading">
          <div class="j-card-stage${f.artPending ? ' no-art' : ''}" style="${kit.stageStyle(f)}">
            <header class="j-card-title">
              <p class="j-kicker">FIGHTER ${f.number} / ${escape(region.name.toUpperCase())} / ${escape(f.stage.toUpperCase())}</p>
              <h1 class="j-slant j-card-headline" id="main-heading" tabindex="-1" style="--len:${Math.max(...f.headline.split(/[\s·]+/).map(word => word.length))}">${escape(f.headline)}</h1>
              <p class="j-card-test">${escape(m.name)}</p>
            </header>
            <div class="j-card-body">
              <div class="j-card-fighter">
                ${kit.bubble(`DO YOU WANT TO <b>${escape(f.challenge)}</b>?`, 'j-card-bubble')}
                ${kit.portrait(f, 'j-card-portrait')}
                <div class="j-nameplate"><h2>${escape(f.name)}</h2><p>${escape(f.title)}</p></div>
              </div>
              <div class="j-card-side">
                ${kit.statBars(f)}
                <div class="j-card-move"><span>SPECIAL MOVE</span><strong>${escape(f.move)}</strong></div>
                <div class="j-card-vs" aria-label="Opponent: The Null"><span class="j-vs" aria-hidden="true">VS</span>${kit.nullFigure('j-card-null')}<span class="j-cpu-name">THE NULL<small>CPU · H0</small></span></div>
                ${kit.action(kit.path('arena'), 'PRESS START TO FIGHT!', true, 'data-start')}
                <button type="button" class="j-text-link j-manual-link" data-manual aria-controls="field-manual">OPEN FIELD MANUAL ↓</button>
              </div>
            </div>
          </div>
          <details class="j-manual frame" id="field-manual">
            <summary><h2>FIELD MANUAL / ${escape(f.name.toUpperCase())}</h2></summary>
            <blockquote class="j-speech">“${escape(f.quote)}”</blockquote>
            <p>${escape(f.bio)}</p>
            <p class="j-aside">${escape(f.joke)}</p>
            <div class="j-briefing"><h3>Pick me when…</h3><p>${escape(f.choose)}</p><h3>Not for…</h3><p>${kit.linkFighters(f.avoid)}</p>${kit.helpButton('assumptions', 'Read study assumptions')}</div>
            <p class="j-small"><b>WEAKNESS</b> ${escape(f.weakness)}</p>
            ${kit.action(kit.path('arena'), 'ENTER THE ARENA', true)}
          </details>
        </article>`, `${escape(f.name.toUpperCase())} / ${escape(f.move.toUpperCase())} / PRESS START`);
    },
    click(event) {
      if (!event.target.closest('[data-manual]')) return false;
      const manual = kit.root.querySelector('#field-manual');
      manual.open = true; manual.scrollIntoView({ block: 'start' }); manual.querySelector('summary').focus({ preventScroll: true });
      return true;
    },
  };
}
