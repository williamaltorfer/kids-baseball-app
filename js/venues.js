import { MLB, fetchJSON } from './api.js';
import { setTeamLogo } from './components.js';
import { escapeHtml } from './utils.js';

const SEASON = new Date().getFullYear();
let _cache = null;

// Year each team's current home park opened (keyed by stable MLB team ID)
const YEAR_OPENED = {
  108: 1966,  // Angels        – Angel Stadium
  109: 1998,  // Diamondbacks  – Chase Field
  110: 1992,  // Orioles       – Oriole Park at Camden Yards
  111: 1912,  // Red Sox       – Fenway Park
  112: 1914,  // Cubs          – Wrigley Field
  113: 2003,  // Reds          – Great American Ball Park
  114: 1994,  // Guardians     – Progressive Field
  115: 1995,  // Rockies       – Coors Field
  116: 2000,  // Tigers        – Comerica Park
  117: 2000,  // Astros        – Daikin Park (fka Minute Maid)
  118: 1973,  // Royals        – Kauffman Stadium
  119: 1962,  // Dodgers       – Dodger Stadium
  120: 2008,  // Nationals     – Nationals Park
  121: 2009,  // Mets          – Citi Field
  133: 1999,  // Athletics     – Sutter Health Park (Sacramento, temp)
  134: 2001,  // Pirates       – PNC Park
  135: 2004,  // Padres        – Petco Park
  136: 1999,  // Mariners      – T-Mobile Park
  137: 2000,  // Giants        – Oracle Park
  138: 2006,  // Cardinals     – Busch Stadium
  139: 1990,  // Rays          – Tropicana Field
  140: 2020,  // Rangers       – Globe Life Field
  141: 1989,  // Blue Jays     – Rogers Centre
  142: 2010,  // Twins         – Target Field
  143: 2004,  // Phillies      – Citizens Bank Park
  144: 2017,  // Braves        – Truist Park
  145: 1991,  // White Sox     – Guaranteed Rate Field
  146: 2012,  // Marlins       – loanDepot park
  147: 2009,  // Yankees       – Yankee Stadium
  158: 2001,  // Brewers       – American Family Field
};

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
  ensureOverlayReady();

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

  // ── Body: stadium name + city + year ──
  const body = document.createElement('div');
  body.className = 'vcard-body';

  const city  = loc.city || team.locationName || '';
  const state = loc.stateAbbrev || '';
  const year  = YEAR_OPENED[team.id];
  const cityLine = (year ? `Est. ${year} · ` : '') + (state ? `${city}, ${state}` : city);

  body.innerHTML = `<div class="vcard-stadium">${escapeHtml(venue.name || '')}</div>
    <div class="vcard-city">${escapeHtml(cityLine)}</div>`;

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

  // ── Photo: lazy-loaded; src stored for reuse in detail view ──
  const photo = document.createElement('div');
  photo.className = 'vcard-photo';
  let resolvedPhotoSrc = null;

  fetchWikiPhoto(venue.name).then(src => {
    resolvedPhotoSrc = src;
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

  card.addEventListener('click', () => openVenueDetail(team, venue, resolvedPhotoSrc));

  return card;
}

// ── Venue detail overlay ──────────────────────────────────────────────────────

let _overlayReady = false;

function ensureOverlayReady() {
  if (_overlayReady) return;
  _overlayReady = true;

  const overlay = document.getElementById('venueOverlay');
  document.getElementById('venueClose').addEventListener('click', () => {
    overlay.style.display = 'none';
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.style.display !== 'none') {
      overlay.style.display = 'none';
    }
  });
}

