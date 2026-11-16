'use strict';
// The arena reads as a round in progress. The fighter's bar is power, The Null's bar is the type II
// error that remains, and the clock shows alpha. The verified result is written to the live region
// at once; the fight sequence is decoration on top of it, skippable and absent without effects.
{
  const kit = globalThis.StatFighter.kit;
  const { content, stats, escape, fmt, pct } = kit;
  let arenaError = '';
  let fightTimers = [];
  let finishFight = null;
  let stepWired = false;

  // ---- Fields ----
  // Number fields get their own ▼ ▲ buttons and arrow keys, driven by methods.stepValue: one
  // ladder for every field (proportions toward the nearer end, other values by ~5–10%). The
  // browser's spinner is hidden because it can only step by a fixed amount.
  const bounds = f => `${f.min !== undefined ? ` min="${f.min}"` : ''}${f.max !== undefined ? ` max="${f.max}"` : ''}`;
  const numberInput = (attrs, f, value, label) => `<div class="j-num"><button type="button" class="j-step" data-step="-1" tabindex="-1" aria-label="Decrease ${escape(label)}">▼</button><input ${attrs} type="number" step="any" inputmode="decimal"${bounds(f)} value="${escape(value)}"><button type="button" class="j-step" data-step="1" tabindex="-1" aria-label="Increase ${escape(label)}">▲</button></div>`;
  function stepInput(input, direction) {
    const m = kit.method, id = input.name;
    const f = id === 'dropout' ? { min: 0, max: .9 } : m.fieldView(id, kit.state.draft);
    const next = kit.methods.stepValue(input.value, direction, f);
    if (next === null) return;
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function field(id, extra = false) {
    const m = kit.method, f = m.fieldView(id, kit.state.draft), value = kit.state.draft[id];
    if (f.hidden) return '';
    const attrs = `id="j-${id}" name="${id}" ${extra ? `data-extra="${id}"` : 'required'} aria-describedby="j-hint-${id}"`;
    const control = f.options
      ? `<select ${attrs}>${f.options.map(option => `<option value="${escape(option.value)}" ${value === option.value ? 'selected' : ''}>${escape(option.label)}</option>`).join('')}</select>`
      : numberInput(attrs, f, value, f.label);
    return `<div class="j-field"><div class="j-field-label"><label for="j-${id}">${f.label}</label>${kit.helpButton(id, `Help with ${f.label}`)}</div>${control}<small id="j-hint-${id}">${f.hint}</small>${f.presets ? `<div class="j-presets" aria-label="${f.label} presets">${f.presets.map(v => `<button type="button" data-preset="${id}:${v}" aria-label="Set ${f.label} to ${v}">${v}</button>`).join('')}</div>` : ''}</div>`;
  }
  const designFields = () => kit.method.designFields.map(id => field(id)).join('');
  function effectFields() {
    const m = kit.method, selected = m.modes.find(mode => mode.id === kit.state.draft.mode);
    return `<div class="j-fields effect-fields${selected?.repeat ? ' j-repeat-fields' : ''}">${m.inputFields(kit.state.draft).map(id => field(id)).join('')}</div>${selected?.repeat ? '<p class="j-small">All group means have equal weight. Change the group count above; hidden group values are retained.</p>' : ''}`;
  }

  // ---- Corner advice: unusual but valid inputs. Advisory only; never blocks a calculation. ----
  function advice() {
    const m = kit.method, out = [];
    let p;
    try { p = m.normalize(kit.state.draft); } catch { return out; }
    const r = kit.state.outcome && !kit.state.stale ? kit.state.outcome.result : null;
    if (['d', 'dᶻ'].includes(m.effectSymbol) && Math.abs(p.effect) > 1) out.push(`${m.effectSymbol} = ${Number(Math.abs(p.effect).toPrecision(3))} is a huge effect. Most real treatments land well below 1. Is this optimistic?`);
    if (p.power < .8) out.push(`Power ${pct(p.power)} misses a real effect more than one time in five.`);
    if (p.ratio !== undefined && (p.ratio > 3 || p.ratio < 1 / 3)) out.push('Allocation beyond 3:1 buys the same power with a lot more total sample.');
    if (!m.marginPlanning && p.alpha > .05) out.push(`Alpha ${p.alpha} is lenient. Check what your field and reviewers accept.`);
    if (r && m.unit !== 'observed events') {
      const smallest = Math.min(r.n, r.n2 || r.n);
      if (smallest < 10) out.push(`Only ${smallest} per group. Approximations and normality checks get shaky this small.`);
    }
    out.push(...(m.advice?.(p, r) ?? []));
    return out;
  }
  function bubbleText() {
    const f = kit.fighter, s = kit.state;
    if (arenaError) return { text: arenaError, tone: 'error' };
    if (s.outcome && s.stale) return { text: kit.pick(content.lines.stale), tone: 'stale' };
    if (s.outcome) return { text: kit.pick(kit.pool(f, 'resultTitle')), tone: 'win' };
    const tip = advice()[0];
    return tip ? { text: tip, tone: 'advice' } : { text: kit.pick(kit.pool(f, 'waiting')), tone: '' };
  }
  // The Null's corner: a taunt while waiting, a grudging line after a fresh result, silent otherwise.
  function nullText() {
    const s = kit.state;
    if (arenaError || (s.outcome && s.stale)) return '';
    return s.outcome ? kit.pick(content.cpu.defeats, 2) : kit.pick(content.cpu.taunts, 1);
  }
  function refreshCorner() {
    const bubble = kit.root.querySelector('#j-bubble'), b = bubbleText();
    if (bubble) { bubble.textContent = b.text; bubble.dataset.tone = b.tone; }
    const nullBubble = kit.root.querySelector('#j-null-bubble'), taunt = nullText();
    if (nullBubble) { nullBubble.textContent = taunt; nullBubble.hidden = !taunt; }
    const box = kit.root.querySelector('#j-advice'), tips = advice();
    if (box) { box.hidden = !tips.length; box.querySelector('ul').innerHTML = tips.map(t => `<li>${escape(t)}</li>`).join(''); }
    const clock = kit.root.querySelector('#j-clock b');
    if (clock) clock.textContent = kit.state.draft.alpha;
  }

  // ---- Life bars ----
  function bars() {
    const s = kit.state, you = kit.root.querySelector('#j-you-bar'), cpu = kit.root.querySelector('#j-null-bar');
    if (!you) return;
    const ring = kit.root.querySelector('.j-ring');
    ring.classList.toggle('stale', Boolean(s.outcome && s.stale));
    if (s.outcome) {
      const power = s.outcome.result.power;
      you.style.width = `${power * 100}%`; cpu.style.width = `${(1 - power) * 100}%`;
      kit.root.querySelector('#j-you-label').textContent = `POWER ${pct(power)}`;
      kit.root.querySelector('#j-null-label').textContent = `TYPE II ${pct(1 - power)}`;
    } else {
      const target = Number(s.draft.power);
      you.style.width = Number.isFinite(target) ? `${Math.min(1, Math.max(0, target)) * 100}%` : '0%'; cpu.style.width = '100%';
      kit.root.querySelector('#j-you-label').textContent = `TARGET ${Number.isFinite(target) ? pct(target) : '?'}`;
      kit.root.querySelector('#j-null-label').textContent = 'TYPE II ?';
    }
    ring.classList.toggle('awaiting', !s.outcome);
  }

  // ---- Result panel ----
  function waiting() {
    const m = kit.method;
    return `<div class="j-waiting"><div class="j-versus" aria-hidden="true">VS</div><h2>THE NULL</h2><p>“${escape(kit.pick(content.cpu.taunts, 1))}”</p><p>Set your parameters.<br>${m.waitingAction ?? 'Find the sample size.'}<br>Make a grand entrance.</p><div class="j-empty-score">N = ?</div><span class="j-kicker">AWAITING YOUR MOVE</span></div>`;
  }
  function headline() {
    const { outcome, stale } = kit.state, m = kit.method, f = kit.fighter;
    if (!outcome) return waiting();
    const { parameters: p, result: r } = outcome;
    return `<div class="j-result-head j-victory-head"><p class="j-kicker">${stale ? 'PARAMETERS CHANGED' : 'K.O. / CALCULATION COMPLETE'}</p><h2 class="j-slant">${stale ? 'REMATCH?' : 'YOU WIN'}</h2><p class="j-victory-line">${stale ? 'Ready for a rematch?' : escape(kit.pick(kit.pool(f, 'resultTitle')))}</p></div>
      ${stale ? '<p class="j-stale" role="status">Previous result — recalculate to update. Copy and share are paused.</p>' : ''}
      <div class="j-score"><span>${m.scoreLabel ?? 'REQUIRED SAMPLE SIZE'}</span><strong>${fmt.format(r.total)}</strong><span>${m.totalLabel}</span></div>
      <div class="j-group-counts">${m.allocations(r, p).map(([label, value]) => `<div>${escape(label.toUpperCase())}<strong>${fmt.format(value)}</strong></div>`).join('')}</div>
      <div class="j-power-label"><span>${m.powerLabel ?? 'ACHIEVED POWER'}</span><b>${pct(r.power)}</b></div>
      <meter min="0" max="1" value="${r.power}" aria-label="Achieved power">${pct(r.power)}</meter>
      <p class="j-small">Target ${pct(p.power)} · Complete, analyzable ${m.unit}.</p>
      <p class="j-small j-disclaimer">${escape(content.disclaimer.short)}</p>
      ${m.calculationNote ? `<p class="j-small j-calculation-note">${escape(m.calculationNote)}</p>` : ''}`;
  }

  // Dropout allowance: a separate line, so the verified number is never altered.
  function enrolment(d) {
    const { parameters: p, result: r } = kit.state.outcome, up = v => Math.ceil(v / (1 - d) - 1e-9);
    if (r.n2) { const a = up(r.n), b = up(r.n2); return { total: a + b, detail: `${fmt.format(a)} + ${fmt.format(b)}` }; }
    if (p.groups) { const a = up(r.n); return { total: a * p.groups, detail: `${fmt.format(a)} × ${p.groups} groups` }; }
    return { total: up(r.total), detail: '' };
  }
  function dropoutLine() {
    const raw = kit.state.draft.dropout, d = Number(raw);
    if (raw === undefined || !String(raw).trim() || d === 0) return 'No dropout allowance. Enter a proportion to see how many to enrol.';
    if (!Number.isFinite(d) || d < 0 || d >= .9) return 'Dropout allowance must be a proportion from 0 to below 0.9.';
    const e = enrolment(d), r = kit.state.outcome.result;
    return `ENROL ${fmt.format(e.total)}${e.detail ? ` (${e.detail})` : ''} so that about ${fmt.format(r.total)} remain after ${(d * 100).toFixed(1).replace(/\.0$/, '')}% dropout.`;
  }
  const tableRaw = () => ({ ...kit.state.outcome.raw, ...Object.fromEntries(kit.extraKeys(kit.method).map(k => [k, kit.state.draft[k]])) });
  function tables() {
    const m = kit.method;
    if (!m.resultTables || !kit.state.outcome) return [];
    const { parameters: p, result: r } = kit.state.outcome;
    return m.resultTables(tableRaw(), p, r, stats);
  }
  const tableHtml = t => `<div class="j-table-wrap" tabindex="0" role="region" aria-label="${escape(t.title)}"><table class="j-table${t.columns ? ' j-wide' : ''}"><caption>${escape(t.title)}</caption>${t.columns ? `<thead><tr>${t.columns.map(c => `<th scope="col">${escape(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${t.rows.map(row => t.columns ? `<tr>${row.map(c => `<td>${escape(c)}</td>`).join('')}</tr>` : `<tr><th scope="row">${escape(row[0])}</th><td>${escape(row[1])}</td></tr>`).join('')}</tbody></table></div>${t.note ? `<p class="j-small">${escape(t.note)}</p>` : ''}`;
  function extrasOut() {
    if (!kit.state.outcome) return '';
    return `${kit.method.dropout === false ? '' : `<p class="j-dropout-out">${escape(dropoutLine())}</p>`}${tables().map(tableHtml).join('')}`;
  }
  function afterResult() {
    const { outcome, stale } = kit.state, m = kit.method;
    if (!outcome) return '';
    const { parameters: p, result: r, raw } = outcome;
    const extras = [...(m.dropout === false ? [] : ['dropout']), ...(m.extraFields ?? [])];
    return `<section class="j-extras" aria-labelledby="j-extras-title">
        <h3 id="j-extras-title">${escape(m.extraTitle ?? 'PLANNING EXTRAS')}</h3>
        <div class="j-fields">${extras.map(id => id === 'dropout' ? dropoutField() : field(id, true)).join('')}</div>
        <div id="j-extras-out" aria-live="polite">${extrasOut()}</div>
      </section>
      <section class="j-curve-box" aria-labelledby="j-curve-title"><h3 id="j-curve-title">POWER CURVE / WHAT IF?</h3><div id="j-curve"><p class="j-small">Charging the power curve…</p></div></section>
      <details class="j-receipt"><summary>View the calculation receipt</summary><dl><dt>Method</dt><dd>${m.name}</dd>${m.receipt(raw, p, r).map(([label, value]) => `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join('')}<dt>Engine / method</dt><dd>${stats.version ?? '1'} / ${m.version}</dd></dl><p>${m.allocationRule}</p></details>
      <button class="j-edit-inputs j-text-link" data-edit-inputs type="button">↑ Edit parameters / Rematch</button>
      <div class="j-result-actions"><button class="j-button" data-copy="result" ${stale ? 'disabled' : ''}>COPY RESULT</button><button class="j-button" data-copy="link" ${stale ? 'disabled' : ''}>COPY LINK</button></div>
      <p id="j-copy-status" class="j-small" role="status"></p><textarea id="j-manual-copy" aria-label="Result or link to copy" readonly hidden></textarea>`;
  }
  const dropoutField = () => `<div class="j-field"><div class="j-field-label"><label for="j-dropout">Dropout allowance</label>${kit.helpButton('dropout', 'Help with dropout allowance')}</div>${numberInput('id="j-dropout" name="dropout" data-extra="dropout" aria-describedby="j-hint-dropout"', { min: 0, max: .9 }, kit.state.draft.dropout ?? '0', 'dropout allowance')}<small id="j-hint-dropout">Proportion expected to drop out, e.g. 0.1. Shown separately; the result above is unchanged.</small><div class="j-presets" aria-label="Dropout presets">${['0', '0.1', '0.2'].map(v => `<button type="button" data-preset="dropout:${v}" aria-label="Set dropout to ${v}">${v}</button>`).join('')}</div></div>`;

  // ---- Power curve and what-if table, from the method's own fixed-size evaluator ----
  function curveSvg(points, p, r) {
    const W = 320, H = 168, L = 36, R = 10, T = 10, B = 26;
    const xs = points.map(([x]) => x), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const X = x => L + (x - x0) / Math.max(1, x1 - x0) * (W - L - R), Y = y => T + (1 - y) * (H - T - B);
    const path = points.map(([x, y], i) => `${i ? 'H' : 'M'}${X(x).toFixed(1)}${i ? ` V${Y(y).toFixed(1)}` : ` ${Y(y).toFixed(1)}`}`).join(' ');
    const first = points[0], last = points.at(-1);
    const label = `Power curve. Power rises from ${pct(first[1])} at ${fmt.format(first[0])} to ${pct(last[1])} at ${fmt.format(last[0])} ${kit.method.unit}. The target ${pct(p.power)} is first reached at ${fmt.format(r.total)}.`;
    return `<svg class="j-curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(label)}" shape-rendering="crispEdges">
      ${[0, .5, 1].map(y => `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}"/><text x="${L - 4}" y="${Y(y) + 3}" text-anchor="end">${y * 100}%</text>`).join('')}
      <line class="target" x1="${L}" x2="${W - R}" y1="${Y(p.power)}" y2="${Y(p.power)}"/>
      <path class="line" d="${path}"/>
      <rect class="you" x="${X(r.total) - 4}" y="${Y(r.power) - 4}" width="8" height="8"/>
      ${[x0, r.total, x1].map((x, i) => `<text x="${X(x)}" y="${H - 8}" text-anchor="${['start', 'middle', 'end'][i]}">${fmt.format(x)}</text>`).join('')}
    </svg>`;
  }
  function drawCurve() {
    const outcome = kit.state.outcome, target = kit.root.querySelector('#j-curve');
    if (!outcome || !target) return;
    const m = kit.method, { parameters: p, result: r } = outcome, points = [];
    const lo = Math.max(1, Math.floor(r.n / 4)), hi = Math.max(r.n * 2, r.n + 8), step = Math.max(1, Math.ceil((hi - lo) / 28));
    for (let n = lo; n <= hi; n += step) { try { const q = m.powerAt(stats, p, n); points.push([q.total, q.power]); } catch { /* below the method's minimum */ } }
    points.push([r.total, r.power]);
    points.sort((a, b) => a[0] - b[0]);
    const unique = points.filter((pt, i) => i === 0 || pt[0] !== points[i - 1][0]);
    const rows = [.8, .9, .95].map(t => {
      try { const x = m.solve(stats, { ...p, power: t }, m.id); return `<tr${Math.abs(t - p.power) < 1e-12 ? ' class="current"' : ''}><th scope="row">${pct(t)}</th><td>${fmt.format(x.total)}</td><td>${pct(x.power)}</td></tr>`; }
      catch { return `<tr><th scope="row">${pct(t)}</th><td colspan="2">Beyond the 1,000,000 limit</td></tr>`; }
    }).join('');
    if (kit.state.outcome !== outcome) return;
    target.innerHTML = `${unique.length > 1 ? curveSvg(unique, p, r) : ''}<table class="j-table j-whatif"><caption>What if you wanted more power?</caption><thead><tr><th scope="col">Target</th><th scope="col">${escape(m.totalLabel.toLowerCase())}</th><th scope="col">Achieved</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function refreshResult() {
    finishFight?.(false);
    kit.root.querySelector('#j-result').innerHTML = headline();
    kit.root.querySelector('#j-after').innerHTML = afterResult();
    kit.root.querySelector('.j-fight').innerHTML = `${kit.state.outcome ? 'REMATCH / RECALCULATE' : 'FIGHT! / CALCULATE'} <span aria-hidden="true">▶</span>`;
    bars(); refreshCorner();
    if (kit.state.outcome) setTimeout(drawCurve, 30);
  }

  // ---- Fight sequence: ROUND 1 … FIGHT! … special move … K.O. and the score counts up. ----
  function fight(done) {
    const ring = kit.root.querySelector('.j-ring'), ko = ring.querySelector('.j-ko'), r = kit.state.outcome.result;
    const you = ring.querySelector('#j-you-bar'), cpu = ring.querySelector('#j-null-bar');
    let raf = 0;
    const show = (text, cls) => { ko.className = `j-ko ${cls}`; ko.innerHTML = text; };
    const finish = (complete = true) => {
      fightTimers.forEach(clearTimeout); fightTimers = []; cancelAnimationFrame(raf);
      document.removeEventListener('keydown', skip, true); document.removeEventListener('pointerdown', skip, true);
      ring.classList.remove('fighting'); ko.className = 'j-ko'; ko.innerHTML = ''; finishFight = null; bars();
      if (complete) done();
    };
    const skip = event => { if (event.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(event.key)) return; finish(); };
    finishFight = finish;
    document.addEventListener('keydown', skip, true); document.addEventListener('pointerdown', skip, true);
    ring.classList.add('fighting'); you.style.width = '0%'; cpu.style.width = '100%';
    const at = (ms, fn) => fightTimers.push(setTimeout(fn, ms));
    // Group sequential designs fight one round per look, each with its boundary; the bars close in
    // on the final values look by look. Everything else: ROUND 1, FIGHT!, the special move.
    const rounds = kit.method.rounds?.(r);
    let koAt = 1150;
    if (rounds) {
      const step = 360;
      rounds.forEach((label, k) => at(k * step, () => {
        const share = (k + 1) / rounds.length;
        show(label, k === rounds.length - 1 ? 'move' : 'round');
        you.style.width = `${r.power * share * 100}%`; cpu.style.width = `${(1 - r.power * share) * 100}%`;
      }));
      koAt = rounds.length * step + 120;
    } else {
      show('ROUND 1', 'round');
      at(380, () => show('FIGHT!', 'go'));
      at(720, () => { show(escape(kit.fighter.move.toUpperCase()), 'move'); you.style.width = `${r.power * 100}%`; cpu.style.width = `${(1 - r.power) * 100}%`; });
    }
    at(koAt, () => {
      show('K.O.<b>0</b>', 'ko');
      const count = ko.querySelector('b'), start = performance.now();
      const tick = now => { const t = Math.min(1, (now - start) / 450); count.textContent = fmt.format(Math.round(r.total * t)); if (t < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    });
    at(koAt + 650, () => finish());
  }

  // ---- Copying ----
  async function copy(kind) {
    const s = kit.state, m = kit.method;
    if (!s.outcome || s.stale) return;
    const { result: r, parameters: p } = s.outcome, raw = tableRaw();
    const text = kind === 'link' ? location.href.split('#')[0] + kit.urlFor(raw, true) : [
      `STAT FIGHTER ’89 — ${m.name}`, `Required: ${r.total} ${m.unit}`,
      ...m.allocations(r, p).map(([label, value]) => `${label}: ${value}`), `Achieved power: ${pct(r.power)}; target: ${pct(p.power)}`,
      ...(m.dropout === false || !Number(s.draft.dropout) ? [] : [dropoutLine()]),
      ...m.receipt(s.outcome.raw, p, r).map(([label, value]) => `${label}: ${value}`),
      ...tables().flatMap(t => [t.title, ...(t.columns ? [t.columns.join(' | ')] : []), ...t.rows.map(row => row.join(t.columns ? ' | ' : ': ')), ...(t.note ? [t.note] : [])]),
      m.assumptions, m.allocationRule, `Engine ${stats.version ?? '1'} / method ${m.version}; objective: sample size.`, content.disclaimer.copy,
    ].join('\n');
    const status = kit.root.querySelector('#j-copy-status');
    try { await navigator.clipboard.writeText(text); status.textContent = `${kind === 'link' ? 'Link' : 'Result'} copied.`; }
    catch { const area = kit.root.querySelector('#j-manual-copy'); area.hidden = false; area.value = text; area.focus(); area.select(); status.textContent = 'Select and copy the text below.'; }
  }

  // ---- Screen ----
  kit.screens.arena = {
    label: 'Arena',
    title: () => `${kit.fighter.name} / Arena`,
    render() {
      const f = kit.fighter, m = kit.method, s = kit.state;
      arenaError = '';
      const b = bubbleText();
      return kit.cabinet(`<section class="j-ring${f.artPending ? ' no-art' : ''}" style="${kit.stageStyle(f)}" role="group" aria-labelledby="main-heading">
          <div class="j-fightbar" aria-hidden="true">
            <div class="j-life you"><span class="j-life-name">${escape(f.name.toUpperCase())}</span><span class="j-life-bar"><i id="j-you-bar"></i></span><small id="j-you-label"></small></div>
            <div class="j-clock" id="j-clock"><small>α</small><b>${escape(s.draft.alpha)}</b></div>
            <div class="j-life cpu"><span class="j-life-name">THE NULL</span><span class="j-life-bar"><i id="j-null-bar"></i></span><small id="j-null-label"></small></div>
          </div>
          <div class="j-ring-floor">
            <div class="j-corner you"><div class="j-bubble j-ring-bubble" id="j-bubble" data-tone="${b.tone}" aria-hidden="true">${escape(b.text)}</div>${kit.portrait(f, 'j-ring-portrait', { alt: `${f.name}, ready to fight.` })}</div>
            <div class="j-ko" aria-hidden="true"></div>
            <div class="j-corner cpu"><div class="j-bubble j-ring-bubble cpu" id="j-null-bubble" aria-hidden="true" hidden></div>${kit.nullFigure('j-ring-null')}</div>
          </div>
          <div class="j-ring-caption">
            <div><p class="j-kicker">${escape(f.stage.toUpperCase())} / ${m.missionLabel ?? 'SAMPLE SIZE MISSION'}</p><h1 id="main-heading" tabindex="-1">${escape(f.name)}’s arena</h1><p>${escape(m.name)}</p></div>
            <nav aria-label="Arena navigation"><a href="${kit.path('profile')}" class="j-text-link">← Challenge card</a><a href="#select" class="j-text-link">Switch fighter</a></nav>
          </div>
        </section>
        <div class="j-arena-layout">
          <section class="j-console frame" aria-labelledby="j-movelist">
            <form id="j-arena-form" novalidate>
              <div class="j-console-heading"><h2 id="j-movelist">MOVE LIST / SET YOUR MOVE</h2>${kit.helpButton('assumptions', 'Study assumptions')}</div>
              ${m.notice ? `<p class="j-method-notice">${escape(m.notice)}</p>` : ''}
              ${m.designFields.length ? `<div class="j-fields j-design-fields">${designFields()}</div>` : ''}
              <fieldset class="j-mode"><legend>Enter your effect</legend><div>${m.modes.map(mode => `<label><input type="radio" name="mode" value="${mode.id}" ${s.draft.mode === mode.id ? 'checked' : ''}><span>${mode.label}</span></label>`).join('')}</div></fieldset>
              <div id="j-effect-fields">${effectFields()}</div>
              <p id="j-derived" class="j-derived"></p>
              ${m.signed ? `<fieldset class="j-alternative"><legend>Alternative hypothesis ${kit.helpButton('alternative', 'Help with alternative hypothesis')}</legend><div>${[['two-sided', '≠ TWO-SIDED'], ['greater', '> GREATER'], ['less', '< LESS']].map(([value, label]) => `<label><input type="radio" name="alternative" value="${value}" ${s.draft.alternative === value ? 'checked' : ''}><span>${escape(label)}</span></label>`).join('')}</div></fieldset>` : ''}
              <h2 class="j-subhead">TUNE YOUR POWER</h2>
              <div class="j-fields">${m.tuningFields.map(id => field(id)).join('')}</div>
              <aside class="j-advice" id="j-advice" hidden><h3>CORNER ADVICE <span>· ${escape(f.name.toUpperCase())}</span></h3><ul></ul><p class="j-small">Advice only. It never blocks a calculation.</p></aside>
              <details><summary>Study assumptions & limits</summary><p>${m.assumptions} This plans sample size, not a p-value. Search limit: one million total units.</p></details>
              <p id="j-error" class="j-error" role="alert" ${kit.routeError ? '' : 'hidden'}>${escape(kit.routeError)}</p>
              <button class="j-button hot j-fight" type="submit">${s.outcome ? 'REMATCH / RECALCULATE' : 'FIGHT! / CALCULATE'} <span aria-hidden="true">▶</span></button>
              <p class="j-small">${escape(f.name)}’s draft is kept separately on this device when storage is available.</p>
            </form>
          </section>
          <section class="j-scoreboard frame" aria-label="Calculation result">
            <div class="j-console-heading"><h2>${f.scoreTitle}</h2>${kit.helpButton('verification', 'How the calculation engine is verified')}</div>
            <div id="j-result" aria-live="polite">${headline()}</div>
            <div id="j-after">${afterResult()}</div>
          </section>
        </div>`, 'NO GUTS. JUST GOOD ASSUMPTIONS.');
    },
    afterRender() {
      bars(); refreshCorner(); derived();
      if (kit.state.outcome) setTimeout(drawCurve, 30);
    },
    leave() { finishFight?.(false); },
    click(event) {
      if (event.target.closest('[data-edit-inputs]')) {
        kit.root.querySelector('#j-arena-form').scrollIntoView({ block: 'start' });
        kit.root.querySelector('#j-arena-form input[type=number], #j-arena-form select').focus({ preventScroll: true });
        return true;
      }
      const copyButton = event.target.closest('[data-copy]');
      if (copyButton) { copy(copyButton.dataset.copy); return true; }
      return false;
    },
    wire() { wireForm(); },
  };

  function derived() { const target = kit.root.querySelector('#j-derived'); if (target) target.textContent = kit.method.derive(kit.state.draft); }
  function syncDraft(form) {
    const m = kit.method, s = kit.state, raw = Object.fromEntries(new FormData(form));
    for (const key of Object.keys(m.defaults)) if (Object.hasOwn(raw, key)) s.draft[key] = raw[key];
    if (s.outcome) s.stale = true;
    delete s.kept; kit.save(); kit.replaceUrl(kit.urlFor(s.draft));
  }
  function updateExtra(input) {
    const s = kit.state;
    s.draft[input.dataset.extra] = input.value; delete s.kept; kit.save();
    kit.replaceUrl(kit.urlFor(s.outcome && !s.stale ? tableRaw() : s.draft, Boolean(s.outcome && !s.stale)));
    const out = kit.root.querySelector('#j-extras-out');
    if (out) out.innerHTML = extrasOut();
  }

  function wireForm() {
    const form = kit.root.querySelector('#j-arena-form'), m = () => kit.method;
    kit.root.oninput = event => {
      if (event.target.dataset.extra) { updateExtra(event.target); return; }
      if (!form.contains(event.target) || event.target.name === 'mode') return;
      const wasFresh = kit.state.outcome && !kit.state.stale;
      syncDraft(form); derived(); arenaError = '';
      for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
      kit.root.querySelector('#j-error').hidden = true;
      if (wasFresh) refreshResult(); else { bars(); refreshCorner(); }
    };
    form.onchange = event => {
      if (event.target.name === 'mode') {
        const mode = event.target.value; syncDraft(form); kit.state.draft.mode = mode; kit.save();
        kit.replaceUrl(kit.urlFor(kit.state.draft));
        kit.rerender();
        kit.root.querySelector(`input[name="mode"][value="${mode}"]`)?.focus();
      } else if (m().refreshOn?.includes(event.target.name)) {
        // A choice that shows, hides or relabels other design fields (Bell and Towel's ρ / γ).
        const name = event.target.name; syncDraft(form); m().fieldChanged?.(name, kit.state.draft); kit.save();
        kit.replaceUrl(kit.urlFor(kit.state.draft));
        kit.root.querySelector('.j-design-fields').innerHTML = designFields(); derived();
        kit.root.querySelector(`#j-${name}`)?.focus();
      } else {
        const repeat = m().modes.find(mode => mode.id === kit.state.draft.mode)?.repeat;
        if (repeat?.count === event.target.name) { syncDraft(form); kit.root.querySelector('#j-effect-fields').innerHTML = effectFields(); derived(); }
      }
    };
    // ▼ ▲ buttons (also the extras, outside the form) and the arrow keys on a number field.
    // The screen root outlives the arena, so these listeners are added once and act only on .j-num.
    if (!stepWired) {
      stepWired = true;
      kit.root.addEventListener('click', event => {
        const button = event.target.closest('.j-num [data-step]');
        if (button) stepInput(button.parentElement.querySelector('input'), Number(button.dataset.step));
      });
      kit.root.addEventListener('keydown', event => {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !event.target.matches?.('.j-num input')) return;
        event.preventDefault(); stepInput(event.target, event.key === 'ArrowUp' ? 1 : -1);
      });
    }
    form.onsubmit = event => {
      event.preventDefault(); syncDraft(form); kit.emit('calculationStarted');
      const errorBox = kit.root.querySelector('#j-error'); errorBox.hidden = true; arenaError = '';
      for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
      const s = kit.state, method = m();
      try {
        const parameters = method.normalize(s.draft), result = method.solve(stats, parameters, method.id);
        s.outcome = { parameters, result, raw: kit.coreDraft(method, s.draft) }; s.stale = false; kit.routeError = ''; s.seed = kit.newSeed();
        kit.replaceUrl(kit.urlFor(tableRaw(), true));
        kit.recordScore({ id: method.id, name: kit.fighter.name, total: result.total, unit: method.unit, power: result.power, at: new Date().toISOString().slice(0, 10), link: kit.urlFor(tableRaw(), true) });
        refreshResult(); kit.refreshHud(); kit.emit('calculationSucceeded');
        // At any width: show the ring for the fight if it is off screen, then bring the result
        // into view. In one column the result sits below the form, so it always scrolls there.
        const phone = window.matchMedia('(max-width: 760px)').matches;
        const offScreen = el => { const box = el.getBoundingClientRect(); return box.top < 0 || box.top > window.innerHeight * .6; };
        const reveal = el => { if (phone || offScreen(el)) el.scrollIntoView({ block: 'start' }); };
        const toScore = () => reveal(kit.root.querySelector('.j-scoreboard'));
        if (kit.motion()) {
          const ring = kit.root.querySelector('.j-ring'), box = ring.getBoundingClientRect();
          if (box.top < 0 || box.bottom > window.innerHeight) ring.scrollIntoView({ block: 'start' });
          fight(toScore);
        } else toScore();
      } catch (error) {
        errorBox.textContent = error.message; errorBox.hidden = false; arenaError = error.message;
        const input = form.querySelector(error.field === 'alternative' ? 'input[name="alternative"]:checked' : `#j-${error.field}`);
        if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
        if (s.outcome) refreshResult(); else refreshCorner();
        kit.emit('validationFailed');
      }
    };
  }

  // Presets for extra fields (dropout) live outside the form; the router dispatches an input event.
  kit.arena = { field, refreshResult };
}
