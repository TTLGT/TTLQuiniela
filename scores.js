/* ============================================
   SCORES.JS — Resultados Reales de Partidos
   ============================================ */

// Resultados manuales (respaldo cuando el feed no está actualizado)
const MANUAL_RESULTS = {
  // Formato: "TeamA vs TeamB (YYYY-MM-DD)": { goalsTeamA: X, goalsTeamB: Y }
  // Ejemplo: "Mexico vs USA (2026-06-12)": { goalsTeamA: 2, goalsTeamB: 1 }
  "Canada vs Bosnia y Herzegovina": { goalsTeamA: 2, goalsTeamB: 2 }
};

// Fechas/horarios manuales (para partidos que el feed aún no tiene en su calendario)
// Usa los nombres exactos de equipos tal como aparecen en la columna "Partido" de la tabla.
// El orden local vs visitante no importa — la búsqueda funciona en ambas direcciones.
const MANUAL_SCHEDULE = {
  // Formato: "Local vs Visitante": { date: "YYYY-MM-DD", time: "HH:MM" }
  // Ejemplo: "Alemania vs Curazao": { date: "2026-06-20", time: "18:00" }
};

// Caché de resultados
let resultsCache = null;

// Caché de fechas/horarios de todos los partidos (incluyendo pendientes)
let scheduleCache = null;

// Caché de horarios ESPN en UTC
let espnTimeCache = null;

function utcToGuatemala(utcStr) {
  // Guatemala = UTC-6, no DST
  const d = new Date(utcStr);
  const gt = new Date(d.getTime() - 6 * 60 * 60 * 1000);
  return {
    date: gt.toISOString().slice(0, 10),
    time: `${String(gt.getUTCHours()).padStart(2, '0')}:${String(gt.getUTCMinutes()).padStart(2, '0')}`
  };
}