function openVenueDetail(team, venue, photoSrc) {
  const overlay   = document.getElementById('venueOverlay');
  const content   = document.getElementById('venueContent');
  const titleEl   = document.getElementById('venueTitle');

  titleEl.textContent = venue.name;
  content.innerHTML   = '';
  overlay.style.display = 'flex';

  const fi   = venue.fieldInfo || {};
  const loc  = venue.location  || {};
  const city = loc.city || team.locationName || '';
  const state = loc.stateAbbrev || '';

  const year     = YEAR_OPENED[team.id];
  const capacity = fi.capacity ? fi.capacity.toLocaleString() : '—';
  const surface  = normalizeSurface(fi.turfType);
  const roof     = normalizeRoof(fi.roofType);
  const lf = fi.leftLine  ?? null;
  const cf = fi.center    ?? null;
  const rf = fi.rightLine ?? null;

  // Photo
  if (photoSrc) {
    const photoDiv = document.createElement('div');
    photoDiv.className = 'vdetail-photo';
    const img = document.createElement('img');
    img.src = photoSrc;
    img.alt = venue.name;
    photoDiv.append(img);
    content.append(photoDiv);
  }

  // Hero: logo + team name + location
  const detailHero = document.createElement('div');
  detailHero.className = 'vdetail-hero';
  const detailCrest = document.createElement('div');
  detailCrest.className = 'crest vdetail-crest';
  setTeamLogo(detailCrest, { teamId: team.id, id: team.abbreviation, name: team.name });
  const teamMeta = document.createElement('div');
  const divisionLabel = team.division?.name || team.league?.name || '';
  const locationLabel = state ? `${city}, ${state}` : city;
  teamMeta.innerHTML = `<div class="vdetail-team">${escapeHtml(team.name)}</div>
    <div class="vdetail-division">${escapeHtml(divisionLabel)}${locationLabel ? ` · ${escapeHtml(locationLabel)}` : ''}</div>`;
  detailHero.append(detailCrest, teamMeta);
  content.append(detailHero);

  // Stats row: opened | capacity | surface | roof
  const statsDiv = document.createElement('div');
  statsDiv.className = 'vdetail-stats';
  [
    { val: year ? String(year) : '—', lbl: 'Opened' },
    { val: capacity,                  lbl: 'Capacity' },
    { val: surface,                   lbl: 'Surface'  },
    { val: roof,                      lbl: 'Roof'     },
  ].forEach(({ val, lbl }) => {
    const cell = document.createElement('div');
    cell.className = 'vdetail-stat';
    cell.innerHTML = `<span class="vdetail-stat-val">${escapeHtml(val)}</span><span class="vdetail-stat-lbl">${escapeHtml(lbl)}</span>`;
    statsDiv.append(cell);
  });
  content.append(statsDiv);

  // Field dimensions
  if (lf !== null || cf !== null || rf !== null) {
    const dimsDiv = document.createElement('div');
    dimsDiv.className = 'vdetail-dims';
    [
      { val: lf, lbl: 'LF' },
      { val: cf, lbl: 'CF' },
      { val: rf, lbl: 'RF' },
    ].forEach(({ val, lbl }) => {
      const d = document.createElement('div');
      d.className = 'vdetail-dim';
      d.innerHTML = `<span class="vdetail-dim-val">${val ?? '—'}</span><span class="vdetail-dim-lbl">${lbl} ft</span>`;
      dimsDiv.append(d);
    });
    content.append(dimsDiv);
  }

  // Wikipedia sections (populated asynchronously)
  const aboutSection   = makeDetailSection('About');
  const notableSection = makeDetailSection('Notable Events');
  content.append(aboutSection.el, notableSection.el);

  const wikiTitle = WIKI_OVERRIDES[venue.name] || venue.name.replace(/ /g, '_');

  const wikiPromise = _wikiCache.has(wikiTitle)
    ? Promise.resolve(_wikiCache.get(wikiTitle))
    : Promise.all([fetchWikiExtract(wikiTitle), fetchWikiNotableSection(wikiTitle)])
        .then(([extract, notable]) => {
          const result = { extract, notable };
          _wikiCache.set(wikiTitle, result);
          return result;
        });

  wikiPromise.then(({ extract, notable }) => {
    if (extract) {
      aboutSection.body.className = 'vdetail-section-body';
      aboutSection.body.textContent = extract;
    } else {
      aboutSection.el.remove();
    }

    if (notable?.length) {
      notableSection.body.className = 'vdetail-section-body';
      const ul = document.createElement('ul');
      ul.className = 'vdetail-notable-list';
      notable.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        ul.append(li);
      });
      notableSection.body.append(ul);
    } else {
      notableSection.el.remove();
    }
  });
}

