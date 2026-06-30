/* ============================================
   STATS.JS — 20 Estadísticas Avanzadas
   ============================================ */

let statsCharts = {};
let _dailySnapshots = null;

function destroyStatsCharts() {
  Object.values(statsCharts).forEach(c => { try { c.destroy(); } catch(e) {} });
  statsCharts = {};
}

// ==================== SHARED HELPERS ====================

function getPlayedMatches(scoreData) {
  return Object.values(scoreData.matches || {}).filter(m => m.result && m.result.goalsTeamA != null);
}

function getPendingMatches(scoreData) {
  return Object.values(scoreData.matches || {}).filter(m => !m.result || m.result.goalsTeamA == null);
}

function isDarkMode() {
  return document.body.classList.contains('dark-mode');
}

function chartColors() {
  const dark = isDarkMode();
  return {
    text: dark ? '#c9d1d9' : '#041561',
    grid: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  };
}

// ==================== TIMELINE BACKBONE (Stats 1, 15, 16) ====================

function buildDailyRankSnapshots() {
  if (_dailySnapshots) return _dailySnapshots;

  const participants = Object.keys(appState.scores);
  if (!participants.length) { _dailySnapshots = []; return []; }

  // Build match lookup: matchKey -> { matchMeta, pts: { pName: points } }
  const matchLookup = {};
  for (const [pName, sd] of Object.entries(appState.scores)) {
    for (const m of Object.values(sd.matches || {})) {
      const key = `${m.id}|${m.phase}`;
      if (!matchLookup[key]) matchLookup[key] = { meta: m, pts: {} };
      matchLookup[key].pts[pName] = m.points || 0;
    }
  }

  // Filter to only played matches and resolve dates
  const played = [];
  for (const [key, data] of Object.entries(matchLookup)) {
    const m = data.meta;
    if (!m.result || m.result.goalsTeamA == null) continue;
    const dt = findMatchDateTime(m.teamLocal, m.teamVisitor);
    played.push({ key, date: dt?.date || '9999-01-01', id: m.id, pts: data.pts });
  }

  if (!played.length) { _dailySnapshots = []; return []; }

  // Group by date
  const byDate = {};
  for (const item of played) {
    (byDate[item.date] = byDate[item.date] || []).push(item);
  }

  const dates = Object.keys(byDate).sort();
  const running = Object.fromEntries(participants.map(p => [p, 0]));
  const snapshots = [];

  for (const date of dates) {
    for (const item of byDate[date]) {
      for (const [pName, pts] of Object.entries(item.pts)) {
        running[pName] = (running[pName] || 0) + pts;
      }
    }
    const ranked = [...participants].sort((a, b) => running[b] - running[a]);
    const positions = {};
    ranked.forEach((p, i) => { positions[p] = i + 1; });
    snapshots.push({ date, positions, totals: { ...running } });
  }

  _dailySnapshots = snapshots;
  return snapshots;
}

