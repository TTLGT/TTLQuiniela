/* ============================================
   CONFIGURACIÓN GLOBAL
   ============================================ */

// 🔑 GOOGLE SHEETS API KEY
// Instrucciones para obtener tu propia key:
// 1. Ve a: https://console.cloud.google.com/
// 2. Crea un nuevo proyecto o selecciona uno existente
// 3. Habilita "Google Sheets API"
// 4. Ve a "Credenciales" y crea una nueva "API Key"
// 5. Restringe la key a solo "Google Sheets API"
// 6. Copia la key aquí (NO la subas a GitHub)

const GOOGLE_SHEETS_API_KEY = 'AIzaSyBUhn3DBWuCwzhxMpZXPk7u-sThPxU7psc';

// IDs de los Google Sheets
const SHEETS_CONFIG = {
  CONTROL_SHEET: '1z5JtZkEQ7z6IhTBZ2nSN2C3SCDDGsS93',
  PREDICCIONES_SHEET: '1ay5us4PV3JMnUFV0L0IV_zSGB8pUc8nObXHa5YHBnxg'
};

// URLs de las APIs
const API_ENDPOINTS = {
  WORLDCUP_JSON: 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
  SHEETS_API: 'https://sheets.googleapis.com/v4/spreadsheets'
};

// Fases del mundial
const PHASES = {
  groups: { name: 'Fase de Grupos', multiplier: 1, id: 'groups' },
  round16: { name: 'Dieciseisavos', multiplier: 1, id: 'round16' },
  // Octavos usa puntuación fija (reglamento de eliminación directa): 5 pts exacto, 2 pts tendencia, sin bonos extra
  round8: { name: 'Octavos', multiplier: 1, id: 'round8', exactPoints: 5, winnerPoints: 2 },
  // Cuartos, Semifinal y Final usan el mismo 5/2 base MAS 3 bonos independientes de +1 pt
  // cada uno (ver calculateScore en scoring.js): diferencia de gol igual al pronóstico,
  // acertar el ganador en tiempos extra/penales, y acertar quién anota el primer gol.
  quarters: { name: 'Cuartos', multiplier: 2, id: 'quarters', exactPoints: 5, winnerPoints: 2, bonusRules: true },
  semi: { name: 'Semifinal', multiplier: 3, id: 'semi', exactPoints: 5, winnerPoints: 2, bonusRules: true },
  final: { name: 'Final', multiplier: 5, id: 'final', exactPoints: 5, winnerPoints: 2, bonusRules: true }
};

// Puntuación por tipo de acierto
const SCORING_RULES = {
  EXACT_MATCH: 3,      // Marcador exacto
  WINNER_MATCH: 1,     // Solo ganador correcto
  NO_MATCH: 0          // Sin puntos
};

// Puntos exacto/tendencia para una fase, respetando overrides fijos (ej. Octavos) o cayendo al multiplicador
function getPhasePoints(phaseId) {
  const phase = PHASES[phaseId];
  if (phase && typeof phase.exactPoints === 'number') {
    return { exact: phase.exactPoints, winner: phase.winnerPoints };
  }
  const multiplier = phase ? phase.multiplier : 1;
  return { exact: SCORING_RULES.EXACT_MATCH * multiplier, winner: SCORING_RULES.WINNER_MATCH * multiplier };
}

// Texto de la leyenda de puntuación de una fase, acorde a si usa puntos fijos
// (ej. Octavos) o el multiplicador general — se recalcula desde PHASES para
// que la leyenda nunca quede desfasada de las reglas reales.
function formatPhaseHint(phaseId) {
  const phase = PHASES[phaseId];
  const points = getPhasePoints(phaseId);
  if (phase && phase.bonusRules) {
    return `${points.exact} pts por marcador exacto, ${points.winner} pts por acertar el ganador o empate en tiempo regular (90'), `
      + `+1 pt si la diferencia de gol coincide, +1 pt si aciertas el ganador en tiempo extra/penales, +1 pt si aciertas quién anota el primer gol`;
  }
  if (phase && typeof phase.exactPoints === 'number') {
    return `${points.exact} pts por marcador exacto, ${points.winner} pts por acertar el ganador o empate en esta fase`;
  }
  const multiplier = phase ? phase.multiplier : 1;
  return `Los puntos de cada acierto se multiplican por ×${multiplier} en esta fase`;
}

console.log('%c⚽ Quiniela Mundialista 2026 iniciada', 'color: #041561; font-size: 16px; font-weight: bold;');
