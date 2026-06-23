import { MLB, fetchJSON } from './api.js';
import { PLAYER_FACTS } from './player-facts.js';
import { escapeHtml } from './utils.js';
import { setTeamLogo } from './components.js';

const SEASON = new Date().getFullYear();

export async function openPlayerCard(personId) {
  if (!personId) return;

  const overlay  = document.getElementById('playerOverlay');
  const content  = document.getElementById('playerContent');
  const titleEl  = document.getElementById('playerTitle');

  titleEl.textContent = '';
  content.innerHTML   = '<div class="player-loading">Loading player info…</div>';
  overlay.style.display = 'flex';

  try {
    const [bioData, statsData, hitLogData, pitLogData] = await Promise.allSettled([
      fetchJSON(MLB.person(personId)),
      fetchJSON(MLB.personStats(personId, SEASON)),
      fetchJSON(MLB.gameLog(personId, 'hitting',  SEASON)),
      fetchJSON(MLB.gameLog(personId, 'pitching', SEASON)),
    ]);

    const person = bioData.value?.people?.[0];
    if (!person) throw new Error('No person data');

    const statsVal       = statsData.value;
    const hittingSplit   = statsVal?.stats?.find(s => s.group?.displayName === 'hitting')?.splits?.[0]?.stat;
    const pitchingSplit  = statsVal?.stats?.find(s => s.group?.displayName === 'pitching')?.splits?.[0]?.stat;

    const hitLogSplits = hitLogData.value?.stats?.find(s => s.type?.displayName === 'gameLog')?.splits ?? [];
    const pitLogSplits = pitLogData.value?.stats?.find(s => s.type?.displayName === 'gameLog')?.splits ?? [];

    content.innerHTML = '';
    content.append(buildCard(person, hittingSplit, pitchingSplit, hitLogSplits, pitLogSplits, PLAYER_FACTS[personId]));
  } catch (err) {
    console.warn('Player card error', err);
    content.innerHTML = '<div class="stat-empty">Could not load player info right now.</div>';
  }
}

// ── Card builder ──────────────────────────────────────────────────────────────

function buildCard(person, hitting, pitching, hitLog, pitLog, fact) {
  const wrap = document.createElement('div');

  // ── Hero ──
  const hero = document.createElement('div');
  hero.className = 'pc-hero';

  const img = document.createElement('img');
  img.className = 'pc-headshot';
  img.alt = '';
  img.src = MLB.headshot(person.id);
  img.onerror = function () {
    this.onerror = null;
    this.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(person.fullName)}&backgroundColor=e2eaff&textColor=1d3665`;
  };

  const name = document.createElement('div');
  name.className = 'pc-name';
  name.textContent = person.fullName;

  const teamRow = document.createElement('div');
  teamRow.className = 'pc-team-row';
  if (person.currentTeam?.id) {
    const crest = document.createElement('div');
    crest.className = 'crest pc-crest';
    setTeamLogo(crest, { teamId: person.currentTeam.id });
    teamRow.append(crest);
  }
  const teamName = document.createElement('span');
  teamName.className = 'pc-team-name';
  teamName.textContent = person.currentTeam?.name || '';
  teamRow.append(teamName);

  hero.append(img, name, teamRow);

  // ── Bio grid ──
  const bio = document.createElement('div');
  bio.className = 'pc-bio';

  const bioItems = [
    person.primaryPosition?.name  && { label: 'Position', value: person.primaryPosition.name },
    person.primaryNumber          && { label: 'Jersey',   value: `#${person.primaryNumber}` },
    person.batSide?.code          && { label: 'Bats',     value: person.batSide.code },
    person.pitchHand?.code        && { label: 'Throws',   value: person.pitchHand.code },
    person.birthDate              && { label: 'Age',       value: calcAge(person.birthDate) },
    person.height                 && { label: 'Height',    value: person.height },
    person.weight                 && { label: 'Weight',    value: `${person.weight} lbs` },
  ].filter(Boolean);

  bioItems.forEach(({ label, value }) => {
    const item = document.createElement('div');
    item.className = 'pc-bio-item';
    item.innerHTML = `<span class="pc-bio-label">${escapeHtml(label)}</span><span class="pc-bio-value">${escapeHtml(String(value))}</span>`;
    bio.append(item);
  });

  // ── Season stats ──
  const hasHitting  = hitting  && Number(hitting.atBats || 0) > 0;
  const hasPitching = pitching && Number((pitching.inningsPitched || '0').replace('.', '')) > 0;

  // ── Fun fact ──
  let factEl = null;
  if (fact) {
    factEl = document.createElement('div');
    factEl.className = 'pc-fact';
    factEl.innerHTML = `<div class="pc-fact-title">⭐ Fun Fact</div><p class="pc-fact-text">${escapeHtml(fact)}</p>`;
  }

  wrap.append(hero, bio);
  if (hasHitting)  wrap.append(buildStatGroup(`${SEASON} Hitting`,  buildHittingStats(hitting)));
  if (hasPitching) wrap.append(buildStatGroup(`${SEASON} Pitching`, buildPitchingStats(pitching)));
  if (!hasHitting && !hasPitching) {
    const none = document.createElement('div');
    none.className = 'stat-empty';
    none.textContent = `No ${SEASON} season stats yet.`;
    wrap.append(none);
  }

  // ── Game log ──
  const logSplits = hasHitting
    ? [...hitLog].reverse().slice(0, 5)
    : hasPitching
      ? [...pitLog].reverse().slice(0, 5)
      : [];

  if (logSplits.length) {
    wrap.append(buildGameLog(logSplits, hasHitting ? 'hitting' : 'pitching'));
  }

  if (factEl) wrap.append(factEl);

  return wrap;
}