function fmtSnapshotDate(d) {
  const [, mm, dd] = d.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(dd)} ${months[parseInt(mm) - 1]}`;
}

// ==================== COMPUTATIONS ====================

// Stat 1: Ranking Timeline
function computeRankingTimeline() {
  const snapshots = buildDailyRankSnapshots();
  if (!snapshots.length) return null;
  const participants = Object.keys(appState.scores);
  return {
    dates: snapshots.map(s => fmtSnapshotDate(s.date)),
    series: participants.map(p => ({ participant: p, positions: snapshots.map(s => s.positions[p] || participants.length) })),
    snapshots, participants
  };
}

// Stat 3: Points Gap to 1st
function computePointsGap() {
  if (!appState.participants.length) return [];
  const leader = appState.participants[0].total;
  return appState.participants.map(p => ({ participant: p.participant, team: p.team, total: p.total, gap: leader - p.total, position: p.position }));
}

// Stat 4: Max Possible Points
function computeMaxPossible() {
  const leader = appState.participants.length ? appState.participants[0].total : 0;
  return appState.participants.map(p => {
    const pending = getPendingMatches(appState.scores[p.participant] || { matches: {} });
    const maxAdd = pending.reduce((s, m) => {
      const pid = getPhaseIdFromStr(m.phase);
      return s + (SCORING_RULES.EXACT_MATCH * (PHASES[pid]?.multiplier || 1));
    }, 0);
    return { participant: p.participant, team: p.team, current: p.total, maxAdd, maxTotal: p.total + maxAdd, canWin: (p.total + maxAdd) >= leader, position: p.position };
  }).sort((a, b) => b.maxTotal - a.maxTotal);
}

// Stat 5: Hit Rate
function computeHitRate() {
  return appState.participants.map(p => {
    const played = getPlayedMatches(appState.scores[p.participant] || { matches: {} });
    const hits = played.filter(m => m.type === 'exact-match' || m.type === 'winner-match');
    return { participant: p.participant, team: p.team, played: played.length, hits: hits.length, hitRate: played.length ? hits.length / played.length : 0 };
  }).sort((a, b) => b.hitRate - a.hitRate);
}

// Stat 6: Sniper Rate
function computeSniperRate() {
  return appState.participants.map(p => {
    const played = getPlayedMatches(appState.scores[p.participant] || { matches: {} });
    const exact = played.filter(m => m.type === 'exact-match');
    return { participant: p.participant, team: p.team, played: played.length, exactHits: exact.length, sniperRate: played.length ? exact.length / played.length : 0 };
  }).sort((a, b) => b.sniperRate - a.sniperRate);
}

// Stats 7/8: Phase Accuracy
function computePhaseAccuracy() {
  const phaseList = ['groups','round16','round8','quarters','semi','final'];
  return appState.participants.map(p => {
    const allM = Object.values(appState.scores[p.participant]?.matches || {});
    const byPhase = {};
    for (const pid of phaseList) {
      const pm = allM.filter(m => getPhaseIdFromStr(m.phase) === pid && m.result?.goalsTeamA != null);
      const hits = pm.filter(m => m.type === 'exact-match' || m.type === 'winner-match');
      byPhase[pid] = { played: pm.length, hits: hits.length, hitRate: pm.length ? hits.length / pm.length : null };
    }
    let bestPhase = null, bestRate = -1;
    for (const [pid, d] of Object.entries(byPhase)) {
      if (d.played >= 2 && d.hitRate !== null && d.hitRate > bestRate) { bestRate = d.hitRate; bestPhase = pid; }
    }
    return { participant: p.participant, team: p.team, byPhase, bestPhase, bestRate };
  });
}

// Stats 9/10: Goal Personalities
function computeGoalPersonalities() {
  return appState.participants.map(p => {
    const allM = Object.values(appState.scores[p.participant]?.matches || {});
    const withPred = allM.filter(m => m.goalsLocal != null && !isNaN(Number(m.goalsLocal)));
    const totalGoals = withPred.reduce((s, m) => s + Number(m.goalsLocal) + Number(m.goalsVisitor), 0);
    const draws = withPred.filter(m => Number(m.goalsLocal) === Number(m.goalsVisitor)).length;
    return {
      participant: p.participant, team: p.team,
      avgGoals: withPred.length ? totalGoals / withPred.length : 0,
      matchCount: withPred.length,
      drawPct: withPred.length ? draws / withPred.length : 0
    };
  }).sort((a, b) => b.avgGoals - a.avgGoals);
}

// Stat 11: Contrarian Index
function computeContrarianIndex() {
  const matchPreds = {};
  for (const [pName, sd] of Object.entries(appState.scores)) {
    for (const m of Object.values(sd.matches || {})) {
      const key = `${m.id}|${m.phase}`;
      if (!matchPreds[key]) matchPreds[key] = {};
      if (m.prediction && m.prediction !== 'NaN-NaN') {
        matchPreds[key][m.prediction] = (matchPreds[key][m.prediction] || 0) + 1;
      }
    }
  }
  const majority = {};
  for (const [key, counts] of Object.entries(matchPreds)) {
    const max = Math.max(...Object.values(counts));
    majority[key] = Object.entries(counts).find(([, c]) => c === max)?.[0];
  }
  return appState.participants.map(p => {
    let contraryCount = 0, totalCount = 0;
    for (const m of Object.values(appState.scores[p.participant]?.matches || {})) {
      const key = `${m.id}|${m.phase}`;
      const pred = m.prediction;
      if (!pred || pred === 'NaN-NaN') continue;
      totalCount++;
      if (majority[key] && pred !== majority[key]) contraryCount++;
    }
    return { participant: p.participant, team: p.team, contraryCount, totalCount, contrarianRate: totalCount ? contraryCount / totalCount : 0 };
  }).sort((a, b) => b.contrarianRate - a.contrarianRate);
}

// Stats 13/14: Team Performance
function computeTeamPerformance() {
  return Object.entries(EQUIPOS).map(([team, members]) => {
    const scores = members.map(m => appState.scores[m]?.total || 0);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { team, members, scores, totalPoints: scores.reduce((a, b) => a + b, 0), avgPoints: avg };
  }).sort((a, b) => b.avgPoints - a.avgPoints);
}

// Stats 15/16: Biggest Jump / Drop
function computeJumpDrop() {
  const snapshots = buildDailyRankSnapshots();
  if (snapshots.length < 2) return { jumps: [], drops: [] };
  const participants = Object.keys(appState.scores);
  const jumps = [], drops = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1], curr = snapshots[i];
    for (const p of participants) {
      const prevPos = prev.positions[p] || participants.length;
      const currPos = curr.positions[p] || participants.length;
      const change = prevPos - currPos;
      const entry = { participant: p, date: fmtSnapshotDate(curr.date), from: prevPos, to: currPos };
      if (change >= 2) jumps.push({ ...entry, jump: change });
      if (change <= -2) drops.push({ ...entry, drop: -change });
    }
  }
  return { jumps: jumps.sort((a, b) => b.jump - a.jump), drops: drops.sort((a, b) => b.drop - a.drop) };
}

// Stat 17: Best Day (sum of all points earned in a single day)
function computeMostPointsOneMatch() {
  const bests = {};
  for (const [pName, sd] of Object.entries(appState.scores)) {
    const byDate = {};
    for (const m of getPlayedMatches(sd)) {
      const dt = findMatchDateTime(m.teamLocal, m.teamVisitor);
      const date = dt?.date || '9999-01-01';
      if (!byDate[date]) byDate[date] = 0;
      byDate[date] += m.points || 0;
    }
    for (const [date, total] of Object.entries(byDate)) {
      if (!bests[pName] || total > bests[pName].points) {
        bests[pName] = { participant: pName, points: total, date };
      }
    }
  }
  return Object.values(bests).sort((a, b) => b.points - a.points);
}

// Stat 18: Best pending prediction per participant, ranked by positions they'd jump in the table
function computeUnluckyPredictions() {
  const currentTotals = {};
  for (const p of appState.participants) currentTotals[p.participant] = p.total || 0;

  // Build lookup of all pending predictions per match to detect shared predictions
  const allPredsByMatch = {};
  const unlucky = [];
  for (const [pName, sd] of Object.entries(appState.scores)) {
    for (const m of getPendingMatches(sd)) {
      if (!m.prediction || m.prediction === 'NaN-NaN' || m.goalsLocal == null) continue;
      const pid = getPhaseIdFromStr(m.phase);
      const mult = PHASES[pid]?.multiplier || 1;
      const potentialPoints = SCORING_RULES.EXACT_MATCH * mult;
      if (!allPredsByMatch[m.id]) allPredsByMatch[m.id] = [];
      allPredsByMatch[m.id].push({ participant: pName, prediction: m.prediction, potentialPoints });
      unlucky.push({ participant: pName, matchId: m.id, teamLocal: m.teamLocal, teamVisitor: m.teamVisitor, phase: m.phase, phaseId: pid, multiplier: mult, prediction: m.prediction, potentialPoints });
    }
  }

  // Keep only the highest-value pending bet per participant
  unlucky.sort((a, b) => b.potentialPoints - a.potentialPoints);
  const seen = new Set();
  const best = unlucky.filter(u => { if (seen.has(u.participant)) return false; seen.add(u.participant); return true; });

  // Compute position jump accounting for others who share the same prediction on the same match
  for (const u of best) {
    const myTotal = currentTotals[u.participant] || 0;
    const myNewTotal = myTotal + u.potentialPoints;

    const simulatedTotals = { ...currentTotals };
    simulatedTotals[u.participant] = myNewTotal;
    for (const other of (allPredsByMatch[u.matchId] || [])) {
      if (other.participant !== u.participant && other.prediction === u.prediction) {
        simulatedTotals[other.participant] = (currentTotals[other.participant] || 0) + other.potentialPoints;
      }
    }

    u.currentPos = Object.values(currentTotals).filter(t => t > myTotal).length + 1;
    u.newPos = Object.values(simulatedTotals).filter(t => t >= myNewTotal).length + 1;
    u.positionsGained = Math.max(0, u.currentPos - u.newPos);
  }

  return best.sort((a, b) => b.positionsGained - a.positionsGained || b.potentialPoints - a.potentialPoints);
}

// Stats 12/19: Phase match grid (used in phase tabs)
function computePhaseMatchGrid(phaseId) {
  const participants = Object.keys(appState.scores).sort();
  const matchMap = {};
  for (const [pName, sd] of Object.entries(appState.scores)) {
    for (const m of Object.values(sd.matches || {})) {
      if (getPhaseIdFromStr(m.phase) !== phaseId) continue;
      if (!matchMap[m.id]) matchMap[m.id] = { id: m.id, teamLocal: m.teamLocal, teamVisitor: m.teamVisitor, result: m.result, predictions: {} };
      if (m.prediction && m.prediction !== 'NaN-NaN') {
        matchMap[m.id].predictions[pName] = { pred: m.prediction, type: m.type || 'no-match', points: m.points || 0 };
      }
    }
  }
  const matches = Object.values(matchMap).sort((a, b) => a.id - b.id);
  for (const match of matches) {
    const preds = Object.values(match.predictions).map(p => p.pred);
    const counts = {};
    preds.forEach(p => counts[p] = (counts[p] || 0) + 1);
    const maxCount = preds.length ? Math.max(...Object.values(counts)) : 0;
    match.topPred = maxCount ? Object.entries(counts).find(([, c]) => c === maxCount)?.[0] : null;
    match.topPredCount = maxCount;
    match.totalPreds = preds.length;
    match.agreementPct = preds.length ? Math.round(maxCount / preds.length * 100) : 0;
  }
  return { matches, participants };
}

// Stat 20: Avg points per day with at least one played match
function computeAvgPerMatch() {
  return appState.participants.map(p => {
    const played = getPlayedMatches(appState.scores[p.participant] || { matches: {} });
    const days = new Set(played.map(m => findMatchDateTime(m.teamLocal, m.teamVisitor)?.date || '9999-01-01'));
    const daysPlayed = days.size;
    return { participant: p.participant, team: p.team, played: daysPlayed, totalPoints: p.total, avgPts: daysPlayed ? p.total / daysPlayed : 0 };
  }).sort((a, b) => b.avgPts - a.avgPts);
}

// ==================== MAIN ENTRY POINTS ====================

function renderStats() {
  if (!appState.participants.length) return;
  _dailySnapshots = null;
  destroyStatsCharts();

  renderGeneralWidgets();

  const section = document.getElementById('stats');
  if (!section) return;

  section.innerHTML = `
    <h2 class="section-title">📈 Estadísticas</h2>
    <div class="stats-content">
      <div id="st-highlights"></div>
      <div id="st-timeline"></div>
      <div id="st-accuracy"></div>
      <div id="st-phase-acc"></div>
      <div id="st-personality"></div>
      <div id="st-contrarian"></div>
      <div id="st-team"></div>
      <div id="st-h2h"></div>
      <div id="st-extras"></div>
    </div>`;

  renderHighlights();
  renderTimelineChart();
  renderAccuracyCharts();
  renderPhaseAccuracyChart();
  renderPersonalitySection();
  renderContrarianChart();
  renderTeamSection();
  renderH2HSection();
  renderExtrasSection();
}

// Called after renderPhase() for each phase tab
function renderPhaseStats(phaseId) {
  const section = document.getElementById(phaseId);
  if (!section || !appState.participants.length) return;

  const old = section.querySelector('.phase-stats-block');
  if (old) old.remove();

  const { matches, participants } = computePhaseMatchGrid(phaseId);
  if (!matches.length) return;

  const block = document.createElement('div');
  block.className = 'phase-stats-block';
  section.appendChild(block);

  // Stat 12: Most Agreed Match
  const withPreds = matches.filter(m => m.totalPreds > 0);
  if (withPreds.length) {
    const top = withPreds.reduce((best, m) => m.agreementPct > best.agreementPct ? m : best);
    const hasResult = top.result?.goalsTeamA != null;
    block.innerHTML += `
      <div class="ps-row">
        <h4 class="ps-title">Mayor Consenso en esta Fase</h4>
        <div class="mac-card">
          <div class="mac-match">${getFlag(top.teamLocal)}${esc(top.teamLocal)} vs ${esc(top.teamVisitor)}${getFlag(top.teamVisitor)}</div>
          <div class="mac-data">
            <span class="mac-pred">Pronóstico más popular: <strong>${esc(top.topPred || '–')}</strong></span>
            <span class="mac-pct">${top.topPredCount} de ${top.totalPreds} participantes eligieron ese marcador (${top.agreementPct}%)</span>
            ${hasResult
              ? `<span class="mac-result">Resultado real: <strong>${top.result.goalsTeamA}–${top.result.goalsTeamB}</strong></span>`
              : '<span class="mac-pending">Partido aún pendiente</span>'}
          </div>
        </div>
      </div>`;
  }

  // Stat 19: Prediction Heatmap
  block.innerHTML += `
    <div class="ps-row">
      <div class="ps-title-bar">
        <h4 class="ps-title">Mapa de Predicciones</h4>
        <a href="https://futbol-libres.su/" target="_blank" class="watch-link ps-watch-link">📺 Ver partidos en vivo</a>
      </div>
      <div class="heatmap-scroll"><div class="heatmap-grid" id="hm-${phaseId}"></div></div>
    </div>`;

  const hmEl = document.getElementById(`hm-${phaseId}`);
  if (!hmEl) return;

  const hmMonthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  hmEl.innerHTML = matches.map(match => {
    const hasResult = match.result?.goalsTeamA != null;
    const matchDT = findMatchDateTime(match.teamLocal, match.teamVisitor);

    // Date/time line
    let hmDateHtml = '';
    if (matchDT?.date) {
      const [, mm, dd] = matchDT.date.split('-');
      const mName = hmMonthNames[parseInt(mm, 10) - 1] || mm;
      hmDateHtml = `<div class="hm-date">${dd} ${mName}${matchDT.time ? ` ${matchDT.time}` : ''}</div>`;
    }

    // Live detection
    let isLive = false;
    if (!hasResult && matchDT?.date && matchDT?.time) {
      const kickoff = matchDT.utcStr ? new Date(matchDT.utcStr) : new Date(`${matchDT.date}T${matchDT.time}:00`);
      const mins = (Date.now() - kickoff.getTime()) / 60000;
      isLive = mins >= 0 && mins <= 135;
    }
    const liveScore = isLive ? getLiveScore(match.teamLocal, match.teamVisitor) : null;

    // Score row: Flag TeamA [score] – [score] Flag TeamB
    let scoreHtml;
    if (hasResult) {
      scoreHtml = `
        <div class="hm-score-row">
          <span class="hm-sb-team">${getFlag(match.teamLocal)} ${esc(match.teamLocal)}</span>
          <span class="hm-sb-score">${match.result.goalsTeamA} <span class="hm-sb-sep">–</span> ${match.result.goalsTeamB}</span>
          <span class="hm-sb-team">${getFlag(match.teamVisitor)} ${esc(match.teamVisitor)}</span>
        </div>
        <div class="hm-status-row"><span class="status-badge finished">Finalizado</span></div>`;
    } else if (liveScore) {
      scoreHtml = `
        <div class="hm-score-row">
          <span class="hm-sb-team">${getFlag(match.teamLocal)} ${esc(match.teamLocal)}</span>
          <span class="hm-sb-score hm-sb-live">🔴 ${liveScore.goalsTeamA} <span class="hm-sb-sep">–</span> ${liveScore.goalsTeamB}${liveScore.clock ? `<span class="live-clock">${liveScore.clock}</span>` : ''}</span>
          <span class="hm-sb-team">${getFlag(match.teamVisitor)} ${esc(match.teamVisitor)}</span>
        </div>
        <div class="hm-status-row"><span class="status-badge live">🔴 En Curso</span></div>`;
    } else {
      scoreHtml = `
        <div class="hm-score-row">
          <span class="hm-sb-team">${getFlag(match.teamLocal)} ${esc(match.teamLocal)}</span>
          <span class="hm-sb-score hm-sb-pending">– – –</span>
          <span class="hm-sb-team">${getFlag(match.teamVisitor)} ${esc(match.teamVisitor)}</span>
        </div>
        <div class="hm-status-row"><span class="status-badge pending">Pendiente</span></div>`;
    }

    const groupBadge = (phaseId === 'groups' && match.group)
      ? `<div class="hm-group-badge">Grupo ${esc(match.group)}</div>`
      : '';

    return `
      <div class="hm-match">
        <div class="hm-header">
          ${groupBadge}
          ${hmDateHtml}
          ${scoreHtml}
        </div>
        <div class="hm-cells">
          ${participants.map(p => {
            const pred = match.predictions[p];
            const cls = pred ? `hm-${pred.type}` : 'hm-no-pred';
            const nameParts = p.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');
            return `<div class="hm-cell ${cls}" title="${esc(p)}: ${pred?.pred || '–'}${pred?.points ? ` · ${pred.points}pts` : ''}">
              <span class="hm-p">${esc(firstName)}</span>
              ${lastName ? `<span class="hm-ln">${esc(lastName)}</span>` : ''}
              <span class="hm-s">${pred?.pred || '–'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

// ==================== RENDERING FUNCTIONS ====================

// General Tab: Stats 3 & 4 as charts
function renderGeneralWidgets() {
  const container = document.getElementById('charts-container');
  if (!container || !appState.participants.length) return;
  container.innerHTML = '';

  const gap = computePointsGap();
  const maxPoss = computeMaxPossible();

  const gapWrapper = document.createElement('div');
  gapWrapper.className = 'chart-wrapper';
  gapWrapper.innerHTML = `<h3>Distancia al Líder (puntos)</h3><canvas id="chart-gap"></canvas>`;
  container.appendChild(gapWrapper);

  const maxWrapper = document.createElement('div');
  maxWrapper.className = 'chart-wrapper';
  maxWrapper.innerHTML = `<h3>Actuales vs Máximo Posible</h3><canvas id="chart-maxpossible"></canvas>`;
  container.appendChild(maxWrapper);

  requestAnimationFrame(() => {
    const { text, grid } = chartColors();
    const isMobile = window.innerWidth <= 768;
    const barHeight = isMobile ? 40 : 32;
    const labelFont = isMobile ? 13 : 12;
    const chartH = Math.max(isMobile ? 400 : 280, gap.length * barHeight);

    const gapCanvas = document.getElementById('chart-gap');
    if (gapCanvas) {
      gapCanvas.style.height = chartH + 'px';
      const gapCtx = gapCanvas.getContext('2d');
      if (statsCharts['gap']) statsCharts['gap'].destroy();
      statsCharts['gap'] = new Chart(gapCtx, {
        type: 'bar',
        data: {
          labels: gap.map(p => p.participant.split(' ')[0]),
          datasets: [{ data: gap.map(p => p.gap), backgroundColor: gap.map(p => p.gap === 0 ? 'rgba(40,167,69,0.75)' : 'rgba(6,45,161,0.55)'), borderRadius: 4 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${gap[c.dataIndex]?.participant}: ${c.raw} pts detrás (${gap[c.dataIndex]?.total} pts totales)` } } },
          scales: { x: { grid: { color: grid }, ticks: { color: text } }, y: { grid: { display: false }, ticks: { color: text, font: { size: labelFont } } } }
        }
      });
    }

    const maxChartH = Math.max(isMobile ? 400 : 280, maxPoss.length * barHeight);
    const maxCanvas = document.getElementById('chart-maxpossible');
    if (maxCanvas) {
      maxCanvas.style.height = maxChartH + 'px';
      const maxCtx = maxCanvas.getContext('2d');
      if (statsCharts['maxpossible']) statsCharts['maxpossible'].destroy();
      statsCharts['maxpossible'] = new Chart(maxCtx, {
        type: 'bar',
        data: {
          labels: maxPoss.map(p => p.participant.split(' ')[0]),
          datasets: [
            { label: 'Actuales', data: maxPoss.map(p => p.current), backgroundColor: 'rgba(6,45,161,0.65)', borderRadius: 4 },
            { label: 'Potencial', data: maxPoss.map(p => p.maxAdd), backgroundColor: 'rgba(255,193,7,0.55)', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { position: 'bottom', labels: { color: text, font: { size: 11 }, boxWidth: 10 } },
            tooltip: { callbacks: { label: c => c.datasetIndex === 0 ? `Actuales: ${c.raw}` : `Potencial: +${c.raw} → Máx ${maxPoss[c.dataIndex]?.maxTotal}` } }
          },
          scales: { x: { stacked: true, grid: { color: grid }, ticks: { color: text } }, y: { stacked: true, grid: { display: false }, ticks: { color: text, font: { size: labelFont } } } }
        }
      });
    }
  });
}

