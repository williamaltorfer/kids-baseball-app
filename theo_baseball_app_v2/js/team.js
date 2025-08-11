import { btnIcon, escapeHtml, safe, formatAVG } from './utils.js';
import { MLB, getTeam, getRosterActive, getPeopleStats, fetchJSON } from './api.js';
import { setTeamLogo } from './components.js';


async function getRecentBattingOrder(teamId){
  // Look back ~10 days for the most recent completed game
  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() - 10);
  const pad = n => String(n).padStart(2,'0');
  const toKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${toKey(start)}&endDate=${toKey(today)}`;

  try {
    const sched = await fetchJSON(url);
    const dates = sched.dates || [];
    // find most recent gamePk
    let latest = null;
    for(const d of dates){
      for(const g of (d.games||[])){
        // prefer Final games
        const isFinal = String(g.status?.detailedState||'').toLowerCase().includes('final');
        if(isFinal){
          latest = g.gamePk;
        }
      }
    }
    if(!latest) return {};
    const live = await fetchJSON(MLB.live(latest));
    const bs = live.liveData?.boxscore;
    if(!bs) return {};
    // Determine which side belongs to teamId
    const homeTeamId = live.gameData?.teams?.home?.id;
    const side = (homeTeamId===Number(teamId)) ? 'home' : 'away';
    const players = bs.teams?.[side]?.players || {};
    const orderMap = {};
    for(const pid in players){
      const pl = players[pid];
      const id = pl.person?.id;
      const bo = Number(pl.battingOrder || 0);
      if(id && bo){
        const slot = Math.floor(bo / 100); // e.g., 100 -> 1 (1st), 200 -> 2, etc.
        orderMap[id] = slot;
      }
    }
    const gdate = new Date(live.gameData?.datetime?.originalDate || live.gameData?.datetime?.dateTime || Date.now());
    const dateLabel = gdate.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
    return { map: orderMap, dateLabel };
  } catch(e){
    console.warn('getRecentBattingOrder failed', e);
    return { map:{}, dateLabel:'' };
  }
}


export async function renderTeam(teamId){
  const view = document.getElementById('view'); view.innerHTML = '';
  const back = btnIcon('⬅ Back to Standings'); back.onclick = ()=>{ location.hash = '#/standings'; };
  const header = document.createElement('div'); header.className='team-header';
  const crest = document.createElement('div'); crest.className='crest'; header.append(crest);
  const title = document.createElement('div'); title.className='app-title'; title.style.fontSize='24px'; title.textContent = 'Loading team...'; header.append(title);
  view.append(back, header);

  try{
    const [teamMeta, roster] = await Promise.all([
      getTeam(teamId),
      getRosterActive(Number(teamId))
    ]);
    const team = teamMeta.teams?.[0] || {};
    title.textContent = team.name || 'Team';
    setTeamLogo(crest, { name: team.name||'', id: team.abbreviation||'', teamId: team.id });

    const players = (roster.roster||[]).map(r=>({
      id: r.person?.id,
      name: r.person?.fullName,
      pos: r.position?.abbreviation || r.position?.code || ''
    })).filter(p=>p.id);

    const ids = players.map(p=>p.id);
    const season = new Date().getFullYear();
    let statsMap = {};
    try{
      const people = await getPeopleStats(ids, season);
      for(const person of (people.people||[])){
        const id = person.id; const entry = { hitting:{}, pitching:{} };
        for(const s of (person.stats||[])){
          const group = (s.group?.displayName||'').toLowerCase();
          const splits = s.splits?.[0]?.stat || {};
          if(group==='hitting') entry.hitting = splits;
          if(group==='pitching') entry.pitching = splits;
        }
        statsMap[id] = entry;
      }
    } catch(e){ console.warn('people stats failed', e); }

    const hitters = []; const pitchers = [];
    for(const p of players){
      const stat = statsMap[p.id] || {};
      if(p.pos === 'P') pitchers.push({ ...p, stat: stat.pitching||{} });
      else hitters.push({ ...p, stat: stat.hitting||{} });
    }

    const posOrder = ['C','1B','2B','3B','SS','LF','CF','RF','DH'];
    const starters = []; const bench = [];
    for(const pos of posOrder){
      const list = hitters.filter(h=>h.pos===pos).sort((a,b)=> (b.stat.games||0) - (a.stat.games||0));
      if(list.length){ starters.push(list[0]); bench.push(...list.slice(1)); }
    }
    const others = hitters.filter(h=> !posOrder.includes(h.pos));
    bench.push(...others);

    const SP = []; const RP = []; const CL = [];
    pitchers.forEach(p=>{
      const gs = Number(p.stat.gamesStarted||0);
      const sv = Number(p.stat.saves||0);
      const gf = Number(p.stat.gamesFinished||0);
      if(sv >= 15 || gf >= 35) CL.push(p); else if(gs >= 8) SP.push(p); else RP.push(p);
    });

    // Sort starters by most recent game's batting order
    let orderMap = {};
    let lineupDate = '';
    try{
      const orderInfo = await getRecentBattingOrder(teamId);
      orderMap = orderInfo.map || {};
      lineupDate = orderInfo.dateLabel || '';
      if(Object.keys(orderMap).length){
        starters.sort((a,b)=> (orderMap[a.id]??999) - (orderMap[b.id]??999));
      }
    } catch(e){ console.warn('batting order sort failed', e); }

    const hittersCard = document.createElement('div'); hittersCard.className='subcard team-section batters-section';
    hittersCard.innerHTML = `<div class='head'>Batters</div>`;
    hittersCard.append(rosterTableHitters('Starters', starters, orderMap, lineupDate));
    hittersCard.append(rosterTableHitters('Bench', bench, orderMap));

    const pitchCard = document.createElement('div'); pitchCard.className='subcard team-section pitchers-section';
    pitchCard.innerHTML = `<div class='head'>Pitchers</div>`;
    pitchCard.append(rosterTablePitchers('Starters', SP));
    pitchCard.append(rosterTablePitchers('Relievers', RP));
    pitchCard.append(rosterTablePitchers('Closers', CL));

    view.append(hittersCard, pitchCard);
  } catch(e){
    console.warn('team page failed', e);
    const err = document.createElement('div'); err.className='empty'; err.textContent='Team page unavailable right now.'; view.append(err);
  }
}

function rosterTableHitters(label, rows, orderMap={}, lineupDate=''){
  const wrap = document.createElement('div');
  const table = document.createElement('table'); table.className='table team-fixed hitters';
  table.innerHTML = `
    <colgroup>
      <col style="width:52%" /><!-- Player -->
      <col style="width:8%" /><!-- Pos -->
      <col style="width:6.666%" /><col style="width:6.666%" /><col style="width:6.666%" /><col style="width:6.666%" /><col style="width:6.666%" /><col style="width:6.666%" />
    </colgroup>
    <thead>
      <tr><th colspan='8' style='text-align:left;background:#fff;'>${escapeHtml(label)}${lineupDate ? ` <span class='subhead'>(from ${escapeHtml(lineupDate)})</span>` : ''}</th></tr>
      <tr><th>Player</th><th>Pos</th><th class='num'>G</th><th class='num'>AB</th><th class='num'>R</th><th class='num'>H</th><th class='num'>HR</th><th class='num'>AVG</th></tr>
    </thead>
    <tbody>
      ${rows.map(r=>`
        <tr>
          <td><div class='player'><img src='${MLB.headshot(r.id)}' class='avatar' alt='' /><span class='name'>${escapeHtml(r.name)}</span></div></td>
          <td>${escapeHtml(r.pos||'')}</td>
          <td class='num'>${safe(r.stat.games ?? r.stat.gamesPlayed)}</td>
          <td class='num'>${safe(r.stat.atBats)}</td>
          <td class='num'>${safe(r.stat.runs)}</td>
          <td class='num'>${safe(r.stat.hits)}</td>
          <td class='num'>${safe(r.stat.homeRuns)}</td>
          <td class='num'>${formatAVG(r.stat.avg)}</td>
        </tr>`).join('')}
    </tbody>`;
  wrap.append(table); return wrap;
}

function rosterTablePitchers(label, rows){
  const wrap = document.createElement('div');
  const table = document.createElement('table'); table.className='table team-fixed pitchers';
  table.innerHTML = `
    <colgroup>
      <col style="width:44%" /><!-- Player -->
      <col style="width:6.222%" /><col style="width:6.222%" /><col style="width:6.222%" /><col style="width:6.222%" /><col style="width:6.222%" /><col style="width:6.222%" /><col style="width:6.222%" /><col style="width:6.222%" /><col style="width:6.222%" />
    </colgroup>
    <thead>
      <tr><th colspan='10' style='text-align:left;background:#fff;'>${escapeHtml(label)}</th></tr>
      <tr><th>Player</th><th class='num'>G</th><th class='num'>GS</th><th class='num'>IP</th><th class='num'>H</th><th class='num'>ER</th><th class='num'>BB</th><th class='num'>SO</th><th class='num'>SV</th><th class='num'>ERA</th></tr>
    </thead>
    <tbody>
      ${rows.map(r=>`
        <tr>
          <td><div class='player'><img src='${MLB.headshot(r.id)}' class='avatar' alt='' /><span class='name'>${escapeHtml(r.name)}</span></div></td>
          <td class='num'>${safe(r.stat.games ?? r.stat.gamesPlayed)}</td>
          <td class='num'>${safe(r.stat.gamesStarted)}</td>
          <td class='num'>${safe(r.stat.inningsPitched)}</td>
          <td class='num'>${safe(r.stat.hits)}</td>
          <td class='num'>${safe(r.stat.earnedRuns)}</td>
          <td class='num'>${safe(r.stat.baseOnBalls)}</td>
          <td class='num'>${safe(r.stat.strikeOuts)}</td>
          <td class='num'>${safe(r.stat.saves)}</td>
          <td class='num'>${safe(r.stat.era)}</td>
        </tr>`).join('')}
    </tbody>`;
  wrap.append(table); return wrap;
}

