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

async function readSheetData(sheetName, range = 'A1:F500') {
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

function parseMatchesFromSheet(sheetData, participantName) {
  const matches = {};
  let currentPhase = null;
  let currentGroup = null;
  let matchNumber = 0;

  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || row.length === 0) continue;

    const col0 = (row[0] || '').trim();
    const col1 = (row[1] || '').trim();

    // Detectar encabezado de fase (ej: "FASE DE GRUPOS")
    if (col0.includes('FASE')) {
      currentPhase = col0;
      console.log(`  📍 Fase encontrada: ${currentPhase}`);
      continue;
    }

    // Detectar encabezados de columna (PARTIDO, Grupo, etc)
    if (col0 === 'PARTIDO' && col1 === 'Grupo') {
      continue;
    }

    // Detectar fecha (ej: "11/06" o "12/06")
    if (/^\d{2}\/\d{2}$/.test(col0)) {
      currentGroup = col0;
      continue;
    }

    // Detectar fila de fecha en col1 (ej: ['', '12/06'])
    if (col0 === '' && /^\d{2}\/\d{2}$/.test(col1)) {
      currentGroup = col1;
      continue;
    }

    // Parsear un partido
    if (col0 && !isNaN(col0) && currentPhase) {
      const matchId = parseInt(col0);
      const group = col1;
      const teamLocal = (row[2] || '').trim();
      const goalsLocal = (row[3] || '').trim();
      const goalsVisitor = (row[4] || '').trim();
      const teamVisitor = (row[5] || '').trim();

      // Validar que sea un partido válido con goles numéricos
      if (teamLocal && teamVisitor && /^\d+$/.test(goalsLocal) && /^\d+$/.test(goalsVisitor)) {
        const key = `${currentPhase}_${matchId}`;
        matches[key] = {
          id: matchId,
          phase: currentPhase,
          group: group,
          teamLocal: normalizeTeamName(teamLocal),
          goalsLocal: parseInt(goalsLocal),
          goalsVisitor: parseInt(goalsVisitor),
          teamVisitor: normalizeTeamName(teamVisitor),
          participant: participantName
        };
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
  
  const allPredictions = {};
  const participantNames = getAllParticipants();

  for (const sheetName of sheetNames) {
    // Solo leer las pestañas que corresponden a participantes
    if (participantNames.includes(sheetName)) {
      const sheetData = await readSheetData(sheetName);
      const matches = parseMatchesFromSheet(sheetData, sheetName);
      allPredictions[sheetName] = matches;
    }
  }

  sheetsCache = allPredictions;
  console.log(`✅ Predicciones de ${Object.keys(allPredictions).length} participantes cargadas`);
  return allPredictions;
}

console.log('✅ sheets.js cargado');