// Stat: Hot & Cold Streaks
function computeStreaks() {
  const result = [];
  for (const [pName, sd] of Object.entries(appState.scores)) {
    const played = getPlayedMatches(sd);
    if (!played.length) { result.push({ participant: pName, hotStreak: 0, coldStreak: 0 }); continue; }
    const sorted = [...played].sort((a, b) => {
      const da = findMatchDateTime(a.teamLocal, a.teamVisitor)?.date || '9999-01-01';
      const db = findMatchDateTime(b.teamLocal, b.teamVisitor)?.date || '9999-01-01';
      return da !== db ? da.localeCompare(db) : (a.id || 0) - (b.id || 0);
    });
    let hotStreak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].type !== 'no-match') hotStreak++;
      else break;
    }
    let coldStreak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].type === 'no-match') coldStreak++;
      else break;
    }
    result.push({ participant: pName, hotStreak, coldStreak });
  }
  return result;
}

// Stat: Next Match Favorite
function computeNextMatchFavorite() {
  const pendingById = new Map();
  for (const [, sd] of Object.entries(appState.scores)) {
    for (const m of getPendingMatches(sd)) {
      if (!pendingById.has(m.id)) pendingById.set(m.id, m);
    }
  }
  let nextMatch = null, nextDT = null, earliestStr = null;
  for (const [, m] of pendingById) {
    const dt = findMatchDateTime(m.teamLocal, m.teamVisitor);
    if (!dt?.date) continue;
    const dtStr = `${dt.date} ${dt.time || '00:00'}`;
    if (!earliestStr || dtStr < earliestStr) { earliestStr = dtStr; nextMatch = m; nextDT = dt; }
  }
  if (!nextMatch) return null;
  const winnerCounts = {};
  let totalPreds = 0;
  for (const [, sd] of Object.entries(appState.scores)) {
    const m = Object.values(sd.matches || {}).find(x => x.id === nextMatch.id);
    if (!m || m.goalsLocal == null || m.goalsVisitor == null) continue;
    const gl = Number(m.goalsLocal), gv = Number(m.goalsVisitor);
    if (isNaN(gl) || isNaN(gv)) continue;
    const winner = gl > gv ? m.teamLocal : gv > gl ? m.teamVisitor : 'Empate';
    winnerCounts[winner] = (winnerCounts[winner] || 0) + 1;
    totalPreds++;
  }
  if (!totalPreds) return null;
  const maxCount = Math.max(...Object.values(winnerCounts));
  const favorites = Object.entries(winnerCounts).filter(([, c]) => c === maxCount).map(([n]) => n);
  return { teamLocal: nextMatch.teamLocal, teamVisitor: nextMatch.teamVisitor, dt: nextDT, favorites, favoriteCount: maxCount, totalPreds };
}

