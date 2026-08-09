// helpers to pick highlight playbacks and locate recaps in content payload
export function pickPlayback(playbacks){
  if(!Array.isArray(playbacks)) return null;
  const pref = ['HTTP_CLOUD_WIRED_720','HTTP_CLOUD_MOBILE','MP4_720K','HTTP_CLOUD_TABLET'];
  for(const name of pref){
    const p = playbacks.find(x=> x.name===name);
    if(p) return p.url;
  }
  return playbacks[0]?.url || null;
}

// MLB publishes dedicated translated highlight reels (e.g. "Japanese Highlights: Blue Jays-Phillies")
// alongside the English recap. Their headline/title always leads with the language name, unlike
// ordinary English clips which are also taxonomy-tagged for a language (international licensing)
// without actually being dubbed/translated.
const FOREIGN_HIGHLIGHT_REEL = /^(japanese|spanish|korean|chinese|portuguese)\s+highlights\b/i;

function isNonEnglish(item){
  return FOREIGN_HIGHLIGHT_REEL.test(item.headline || '') || FOREIGN_HIGHLIGHT_REEL.test(item.title || '');
}

export function findRecapFromContent(data){
  const buckets = [];
  if(data?.highlights?.highlights?.items) buckets.push(...data.highlights.highlights.items);
  if(data?.highlights?.live?.items) buckets.push(...data.highlights.live.items);
  if(data?.editorial?.recap?.mlb?.items) buckets.push(...data.editorial.recap.mlb.items);
  const english = buckets.filter(item => !isNonEnglish(item));
  const ranked = english.sort((a,b)=>{
    const ah = (a.headline||'').toLowerCase();
    const bh = (b.headline||'').toLowerCase();
    const ascore = (ah.includes('recap')?2:0) + (ah.includes('highlight')?1:0);
    const bscore = (bh.includes('recap')?2:0) + (bh.includes('highlight')?1:0);
    return bscore - ascore;
  });
  for(const item of ranked){
    const url = pickPlayback(item.playbacks || item.media?.playbacks || []);
    if(url) return { title: item.headline || 'Game Highlights', url };
  }
  return null;
}
