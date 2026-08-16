import { $, $$, toDateKey } from './utils.js';
import { renderScores } from './scores.js';
import { renderStandings } from './standings.js';
import { renderTeam } from './team.js';
import { renderStats } from './stats.js';
import { renderVenues } from './venues.js';
import { closeHighlights } from './highlights.js';

// Simple router
const routes = {
  '#/scores':    (state) => renderScores(state),
  '#/standings': (state) => renderStandings(state),
  '#/stats':     (state) => renderStats(state),
  '#/ballparks': ()      => renderVenues(),
};

function setActiveTab(){
  const h = location.hash || '#/scores';
  $$('.nav-item').forEach(b=> b.setAttribute('aria-current', b.dataset.route===h ? 'page' : 'false'));
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
$$('.nav-item').forEach(btn => btn.addEventListener('click', ()=>{ location.hash = btn.dataset.route; }));
document.getElementById('boxClose').addEventListener('click', ()=> document.getElementById('overlay').style.display='none');
document.getElementById('overlay').addEventListener('click', (e)=>{ if(e.target.id==='overlay') document.getElementById('overlay').style.display='none'; });

document.getElementById('hlClose').addEventListener('click', closeHighlights);
document.getElementById('hlOverlay').addEventListener('click', (e)=>{ if(e.target.id==='hlOverlay') closeHighlights(); });

document.getElementById('playerClose').addEventListener('click', ()=> document.getElementById('playerOverlay').style.display='none');
document.getElementById('playerOverlay').addEventListener('click', (e)=>{ if(e.target.id==='playerOverlay') document.getElementById('playerOverlay').style.display='none'; });

setActiveTab();
window.addEventListener('hashchange', ()=>{ setActiveTab(); render(); });
render();

// iOS Safari reports 100vh/100dvh using the address-bar-expanded viewport at
// first paint, then repaints late once it collapses — this leaves a stale
// gap that only resolves on the first scroll/resize. Track the real visual
// viewport height ourselves so the shell is correct from the first frame.
function setViewportHeight(){
  const h = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
}
setViewportHeight();
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', setViewportHeight);
window.visualViewport?.addEventListener('resize', setViewportHeight);