// Stat: Exact Hits Leader
function computeExactHitsLeader() {
  const counts = Object.keys(appState.scores).map(pName => ({
    participant: pName,
    exactHits: getPlayedMatches(appState.scores[pName]).filter(m => m.type === 'exact-match').length
  })).sort((a, b) => b.exactHits - a.exactHits);
  if (!counts.length || counts[0].exactHits === 0) return null;
  const maxHits = counts[0].exactHits;
  const leaders = counts.filter(x => x.exactHits === maxHits);
  const next = counts.find(x => x.exactHits < maxHits) || null;
  return { leaders, maxHits, next };
}

// Stats 15, 16, 17, 18 — Highlights row
function renderHighlights() {
  const el = document.getElementById('st-highlights');
  if (!el) return;

  const { jumps, drops } = computeJumpDrop();
  const mostPts = computeMostPointsOneMatch();
  const unlucky = computeUnluckyPredictions();

  const jump = jumps[0], drop = drops[0], luck = unlucky[0];

  // All participants tied at the top points, prefer the most recent date among ties
  const bestPts = mostPts[0]?.points;
  const tiedForBest = mostPts.filter(x => x.points === bestPts);
  const bestDate = tiedForBest.reduce((latest, x) => x.date > latest ? x.date : latest, '');
  const bestGroup = tiedForBest.filter(x => x.date === bestDate);
  const bestNames = bestGroup.map(x => esc(x.participant.split(' ')[0])).join(', ');

  // New stat cards
  const streaks = computeStreaks();
  const hotVal = Math.max(...streaks.map(s => s.hotStreak), 0);
  const coldVal = Math.max(...streaks.map(s => s.coldStreak), 0);
  const hotLeaders = streaks.filter(s => s.hotStreak === hotVal && hotVal >= 1);
  const coldLeaders = streaks.filter(s => s.coldStreak === coldVal && coldVal >= 1);
  const hotNames = hotLeaders.map(s => esc(s.participant.split(' ')[0])).join(', ');
  const coldNames = coldLeaders.map(s => esc(s.participant.split(' ')[0])).join(', ');

  const nextFav = computeNextMatchFavorite();
  const exactLeader = computeExactHitsLeader();

  const cards = [
    jump ? `<div class="shc shc-green"><div class="shc-icon">📈</div><div class="shc-label">Mayor Subida</div><div class="shc-name">${esc(jump.participant.split(' ')[0])}</div><div class="shc-val">+${jump.jump} puestos</div><div class="shc-sub">#${jump.from} → #${jump.to} · ${jump.date}</div></div>` : '',
    drop ? `<div class="shc shc-red"><div class="shc-icon">📉</div><div class="shc-label">Mayor Caída</div><div class="shc-name">${esc(drop.participant.split(' ')[0])}</div><div class="shc-val">-${drop.drop} puestos</div><div class="shc-sub">#${drop.from} → #${drop.to} · ${drop.date}</div></div>` : '',
    bestGroup.length ? `<div class="shc shc-gold"><div class="shc-icon">⚡</div><div class="shc-label">Mejor Día</div><div class="shc-name">${bestNames}</div><div class="shc-val">${bestPts} pts en 1 día</div><div class="shc-sub">${bestDate !== '9999-01-01' ? fmtSnapshotDate(bestDate) : ''}</div></div>` : '',
    luck ? `<div class="shc shc-blue"><div class="shc-icon">🔮</div><div class="shc-label">Mayor Subida Potencial</div><div class="shc-name">${esc(luck.participant.split(' ')[0])}</div><div class="shc-val">+${luck.positionsGained} puestos posibles</div><div class="shc-sub">#${luck.currentPos} → #${luck.newPos} · ${esc(luck.teamLocal)} vs ${esc(luck.teamVisitor)}</div><div class="shc-sub">Necesita: <strong>${esc(luck.prediction)}</strong></div></div>` : '',
    hotVal >= 1 ? `<div class="shc shc-orange"><div class="shc-icon">🔥</div><div class="shc-label">Racha Caliente</div><div class="shc-name">${hotNames}</div><div class="shc-val">${hotVal} seguidos</div><div class="shc-sub">${hotVal} juego${hotVal !== 1 ? 's' : ''} consecutivo${hotVal !== 1 ? 's' : ''} con puntos</div></div>` : '',
    coldVal >= 1
      ? `<div class="shc shc-gray"><div class="shc-icon">🧊</div><div class="shc-label">Racha Fría</div><div class="shc-name">${coldNames}</div><div class="shc-val">${coldVal} sin puntuar</div><div class="shc-sub">${coldVal} juego${coldVal !== 1 ? 's' : ''} consecutivo${coldVal !== 1 ? 's' : ''} sin puntos</div></div>`
      : streaks.some(s => s.hotStreak > 0) ? `<div class="shc shc-gray"><div class="shc-icon">🧊</div><div class="shc-label">Racha Fría</div><div class="shc-name">¡Nadie en racha fría!</div><div class="shc-val">Todos puntuaron</div><div class="shc-sub">¡Todos puntuaron en el último juego, qué suerte!</div></div>` : '',
    nextFav ? `<div class="shc shc-purple"><div class="shc-icon">🏆</div><div class="shc-label">Favorito · Próximo Partido</div><div class="shc-name">${nextFav.favorites.map(f => esc(f)).join(', ')}</div><div class="shc-val">${nextFav.favoriteCount} de ${nextFav.totalPreds} lo eligen</div><div class="shc-sub">${esc(nextFav.teamLocal)} vs ${esc(nextFav.teamVisitor)}</div></div>` : '',
    exactLeader ? `<div class="shc shc-teal"><div class="shc-icon">🎯</div><div class="shc-label">Rey del Marcador Exacto</div><div class="shc-name">${exactLeader.leaders.map(l => esc(l.participant.split(' ')[0])).join(', ')}</div><div class="shc-val">${exactLeader.maxHits} exacto${exactLeader.maxHits !== 1 ? 's' : ''}</div>${exactLeader.next ? `<div class="shc-sub">Siguiente: ${esc(exactLeader.next.participant.split(' ')[0])} con ${exactLeader.next.exactHits}</div>` : ''}</div>` : ''
  ].filter(Boolean);

  if (!cards.length) return;
  el.innerHTML = `<h3 class="st-title">Destacados de la Quiniela del Mundial 2026</h3><div class="shc-grid">${cards.join('')}</div>`;
}

