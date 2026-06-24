import { MLB, fetchJSON } from './api.js';
import { setTeamLogo } from './components.js';
import { escapeHtml } from './utils.js';

const SEASON = new Date().getFullYear();
let _cache = null;

export async function renderVenues() {
  const view = document.getElementById('view');
  renderSkeleton(view);

  try {
    if (!_cache) _cache = await loadAll();
    buildPage(view, _cache);
  } catch (err) {
    console.warn('Venues load failed', err);
    view.innerHTML = '<div class="stat-empty">Could not load ballparks right now.</div>';
  }
}

async function loadAll() {
  const teamsData = await fetchJSON(MLB.teams(SEASON));
  const teams = (teamsData.teams || []).filter(t => t.active !== false && t.sport?.id === 1);

  const results = await Promise.allSettled(
    teams.map(t =>
      fetchJSON(MLB.venueDetail(t.venue.id))
        .then(d => ({ team: t, venue: d.venues?.[0] }))
    )
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value?.venue)
    .map(r => r.value)
    .sort((a, b) => a.team.name.localeCompare(b.team.name));
}

function buildPage(view, items) {
  view.innerHTML = '';

  let activeLeague = 'all';
  let searchQ = '';

  const seg = document.createElement('div');
  seg.className = 'seg';

  [['all', 'All'], ['103', 'AL'], ['104', 'NL']].forEach(([id, label]) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.dataset.league = id;
    btn.setAttribute('aria-pressed', id === 'all' ? 'true' : 'false');
    btn.addEventListener('click', () => {
      activeLeague = id;
      seg.querySelectorAll('button').forEach(b =>
        b.setAttribute('aria-pressed', b.dataset.league === id ? 'true' : 'false')
      );
      renderGrid();
    });
    seg.append(btn);
  });

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'venues-search';
  searchInput.placeholder = 'Search team or ballpark…';
  searchInput.addEventListener('input', () => {
    searchQ = searchInput.value.toLowerCase().trim();
    renderGrid();
  });

  const controls = document.createElement('div');
  controls.className = 'venues-controls';
  controls.append(seg, searchInput);

  const grid = document.createElement('div');
  grid.className = 'venues-grid';

  view.append(controls, grid);

  function renderGrid() {
    grid.innerHTML = '';
    const visible = items.filter(({ team, venue }) => {
      if (activeLeague !== 'all' && String(team.league?.id) !== activeLeague) return false;
      if (searchQ) {
        const hay = `${team.name} ${venue?.name || ''}`.toLowerCase();
        if (!hay.includes(searchQ)) return false;
      }
      return true;
    });

    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No ballparks match your search.';
      grid.append(empty);
      return;
    }

    visible.forEach(({ team, venue }) => grid.append(makeCard(team, venue)));
  }

  renderGrid();
}

function makeCard(team, venue) {
  const fi  = venue.fieldInfo || {};
  const loc = venue.location  || {};

  const card = document.createElement('div');
  card.className = 'vcard';

  // ── Hero: team logo + name ──
  const hero = document.createElement('div');
  hero.className = 'vcard-hero';

  const crest = document.createElement('div');
  crest.className = 'crest vcard-crest';
  setTeamLogo(crest, { teamId: team.id, id: team.abbreviation, name: team.name });

  const meta = document.createElement('div');
  meta.className = 'vcard-meta';
  meta.innerHTML = `<div class="vcard-team">${escapeHtml(team.name)}</div>
    <div class="vcard-division">${escapeHtml(team.division?.name || team.league?.name || '')}</div>`;

  hero.append(crest, meta);

  // ── Body: stadium name + city ──
  const body = document.createElement('div');
  body.className = 'vcard-body';

  const city = loc.city || team.locationName || '';
  const state = loc.stateAbbrev || '';

  body.innerHTML = `<div class="vcard-stadium">${escapeHtml(venue.name || '')}</div>
    <div class="vcard-city">${escapeHtml(state ? `${city}, ${state}` : city)}</div>`;

  // ── Stats: capacity | surface | roof ──
  const stats = document.createElement('div');
  stats.className = 'vcard-stats';

  const capacity = fi.capacity ? fi.capacity.toLocaleString() : '—';
  const surface  = normalizeSurface(fi.turfType);
  const roof     = normalizeRoof(fi.roofType);

  [
    { val: capacity, lbl: 'Capacity' },
    { val: surface,  lbl: 'Surface'  },
    { val: roof,     lbl: 'Roof'     },
  ].forEach(({ val, lbl }) => {
    const cell = document.createElement('div');
    cell.className = 'vcard-stat';
    cell.innerHTML = `<span class="vcard-stat-val">${escapeHtml(val)}</span><span class="vcard-stat-lbl">${escapeHtml(lbl)}</span>`;
    stats.append(cell);
  });

  // ── Field dimensions: LF | CF | RF ──
  const lf = fi.leftLine  ?? null;
  const cf = fi.center    ?? null;
  const rf = fi.rightLine ?? null;

  // ── Photo: lazy-loaded from Wikipedia ──
  const photo = document.createElement('div');
  photo.className = 'vcard-photo';

  fetchWikiPhoto(venue.name).then(src => {
    if (src) {
      const img = document.createElement('img');
      img.alt = venue.name;
      img.src = src;
      img.onerror = () => photo.remove();
      photo.append(img);
    } else {
      photo.remove();
    }
  });

  card.append(hero, photo, body, stats);

  if (lf !== null || cf !== null || rf !== null) {
    const dims = document.createElement('div');
    dims.className = 'vcard-dims';
    [
      { val: lf, lbl: 'LF' },
      { val: cf, lbl: 'CF' },
      { val: rf, lbl: 'RF' },
    ].forEach(({ val, lbl }) => {
      const d = document.createElement('div');
      d.className = 'vcard-dim';
      d.innerHTML = `<span class="vcard-dim-val">${val ?? '—'}</span><span class="vcard-dim-lbl">${lbl} ft</span>`;
      dims.append(d);
    });
    card.append(dims);
  }

  return card;
}

// ── Wikipedia photo helper ────────────────────────────────────────────────────

const WIKI_OVERRIDES = {
  'loanDepot park': 'loanDepot_Park',
};

async function fetchWikiPhoto(venueName) {
  const title = WIKI_OVERRIDES[venueName] || venueName.replace(/ /g, '_');
  try {
    const data = await fetchJSON(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    );
    const raw = data.originalimage?.source || data.thumbnail?.source;
    if (!raw) return null;
    return raw.includes('/thumb/') ? raw.replace(/\/\d+px-/, '/800px-') : raw;
  } catch {
    return null;
  }
}

function normalizeSurface(s) {
  if (!s) return '—';
  return s.toLowerCase().includes('grass') ? 'Grass' : 'Turf';
}

function normalizeRoof(r) {
  if (!r) return '—';
  const lc = r.toLowerCase();
  if (lc.includes('retractable')) return 'Retractable';
  if (lc.includes('indoor') || lc.includes('dome') || lc.includes('fixed')) return 'Dome';
  return 'Open';
}

function renderSkeleton(view) {
  view.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'venues-grid';
  for (let i = 0; i < 9; i++) {
    const sk = document.createElement('div');
    sk.className = 'vcard vcard--loading';
    grid.append(sk);
  }
  view.append(grid);
}
