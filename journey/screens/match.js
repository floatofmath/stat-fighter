'use strict';
// MATCHMAKER: up to three questions, one at a time, answers kept in the hash so the browser's Back
// button steps back through them. The rules live in content.matchmaker (pure, tested in Node).
{
  const kit = globalThis.StatFighter.kit;
  const { content, escape } = kit;
  const mm = content.matchmaker;
  const keys = ['goal', 'outcome', 'design'];
  const titles = { goal: 'What do you want to show?', outcome: 'What kind of outcome?', design: 'What is the design?' };

  function answers() {
    const query = new URLSearchParams(location.hash.split('?')[1] ?? ''), out = {};
    for (const key of keys) { const v = query.get(key); if (v) out[key] = v; }
    return out;
  }
  const href = a => { const params = new URLSearchParams(Object.entries(a).filter(([, v]) => v)); return `#match${[...params].length ? `?${params}` : ''}`; };

  kit.screens.match = {
    label: 'Matchmaker',
    render() {
      const a = answers(), step = mm.step(a);
      // Keep only the answers the rules actually used, so Back always removes the last real step.
      const used = Object.fromEntries(keys.filter(k => a[k] && (step.ask ? keys.indexOf(k) < keys.indexOf(step.ask) : true)).map(k => [k, a[k]]));
      if (step.fighter && !step.rule.design) delete used.design;
      if (step.fighter && mm.noOutcome.includes(used.goal)) delete used.outcome;
      const asked = keys.filter(k => used[k]);
      const back = asked.length ? href(Object.fromEntries(asked.slice(0, -1).map(k => [k, used[k]]))) : '#title';
      const nav = `<p class="j-match-nav"><a class="j-text-link" href="${back}">← BACK</a>${asked.length ? '<a class="j-text-link" href="#match">START OVER</a>' : ''}</p>`;
      let body;
      if (step.ask) {
        const number = asked.length + 1;
        body = `<section class="j-match frame" aria-labelledby="j-match-q">
          <p class="j-kicker">QUESTION ${number}</p><h2 id="j-match-q">${titles[step.ask]}</h2>
          <nav class="j-match-options" aria-label="Answers" data-arrow-nav>${step.options.map(([id, label, hint]) => `<a class="j-button j-match-option" href="${href({ ...used, [step.ask]: id })}"><span class="j-match-label">${escape(label)}${hint ? `<small>${escape(hint)}</small>` : ''}</span><span aria-hidden="true">▶</span></a>`).join('')}</nav>
          ${nav}</section>`;
      } else if (step.none) {
        body = `<section class="j-match frame" aria-labelledby="j-match-q"><p class="j-kicker">NO MATCH</p><h2 id="j-match-q">NO FIGHTER FOR THIS YET</h2>
          <p class="j-small">None of the twenty-two fighters plans this combination. Browse them all and read each challenge card’s “not for” notes.</p>
          <div class="j-match-actions">${kit.action('#select', 'QUICK SELECT', true)}</div>${nav}</section>`;
      } else {
        const id = step.fighter, f = content.fighters[id];
        body = `<section class="j-match j-match-result frame" style="--accent:${f.accent}" aria-labelledby="j-match-q">
          <div class="j-match-fighter">${kit.thumb(f)}<div><p class="j-kicker">YOUR FIGHTER</p><h2 id="j-match-q">${escape(f.name)}</h2><p class="j-slant j-match-headline">${escape(f.headline)}</p></div></div>
          <p class="j-match-choose"><b>PICK WHEN</b> ${escape(f.choose)}</p>
          ${step.rule.tip ? `<p class="j-small j-match-tip">${escape(step.rule.tip)}</p>` : ''}
          <p class="j-small j-match-avoid"><b>NOT FOR</b> ${kit.linkFighters(f.avoid)}</p>
          <div class="j-match-actions">${kit.action(kit.path('profile', id), 'SEE CHALLENGE CARD')}${kit.action(kit.path('arena', id), 'ENTER ARENA', true)}</div>
          ${nav}</section>`;
      }
      return kit.cabinet(`${kit.heading('MATCHMAKER / THREE QUESTIONS', 'Find your fighter', 'Answer up to three questions about your study. Each answer narrows the roster.')}
        <div class="j-match-wrap">${body}</div>`, 'THE MATCHMAKER SUGGESTS. YOU DECIDE.');
    },
  };
}
