import { $, $$, toDateKey } from './utils.js';
import { renderScores } from './scores.js';
import { renderStandings } from './standings.js';
import { renderTeam } from './team.js';

// Simple router
const routes = {
  '#/scores': (state) => renderScores(state),
  '#/standings': (state) => renderStandings(state)
};

function setActiveTab(){
  const h = location.hash || '#/scores';
  $$('.tab').forEach(b=> b.setAttribute('aria-current', b.dataset.route===h ? 'page' : 'false'));
}

function render(){
  const h = location.hash || '#/scores';
  if(h.startsWith('#/team/')){
    const id = h.split('/')[2];
    renderTeam(id);
    return;
  }
  (routes[h] || routes['#/scores'])(state);
}

// app state & boot
const state = { date: toDateKey(new Date()) };

// wire navigation
$$('.tab').forEach(btn => btn.addEventListener('click', ()=>{ location.hash = btn.dataset.route; }));
document.getElementById('boxClose').addEventListener('click', ()=> document.getElementById('overlay').style.display='none');
document.getElementById('overlay').addEventListener('click', (e)=>{ if(e.target.id==='overlay') document.getElementById('overlay').style.display='none'; });

document.getElementById('hlClose').addEventListener('click', ()=> document.getElementById('hlOverlay').style.display='none');
document.getElementById('hlOverlay').addEventListener('click', (e)=>{ if(e.target.id==='hlOverlay') document.getElementById('hlOverlay').style.display='none'; });

setActiveTab();
window.addEventListener('hashchange', ()=>{ setActiveTab(); render(); });
render();
