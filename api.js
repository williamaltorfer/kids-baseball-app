// API + data helpers
export const MLB = {
  schedule: (dateKey)=> `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dateKey}`,
  live: (gamePk)=> `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,
  content: (gamePk)=> `https://statsapi.mlb.com/api/v1/game/${gamePk}/content`,
  standings: (season)=> `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team(division,league)`,
  team: (teamId)=> `https://statsapi.mlb.com/api/v1/teams/${teamId}`,
  rosterActive: (teamId)=> `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=active`,
  peopleStats: (ids, season)=> `https://statsapi.mlb.com/api/v1/people?personIds=${ids.join(',')}&hydrate=stats(group=[hitting,pitching],type=[season],season=${season})`,
  headshot: (id)=> `https://img.mlbstatic.com/mlb-photos/image/upload/w_56,q_auto:best/v1/people/${id}/headshot/67/current`,
  teamLogos: (id)=> [
    `https://www.mlbstatic.com/team-logos/${id}.svg`,
    `https://www.mlbstatic.com/team-logos/team-primary-on-light/${id}.svg`,
    `https://www.mlbstatic.com/team-logos/team-primary-on-dark/${id}.svg`,
    `https://www.mlbstatic.com/team-logos/team-cap-on-light/${id}.svg`
  ]
};

export async function fetchJSON(url, {timeout=12000}={}){
  const ctrl = new AbortController();
  const id = setTimeout(()=>ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {signal: ctrl.signal});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(id); }
}

export async function getSchedule(dateKey){
  try {
    const data = await fetchJSON(MLB.schedule(dateKey));
    const games = (data.dates?.[0]?.games || []).map(g => ({
      id: String(g.gamePk),
      gamePk: g.gamePk,
      status: (g.status?.detailedState || 'Scheduled').toUpperCase().includes('FINAL') ? 'FINAL' : (g.status?.abstractGameState || 'Preview').toUpperCase(),
      start: g.gameDate,
      venue: g.venue?.name || '',
      away: { id: g.teams.away.team.abbreviation, name: g.teams.away.team.name, teamId: g.teams.away.team.id },
      home: { id: g.teams.home.team.abbreviation, name: g.teams.home.team.name, teamId: g.teams.home.team.id },
      probable: {
        away: g.teams.away?.probablePitcher?.fullName ? `${g.teams.away.probablePitcher.fullName}` : 'TBD',
        home: g.teams.home?.probablePitcher?.fullName ? `${g.teams.home.probablePitcher.fullName}` : 'TBD'
      }
    }));
    return games;
  } catch (e) {
    console.warn('Schedule fetch failed.', e);
    return [];
  }
}

export const getLive = (gamePk) => fetchJSON(MLB.live(gamePk));
export const getContent = (gamePk) => fetchJSON(MLB.content(gamePk));

// Standings helpers
export async function getStandings(season){
  return await fetchJSON(MLB.standings(season));
}
export async function getTeam(teamId){
  return await fetchJSON(MLB.team(teamId));
}
export async function getRosterActive(teamId){
  return await fetchJSON(MLB.rosterActive(teamId));
}
export async function getPeopleStats(ids, season){
  return await fetchJSON(MLB.peopleStats(ids, season));
}
