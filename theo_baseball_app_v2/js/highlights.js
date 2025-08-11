import { pickPlayback, findRecapFromContent } from './media.js';

export function openHighlights(recap, gameTitle){
  const overlay = document.getElementById('hlOverlay');
  const body = document.getElementById('hlContent');
  const h = document.getElementById('hlTitle');
  h.textContent = `Watch Highlights — ${gameTitle}`;
  body.innerHTML = '';

  const wrap = document.createElement('div'); wrap.className = 'video-wrap';
  const video = document.createElement('video'); video.className='video'; video.controls = true; video.playsInline = true; video.src = recap.url;
  const caption = document.createElement('div'); caption.style.padding='8px 2px 2px'; caption.textContent = recap.title || 'Game Highlights';
  wrap.append(video, caption);
  body.append(wrap);

  overlay.style.display = 'flex';
}

// re-export helpers if needed
export { pickPlayback, findRecapFromContent };
