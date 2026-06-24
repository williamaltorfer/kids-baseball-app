import { escapeHtml } from './utils.js';
import { MLB, getLeaders } from './api.js';

const SEASON = new Date().getFullYear();

// ── Stat definitions ──────────────────────────────────────────────────────────

const HITTING = [
  {
    key: 'battingAverage', label: 'Batting Average', abbr: 'AVG', fmt: v => v,
    info: 'How often a batter gets a hit. Divide hits by at-bats. A .300 average means getting a hit 3 out of every 10 trips to the plate — that\'s really good!'
  },
  {
    key: 'homeRuns', label: 'Home Runs', abbr: 'HR', fmt: v => v,
    info: 'When the batter hits the ball over the outfield fence, everyone on base scores — including them! The most exciting swing in baseball. 💥'
  },
  {
    key: 'runsBattedIn', label: 'Runs Batted In', abbr: 'RBI', fmt: v => v,
    info: 'Every time a batter\'s hit (or walk) lets a teammate cross home plate, that\'s an RBI. It measures how well you help your team score runs.'
  },
  {
    key: 'hits', label: 'Hits', abbr: 'H', fmt: v => v,
    info: 'Total number of times a batter safely reached base because they hit the ball. Includes singles, doubles, triples, and home runs.'
  },
  {
    key: 'runs', label: 'Runs Scored', abbr: 'R', fmt: v => v,
    info: 'How many times a player crossed home plate and scored a run for their team. You can score by hitting, walking, or being fast on the bases!'
  },
  {
    key: 'onBasePlusSlugging', label: 'OPS', abbr: 'OPS', fmt: v => v,
    info: 'On-base Plus Slugging — adds how often you get on base to how much power you hit with. Above 1.000 means you\'re one of the best hitters in baseball. The ultimate all-around hitting number!'
  },
];

const PITCHING = [
  {
    key: 'earnedRunAverage', label: 'ERA', abbr: 'ERA', fmt: v => v,
    info: 'Earned Run Average — the average number of runs a pitcher allows over 9 innings. Lower is better. Below 3.00 is excellent; the best pitchers are below 2.00!'
  },
  {
    key: 'strikeouts', label: 'Strikeouts', abbr: 'SO', fmt: v => v,
    info: 'Every time a pitcher gets three strikes on a batter, that\'s a strikeout (K). The most dominant pitchers rack up hundreds of Ks in a season. ⚡'
  },
  {
    key: 'wins', label: 'Wins', abbr: 'W', fmt: v => v,
    info: 'A pitcher earns a win when they were pitching when their team took the lead for good. Starting pitchers who win 15+ games in a season are considered elite.'
  },
  {
    key: 'saves', label: 'Saves', abbr: 'SV', fmt: v => v,
    info: 'When a relief pitcher comes in late in a close game and holds the lead, they get a save. The closer is usually the team\'s best reliever.'
  },
  {
    key: 'whip', label: 'WHIP', abbr: 'WHIP', fmt: v => v,
    info: 'Walks + Hits per Inning Pitched. Measures how many baserunners a pitcher allows each inning. Below 1.00 is outstanding — fewer runners means fewer runs!'
  },
  {
    key: 'strikeoutsPer9Inn', label: 'K/9', abbr: 'K/9', fmt: v => v,
    info: 'Strikeouts per 9 innings — if a pitcher pitched a full game, how many batters would they strike out? Above 10 means nearly a strikeout an inning. Filthy! 🔥'
  },
];

const FUN = [
  {
    key: 'triples', label: 'Triples', abbr: '3B', fmt: v => v,
    info: 'The rarest and most exciting hit in baseball! A triple means you hit the ball into the gap and ran all the way to third base. Speed + power combined. 🚀'
  },
  {
    key: 'stolenBases', label: 'Stolen Bases', abbr: 'SB', fmt: v => v,
    info: 'When a baserunner takes off and reaches the next base before the catcher can throw them out. Pure speed and smarts — no bat swing needed! 💨'
  },
  {
    key: 'totalBases', label: 'Total Bases', abbr: 'TB', fmt: v => v,
    info: 'Add up all the bases from every hit: 1 for a single, 2 for a double, 3 for a triple, 4 for a homer. High total bases = super powerful hitter!'
  },
  {
    key: 'strikeouts', label: 'Pitcher Strikeouts', abbr: 'K', fmt: v => v,
    statGroup: 'pitching',
    info: 'Some pitchers can strike out over 300 batters in one season — that\'s nearly 2 per inning! Batters see a pitch so nasty they can\'t even touch it. ⚡'
  },
];

const SEGMENTS = [
  { id: 'hitting',  label: 'Hitting',    defs: HITTING  },
  { id: 'pitching', label: 'Pitching',   defs: PITCHING },
  { id: 'fun',      label: '⚡ Fun Stats', defs: FUN     },
];

// ── Main render ───────────────────────────────────────────────────────────────

