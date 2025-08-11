import { $, $$, toDateKey, fromKey, localTime, dayLabel, btnIcon, labelStatus, escapeHtml } from './utils.js';
import { MLB, getSchedule, getLive, getContent } from './api.js';
import { setTeamLogo, linescoreTable } from './components.js';
import { findRecapFromContent } from './media.js';
import { openHighlights } from './highlights.js';

export async function renderScores(state){
  const view = document.getElementById('view'); view.innerHTML = '';
  // Controls
  const controls = document.createElement('div'); controls.className = 'controls';
  const prev = btnIcon('◀'); prev.classList.add('square');
  const next = btnIcon('▶'); next.classList.add('square');
  const dateDisp = document.createElement('div'); dateDisp.className='date-display';
  const datePick = document.createElement('input'); datePick.type='date'; datePick.className='date-input';

  const current = state.date || toDateKey(new Date());
  datePick.value = current; dateDisp.textContent = dayLabel(current);

  controls.append(prev, dateDisp, datePick, next);
  view.append(controls);

  const grid = document.createElement('div'); grid.className = 'grid'; view.append(grid);

  async function load(dateKey){
    state.date = dateKey; datePick.value = dateKey; dateDisp.textContent = dayLabel(dateKey);
    grid.innerHTML = '';
    const games = await getSchedule(dateKey);
    if(!games.length){ const empty = document.createElement('div'); empty.className='empty'; empty.textContent='No games for this date.'; grid.append(empty); return; }
    games.forEach(async g => {
      const card = makeGameCard(g); grid.append(card);
      if(g.gamePk){
        try{
          const [live, content] = await Promise.all([getLive(g.gamePk), getContent(g.gamePk)]);
          const ls = live.liveData?.linescore;
          if(ls){
            g.linescore = {
              innings: Array.from({length:9}, (_,i)=>({ num:i+1, away:(ls.innings?.[i]?.away?.runs ?? 0), home:(ls.innings?.[i]?.home?.runs ?? 0) })),
              totals:{ away:{R: ls.teams?.away?.runs ?? 0}, home:{R: ls.teams?.home?.runs ?? 0} }
            };
            const mount = card.querySelector('[data-linescore]');
            mount.innerHTML = '';
            mount.append(linescoreTable(g));
          }
          const stateText = live.gameData?.status?.detailedState || live.gameData?.status?.abstractGameState;
          card.querySelector('[data-status]').textContent = stateText;

          // If Final and recap exists, show a Watch Highlights button
          const recap = findRecapFromContent(content);
          if(String(stateText).toLowerCase().includes('final') && recap){
            const actions = card.querySelector('[data-actions]');
            const btn = btnIcon('▶ Watch Highlights');
            btn.addEventListener('click', (e)=>{ e.stopPropagation(); openHighlights(recap, `${g.away.name} @ ${g.home.name}`); });
            actions.append(btn);
          }
          card.addEventListener('click', ()=> openBoxLive(g));
        } catch(err){ console.warn('live/content fetch failed', err); }
      }
    });
  }

  prev.onclick = ()=>{ const d = fromKey(datePick.value); d.setDate(d.getDate()-1); load(toDateKey(d)); };
  next.onclick = ()=>{ const d = fromKey(datePick.value); d.setDate(d.getDate()+1); load(toDateKey(d)); };
  datePick.onchange = ()=> load(datePick.value);

  load(current);
}

function makeGameCard(game){
  const tpl = document.getElementById('game-card'); const node = tpl.content.firstElementChild.cloneNode(true);
  setTeamLogo(node.querySelector('[data-crest="away"]'), game.away);
  setTeamLogo(node.querySelector('[data-crest="home"]'), game.home);
  node.querySelector('[data-teamname="away"]').textContent = game.away.name;
  node.querySelector('[data-teamname="home"]').textContent = game.home.name;
  node.querySelector('[data-status]').textContent = labelStatus(game.status);

  const meta = node.querySelector('[data-meta]');
  const when = `${dayLabel(game.start)} • ${localTime(game.start)}`;
  meta.textContent = `${when} • ${game.venue}`;

  const lsMount = node.querySelector('[data-linescore]');
  if(game.status === 'FINAL' && game.linescore){
    lsMount.append(linescoreTable(game));
  } else if (game.status === 'SCHEDULED'){
    const p = document.createElement('div');
    p.className = 'meta';
    p.textContent = `Probable pitchers — Away: ${game.probable?.away || 'TBD'} | Home: ${game.probable?.home || 'TBD'}`;
    lsMount.append(p);
  }

  return node;
}

