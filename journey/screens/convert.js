'use strict';
// TRAINING ROOM: conversions only, no opponent. Turns what a paper reports (a CV, a CI, two
// medians…) into what a fighter asks for. State lives in the URL; drafts are also kept per tool.
// A `to=method.field` link from an arena field adds a USE button that writes the value back.
{
  const kit = globalThis.StatFighter.kit;
  const { content, escape } = kit;
  const convert = globalThis.StatFighter.convert;
  const storageKey = 'stat-fighter:convert:v1';
  const show = x => String(Number(x.toPrecision(6)));
  let view = null;

  function loadDrafts() { try { const saved = JSON.parse(localStorage.getItem(storageKey)); return saved && typeof saved === 'object' ? saved : {}; } catch { return {}; } }
  function saveDrafts() {
    try {
      const saved = loadDrafts(); saved.tool = view.tool.id; saved.modes = { ...saved.modes, [view.tool.id]: view.mode.id };
      saved.values = { ...saved.values, [view.tool.id]: { ...saved.values?.[view.tool.id], ...view.values } };
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch { /* storage unavailable */ }
  }

  // Read the hash, then fall back to the saved draft, then to each field's example value.
  function readState() {
    const query = new URLSearchParams(location.hash.split('?')[1] ?? ''), saved = loadDrafts();
    const to = convert.target(query.get('to'));
    const toolId = [query.get('tool'), to?.tool, saved.tool].find(id => id && Object.hasOwn(convert.byId, id)) ?? convert.tools[0].id;
    const tool = convert.byId[toolId];
    const wantedMode = query.get('mode') ?? (to && to.tool === toolId ? convert.modeFor(toolId, to.key) : saved.modes?.[toolId]);
    const mode = tool.modes.find(m => m.id === wantedMode) ?? tool.modes[0];
    const values = {};
    for (const id of Object.keys(tool.fields)) {
      const fromUrl = query.get(id), fromSaved = saved.values?.[toolId]?.[id];
      values[id] = typeof fromUrl === 'string' ? fromUrl : typeof fromSaved === 'string' ? fromSaved : tool.fields[id].example;
    }
    return { tool, mode, values, to: to && to.tool === toolId ? to : null };
  }
  function urlFor() {
    const params = new URLSearchParams({ tool: view.tool.id, mode: view.mode.id });
    for (const id of view.mode.inputs) params.set(id, view.values[id]);
    if (view.to) params.set('to', `${view.to.method}.${view.to.field}`);
    return `#convert?${params}`;
  }

  // Never throws: a bad input becomes an alert line and an empty table.
  function compute() {
    const numbers = Object.fromEntries(view.mode.inputs.map(id => [id, String(view.values[id] ?? '').trim() === '' ? NaN : Number(view.values[id])]));
    try { return { out: view.tool.compute(view.mode.id, numbers) }; } catch (error) { return { error: error.message || 'These values cannot be converted.', field: error.field }; }
  }
  function useLabel() { return `USE IN ${content.fighters[view.to.method].name.toUpperCase()}’S ARENA`; }
  function resultHtml() {
    const r = compute();
    if (r.error) return `<p class="j-error" role="alert">${escape(r.error)}</p>`;
    const rows = r.out.rows.map(([label, value, key]) => {
      const use = view.to && view.to.key === key;
      return `<tr${use ? ' class="current"' : ''}><th scope="row">${escape(label)}</th><td>${escape(show(value))}</td><td class="j-convert-actions">${use ? `<button type="button" class="j-button hot" data-use="${escape(key)}">${escape(useLabel())} <span aria-hidden="true">▶</span></button>` : ''}<button type="button" class="j-button" data-copy-value="${escape(show(value))}" aria-label="Copy ${escape(label)}">COPY</button></td></tr>`;
    }).join('');
    return `<div class="j-table-wrap" tabindex="0" role="region" aria-label="Converted values"><table class="j-table j-convert-table"><caption>Converted values</caption><tbody>${rows}</tbody></table></div><p class="j-small j-convert-note">${escape(r.out.note)}</p>`;
  }
  function refresh() {
    const out = kit.root.querySelector('#j-convert-out');
    if (out) out.innerHTML = resultHtml();
    const r = compute();
    for (const input of kit.root.querySelectorAll('.j-convert-fields input')) input.toggleAttribute('aria-invalid', r.field === input.name);
  }

  const numberInput = (id, f, value) => `<div class="j-cnum"><button type="button" class="j-step" data-cstep="-1" tabindex="-1" aria-label="Decrease ${escape(f.label)}">▼</button><input id="j-c-${id}" name="${id}" type="number" step="any" inputmode="decimal" value="${escape(value)}" aria-describedby="j-c-hint-${id}"><button type="button" class="j-step" data-cstep="1" tabindex="-1" aria-label="Increase ${escape(f.label)}">▲</button></div>`;
  const stepBounds = { positive: { min: 0 }, nonneg: { min: 0 }, prob: { min: 0, max: 1 }, unit: { min: 0, max: 1 }, corr: { min: -1, max: 1 }, above1: { min: 1 }, count: { min: 2 } };
  function step(input, direction) {
    const kind = view.tool.fields[input.name]?.kind;
    let next = kit.methods.stepValue(input.value, direction, stepBounds[kind] ?? {});
    if (next === null) return;
    if (kind === 'count') next = Math.max(2, Math.round(next));
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function copyText(text, label) {
    const status = kit.root.querySelector('#j-convert-status');
    try { await navigator.clipboard.writeText(text); status.textContent = `${label} copied.`; }
    catch { const area = kit.root.querySelector('#j-convert-copy'); area.hidden = false; area.value = text; area.focus(); area.select(); status.textContent = 'Select and copy the value below.'; }
  }
  function use(key) {
    const r = compute(), row = r.out?.rows.find(x => x[2] === key);
    if (!row || !view.to) return;
    const { method: id, field } = view.to, m = kit.methods[id], s = kit.states[id];
    s.draft[field] = String(Number(row[1].toPrecision(6)));
    if (!m.modes.find(mode => mode.id === s.draft.mode)?.fields.includes(field)) {
      const owner = m.modes.find(mode => mode.fields.includes(field));
      if (owner) s.draft.mode = owner.id;
    }
    if (s.outcome) s.stale = true;
    delete s.kept; kit.save();
    location.hash = kit.path('arena', id);
  }

  kit.screens.convert = {
    label: 'Training Room',
    render() {
      view = readState();
      const { tool, mode, values, to } = view;
      const toolList = convert.tools.map(t => `<button type="button" class="j-button${t === tool ? ' hot' : ''}" data-tool="${t.id}" aria-pressed="${t === tool}">${escape(t.title.toUpperCase())}<span aria-hidden="true">${t === tool ? '▶' : ''}</span></button>`).join('');
      const back = to ? `<p class="j-convert-return">For <b>${escape(content.fighters[to.method].name)}</b>: ${escape(kit.methods[to.method].fieldView(to.field, kit.states[to.method].draft).label ?? to.field)}. <a class="j-text-link" href="${kit.path('arena', to.method)}">← Back to the arena without a value</a></p>` : '';
      return kit.cabinet(`${kit.heading('TRAINING ROOM / NO OPPONENT', 'Convert your numbers', 'Translate what you know into what the fighters ask for. Nothing here is a sample size.')}
        <div class="j-convert">
          <nav class="j-convert-tools" aria-label="Conversion tools" data-arrow-nav>${toolList}</nav>
          <section class="j-convert-panel frame" aria-labelledby="j-convert-title">
            <div class="j-console-heading"><h2 id="j-convert-title">${escape(tool.title.toUpperCase())}</h2></div>
            <p class="j-small">${escape(tool.blurb)}</p>
            ${back}
            <fieldset class="j-mode j-convert-mode"><legend>I know…</legend><div>${tool.modes.map(m => `<label><input type="radio" name="convert-mode" value="${m.id}" ${m === mode ? 'checked' : ''}><span>${escape(m.label)}</span></label>`).join('')}</div></fieldset>
            <div class="j-fields j-convert-fields">${mode.inputs.map(id => { const f = tool.fields[id]; return `<div class="j-field"><div class="j-field-label"><label for="j-c-${id}">${escape(f.label)}</label></div>${numberInput(id, f, values[id])}${f.hint ? `<small id="j-c-hint-${id}">${escape(f.hint)}</small>` : ''}</div>`; }).join('')}</div>
            <div id="j-convert-out" aria-live="polite">${resultHtml()}</div>
            <p id="j-convert-status" class="j-small" role="status"></p><textarea id="j-convert-copy" aria-label="Value to copy" readonly hidden></textarea>
            <p class="j-small j-disclaimer">${escape(content.disclaimer.short)}</p>
          </section>
        </div>`, 'TRAINING ROOM / CONVERSIONS ONLY / NO WARRANTY');
    },
    afterRender() { refresh(); },
    wire() {
      kit.root.oninput = event => {
        const input = event.target;
        if (!input.closest?.('.j-convert-fields')) return;
        view.values[input.name] = input.value;
        saveDrafts(); kit.replaceUrl(urlFor()); refresh();
      };
      kit.root.onchange = event => {
        if (event.target.name !== 'convert-mode') return;
        const mode = view.tool.modes.find(m => m.id === event.target.value);
        if (!mode) return;
        view.mode = mode; saveDrafts(); kit.replaceUrl(urlFor()); kit.rerender();
        kit.root.querySelector(`input[name="convert-mode"][value="${mode.id}"]`)?.focus();
      };
      kit.root.addEventListener('keydown', event => {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !event.target.matches?.('.j-cnum input')) return;
        event.preventDefault(); step(event.target, event.key === 'ArrowUp' ? 1 : -1);
      }, { signal: (view.abort = new AbortController()).signal });
    },
    leave() { view?.abort?.abort(); kit.root.onchange = null; },
    click(event) {
      const tool = event.target.closest('[data-tool]');
      if (tool) {
        const params = new URLSearchParams({ tool: tool.dataset.tool });
        if (view.to && view.to.tool === tool.dataset.tool) params.set('to', `${view.to.method}.${view.to.field}`);
        location.hash = `#convert?${params}`; return true;
      }
      const stepper = event.target.closest('.j-cnum [data-cstep]');
      if (stepper) { step(stepper.parentElement.querySelector('input'), Number(stepper.dataset.cstep)); return true; }
      const copy = event.target.closest('[data-copy-value]');
      if (copy) { copyText(copy.dataset.copyValue, 'Value'); return true; }
      const useButton = event.target.closest('[data-use]');
      if (useButton) { use(useButton.dataset.use); return true; }
      return false;
    },
  };
}
