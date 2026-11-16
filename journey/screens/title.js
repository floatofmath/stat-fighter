'use strict';
{
  const kit = globalThis.StatFighter.kit;
  const { content, escape } = kit;

  // Attract mode: after a quiet spell on the title screen, cycle through the roster like an arcade
  // cabinet waiting for a coin. Decorative only (aria-hidden); the static first portrait keeps its
  // alt text. Never runs without motion; any key, pointer or hidden tab stops it.
  const attract = { idle: 20000, cycle: 6000 };
  let idleTimer = 0, cycleTimer = 0, index = 0, listening = false;

  const overlay = () => kit.root.querySelector('.j-attract');
  function show(i) {
    const roster = kit.playable(), [, f] = roster[i % roster.length], [, next] = roster[(i + 1) % roster.length];
    const layer = overlay();
    if (!layer) return;
    layer.innerHTML = `${kit.portrait(f, 'j-attract-portrait', { lazy: true, alt: '' })}<div class="j-attract-caption"><b>${escape(f.name.toUpperCase())}</b><span class="j-slant">${escape(f.headline)}</span><q>${escape(f.quote)}</q></div><span class="j-attract-demo">DEMO</span>`;
    layer.style.setProperty('--accent', f.accent);
    layer.hidden = false;
    if (!next.artPending) new Image().src = next.image;
  }
  function startDemo() {
    if (!kit.motion() || document.hidden || !overlay()) return;
    index = 1; show(index);
    cycleTimer = setInterval(() => show(++index), attract.cycle);
  }
  function stopDemo() {
    clearInterval(cycleTimer); cycleTimer = 0;
    const layer = overlay();
    if (layer) { layer.hidden = true; layer.innerHTML = ''; }
  }
  function arm() { clearTimeout(idleTimer); idleTimer = setTimeout(startDemo, attract.idle); }
  function activity() { stopDemo(); arm(); }
  function visibility() { if (document.hidden) { stopDemo(); clearTimeout(idleTimer); } else arm(); }
  const events = ['keydown', 'pointerdown', 'pointermove'];

  kit.screens.title = {
    label: 'Title',
    attract,
    demoRunning: () => Boolean(cycleTimer),
    render() {
      const featured = content.fighters[kit.firstId], taglines = content.lines.taglines;
      const tagline = taglines[Math.floor(Math.random() * taglines.length)];
      return kit.cabinet(`<section class="j-title-screen">
        <div class="j-title-copy">
          <p class="j-kicker">AN ARCADE FOR CURIOUS MINDS</p>
          <h1 class="j-logo" id="main-heading" tabindex="-1">STAT<br>FIGHTER<span>’89</span></h1>
          <p class="j-tagline">${escape(tagline)}<br>A world of statistical characters awaits.</p>
          <nav class="j-menu" aria-label="Main menu" data-arrow-nav>
            ${kit.action('#world', 'START JOURNEY', true)}${kit.action('#match', 'FIND MY FIGHTER')}${kit.action('#select', 'QUICK SELECT')}${kit.action('#convert', 'TRAINING ROOM')}${kit.action('#scores', 'HI-SCORES')}
            <button class="j-button" data-help="play">HOW TO PLAY <span>?</span></button>
            <button class="j-button" data-options>OPTIONS <span>⚙</span></button>
          </nav>
          <p class="j-small">WORLD TOUR — ${kit.playable().length} FIGHTERS / ${content.regions.length} DISTRICTS</p>
        </div>
        ${kit.portrait(featured, 'title-portrait')}
      </section>`, 'PRESS START. BRING YOUR CURIOSITY.');
    },
    afterRender() {
      kit.root.querySelector('.title-portrait')?.insertAdjacentHTML('beforeend', '<div class="j-attract" aria-hidden="true" hidden></div>');
      if (!listening) { for (const type of events) document.addEventListener(type, activity, true); document.addEventListener('visibilitychange', visibility); listening = true; }
      arm();
    },
    leave() {
      stopDemo(); clearTimeout(idleTimer); idleTimer = 0;
      for (const type of events) document.removeEventListener(type, activity, true);
      document.removeEventListener('visibilitychange', visibility); listening = false;
    },
  };
}