export async function openBoxLive(game){
  const overlay = document.getElementById('overlay'); const content = document.getElementById('boxContent'); const title = document.getElementById('boxTitle');
  const hlBtn = document.getElementById('boxHlBtn');
  title.textContent = `${game.away.name} @ ${game.home.name}`;
  content.innerHTML = '';
  hlBtn.style.display = 'none';
  hlBtn.onclick = null;

  try{
    const [live, cdata] = await Promise.all([getLive(game.gamePk), getContent(game.gamePk)]);
    // Show Highlights button in header only for Final games with recap
    const stateText = live.gameData?.status?.detailedState || live.gameData?.status?.abstractGameState;
    const recap = findRecapFromContent(cdata);
    if(String(stateText).toLowerCase().includes('final') && recap){
      hlBtn.style.display = 'inline-flex';
      hlBtn.onclick = (e)=>{ e.stopPropagation(); openHighlights(recap, `${game.away.name} @ ${game.home.name}`); };
    }

    // Linescore
    const ls = live.liveData?.linescore;
    if(ls){
      const g2 = { ...game, linescore:{
        innings: Array.from({length:9}, (_,i)=>({ num: i+1, away: (ls.innings?.[i]?.away?.runs ?? 0), home: (ls.innings?.[i]?.home?.runs ?? 0) })),
        totals:{ away:{R: ls.teams?.away?.runs ?? 0}, home:{R: ls.teams?.home?.runs ?? 0} }
      }};
      content.append(linescoreSubcard(g2));
    }

    const box = live.liveData?.boxscore;
    if(box){
      const awayRows = playersFromBox(box.teams?.away?.players || {});
      const homeRows = playersFromBox(box.teams?.home?.players || {});
      content.append(battingSubcard('Batting — ' + game.away.name, awayRows.batting));
      content.append(battingSubcard('Batting — ' + game.home.name, homeRows.batting));
      content.append(pitchingSubcard('Pitching — ' + game.away.name, awayRows.pitching));
      content.append(pitchingSubcard('Pitching — ' + game.home.name, homeRows.pitching));
    }
  } catch(err){
    console.warn('box fetch failed', err);
    const msg = document.createElement('div'); msg.className='subcard';
    msg.innerHTML = `<div class='head'>Box Score</div><div style='padding:12px'>Live data unavailable right now.</div>`;
    content.append(msg);
  }

  overlay.style.display = 'flex';
}

// Box helpers and tables
import { safe, num } from './utils.js';
import { linescoreTable as _ignore } from './components.js'; // ensure module loads before use

function linescoreSubcard(game){
  const card = document.createElement('div'); card.className='subcard';
  card.innerHTML = `<div class='head'>Linescore</div>`;
  const body = document.createElement('div'); body.style.padding = '12px';
  body.append(linescoreTable(game)); card.append(body); return card;
}

function battingSubcard(title, rows){
  const card = document.createElement('div'); card.className='subcard';
  card.innerHTML = `<div class='head'>${escapeHtml(title)}</div>`;
  const body = document.createElement('div'); body.style.padding = '0';
  const table = document.createElement('table'); table.className='table box';
  table.innerHTML = `
    <colgroup>
      <col />
      <col />
      <col /><col /><col /><col /><col /><col /><col /><col />
    </colgroup>
    <thead>
      <tr>
        <th>Player</th><th>Pos</th><th class='num'>AB</th><th class='num'>R</th><th class='num'>H</th><th class='num'>RBI</th><th class='num'>BB</th><th class='num'>SO</th><th class='num'>HR</th><th class='num'>AVG</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r=>`
        <tr>
          <td>
            <div class='player'>
              <img src='${r.headshot}' alt='' class='avatar' />
              <span class='name'>${escapeHtml(r.name)}</span>
            </div>
          </td>
          <td>${escapeHtml(r.pos||'')}</td>
          <td class='num'>${num(r.stats.AB)}</td>
          <td class='num'>${num(r.stats.R)}</td>
          <td class='num'>${num(r.stats.H)}</td>
          <td class='num'>${num(r.stats.RBI)}</td>
          <td class='num'>${num(r.stats.BB)}</td>
          <td class='num'>${num(r.stats.SO)}</td>
          <td class='num'>${num(r.stats.HR)}</td>
          <td class='num'>${escapeHtml(r.stats.AVG||'')}</td>
        </tr>
      `).join('')}
    </tbody>`;
  body.append(table); card.append(body); return card;
}