async function fetchESPNTimes() {
  if (espnTimeCache) return espnTimeCache;

  const cache = {};
  const today = new Date();
  const dates = [];
  for (let i = -1; i <= 21; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
  }

  const results = await Promise.all(
    dates.map(date =>
      fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${date}&lang=es&region=gt`)
        .then(r => r.json())
        .catch(() => null)
    )
  );

  for (const data of results) {
    if (!data?.events) continue;
    for (const event of data.events) {
      const utcStr = event.date;
      const competitors = event.competitions?.[0]?.competitors || [];
      const rawHome = competitors.find(c => c.homeAway === 'home')?.team?.name;
      const rawAway = competitors.find(c => c.homeAway === 'away')?.team?.name;
      const team1 = normalizeTeamName(rawHome);
      const team2 = normalizeTeamName(rawAway);
      if (team1 && team2 && utcStr) {
        cache[`${team1} vs ${team2}`] = utcStr;
        cache[`${team2} vs ${team1}`] = utcStr;
      }
    }
  }

  espnTimeCache = cache;
  console.log(`✅ ESPN: ${Object.keys(cache).length / 2} partidos con horario GT cargados`);
  return cache;
}

async function fetchWorldCupResults() {
  console.log('🌍 Descargando resultados del feed worldcup.json...');

  try {
    const response = await fetch(API_ENDPOINTS.WORLDCUP_JSON);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Feed descargado.');

    // Si hay datos en caché, retornar
    if (resultsCache) {
      return resultsCache;
    }

    const normalizedResults = {};

    let tournaments = [];

    if (Array.isArray(data)) {
      tournaments = data;
    } else if (data && typeof data === 'object') {
      if (data.tournaments && Array.isArray(data.tournaments)) {
        tournaments = data.tournaments;
      } else if (data.matches && Array.isArray(data.matches)) {
        tournaments = [data];
      } else if (data.rounds && Array.isArray(data.rounds)) {
        tournaments = [{ rounds: data.rounds }];
      } else {
        tournaments = [data];
      }
    }

    console.log(`📊 Procesando ${tournaments.length} torneo(s)...`);

    const normalizedSchedule = {};

    for (const tournament of tournaments) {
      // Caso top-level con matches
      if (tournament.matches && Array.isArray(tournament.matches)) {
        for (const match of tournament.matches) {
          processMatchResult(match, normalizedResults);
          processMatchSchedule(match, normalizedSchedule);
        }

        continue;
      }

      if (!tournament || !tournament.rounds) continue;

      for (const round of tournament.rounds) {
        if (!round.matches || !Array.isArray(round.matches)) continue;

        for (const match of round.matches) {
          processMatchResult(match, normalizedResults);
          processMatchSchedule(match, normalizedSchedule);
        }
      }
    }

    resultsCache = normalizedResults;
    scheduleCache = normalizedSchedule;
    console.log(`✅ ${Object.keys(normalizedResults).length} resultados procesados`);
    return normalizedResults;
  } catch (error) {
    console.error('❌ Error descargando worldcup.json:', error);
    return {};
  }
}

function processMatchResult(match, normalizedResults) {
  if (!match) return;

  let goalsTeam1 = null;
  let goalsTeam2 = null;

  if (match.score) {
    if (Array.isArray(match.score) && match.score.length >= 2) {
      goalsTeam1 = Number(match.score[0]);
      goalsTeam2 = Number(match.score[1]);
    } else if (match.score.ft && Array.isArray(match.score.ft) && match.score.ft.length >= 2) {
      goalsTeam1 = Number(match.score.ft[0]);
      goalsTeam2 = Number(match.score.ft[1]);
    }
  }

  const rawTeam1 = typeof match.team1 === 'string' ? match.team1 : (match.team1 && match.team1.name);
  const rawTeam2 = typeof match.team2 === 'string' ? match.team2 : (match.team2 && match.team2.name);

  if (!rawTeam1 || !rawTeam2 || goalsTeam1 === null || goalsTeam2 === null) {
    return;
  }

  const team1 = normalizeTeamName(rawTeam1);
  const team2 = normalizeTeamName(rawTeam2);
  const date = match.date ? match.date.split('T')[0] : 'unknown';

  const key = `${team1} vs ${team2}`;
  normalizedResults[key] = {
    goalsTeamA: goalsTeam1,
    goalsTeamB: goalsTeam2,
    team1,
    team2,
    date
  };

  console.log(`  ⚽ ${team1} ${goalsTeam1}-${goalsTeam2} ${team2}`);
}

function processMatchSchedule(match, schedule) {
  if (!match) return;

  const rawTeam1 = typeof match.team1 === 'string' ? match.team1 : (match.team1 && match.team1.name);
  const rawTeam2 = typeof match.team2 === 'string' ? match.team2 : (match.team2 && match.team2.name);

  if (!rawTeam1 || !rawTeam2) return;

  const team1 = normalizeTeamName(rawTeam1);
  const team2 = normalizeTeamName(rawTeam2);

  let date = null;
  let time = null;

  if (match.date) {
    if (match.date.includes('T')) {
      const parts = match.date.split('T');
      date = parts[0];
      time = parts[1] ? parts[1].substring(0, 5) : null;
    } else {
      date = match.date;
    }
  }

  if (match.time) {
    time = match.time.substring(0, 5);
  }

  const key = `${team1} vs ${team2}`;
  schedule[key] = { team1, team2, date, time };
}

function findMatchDateTime(teamLocal, teamVisitor) {
  // 1. Manual schedule (highest priority)
  const key1 = `${teamLocal} vs ${teamVisitor}`;
  const key2 = `${teamVisitor} vs ${teamLocal}`;
  if (MANUAL_SCHEDULE[key1]) return MANUAL_SCHEDULE[key1];
  if (MANUAL_SCHEDULE[key2]) return MANUAL_SCHEDULE[key2];

  // 2. ESPN times in Guatemala (UTC-6)
  if (espnTimeCache) {
    const utcStr = espnTimeCache[key1] || espnTimeCache[key2];
    if (utcStr) {
      const gt = utcToGuatemala(utcStr);
      return { date: gt.date, time: gt.time, utcStr };
    }
  }

  // 3. Fallback: openfootball feed schedule (local venue time, not Guatemala)
  const schedule = scheduleCache || {};
  for (const [, entry] of Object.entries(schedule)) {
    if (
      (entry.team1 === teamLocal && entry.team2 === teamVisitor) ||
      (entry.team1 === teamVisitor && entry.team2 === teamLocal)
    ) {
      return { date: entry.date, time: entry.time };
    }
  }
  return null;
}

function getMatchResult(teamLocal, teamVisitor, dateStr) {
  // Buscar en resultados manuales primero (tienen prioridad)
  const key1 = `${teamLocal} vs ${teamVisitor}`;
  const key2 = `${teamVisitor} vs ${teamLocal}`;

  // Buscar en MANUAL_RESULTS
  if (MANUAL_RESULTS[key1]) {
    console.log(`📋 Resultado manual encontrado: ${key1}`);
    return MANUAL_RESULTS[key1];
  }

  if (MANUAL_RESULTS[key2]) {
    console.log(`📋 Resultado manual encontrado (inverso): ${key2}`);
    const result = MANUAL_RESULTS[key2];
    return {
      goalsTeamA: result.goalsTeamB,
      goalsTeamB: result.goalsTeamA
    };
  }

  // Si no hay resultado manual, retornar null
  return null;
}

function findMatchResultByTeams(results, teamLocal, teamVisitor) {
  // Buscar una clave que contenga ambos equipos
  for (const [key, result] of Object.entries(results)) {
    if (
      (result.team1 === teamLocal && result.team2 === teamVisitor) ||
      (result.team1 === teamVisitor && result.team2 === teamLocal)
    ) {
      if (result.team1 === teamLocal) {
        return {
          goalsTeamA: result.goalsTeamA,
          goalsTeamB: result.goalsTeamB
        };
      } else {
        return {
          goalsTeamA: result.goalsTeamB,
          goalsTeamB: result.goalsTeamA
        };
      }
    }
  }

  return null;
}

console.log('✅ scores.js cargado');
