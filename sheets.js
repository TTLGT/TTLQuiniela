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

async function readSheetData(sheetName, range = 'A1:N500') {
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
  let currentPhaseLeft = null;   // cols A-F (group stage)
  let currentPhaseRight = null;  // cols H-N (knockout rounds)
  let matchNumber = 0;

  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || row.length === 0) continue;

    const col0 = (row[0] || '').trim();
    const col1 = (row[1] || '').trim();

    // === LEFT SECTION: cols A-F (indices 0-5) — group stage ===

    if (col0.includes('FASE')) {
      currentPhaseLeft = col0;
      console.log(`  📍 Fase grupos encontrada: ${currentPhaseLeft}`);
    } else if (col0 !== 'PARTIDO' &&
               !/^\d{2}\/\d{2}$/.test(col0) &&
               !(col0 === '' && /^\d{2}\/\d{2}$/.test(col1))) {
      if (col0 && !isNaN(col0) && currentPhaseLeft) {
        const matchId = parseInt(col0);
        const group = col1;
        const teamLocal = (row[2] || '').trim();
        const goalsLocal = (row[3] || '').trim();
        const goalsVisitor = (row[4] || '').trim();
        const teamVisitor = (row[5] || '').trim();

        if (teamLocal && teamVisitor && /^\d+$/.test(goalsLocal) && /^\d+$/.test(goalsVisitor)) {
          const key = `${currentPhaseLeft}_${matchId}`;
          matches[key] = {
            id: matchId,
            phase: currentPhaseLeft,
            group,
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

    // === RIGHT SECTION: cols H-N (indices 7-13) — knockout rounds ===

    const col7 = (row[7] || '').trim();
    if (!col7 || col7 === 'PARTIDO') {
      // empty or column-header row — skip right section
    } else if (/^\d{2}\/\d{2}$/.test(col7)) {
      // date row in right section — skip
    } else if (isNaN(col7)) {
      // Phase header (e.g. "Dieciseisavos", "Octavos", "Cuartos"...)
      const col7Upper = col7.toUpperCase();
      if (col7Upper.includes('DIECISEIS') || col7Upper.includes('16') ||
          col7Upper.includes('OCTAVOS') || col7Upper.includes('CUARTOS') ||
          col7Upper.includes('SEMIFINAL') ||
          (col7Upper.includes('FINAL') && !col7Upper.includes('SEMI'))) {
        currentPhaseRight = col7;
        console.log(`  📍 Fase knockout encontrada: ${currentPhaseRight}`);
      }
    } else if (currentPhaseRight) {
      // Parse knockout match
      const matchId = parseInt(col7);
      const col8  = (row[8]  || '').trim();
      const col9  = (row[9]  || '').trim();
      const col10 = (row[10] || '').trim();
      const col11 = (row[11] || '').trim();
      const col12 = (row[12] || '').trim();
      const col13 = (row[13] || '').trim();

      // Auto-detect layout:
      // If col8 is a multi-char non-numeric string → teamLocal is at col8 (no Grupo column)
      // Otherwise → col8=group(empty), col9=teamLocal (mirrors group-stage layout)
      let teamLocal, goalsLocal, goalsVisitor, teamVisitor, penaltyWinner;
      if (col8 && isNaN(col8) && col8.length > 1) {
        teamLocal     = col8;
        goalsLocal    = col9;
        goalsVisitor  = col10;
        teamVisitor   = col11;
        penaltyWinner = col13;
      } else {
        teamLocal     = col9;
        goalsLocal    = col10;
        goalsVisitor  = col11;
        teamVisitor   = col12;
        penaltyWinner = col13;
      }

      if (teamLocal && teamVisitor && /^\d+$/.test(goalsLocal) && /^\d+$/.test(goalsVisitor)) {
        const key = `${currentPhaseRight}_${matchId}`;
        matches[key] = {
          id: matchId,
          phase: currentPhaseRight,
          group: '',
          teamLocal: normalizeTeamName(teamLocal),
          goalsLocal: parseInt(goalsLocal),
          goalsVisitor: parseInt(goalsVisitor),
          teamVisitor: normalizeTeamName(teamVisitor),
          penaltyWinner: penaltyWinner ? normalizeTeamName(penaltyWinner) : null,
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