// Stat 1 — Ranking Timeline chart
function renderTimelineChart() {
  const el = document.getElementById('st-timeline');
  if (!el) return;

  const data = computeRankingTimeline();
  el.innerHTML = `<h3 class="st-title">Evolución del Ranking</h3>
    <p class="st-sub">Posición de cada participante después de cada jornada de partidos (1 = líder)</p>
    ${data ? `<div class="chart-wrapper"><canvas id="chart-timeline"></canvas></div>` : `<div class="st-empty">Aún no hay partidos jugados para mostrar la evolución.</div>`}`;

  if (!data) return;

  requestAnimationFrame(() => {
    const ctx = document.getElementById('chart-timeline')?.getContext('2d');
    if (!ctx) return;
    const { text, grid } = chartColors();

    const palette = ['#e6194b','#3cb44b','#4363d8','#f58231','#911eb4','#42d4f4','#f032e6','#a9a9a9','#9A6324','#469990','#800000','#ffe119','#dcbeff','#aaffc3','#fabed4','#808000','#ffd8b1','#000075','#bfef45','#e6beff'];

    if (statsCharts['timeline']) statsCharts['timeline'].destroy();
    statsCharts['timeline'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.dates,
        datasets: data.series.map((s, i) => ({
          label: s.participant.split(' ')[0],
          data: s.positions,
          borderColor: palette[i % palette.length],
          backgroundColor: palette[i % palette.length] + '18',
          tension: 0.35, pointRadius: 3, borderWidth: 2, fill: false
        }))
      },
      options: {
        responsive: true,
        scales: {
          y: { reverse: true, min: 1, max: data.participants.length, ticks: { stepSize: 1, color: text }, grid: { color: grid }, title: { display: true, text: 'Posición', color: text } },
          x: { ticks: { color: text, font: { size: 9 } }, grid: { color: grid } }
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: text, font: { size: 9 }, boxWidth: 10, padding: 5 } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: #${c.raw}` } }
        }
      }
    });
  });
}

