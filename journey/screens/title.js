'use strict';
{
  const kit = globalThis.StatFighter.kit;
  const { content } = kit;

  kit.screens.title = {
    label: 'Title',
    render() {
      const featured = content.fighters[kit.firstId], taglines = content.lines.taglines;
      const tagline = taglines[Math.floor(Math.random() * taglines.length)];
      return kit.cabinet(`<section class="j-title-screen">
        <div class="j-title-copy">
          <p class="j-kicker">AN ARCADE FOR CURIOUS MINDS</p>
          <h1 class="j-logo" id="main-heading" tabindex="-1">STAT<br>FIGHTER<span>’89</span></h1>
          <p class="j-tagline">${kit.escape(tagline)}<br>A world of statistical characters awaits.</p>
          <nav class="j-menu" aria-label="Main menu" data-arrow-nav>
            ${kit.action('#world', 'START JOURNEY', true)}${kit.action('#select', 'QUICK SELECT')}${kit.action('#scores', 'HI-SCORES')}
            <button class="j-button" data-help="play">HOW TO PLAY <span>?</span></button>
            <button class="j-button" data-options>OPTIONS <span>⚙</span></button>
          </nav>
          <p class="j-small">WORLD TOUR — ${kit.playable().length} FIGHTERS / ${content.regions.length} DISTRICTS</p>
        </div>
        ${kit.portrait(featured, 'title-portrait')}
      </section>`, 'PRESS START. BRING YOUR CURIOSITY.');
    },
  };
}