export async function renderStats(state) {
  const view = document.getElementById('view');
  view.innerHTML = '';

  // Segmented control
  const seg = document.createElement('div');
  seg.className = 'seg';
  seg.style.cssText = 'display:inline-flex;margin-bottom:16px;';

  let activeSegId = state.statsSegment || 'hitting';

  const segGrid = document.createElement('div');
  segGrid.className = 'stats-grid';

  SEGMENTS.forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.dataset.seg = id;
    btn.setAttribute('aria-pressed', id === activeSegId ? 'true' : 'false');
    btn.addEventListener('click', () => {
      if (id === activeSegId) return;
      activeSegId = id;
      state.statsSegment = id;
      seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.seg === id ? 'true' : 'false'));
      loadSegment(id);
    });
    seg.append(btn);
  });

  view.append(seg, segGrid);

  async function loadSegment(segId) {
    const { defs } = SEGMENTS.find(s => s.id === segId);
    segGrid.innerHTML = '';

    // Skeleton cards while loading
    defs.forEach(() => {
      const sk = document.createElement('div');
      sk.className = 'stat-card stat-card--loading';
      sk.innerHTML = '<div class="stat-card-head"></div><div class="stat-skeleton-rows"></div>';
      segGrid.append(sk);
    });

    // Fire all leader requests in parallel
    const results = await Promise.allSettled(
      defs.map(d => getLeaders(d.key, SEASON, 10).then(data => ({ def: d, data })))
    );

    segGrid.innerHTML = '';
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        segGrid.append(makeLeaderCard(r.value.def, r.value.data));
      } else {
        const errCard = makeErrorCard();
        segGrid.append(errCard);
      }
    });
  }

  loadSegment(activeSegId);
}

// ── Leader card ───────────────────────────────────────────────────────────────

function makeLeaderCard(def, data) {
  const leaders = data?.leagueLeaders?.[0]?.leaders || [];

  const card = document.createElement('div');
  card.className = 'stat-card';

  // Header
  const head = document.createElement('div');
  head.className = 'stat-card-head';

  const headLeft = document.createElement('div');
  headLeft.className = 'stat-card-head-left';

  const title = document.createElement('span');
  title.className = 'stat-card-title';
  title.textContent = def.label;

  const abbr = document.createElement('span');
  abbr.className = 'stat-card-abbr';
  abbr.textContent = def.abbr;

  headLeft.append(title, abbr);

  const infoBtn = document.createElement('button');
  infoBtn.className = 'stat-info-btn';
  infoBtn.setAttribute('aria-label', `What is ${def.label}?`);
  infoBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7.25" stroke="currentColor" stroke-width="1.5"/><path d="M8 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="4.5" r="0.75" fill="currentColor"/></svg>';

  head.append(headLeft, infoBtn);
  card.append(head);

  // Info drawer (hidden by default)
  const drawer = document.createElement('div');
  drawer.className = 'stat-info-drawer';
  drawer.setAttribute('aria-hidden', 'true');
  const drawerText = document.createElement('p');
  drawerText.className = 'stat-info-text';
  drawerText.textContent = def.info;
  drawer.append(drawerText);
  card.append(drawer);

  infoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = drawer.classList.toggle('stat-info-drawer--open');
    infoBtn.classList.toggle('stat-info-btn--active', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  });

  // Leaderboard rows
  const list = document.createElement('ol');
  list.className = 'stat-list';

  leaders.forEach((entry, i) => {
    const personId = entry.person?.id;
    const name = entry.person?.fullName || '—';
    const teamAbbr = entry.team?.abbreviation || '';
    const value = entry.value ?? '—';

    const li = document.createElement('li');
    li.className = 'stat-row';
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.dataset.personId = personId || '';
    li.dataset.teamId = entry.team?.id || '';

    const rank = document.createElement('span');
    rank.className = 'stat-rank';
    rank.textContent = i + 1;

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.alt = '';
    if (personId) {
      avatar.src = MLB.headshot(personId);
      avatar.onerror = function () {
        this.onerror = null;
        this.src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=e2eaff&textColor=4b5b7c`;
      };
    }

    const info = document.createElement('div');
    info.className = 'stat-player-info';

    const playerName = document.createElement('span');
    playerName.className = 'stat-player-name';
    playerName.textContent = name;

    const team = document.createElement('span');
    team.className = 'stat-player-team';
    team.textContent = teamAbbr;

    info.append(playerName, team);

    const val = document.createElement('span');
    val.className = 'stat-value';
    val.textContent = value;

    li.append(rank, avatar, info, val);
    list.append(li);
  });

  if (!leaders.length) {
    const empty = document.createElement('div');
    empty.className = 'stat-empty';
    empty.textContent = 'No data available.';
    card.append(empty);
  } else {
    card.append(list);
  }

  return card;
}

function makeErrorCard() {
  const card = document.createElement('div');
  card.className = 'stat-card';
  card.innerHTML = '<div class="stat-card-head"><div class="stat-card-head-left"><span class="stat-card-title">Leaders</span></div></div><div class="stat-empty">Couldn\'t load stats right now.</div>';
  return card;
}
