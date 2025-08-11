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

export function findRecapFromContent(data){
  const buckets = [];
  if(data?.highlights?.highlights?.items) buckets.push(...data.highlights.highlights.items);
  if(data?.highlights?.live?.items) buckets.push(...data.highlights.live.items);
  if(data?.editorial?.recap?.mlb?.items) buckets.push(...data.editorial.recap.mlb.items);
  const ranked = buckets.sort((a,b)=>{
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
