/* ============================================
   SHEETS.JS — Lectura de Google Sheets
   ============================================ */

// Caché global para evitar lecturas repetidas
let sheetsCache = null;

async function getAllSheetNames() {
  console.log('📝 Obteniendo nombres de pestañas...');

  const url = `${API_ENDPOINTS.SHEETS_API}/${SHEETS_CONFIG.PREDICCIONES_SHEET}?key=${GOOGLE_SHEETS_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const sheetNames = data.sheets.map(sheet => sheet.properties.title);
    console.log(`✅ ${sheetNames.length} pestañas encontradas`);
    return sheetNames;
  } catch (error) {
    console.error('❌ Error obteniendo nombres de pestañas:', error);
    return [];
  }
}

async function readSheetData(sheetName, range = 'A1:AZ500') {
  console.log(`📖 Leyendo ${sheetName}...`);

  const url = `${API_ENDPOINTS.SHEETS_API}/${SHEETS_CONFIG.PREDICCIONES_SHEET}/values/'${sheetName}'!${range}?key=${GOOGLE_SHEETS_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.values || [];
  } catch (error) {
    console.error(`❌ Error leyendo ${sheetName}:`, error);
    return [];
  }
}

// Lee varias pestañas en una sola llamada a la API (values:batchGet) en vez de
// una request por participante — con muchos participantes cargando la página
// a la vez (ej. el día de la Final), N requests secuenciales agotan la cuota
// de lectura por minuto de Google Sheets y las tablas quedan sin datos.
async function readMultipleSheetsData(sheetNames, range = 'A1:AZ500') {
  if (sheetNames.length === 0) return {};

  const rangesParam = sheetNames
    .map(name => `ranges=${encodeURIComponent(`'${name}'!${range}`)}`)
    .join('&');
  const url = `${API_ENDPOINTS.SHEETS_API}/${SHEETS_CONFIG.PREDICCIONES_SHEET}/values:batchGet?${rangesParam}&key=${GOOGLE_SHEETS_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const result = {};
    (data.valueRanges || []).forEach((valueRange, idx) => {
      result[sheetNames[idx]] = valueRange.values || [];
    });
    return result;
  } catch (error) {
    console.error('❌ Error leyendo pestañas en batch:', error);
    return {};
  }
}

// Cada fase (Grupos, Dieciseisavos, Octavos, Cuartos, Semifinal, Final) ocupa
// un bloque de 7 columnas: [PARTIDO, Grupo, Local, GolesLocal, GolesVisitor, Visitor, PenaltyWinner]
// colocados uno junto al otro en la misma fila de encabezado.
function findPhaseBlocks(sheetData) {
  const blocks = [];
  const seenCols = new Set();
  const headerRows = Math.min(sheetData.length, 3);

  for (let r = 0; r < headerRows; r++) {
    const row = sheetData[r];
    if (!row) continue;

    for (let c = 0; c < row.length; c++) {
      if (seenCols.has(c)) continue;
      const cell = (row[c] || '').trim();
      if (!cell) continue;

      const upper = cell.toUpperCase();
      const isGroupHeader = upper.includes('FASE') && upper.includes('GRUPO');
      const isKnockoutHeader = upper.includes('DIECISEIS') || upper.includes('OCTAVOS') ||
        upper.includes('CUARTOS') || upper.includes('SEMIFINAL') ||
        (upper.includes('FINAL') && !upper.includes('SEMI'));

      if (isGroupHeader || isKnockoutHeader) {
        blocks.push({ startCol: c, phase: cell });
        seenCols.add(c);
      }
    }
  }

  return blocks.sort((a, b) => a.startCol - b.startCol);
}

function parsePhaseBlockRow(row, startCol, phase, participantName) {
  const idCell = (row[startCol] || '').trim();
  if (!idCell || idCell === 'PARTIDO' || isNaN(idCell) || /^\d{2}\/\d{2}$/.test(idCell)) {
    return null;
  }

  // Slot 1 is always a non-team sub-header column: the group letter in Fase de
  // Grupos, blank in Dieciseisavos/Octavos, or the "1er Gol" guess in Cuartos+.
  // It is never the local team, so the block layout is fixed — no shifting.
  const group = (row[startCol + 1] || '').trim();
  const teamLocal = (row[startCol + 2] || '').trim();
  const goalsLocal = (row[startCol + 3] || '').trim();
  const goalsVisitor = (row[startCol + 4] || '').trim();
  const teamVisitor = (row[startCol + 5] || '').trim();
  const penaltyWinner = (row[startCol + 6] || '').trim();

  if (!teamLocal || !teamVisitor || !/^\d+$/.test(goalsLocal) || !/^\d+$/.test(goalsVisitor)) {
    return null;
  }

  return {
    id: parseInt(idCell),
    phase,
    group,
    // Same raw slot as `group`, but named for what it actually holds from
    // Cuartos onward: the participant's guess for which team scores first.
    firstGoalGuess: group ? normalizeTeamName(group) : null,
    teamLocal: normalizeTeamName(teamLocal),
    goalsLocal: parseInt(goalsLocal),
    goalsVisitor: parseInt(goalsVisitor),
    teamVisitor: normalizeTeamName(teamVisitor),
    penaltyWinner: penaltyWinner ? normalizeTeamName(penaltyWinner) : null,
    participant: participantName
  };
}

function parseMatchesFromSheet(sheetData, participantName) {
  const matches = {};
  let matchNumber = 0;

  const phaseBlocks = findPhaseBlocks(sheetData);
  phaseBlocks.forEach(b => console.log(`  📍 Fase encontrada: ${b.phase} (col ${b.startCol})`));

  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || row.length === 0) continue;

    for (const block of phaseBlocks) {
      const match = parsePhaseBlockRow(row, block.startCol, block.phase, participantName);
      if (match) {
        matches[`${block.phase}_${match.id}`] = match;
        matchNumber++;
      }
    }
  }

  console.log(`  ✅ ${matchNumber} partidos parseados para ${participantName}`);
  return matches;
}

async function readPredictionsFromSheets() {
  console.log('📥 Leyendo predicciones de Google Sheets...');

  if (GOOGLE_SHEETS_API_KEY === 'TU_API_KEY_AQUI') {
    console.error('❌ ERROR: Falta configurar GOOGLE_SHEETS_API_KEY');
    throw new Error('API Key no configurada');
  }

  // Usar caché si ya se leyó
  if (sheetsCache) {
    console.log('📦 Usando datos en caché');
    return sheetsCache;
  }

  // Obtener nombres de todas las pestañas
  const sheetNames = await getAllSheetNames();

  const participantNames = getAllParticipants();
  const participantSheetNames = sheetNames.filter(name => participantNames.includes(name));

  // Una sola llamada batchGet para todas las pestañas de participantes, en vez
  // de una request por participante (ver readMultipleSheetsData).
  const sheetDataByName = await readMultipleSheetsData(participantSheetNames);

  const allPredictions = {};
  for (const sheetName of participantSheetNames) {
    const matches = parseMatchesFromSheet(sheetDataByName[sheetName] || [], sheetName);
    allPredictions[sheetName] = matches;
  }

  sheetsCache = allPredictions;
  console.log(`✅ Predicciones de ${Object.keys(allPredictions).length} participantes cargadas`);
  return allPredictions;
}

console.log('✅ sheets.js cargado');