function makeDetailSection(title) {
  const el = document.createElement('div');
  el.className = 'vdetail-section';
  const heading = document.createElement('div');
  heading.className = 'vdetail-section-title';
  heading.textContent = title;
  const body = document.createElement('div');
  body.className = 'vdetail-section-body vdetail-loading';
  body.textContent = 'Loading…';
  el.append(heading, body);
  return { el, body };
}

// ── Wikipedia helpers ─────────────────────────────────────────────────────────

const WIKI_OVERRIDES = {
  'loanDepot park':                   'loanDepot_Park',
  'Rate Field':                       'Guaranteed_Rate_Field',
  'Guaranteed Rate Field':            'Guaranteed_Rate_Field',
  'Great American Ballpark':          'Great_American_Ball_Park',
  'UNIQLO Field at Dodger Stadium':   'Dodger_Stadium',
  'Uniqlo Field at Dodger Stadium':   'Dodger_Stadium',
  'Uniqlo Field at Dodgers Stadium':  'Dodger_Stadium',
};

const WIKI_DIRECT_IMAGES = {
  'Rate Field':            'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Chicago%2C_Illinois%2C_U.S._%282023%29_-_062.jpg/960px-Chicago%2C_Illinois%2C_U.S._%282023%29_-_062.jpg',
  'Guaranteed Rate Field': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Chicago%2C_Illinois%2C_U.S._%282023%29_-_062.jpg/960px-Chicago%2C_Illinois%2C_U.S._%282023%29_-_062.jpg',
};

async function fetchWikiPhoto(venueName) {
  if (WIKI_DIRECT_IMAGES[venueName]) return WIKI_DIRECT_IMAGES[venueName];
  const title = WIKI_OVERRIDES[venueName] || venueName.replace(/ /g, '_');
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=800&origin=*`;
    const data = await fetchJSON(url);
    const page = Object.values(data?.query?.pages || {})[0];
    return page?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

async function fetchWikiExtract(wikiTitle) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=extracts&exintro=1&explaintext=1&format=json&origin=*`;
    const data = await fetchJSON(url);
    const page = Object.values(data?.query?.pages || {})[0];
    return page?.extract?.trim() || null;
  } catch {
    return null;
  }
}

const _wikiCache = new Map();

async function fetchWikiNotableSection(wikiTitle) {
  try {
    const sectionsUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(wikiTitle)}&prop=sections&format=json&origin=*`;
    const sectionsData = await fetchJSON(sectionsUrl);
    const sections = sectionsData?.parse?.sections || [];

    const target = sections.find(s => /notable|event|record/i.test(s.line));
    if (!target) return null;

    const textUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(wikiTitle)}&section=${target.index}&prop=text&format=json&origin=*`;
    const textData = await fetchJSON(textUrl);
    const html = textData?.parse?.text?.['*'] ?? '';

    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    // Remove style blocks, reference lists, footnotes, and edit-section links
    tmp.querySelectorAll('style, sup, .reference, .mw-editsection, .reflist, .references, ol.references, .mw-references-wrap').forEach(el => el.remove());

    // Only unordered list items — reference footnotes live in <ol>, not <ul>
    const items = Array.from(tmp.querySelectorAll('ul > li'))
      .map(li => li.textContent.replace(/\[\d+\]/g, '').trim())
      .filter(t => t.length > 20)
      .slice(0, 10);

    return items.length ? items : null;
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