// Stats 5 & 6 — Hit Rate + Sniper Rate
function renderAccuracyCharts() {
  const el = document.getElementById('st-accuracy');
  if (!el) return;

  const hitRates = computeHitRate();
  const sniperRates = computeSniperRate();
  const hasData = hitRates.some(p => p.played > 0);

  el.innerHTML = `<h3 class="st-title">Precisión de Predicciones</h3>
    ${!hasData ? `<div class="st-empty">Sin partidos jugados aún.</div>` : `
    <div class="st-grid-2">
      <div class="chart-wrapper"><h3>Tasa de Acierto (ganador o exacto)</h3><canvas id="chart-hitrate"></canvas></div>
      <div class="chart-wrapper"><h3>Francotirador (marcador exacto)</h3><canvas id="chart-sniper"></canvas></div>
    </div>`}`;

  if (!hasData) return;

  requestAnimationFrame(() => {
    const { text, grid } = chartColors();
    const barHeight = 32;
    const chartH = Math.max(280, hitRates.length * barHeight);
    const baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { max: 100, grid: { color: grid }, ticks: { color: text, callback: v => v + '%' } }, y: { grid: { display: false }, ticks: { color: text, font: { size: 12 } } } }
    };

    const hCanvas = document.getElementById('chart-hitrate');
    if (hCanvas) {
      hCanvas.style.height = chartH + 'px';
      const hCtx = hCanvas.getContext('2d');
      if (statsCharts['hitrate']) statsCharts['hitrate'].destroy();
      statsCharts['hitrate'] = new Chart(hCtx, {
        type: 'bar',
        data: {
          labels: hitRates.map(p => p.participant.split(' ')[0]),
          datasets: [{ data: hitRates.map(p => Math.round(p.hitRate * 100)), backgroundColor: hitRates.map(p => p.hitRate >= 0.6 ? 'rgba(40,167,69,0.7)' : p.hitRate >= 0.4 ? 'rgba(255,193,7,0.7)' : 'rgba(220,53,69,0.6)'), borderRadius: 4 }]
        },
        options: { ...baseOpts, plugins: { ...baseOpts.plugins, tooltip: { callbacks: { label: c => `${c.raw}% · ${hitRates[c.dataIndex]?.hits}/${hitRates[c.dataIndex]?.played} correctos` } } } }
      });
    }

    const sCanvas = document.getElementById('chart-sniper');
    if (sCanvas) {
      sCanvas.style.height = chartH + 'px';
      const sCtx = sCanvas.getContext('2d');
      if (statsCharts['sniper']) statsCharts['sniper'].destroy();
      statsCharts['sniper'] = new Chart(sCtx, {
        type: 'bar',
        data: {
          labels: sniperRates.map(p => p.participant.split(' ')[0]),
          datasets: [{ data: sniperRates.map(p => Math.round(p.sniperRate * 100)), backgroundColor: 'rgba(6,45,161,0.6)', borderRadius: 4 }]
        },
        options: { ...baseOpts, plugins: { ...baseOpts.plugins, tooltip: { callbacks: { label: c => `${c.raw}% · ${sniperRates[c.dataIndex]?.exactHits}/${sniperRates[c.dataIndex]?.played} exactos` } } } }
      });
    }
  });
}

// Stats 7 & 8 — Phase Accuracy chart + best phase badges
function renderPhaseAccuracyChart() {
  const el = document.getElementById('st-phase-acc');
  if (!el) return;

  const accuracy = computePhaseAccuracy();
  const phaseList = ['groups','round16','round8','quarters','semi','final'];
  const phaseLabels = { groups:'Grupos', round16:'16vos', round8:'8vos', quarters:'Cuartos', semi:'Semi', final:'Final' };
  const hasData = accuracy.some(p => Object.values(p.byPhase).some(d => d.played > 0));

  el.innerHTML = `<h3 class="st-title">Precisión por Fase</h3>
    <p class="st-sub">% de predicciones correctas en cada fase (mínimo 2 partidos jugados)</p>
    ${!hasData ? `<div class="st-empty">Sin partidos jugados aún.</div>` : `
    <div class="chart-wrapper"><canvas id="chart-phaseacc"></canvas></div>
    <div class="best-phase-row">
      ${accuracy.filter(p => p.bestPhase).map(p => `
        <div class="bpr-card">
          <span class="bpr-name">${esc(p.participant.split(' ')[0])}</span>
          <span class="bpr-phase">↑ ${phaseLabels[p.bestPhase]}</span>
          <span class="bpr-pct">${Math.round(p.bestRate * 100)}%</span>
        </div>`).join('')}
    </div>`}`;

  if (!hasData) return;

  requestAnimationFrame(() => {
    const ctx = document.getElementById('chart-phaseacc')?.getContext('2d');
    if (!ctx) return;
    const { text, grid } = chartColors();
    const phaseColors = { groups:'rgba(6,45,161,0.6)', round16:'rgba(40,167,69,0.6)', round8:'rgba(255,193,7,0.7)', quarters:'rgba(220,53,69,0.6)', semi:'rgba(153,50,204,0.65)', final:'rgba(255,140,0,0.7)' };

    if (statsCharts['phaseacc']) statsCharts['phaseacc'].destroy();
    statsCharts['phaseacc'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: accuracy.map(p => p.participant.split(' ')[0]),
        datasets: phaseList.map(pid => ({
          label: phaseLabels[pid],
          data: accuracy.map(p => p.byPhase[pid]?.played >= 2 ? Math.round((p.byPhase[pid].hitRate || 0) * 100) : null),
          backgroundColor: phaseColors[pid],
          borderRadius: 3,
          skipNull: true
        }))
      },
      options: {
        plugins: {
          legend: { position: 'bottom', labels: { color: text, font: { size: 10 }, boxWidth: 10 } },
          tooltip: { callbacks: { label: c => { const p = accuracy[c.dataIndex]?.byPhase[phaseList[c.datasetIndex]]; return p?.played ? `${c.dataset.label}: ${c.raw}% (${p.hits}/${p.played})` : ''; } } }
        },
        scales: { y: { max: 100, grid: { color: grid }, ticks: { color: text, callback: v => v + '%' } }, x: { grid: { display: false }, ticks: { color: text, font: { size: 9 } } } }
      }
    });
  });
}

