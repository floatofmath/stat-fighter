'use strict';
// HI-SCORE TABLE: the last ten plans calculated on this device. Stored only in this browser.
{
  const kit = globalThis.StatFighter.kit;
  const { content, escape, fmt, pct } = kit;

  kit.screens.scores = {
    label: 'Hi-scores',
    render() {
      const list = kit.scores();
      const rows = list.map((entry, i) => {
        const f = content.fighters[entry.id];
        return `<tr><td class="rank">${String(i + 1).padStart(2, '0')}</td><td class="who">${kit.thumb(f)}<span><b>${escape(f.name)}</b><small>${escape(f.test)}</small></span></td><td class="score">${fmt.format(entry.total)}<small>${escape(entry.unit)}</small></td><td>${Number.isFinite(entry.power) ? pct(entry.power) : '—'}</td><td>${escape(entry.at ?? '')}</td><td><a class="j-text-link" href="${escape(entry.link)}">REOPEN ▶</a></td></tr>`;
      }).join('');
      return kit.cabinet(`${kit.heading('HI-SCORE TABLE / THIS DEVICE', 'Your last ten plans', 'Every successful calculation is saved here, newest first. Each row reopens its arena with the same inputs.')}
        <div class="j-scores frame">
          ${list.length ? `<table class="j-table j-score-table"><caption class="sr-only">Last ten plans</caption><thead><tr><th scope="col">#</th><th scope="col">Fighter</th><th scope="col">Score</th><th scope="col">Power</th><th scope="col">Date</th><th scope="col"><span class="sr-only">Reopen</span></th></tr></thead><tbody>${rows}</tbody></table>`
            : '<p class="j-empty-scores">NO SCORES YET. <a class="j-text-link" href="#select">CHOOSE A FIGHTER ▶</a></p>'}
          <p class="j-small">Saved only in this browser’s local storage. Nothing leaves the device.</p>
          ${list.length ? '<button type="button" class="j-button" data-clear-scores>CLEAR HI-SCORES <span aria-hidden="true">×</span></button>' : ''}
          <p id="j-scores-status" class="j-small" role="status"></p>
        </div>`, 'INSERT COIN TO CONTINUE');
    },
    click(event, render) {
      const button = event.target.closest('[data-clear-scores]');
      if (!button) return false;
      if (button.dataset.armed !== 'true') {
        button.dataset.armed = 'true'; button.innerHTML = 'PRESS AGAIN TO CLEAR <span aria-hidden="true">×</span>';
        kit.root.querySelector('#j-scores-status').textContent = 'Press again to delete all saved scores.';
        return true;
      }
      kit.clearScores(); render(); kit.root.querySelector('#main-heading').focus();
      kit.root.querySelector('#j-scores-status').textContent = 'Hi-scores cleared.';
      return true;
    },
  };
}
