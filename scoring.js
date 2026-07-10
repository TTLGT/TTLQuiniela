/* ============================================
   SCORING.JS — Motor de Puntuación
   ============================================ */

function calculateScore(prediction, actualResult, phase, bonusData) {
  const phasePoints = getPhasePoints(phase);

  if (!actualResult || typeof prediction.goalsLocal === 'undefined' || typeof prediction.goalsVisitor === 'undefined') {
    return { points: 0, type: 'no-match', description: 'Sin resultado' };
  }

  const predLocal = prediction.goalsLocal;
  const predVisitor = prediction.goalsVisitor;
  const actualLocal = actualResult.goalsTeamA;
  const actualVisitor = actualResult.goalsTeamB;

  const isExact = predLocal === actualLocal && predVisitor === actualVisitor;
  const isTendencia = !isExact && (
    (predLocal > predVisitor && actualLocal > actualVisitor) || // Local gana ambos
    (predLocal < predVisitor && actualLocal < actualVisitor) || // Visitante gana ambos
    (predLocal === predVisitor && actualLocal === actualVisitor)  // Empate ambos
  );

  let finalPoints = SCORING_RULES.NO_MATCH;
  let matchType = 'no-match';

  if (isExact) {
    finalPoints = phasePoints.exact;
    matchType = 'exact-match';
  } else if (isTendencia) {
    finalPoints = phasePoints.winner;
    matchType = 'winner-match';
  }

  // Bonos independientes de +1 pt para fases de eliminación directa avanzadas
  // (Cuartos, Semifinal, Final) — ver reglamento en config.js PHASES.
  const bonusPoints = [];
  if (PHASES[phase]?.bonusRules) {
    // Diferencia de gol igual al pronóstico (solo aplica sobre un acierto de
    // tendencia sin marcador exacto — el exacto ya implica la misma diferencia).
    if (isTendencia && (predLocal - predVisitor) === (actualLocal - actualVisitor)) {
      finalPoints += 1;
      bonusPoints.push('diferencia-gol');
    }

    // Ganador en tiempo extra/penales: solo cuando el marcador de 90' quedó
    // empatado, el participante también predijo empate, y acertó el ganador.
    if (
      actualLocal === actualVisitor && predLocal === predVisitor &&
      bonusData?.decidedWinner && prediction.penaltyWinner &&
      prediction.penaltyWinner === bonusData.decidedWinner
    ) {
      finalPoints += 1;
      bonusPoints.push('ganador-penales');
    }

    // Equipo que anota el primer gol — independiente del acierto de marcador.
    if (
      bonusData?.firstGoalTeam && prediction.firstGoalGuess &&
      prediction.firstGoalGuess === bonusData.firstGoalTeam
    ) {
      finalPoints += 1;
      bonusPoints.push('primer-gol');
    }
  }

  return {
    points: finalPoints,
    type: matchType,
    bonusPoints,
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

      const phaseUpper = prediction.phase.toUpperCase();
      if (phaseUpper.includes('GRUPOS')) {
        phaseId = 'groups';
      } else if (phaseUpper.includes('DIECISEIS') || phaseUpper.includes('16')) {
        phaseId = 'round16';
      } else if (phaseUpper.includes('OCTAVOS') || phaseUpper.includes('8')) {
        phaseId = 'round8';
      } else if (phaseUpper.includes('CUARTOS')) {
        phaseId = 'quarters';
      } else if (phaseUpper.includes('SEMIFINAL')) {
        phaseId = 'semi';
      } else if (phaseUpper.includes('FINAL')) {
        phaseId = 'final';
      }

      if (!phaseId) {
        console.warn(`  ⚠️ Fase desconocida para: ${prediction.phase}`);
        continue;
      }

      const usesBonusRules = !!PHASES[phaseId]?.bonusRules;
      const bonusData = usesBonusRules
        ? getKnockoutBonusData(prediction.teamLocal, prediction.teamVisitor)
        : null;

      let finalResult;
      if (usesBonusRules) {
        // Cuartos+: a true manual override wins, then the 90'-only score from the
        // knockout summary fetch (the reglamento scores regulation time, not the
        // full-time score ESPN's plain scoreboard would give us), then the usual
        // fallbacks if the summary fetch hasn't resolved yet.
        finalResult = getManualResultOnly(prediction.teamLocal, prediction.teamVisitor)
          || (bonusData ? { goalsTeamA: bonusData.goalsTeamA, goalsTeamB: bonusData.goalsTeamB } : null)
          || getMatchResult(prediction.teamLocal, prediction.teamVisitor, '')
          || findMatchResultByTeams(results, prediction.teamLocal, prediction.teamVisitor);
      } else {
        // Manual results take priority over the feed
        const manualResult = getMatchResult(prediction.teamLocal, prediction.teamVisitor, '');
        finalResult = manualResult || findMatchResultByTeams(results, prediction.teamLocal, prediction.teamVisitor);
      }

      // For in-progress matches, use the live score as a provisional result
      const liveResult = !finalResult ? getLiveScore(prediction.teamLocal, prediction.teamVisitor) : null;
      const effectiveResult = finalResult || liveResult;
      const isLive = !finalResult && !!liveResult;

      if (effectiveResult) {
        const scoreData = calculateScore(prediction, effectiveResult, phaseId, bonusData);
        scoreByPhase[phaseId] += scoreData.points;
        scoreByPhase.total += scoreData.points;
        totalPoints += scoreData.points;

        scoreByPhase.matches[matchKey] = {
          ...prediction,
          ...scoreData,
          result: finalResult,
          liveResult,
          isLive
        };
      } else {
        // Pending match — include it so it shows in the table
        scoreByPhase.matches[matchKey] = {
          ...prediction,
          points: 0,
          type: 'no-match',
          prediction: `${prediction.goalsLocal}-${prediction.goalsVisitor}`,
          result: null,
          isLive: false
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