function buildStatGroup(label, cells) {
  const group = document.createElement('div');
  group.className = 'pc-stat-group';
  const head = document.createElement('div');
  head.className = 'pc-stat-group-head';
  head.textContent = label;
  const row = document.createElement('div');
  row.className = 'pc-stat-row';
  cells.forEach(({ value, label: l }) => {
    const cell = document.createElement('div');
    cell.className = 'pc-stat-cell';
    cell.innerHTML = `<span class="pc-stat-value">${escapeHtml(String(value ?? '—'))}</span><span class="pc-stat-label">${escapeHtml(l)}</span>`;
    row.append(cell);
  });
  group.append(head, row);
  return group;
}

function buildHittingStats(s) {
  return [
    { label: 'AVG',  value: s.avg       ?? '—' },
    { label: 'OPS',  value: s.ops       ?? '—' },
    { label: 'HR',   value: s.homeRuns  ?? '—' },
    { label: 'RBI',  value: s.rbi       ?? '—' },
    { label: 'R',    value: s.runs      ?? '—' },
    { label: 'H',    value: s.hits      ?? '—' },
  ];
}

function buildPitchingStats(s) {
  return [
    { label: 'ERA',  value: s.era              ?? '—' },
    { label: 'WHIP', value: s.whip             ?? '—' },
    { label: 'W',    value: s.wins             ?? '—' },
    { label: 'SO',   value: s.strikeOuts       ?? '—' },
    { label: 'SV',   value: s.saves            ?? '—' },
    { label: 'IP',   value: s.inningsPitched   ?? '—' },
  ];
}

function buildGameLog(splits, group) {
  const isHitting = group === 'hitting';

  const headers = isHitting
    ? ['Date', 'Opp', 'AB', 'H', 'HR', 'RBI', 'BB', 'K']
    : ['Date', 'Opp', 'IP', 'H', 'ER', 'BB', 'K', 'Dec'];

  const rows = splits.map(sp => {
    const s   = sp.stat || {};
    const opp = sp.opponent?.abbreviation || sp.opponent?.name?.substring(0, 3) || '—';
    const dt  = sp.date ? new Date(sp.date + 'T12:00:00').toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : '—';
    const atH = sp.isHome;

    if (isHitting) {
      return [dt, (atH ? 'vs ' : '@ ') + opp, s.atBats ?? '—', s.hits ?? '—', s.homeRuns ?? '—', s.rbi ?? '—', s.baseOnBalls ?? '—', s.strikeOuts ?? '—'];
    } else {
      const dec = s.wins > 0 ? 'W' : s.losses > 0 ? 'L' : s.saves > 0 ? 'S' : '—';
      return [dt, (atH ? 'vs ' : '@ ') + opp, s.inningsPitched ?? '—', s.hits ?? '—', s.earnedRuns ?? '—', s.baseOnBalls ?? '—', s.strikeOuts ?? '—', dec];
    }
  });

  const section = document.createElement('div');
  section.className = 'pc-gamelog';

  const head = document.createElement('div');
  head.className = 'pc-stat-group-head';
  head.textContent = 'Last 5 Games';

  const tableWrap = document.createElement('div');
  tableWrap.style.overflowX = 'auto';

  const table = document.createElement('table');
  table.className = 'table pc-log-table';
  table.innerHTML = `
    <thead><tr>${headers.map(h => `<th class="${h !== 'Date' && h !== 'Opp' ? 'num' : ''}">${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(cells =>
      `<tr>${cells.map((c, i) => `<td class="${i > 1 ? 'num' : ''}">${escapeHtml(String(c))}</td>`).join('')}</tr>`
    ).join('')}</tbody>`;

  tableWrap.append(table);
  section.append(head, tableWrap);
  return section;
}

function calcAge(birthDate) {
  const bd  = new Date(birthDate + 'T00:00:00');
  const now = new Date();
  let age   = now.getFullYear() - bd.getFullYear();
  if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--;
  return age;
}