// Stats 9 & 10 — Personality cards
function renderPersonalitySection() {
  const el = document.getElementById('st-personality');
  if (!el) return;

  const preds = computeGoalPersonalities();
  if (!preds.length || preds.every(p => p.matchCount === 0)) return;

  const offensive = preds[0];
  const defensive = preds[preds.length - 1];
  const drawy = [...preds].sort((a, b) => b.drawPct - a.drawPct)[0];
  const maxAvg = preds[0]?.avgGoals || 1;

  el.innerHTML = `<h3 class="st-title">Perfil de Predicciones</h3>
    <div class="personality-grid">
      <div class="pc-card pc-card-off"><div class="pc-icon">⚽⚽</div><div class="pc-label">Más Goleador</div><div class="pc-name">${esc(offensive.participant)}</div><div class="pc-stat">${offensive.avgGoals.toFixed(1)} goles/partido en promedio</div></div>
      <div class="pc-card pc-card-def"><div class="pc-icon">🛡️</div><div class="pc-label">Más Defensivo</div><div class="pc-name">${esc(defensive.participant)}</div><div class="pc-stat">${defensive.avgGoals.toFixed(1)} goles/partido en promedio</div></div>
      <div class="pc-card pc-card-draw"><div class="pc-icon">🤝</div><div class="pc-label">Rey del Empate</div><div class="pc-name">${esc(drawy.participant)}</div><div class="pc-stat">${Math.round(drawy.drawPct * 100)}% de sus pronósticos son empates</div></div>
    </div>
    <div class="smt-wrapper">
      <h4 class="st-sub-title">Promedio de goles predichos por partido</h4>
      <div class="smt">
        ${preds.map((p, i) => `
          <div class="smt-row">
            <span class="smt-rank">#${i+1}</span>
            <span class="smt-name">${esc(p.participant)}</span>
            <span class="smt-bar-wrap"><span class="smt-bar" style="width:${Math.round(p.avgGoals / maxAvg * 100)}%"></span></span>
            <span class="smt-val">${p.avgGoals.toFixed(1)}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// Stat 11 — Contrarian Index chart
function renderContrarianChart() {
  const el = document.getElementById('st-contrarian');
  if (!el) return;

  const data = computeContrarianIndex();

  el.innerHTML = `<h3 class="st-title">Índice de Originalidad</h3>
    <p class="st-sub">% de predicciones que difieren de la opción más popular del grupo en cada partido</p>
    <div class="chart-wrapper"><canvas id="chart-contrarian"></canvas></div>`;

  requestAnimationFrame(() => {
    const canvas = document.getElementById('chart-contrarian');
    if (!canvas) return;
    const { text, grid } = chartColors();
    canvas.style.height = Math.max(280, data.length * 32) + 'px';
    const ctx = canvas.getContext('2d');
    if (statsCharts['contrarian']) statsCharts['contrarian'].destroy();
    statsCharts['contrarian'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(p => p.participant.split(' ')[0]),
        datasets: [{ data: data.map(p => Math.round(p.contrarianRate * 100)), backgroundColor: data.map(p => p.contrarianRate >= 0.65 ? 'rgba(153,50,204,0.7)' : p.contrarianRate >= 0.5 ? 'rgba(6,45,161,0.55)' : 'rgba(100,100,100,0.4)'), borderRadius: 4 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw}% original · ${data[c.dataIndex]?.contraryCount}/${data[c.dataIndex]?.totalCount} distintas` } } },
        scales: { x: { max: 100, grid: { color: grid }, ticks: { color: text, callback: v => v + '%' } }, y: { grid: { display: false }, ticks: { color: text, font: { size: 12 } } } }
      }
    });
  });
}

// Stats 13 & 14 — Team Performance
function renderTeamSection() {
  const el = document.getElementById('st-team');
  if (!el) return;

  const teams = computeTeamPerformance();

  el.innerHTML = `<h3 class="st-title">Rendimiento por Equipo</h3>
    <p class="st-sub">Puntos totales y promedio por equipo asignado a cada participante</p>
    <div class="team-perf-grid">
      ${teams.map((t, i) => `
        <div class="tpg-card ${i === 0 ? 'tpg-first' : i === 1 ? 'tpg-second' : i === 2 ? 'tpg-third' : ''}">
          <div class="tpg-header">
            <div class="tpg-title-row">
              <span class="tpg-pos">#${i+1}</span>
              <span class="tpg-flag">${getFlag(t.team)}</span>
              <span class="tpg-team">${esc(t.team)}</span>
            </div>
            <span class="tpg-avg">${t.avgPoints.toFixed(1)} pts avg</span>
          </div>
          <div class="tpg-members">
            ${t.members.map((m, j) => `<span class="tpg-member">${esc(m.split(' ')[0])}&nbsp;<strong>${t.scores[j]}</strong></span>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

// Stat 2 — Head to Head
function renderH2HSection() {
  const el = document.getElementById('st-h2h');
  if (!el) return;

  const participants = appState.participants.map(p => p.participant);

  el.innerHTML = `<h3 class="st-title">Comparador Cara a Cara</h3>
    <p class="st-sub">Compara las predicciones de dos participantes partido por partido</p>
    <div class="h2h-controls">
      <select id="h2h-p1" onchange="renderH2HTable()">
        ${participants.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
      </select>
      <div class="h2h-vs-badge">VS</div>
      <select id="h2h-p2" onchange="renderH2HTable()">
        ${participants.map((p, i) => `<option value="${esc(p)}" ${i === 1 ? 'selected' : ''}>${esc(p)}</option>`).join('')}
      </select>
    </div>
    <div id="h2h-content"></div>`;

  renderH2HTable();
}

function renderH2HTable() {
  const p1 = document.getElementById('h2h-p1')?.value;
  const p2 = document.getElementById('h2h-p2')?.value;
  const el = document.getElementById('h2h-content');
  if (!el) return;

  if (!p1 || !p2 || p1 === p2) {
    el.innerHTML = '<div class="st-empty">Selecciona dos participantes diferentes.</div>';
    return;
  }

  const sd1 = appState.scores[p1], sd2 = appState.scores[p2];
  if (!sd1 || !sd2) return;

  const phaseList = ['groups','round16','round8','quarters','semi','final'];
  let p1wins = 0, p2wins = 0, ties = 0;
  let tablesHtml = '';

  for (const phaseId of phaseList) {
    const filter = sd => Object.fromEntries(Object.entries(sd.matches || {}).filter(([, m]) => getPhaseIdFromStr(m.phase) === phaseId));
    const m1map = filter(sd1), m2map = filter(sd2);
    const allKeys = [...new Set([...Object.keys(m1map), ...Object.keys(m2map)])].sort();
    if (!allKeys.length) continue;

    tablesHtml += `<div class="h2h-phase-hdr">${PHASE_LABEL_MAP[phaseId]}</div>
    <div class="h2h-table-wrap"><table class="h2h-table"><thead><tr>
      <th class="h2h-name-col">${esc(p1.split(' ')[0])}</th>
      <th class="h2h-match-col">Partido</th>
      <th class="h2h-res-col">Real</th>
      <th class="h2h-name-col">${esc(p2.split(' ')[0])}</th>
    </tr></thead><tbody>`;

    for (const key of allKeys) {
      const m1 = m1map[key], m2 = m2map[key];
      const m = m1 || m2;
      const hasResult = m?.result?.goalsTeamA != null;
      const actual = hasResult ? `${m.result.goalsTeamA}–${m.result.goalsTeamB}` : '–';
      const pred1 = m1?.prediction || '–', pred2 = m2?.prediction || '–';
      const pts1 = m1?.points ?? 0, pts2 = m2?.points ?? 0;
      if (hasResult) { if (pts1 > pts2) p1wins++; else if (pts2 > pts1) p2wins++; else ties++; }
      const cls1 = m1?.type === 'exact-match' ? 'h2h-exact' : m1?.type === 'winner-match' ? 'h2h-winner' : '';
      const cls2 = m2?.type === 'exact-match' ? 'h2h-exact' : m2?.type === 'winner-match' ? 'h2h-winner' : '';
      tablesHtml += `<tr>
        <td class="${cls1}">${esc(pred1)}${hasResult ? `<small class="h2h-pts"> ${pts1}p</small>` : ''}</td>
        <td class="h2h-match-cell">${getFlag(m?.teamLocal)}${esc(m?.teamLocal || '')} vs ${esc(m?.teamVisitor || '')}${getFlag(m?.teamVisitor)}</td>
        <td class="h2h-res-cell">${actual}</td>
        <td class="${cls2}">${esc(pred2)}${hasResult ? `<small class="h2h-pts"> ${pts2}p</small>` : ''}</td>
      </tr>`;
    }
    tablesHtml += '</tbody></table></div>';
  }

  el.innerHTML = `
    <div class="h2h-scoreboard">
      <div class="h2h-sb-col ${p1wins > p2wins ? 'h2h-sb-winner' : ''}">
        <div class="h2h-sb-name">${esc(p1)}</div>
        <div class="h2h-sb-pts">${sd1.total} pts</div>
        <div class="h2h-sb-wins">${p1wins} victorias</div>
        <div class="h2h-sb-wins-sub">partidos con más puntos que el rival</div>
      </div>
      <div class="h2h-sb-tie"><div class="h2h-sb-tie-n">${ties}</div><div class="h2h-sb-tie-l">empates</div></div>
      <div class="h2h-sb-col ${p2wins > p1wins ? 'h2h-sb-winner' : ''}">
        <div class="h2h-sb-name">${esc(p2)}</div>
        <div class="h2h-sb-pts">${sd2.total} pts</div>
        <div class="h2h-sb-wins">${p2wins} victorias</div>
        <div class="h2h-sb-wins-sub">partidos con más puntos que el rival</div>
      </div>
    </div>
    ${tablesHtml}`;
}

// Stats 17, 18, 20 — Extras section
function renderExtrasSection() {
  const el = document.getElementById('st-extras');
  if (!el) return;

  const avgPerMatch = computeAvgPerMatch();
  const mostPts = computeMostPointsOneMatch();
  const unlucky = computeUnluckyPredictions();
  const maxAvgPts = Math.max(...avgPerMatch.map(p => p.avgPts), 1);
  const maxBestPts = mostPts[0]?.points || 1;

  el.innerHTML = `<h3 class="st-title">Más Estadísticas</h3>
    <div class="st-grid-2">
      <div>
        <h4 class="st-sub-title">Promedio de Puntos por Día Jugado</h4>
        <div class="smt">
          ${avgPerMatch.map((p, i) => `
            <div class="smt-row">
              <span class="smt-rank">#${i+1}</span>
              <span class="smt-name">${esc(p.participant.split(' ')[0])}</span>
              <span class="smt-bar-wrap"><span class="smt-bar smt-bar-alt" style="width:${Math.round(p.avgPts / maxAvgPts * 100)}%"></span></span>
              <span class="smt-val">${p.avgPts.toFixed(2)}</span>
              <span class="smt-detail">(${p.played}d)</span>
            </div>`).join('')}
        </div>
      </div>
      <div>
        <h4 class="st-sub-title">Mejor Día Personal</h4>
        <div class="smt">
          ${mostPts.map((p, i) => `
            <div class="smt-row">
              <span class="smt-rank">#${i+1}</span>
              <span class="smt-name">${esc(p.participant.split(' ')[0])}</span>
              <span class="smt-bar-wrap"><span class="smt-bar smt-bar-gold" style="width:${Math.round(p.points / maxBestPts * 100)}%"></span></span>
              <span class="smt-val">${p.points}p</span>
              <span class="smt-detail">${p.date !== '9999-01-01' ? fmtSnapshotDate(p.date) : ''}</span>
            </div>`).join('')}
        </div>
        ${unlucky.length ? `
        <h4 class="st-sub-title" style="margin-top:1.5rem">Apuestas Activas de Mayor Valor</h4>
        <p class="st-subtitle-note">Si acierta el marcador exacto de este partido, ¿cuántos puestos subiría en la tabla? Ordenado por el mayor salto posible.</p>
        <div class="smt">
          ${unlucky.slice(0, 8).map(u => `
            <div class="smt-row">
              <span class="smt-rank">${getFlag(getTeamForParticipant(u.participant))}</span>
              <span class="smt-name">${esc(u.participant)}</span>
              <span class="smt-text-wrap">${esc(u.teamLocal)} vs ${esc(u.teamVisitor)} · <strong>${esc(u.prediction)}</strong></span>
              <span class="smt-val">${u.positionsGained > 0 ? `+${u.positionsGained} 🏆` : `${u.potentialPoints}p`}</span>
            </div>`).join('')}
        </div>` : ''}
      </div>
    </div>`;
}

console.log('✅ stats.js cargado');
