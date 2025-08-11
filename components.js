import { escapeHtml } from './utils.js';
import { MLB } from './api.js';

export function setTeamLogo(el, team){
  el.innerHTML = '';
  const img = document.createElement('img');
  img.alt = `${team.name||''} logo`;
  const urls = MLB.teamLogos(team.teamId || 0);
  let i = 0;
  img.onerror = () => { i++; if(i < urls.length){ img.src = urls[i]; } else { el.textContent = (team.id||'').slice(0,3).toUpperCase(); } };
  if(urls.length){ img.src = urls[0]; el.append(img); } else { el.textContent = (team.id||'').slice(0,3).toUpperCase(); }
}

export function linescoreTable(game){
  const t = document.createElement('table'); t.className='linescore';
  const heads = ['Team', ...Array.from({length:9}, (_,i)=>String(i+1)), 'R'];
  const thead = document.createElement('thead'); thead.innerHTML = `<tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr>`; t.append(thead);
  const tbody = document.createElement('tbody');
  const away = `<tr><td class="teamcol">${escapeHtml(game.away.name)}</td>${game.linescore.innings.map(i=>`<td>${i.away != null && i.away !== '' ? i.away : 0}</td>`).join('')}<td><strong>${game.linescore.totals.away.R}</strong></td></tr>`;
  const home = `<tr><td class="teamcol">${escapeHtml(game.home.name)}</td>${game.linescore.innings.map(i=>`<td>${i.home != null && i.home !== '' ? i.home : 0}</td>`).join('')}<td><strong>${game.linescore.totals.home.R}</strong></td></tr>`;
  tbody.innerHTML = away + home; t.append(tbody); return t;
}

// Auto-wave the header logo once on load (respects reduced motion)
window.addEventListener('DOMContentLoaded', () => {
  try {
    const logo = document.querySelector('.logo');
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!logo || prefersReduced) return;
    logo.classList.add('auto-wave');
    setTimeout(() => logo.classList.remove('auto-wave'), 650); // keep in sync with CSS duration
  } catch (e) {
    // no-op
  }
});
