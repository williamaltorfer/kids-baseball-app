import { $, $$, escapeHtml } from './utils.js';
import { MLB, getStandings } from './api.js';
import { setTeamLogo } from './components.js';

export async function renderStandings(){
  const view = document.getElementById('view'); view.innerHTML = '';

  const head = document.createElement('div'); head.className = 'controls';
  const seg = document.createElement('div'); seg.className = 'seg';
  const bDiv = document.createElement('button'); bDiv.textContent='Divisions'; bDiv.setAttribute('aria-pressed','true');
  const bLg = document.createElement('button'); bLg.textContent='Leagues'; bLg.setAttribute('aria-pressed','false');
  const bAll = document.createElement('button'); bAll.textContent='MLB'; bAll.setAttribute('aria-pressed','false');
  seg.append(bDiv,bLg,bAll); head.append(seg); view.append(head);

  const wrap = document.createElement('div'); wrap.className='standings'; view.append(wrap);

  const season = new Date().getFullYear();
  let cache = null;
  async function load(){
    if(!cache){
      const data = await getStandings(season);
      cache = normalizeStandings(data);
    }
    renderDivisions();
  }

  function setSeg(active){
    bDiv.setAttribute('aria-pressed', active==='div');
    bLg.setAttribute('aria-pressed', active==='lg');
    bAll.setAttribute('aria-pressed', active==='mlb');
  }

  function renderDivisions(){
    setSeg('div'); wrap.innerHTML='';
    for(const key of Object.keys(cache.divisions)){
      const card = document.createElement('div'); card.className='stand-card';
      card.innerHTML = `<div class='head'>${key}</div>`;
      card.append(makeStandTable(cache.divisions[key], /*groupLabel*/key));
      wrap.append(card);
    }
  }
  function renderLeagues(){
    setSeg('lg'); wrap.innerHTML='';
    for(const key of Object.keys(cache.leagues)){
      const card = document.createElement('div'); card.className='stand-card';
      card.innerHTML = `<div class='head'>${key}</div>`;
      card.append(makeStandTable(cache.leagues[key], key));
      wrap.append(card);
    }
  }
  function renderMLB(){
    setSeg('mlb'); wrap.innerHTML='';
    const card = document.createElement('div'); card.className='stand-card';
    card.innerHTML = `<div class='head'>Overall MLB</div>`;
    card.append(makeStandTable(cache.all, 'MLB'));
    wrap.append(card);
  }

  bDiv.onclick = renderDivisions;
  bLg.onclick = renderLeagues;
  bAll.onclick = renderMLB;

  load();
}

function normalizeStandings(api){
  const rows = [];
  const records = api.records || [];
  for(const rec of records){
    for(const teamRec of rec.teamRecords || []){
      const t = teamRec.team || {};
      rows.push({
        teamId: t.id,
        teamName: t.name,
        teamAbbr: t.abbreviation || '',
        divisionName: (t.division?.name) || (rec.division?.name) || 'Division',
        leagueName: (t.league?.name) || (rec.league?.name) || 'League',
        w: teamRec.wins || 0,
        l: teamRec.losses || 0,
        pct: teamRec.winningPercentage ? Number(teamRec.winningPercentage) : (teamRec.wins+teamRec.losses? teamRec.wins/(teamRec.wins+teamRec.losses): 0),
        gbApi: teamRec.gamesBack || '—',
        rs: teamRec.runsScored || 0,
        ra: teamRec.runsAllowed || 0
      });
    }
  }
  const byDiv = {}; const byLg = {};
  rows.sort((a,b)=> b.pct - a.pct);
  for(const r of rows){
    (byDiv[r.divisionName] ||= []).push({...r});
    (byLg[r.leagueName] ||= []).push({...r});
  }
  for(const k in byDiv) byDiv[k].sort((a,b)=> b.pct - a.pct);
  for(const k in byLg) byLg[k].sort((a,b)=> b.pct - a.pct);
  return { divisions: byDiv, leagues: byLg, all: rows };
}

function computeGBForGroup(rows){
  if(!rows.length) return rows;
  const leader = rows[0];
  const lw = leader.w, ll = leader.l;
  return rows.map((r,i)=>{
    if(i===0) return { ...r, gb: '—' };
    const diff = ((lw - r.w) + (r.l - ll)) / 2;
    const gb = Number.isFinite(diff) ? diff.toFixed(1) : r.gbApi ?? '';
    return { ...r, gb };
  });
}

function makeStandTable(rows, groupLabel){
  // rows already sorted by pct desc; recompute GB relative to leader of this subset
  const withGB = computeGBForGroup(rows);

  const table = document.createElement('table'); table.className='stand-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style='text-align:left'>Team</th>
        <th>W</th><th>L</th><th>Pct</th><th>GB</th><th>RS</th><th>RA</th>
      </tr>
    </thead>
    <tbody>
      ${withGB.map(r=>`
        <tr data-team='${r.teamId}'>
          <td class='stand-team'>
            <span class='crest' data-team-crest='${r.teamId}'></span>
            <span>${escapeHtml(r.teamName)}</span>
          </td>
          <td>${r.w}</td><td>${r.l}</td><td>${r.pct.toFixed(3).slice(1)}</td><td>${r.gb}</td><td>${r.rs}</td><td>${r.ra}</td>
        </tr>`).join('')}
    </tbody>`;
  $$( 'tbody tr', table).forEach(tr=>{
    const teamId = Number(tr.dataset.team);
    const crest = tr.querySelector('[data-team-crest]');
    if(crest){ setTeamLogo(crest, {name:'', id:'', teamId}); }
    tr.querySelector('.stand-team')?.addEventListener('click', ()=>{ location.hash = `#/team/${teamId}`; });
  });
  return table;
}
