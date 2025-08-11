// utils and DOM helpers
export const $ = (s, el=document) => el.querySelector(s);
export const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
export const pad = n => String(n).padStart(2,'0');
export const toDateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const fromKey = (key) => { if (key instanceof Date) return key; const [y,m,d]=String(key).split('-').map(Number); return new Date(y,(m||1)-1,d||1); };
export const localTime = iso => new Date(iso).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
export const dayLabel = d => fromKey(d).toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
export function btnIcon(txt){ const b=document.createElement('button'); b.className='iconbtn'; b.textContent=txt; return b; }
export function labelStatus(s){ return s==='FINAL' ? 'Final' : s==='IN_PROGRESS' ? 'Live' : 'Scheduled'; }
export function escapeHtml(str){ return String(str).replace(/[&<>\"']/g, s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[s])); }
export const safe = v => (v==null || v===undefined) ? '' : v;
export const num = v => (v==null || v===undefined) ? '' : v;

export function avatarFor(name){
  const initial = (name||'?').trim()[0] || '?';
  const svg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56'>
    <rect rx='8' ry='8' width='56' height='56' fill='#dfe9ff'/>
    <text x='50%' y='58%' dominant-baseline='middle' text-anchor='middle' font-family='Fredoka, Arial' font-size='28' fill='#213a6b'>${initial}</text>
  </svg>`);
  return `data:image/svg+xml;charset=utf-8,${svg}`;
}

export function formatAVG(v){
  if(v==null || v==='') return '';
  const s = String(v);
  return s.startsWith('0') ? s.slice(1) : s;
}
