/**
 * Client-side filtering for list pages (Publications, Activities). No framework.
 *
 * Markup contract
 *   [data-filter]                    the form; its <select>/<input> names are the filter keys
 *   [data-chips="<key>"] button[data-value]   optional chip group for one key ("" = all)
 *   [data-filter-item]               an item; data-<key> holds its value, data-text the searchable text (key "q")
 *   [data-filter-group]              a group (e.g. a year) hidden when none of its items is shown
 *   [data-filter-empty]              shown when nothing matches
 *   [data-filter-count]              visually hidden, aria-live result count
 *
 * State lives in the query string (?type=journal&thread=xr&q=robot), so a filtered view can be
 * linked to, and survives the language switch. Without JavaScript every item is shown.
 */
export function initFilter(root = document) {
  const form = root.querySelector('[data-filter]');
  if (!form) return;
  const items = [...root.querySelectorAll('[data-filter-item]')];
  const groups = [...root.querySelectorAll('[data-filter-group]')];
  const empty = root.querySelector('[data-filter-empty]');
  const count = root.querySelector('[data-filter-count]');
  const chipGroups = [...form.querySelectorAll('[data-chips]')];
  const state = {};

  const controls = [...form.elements].filter((el) => el.name);
  const keys = [...new Set([...controls.map((el) => el.name), ...chipGroups.map((g) => g.dataset.chips)])];

  function read() {
    for (const el of controls) state[el.name] = el.value.trim();
  }

  function apply(push = true) {
    let n = 0;
    const q = (state.q ?? '').toLowerCase();
    for (const it of items) {
      const ok = keys.every((k) => {
        const v = state[k];
        if (!v) return true;
        if (k === 'q') return (it.dataset.text ?? '').includes(q);
        return it.dataset[k] === v;
      });
      it.hidden = !ok;
      if (ok) n++;
    }
    for (const g of groups) g.hidden = !g.querySelector('[data-filter-item]:not([hidden])');
    if (empty) empty.hidden = n > 0;
    if (count) count.textContent = `${n} ${count.dataset.label ?? ''}`.trim();
    for (const g of chipGroups) {
      for (const b of g.querySelectorAll('button[data-value]')) b.setAttribute('aria-pressed', String((state[g.dataset.chips] ?? '') === b.dataset.value));
    }
    if (push) {
      const params = new URLSearchParams(location.search);
      for (const k of keys) state[k] ? params.set(k, state[k]) : params.delete(k);
      const qs = params.toString();
      history.replaceState(null, '', (qs ? `?${qs}` : location.pathname) + location.hash);
    }
  }

  // restore from the URL
  const init = new URLSearchParams(location.search);
  for (const k of keys) state[k] = init.get(k) ?? '';
  for (const el of controls) if (state[el.name]) { el.value = state[el.name]; state[el.name] = el.value.trim(); }   // unknown values fall back to "all"
  for (const g of chipGroups) {
    const k = g.dataset.chips;
    if (state[k] && !g.querySelector(`button[data-value="${CSS.escape(state[k])}"]`)) state[k] = '';
  }

  form.addEventListener('input', () => { read(); apply(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); read(); apply(); });
  for (const g of chipGroups) {
    g.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-value]');
      if (!b) return;
      state[g.dataset.chips] = b.dataset.value;
      apply();
    });
  }
  apply(false);
}
