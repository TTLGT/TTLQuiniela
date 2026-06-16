/* ============================================
   SCORING.JS — Motor de Puntuación
   ============================================ */

function calculateScore(prediction, actualResult, phase) {
  const phaseMultiplier = PHASES[phase] ? PHASES[phase].multiplier : 1;

  if (!actualResult || typeof prediction.goalsLocal === 'undefined' || typeof prediction.goalsVisitor === 'undefined') {
    return { points: 0, type: 'no-match', description: 'Sin resultado' };
  }

  const predLocal = prediction.goalsLocal;
  const predVisitor = prediction.goalsVisitor;
  const actualLocal = actualResult.goalsTeamA;
  const actualVisitor = actualResult.goalsTeamB;

  let basePoints = SCORING_RULES.NO_MATCH;
  let matchType = 'no-match';

  // Acierto exacto
  if (predLocal === actualLocal && predVisitor === actualVisitor) {
    basePoints = SCORING_RULES.EXACT_MATCH;
    matchType = 'exact-match';
  }
  // Acierto del ganador/empate
  else if (
    (predLocal > predVisitor && actualLocal > actualVisitor) || // Local gana ambos
    (predLocal < predVisitor && actualLocal < actualVisitor) || // Visitante gana ambos
    (predLocal === predVisitor && actualLocal === actualVisitor)  // Empate ambos
  ) {
    basePoints = SCORING_RULES.WINNER_MATCH;
    matchType = 'winner-match';
  }

  const finalPoints = basePoints * phaseMultiplier;

  return {
    points: finalPoints,
    basePoints,
    type: matchType,
    multiplier: phaseMultiplier,
    prediction: `${predLocal}-${predVisitor}`,
    actual: `${actualLocal}-${actualVisitor}`
  };
}

function calculateParticipantScores(predictions, results) {
  console.log('🧮 Calculando puntos para todos los participantes...');

  const scores = {};

  for (const [participantName, participantMatches] of Object.entries(predictions)) {
    console.log(`  📊 Calculando para ${participantName}...`);

    const scoreByPhase = {
      participant: participantName,
      team: getTeamForParticipant(participantName),
      groups: 0,
      round16: 0,
      round8: 0,
      quarters: 0,
      semi: 0,
      final: 0,
      total: 0,
      matches: {}
    };

    let totalPoints = 0;

    for (const [matchKey, prediction] of Object.entries(participantMatches)) {
      // Extraer fase del matchKey (ej: "FASE DE GRUPOS_1")
      let phaseId = null;

      if (prediction.phase.includes('GRUPOS')) {
        phaseId = 'groups';
      } else if (prediction.phase.includes('16')) {
        phaseId = 'round16';
      } else if (prediction.phase.includes('8')) {
        phaseId = 'round8';
      } else if (prediction.phase.includes('CUARTOS')) {
        phaseId = 'quarters';
      } else if (prediction.phase.includes('SEMIFINAL')) {
        phaseId = 'semi';
      } else if (prediction.phase.includes('FINAL')) {
        phaseId = 'final';
      }

      if (!phaseId) {
        console.warn(`  ⚠️ Fase desconocida para: ${prediction.phase}`);
        continue;
      }

      // Buscar resultado real
      const actualResult = findMatchResultByTeams(
        results,
        prediction.teamLocal,
        prediction.teamVisitor
      );

      // Si no hay resultado, intentar resultado manual
      const finalResult = actualResult || getMatchResult(
        prediction.teamLocal,
        prediction.teamVisitor,
        ''
      );

      if (finalResult) {
        const scoreData = calculateScore(prediction, finalResult, phaseId);
        scoreByPhase[phaseId] += scoreData.points;
        scoreByPhase.total += scoreData.points;
        totalPoints += scoreData.points;

        scoreByPhase.matches[matchKey] = {
          ...prediction,
          ...scoreData,
          result: finalResult
        };
      } else {
        // Pending match — include it so it shows in the table
        scoreByPhase.matches[matchKey] = {
          ...prediction,
          points: 0,
          type: 'no-match',
          prediction: `${prediction.goalsLocal}-${prediction.goalsVisitor}`,
          result: null
        };
      }
    }

    scores[participantName] = scoreByPhase;
  }

  console.log(`✅ Puntos calculados para ${Object.keys(scores).length} participantes`);
  return scores;
}

function getRanking(scores) {
  // Convertir objeto a array y ordenar por total descendente
  const ranking = Object.values(scores)
    .sort((a, b) => b.total - a.total)
    .map((item, index) => ({
      ...item,
      position: index + 1
    }));

  return ranking;
}

console.log('✅ scoring.js cargado');