function pitchingSubcard(title, rows){
  const card = document.createElement('div'); card.className='subcard';
  card.innerHTML = `<div class='head'>${escapeHtml(title)}</div>`;
  const body = document.createElement('div'); body.style.padding = '0';
  const table = document.createElement('table'); table.className='table box';
  table.innerHTML = `
    <colgroup>
      <col />
      <col />
      <col /><col /><col /><col /><col /><col /><col /><col />
    </colgroup>
    <thead>
      <tr>
        <th>Pitcher</th><th>Decision</th><th class='num'>IP</th><th class='num'>H</th><th class='num'>R</th><th class='num'>ER</th><th class='num'>BB</th><th class='num'>SO</th><th class='num'>HR</th><th class='num'>ERA</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r=>`
        <tr>
          <td>
            <div class='player'>
              <img src='${r.headshot}' alt='' class='avatar' />
              <span class='name'>${escapeHtml(r.name)}</span>
            </div>
          </td>
          <td>${escapeHtml(r.notes||'')}</td>
          <td class='num'>${escapeHtml(safe(r.stats.IP))}</td>
          <td class='num'>${num(r.stats.H)}</td>
          <td class='num'>${num(r.stats.R)}</td>
          <td class='num'>${num(r.stats.ER)}</td>
          <td class='num'>${num(r.stats.BB)}</td>
          <td class='num'>${num(r.stats.SO)}</td>
          <td class='num'>${num(r.stats.HR)}</td>
          <td class='num'>${escapeHtml(safe(r.stats.ERA))}</td>
        </tr>
      `).join('')}
    </tbody>`;
  body.append(table); card.append(body); return card;
}

// appearance filters + derivations
function appearedBatting(b){
  if(!b) return false;
  if((b.plateAppearances||0) > 0) return true;
  const f=['atBats','runs','hits','rbi','baseOnBalls','strikeOuts','homeRuns','stolenBases'];
  return f.some(k => (b[k]||0) > 0);
}
function appearedPitching(p){
  if(!p) return false;
  const hasIP = p.inningsPitched && p.inningsPitched !== '0' && p.inningsPitched !== '0.0';
  const f=['hits','runs','earnedRuns','baseOnBalls','strikeOuts','homeRuns','battersFaced'];
  const any = f.some(k => (p[k]||0) > 0);
  const hasDecision = !!(p.decision || p.save || p.hold);
  return hasIP || any || hasDecision;
}
function ipToInnings(ipStr){
  if(!ipStr) return 0; const [w,f='0']=String(ipStr).split('.');
  const whole = Number(w||0); const frac = Number(f||0);
  const thirds = frac===1?1: (frac===2?2:0); return whole + thirds/3;
}
function computeAVGFrom(bat){
  if(!bat) return '';
  if(bat.avg!=null && bat.avg!=='') return String(bat.avg);
  const ab = Number(bat.atBats||0), h = Number(bat.hits||0);
  if(ab>0){ const v=(h/ab).toFixed(3); return v.startsWith('0')? v.slice(1): v; }
  return '';
}
function computeERAFrom(pit){
  if(!pit) return '';
  if(pit.era!=null && pit.era!=='') return String(pit.era);
  const er = Number(pit.earnedRuns||0); const ip = ipToInnings(pit.inningsPitched);
  if(ip>0) return (er*9/ip).toFixed(2);
  return '';
}
function playersFromBox(playersObj){
  const batting = []; const pitching = [];
  for(const key in playersObj){
    const p = playersObj[key];
    const id = p.person?.id;
    const name = p.person?.fullName || 'Player';
    const pos = p.position?.abbreviation || '';
    const bat = p.stats?.batting; const pit = p.stats?.pitching;
    const headshot = id ? MLB.headshot(id) : undefined;
    if(bat && appearedBatting(bat)){
      const avg = bat.avg || p.seasonStats?.batting?.avg || computeAVGFrom(bat);
      batting.push({ name, pos, stats:{
        AB: bat.atBats, R: bat.runs, H: bat.hits, RBI: bat.rbi, BB: bat.baseOnBalls, SO: bat.strikeOuts, HR: bat.homeRuns, AVG: avg
      }, headshot });
    }
    if(pit && appearedPitching(pit)){
      const era = pit.era || p.seasonStats?.pitching?.era || computeERAFrom(pit);
      pitching.push({ name, notes: p.note || pit.note || pit.decision || '', stats:{
        IP: pit.inningsPitched, H: pit.hits, R: pit.runs, ER: pit.earnedRuns, BB: pit.baseOnBalls, SO: pit.strikeOuts, HR: pit.homeRuns, ERA: era
      }, headshot });
    }
  }
  return { batting, pitching };
}
