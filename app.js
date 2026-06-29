/* ============================================
   APP.JS — Lógica Principal de la Aplicación
   ============================================ */

// ==================== ESTADO GLOBAL ====================

let appState = {
  participants: [],
  matches: {},
  predictions: {},
  results: {},
  scores: {},
  selectedParticipant: localStorage.getItem('selectedParticipant') || '',
  lastUpdated: null
};

// UI state
let cardState      = {};  // { phaseId: { matches, index } }
let viewMode       = {};  // { phaseId: 'table' | 'grid' }
let tableVisible   = {};  // { phaseId: boolean } — false = collapsed

// What IF mode
let whatIfMode    = false;
let whatIfScores  = {};   // "TeamA vs TeamB" → { goalsTeamA, goalsTeamB }
let whatIfRanking = null;

// General table phase tab
let generalPhaseTab = 'total';

// ==================== TEAM FLAGS ====================

const TEAM_FLAGS = {
  'Mexico': 'mx', 'USA': 'us', 'Canada': 'ca',
  'Argentina': 'ar', 'Brasil': 'br', 'Uruguay': 'uy',
  'Paraguay': 'py', 'Colombia': 'co', 'Ecuador': 'ec',
  'Peru': 'pe', 'Venezuela': 've', 'Chile': 'cl',
  'Bolivia': 'bo', 'España': 'es', 'Portugal': 'pt',
  'Francia': 'fr', 'Alemania': 'de', 'Paises Bajos': 'nl',
  'Belgica': 'be', 'Italia': 'it', 'Suiza': 'ch',
  'Austria': 'at', 'República Checa': 'cz', 'Polonia': 'pl',
  'Croacia': 'hr', 'Serbia': 'rs', 'Bosnia y Herzegovina': 'ba',
  'Ucrania': 'ua', 'Grecia': 'gr', 'Rumania': 'ro',
  'Hungria': 'hu', 'Noruega': 'no', 'Suecia': 'se',
  'Turquia': 'tr', 'Inglaterra': 'gb-eng', 'Escocia': 'gb-sct',
  'Gales': 'gb-wls', 'Irlanda': 'ie',
  'Japon': 'jp', 'Corea del Sur': 'kr', 'China': 'cn',
  'Australia': 'au', 'Nueva Zelanda': 'nz', 'Qatar': 'qa', 'Arabia Saudita': 'sa',
  'Iran': 'ir', 'Irak': 'iq', 'Jordania': 'jo',
  'Uzbekistan': 'uz', 'Emiratos Arabes': 'ae',
  'Marruecos': 'ma', 'Egipto': 'eg', 'Senegal': 'sn',
  'Nigeria': 'ng', 'Ghana': 'gh', 'Camerun': 'cm',
  'Sudafrica': 'za', 'Costa de Marfil': 'ci',
  'Argelia': 'dz', 'Tunez': 'tn', 'Cabo Verde': 'cv',
  'RD del Congo': 'cd', 'Kenia': 'ke',
  'Haiti': 'ht', 'Panama': 'pa', 'Costa Rica': 'cr',
  'Honduras': 'hn', 'Jamaica': 'jm', 'Curacao': 'cw',
};

function getFlag(teamName) {
  const code = TEAM_FLAGS[teamName];
  if (!code) return '';
  return `<img src="https://flagcdn.com/20x15/${code}.png" width="20" height="15" alt="${teamName}" style="vertical-align:middle;margin-right:2px;">`;
}

// ==================== DARK MODE ====================

function initDarkMode() {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    const btn = document.getElementById('dark-mode-btn');
    if (btn) btn.textContent = '☀️ Modo Claro';
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDark);
  const btn = document.getElementById('dark-mode-btn');
  if (btn) btn.textContent = isDark ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
  if (appState.participants.length) {
    if (typeof renderGeneralWidgets === 'function') renderGeneralWidgets();
    if (typeof renderStats === 'function' && document.querySelector('#stats .stats-content')) renderStats();
  }
}

// ==================== NAVEGACIÓN ====================

function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const phaseFixedCols = { groups: 5, round16: 4, round8: 4, quarters: 4, semi: 4, final: 4 };
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
      const tabId = btn.getAttribute('data-tab');
      const section = document.getElementById(tabId);
      if (section) section.classList.add('active');
      // Re-apply sticky left offsets now that the section is visible (offsetWidth was 0 while hidden)
      if (phaseFixedCols[tabId]) {
        applyStickyColumns(`${tabId}-table`, phaseFixedCols[tabId]);
      }
      // Lazy-render stats tab when first visited
      if (tabId === 'stats' && typeof renderStats === 'function' && appState.participants.length) {
        const hasContent = section?.querySelector('.stats-content');
        if (!hasContent) renderStats();
      }
      updateBackToTopVisibility();
    });
  });
}

// ==================== DOM SETUP ====================

function setupDOM() {
  // Wrap each table in a scroll container
  document.querySelectorAll('section table').forEach(table => {
    if (table.parentElement.classList.contains('table-wrapper')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
    wrapper.addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const canScrollH = wrapper.scrollWidth > wrapper.clientWidth;
      if (!canScrollH) return;
      const delta = e.deltaY * 1.5;
      const atLeft = wrapper.scrollLeft <= 0 && delta < 0;
      const atRight = wrapper.scrollLeft >= wrapper.scrollWidth - wrapper.clientWidth - 1 && delta > 0;
      if (atLeft || atRight) return;
      e.preventDefault();
      wrapper.scrollLeft += delta;
    }, { passive: false });
  });

  // Inject legend before each table-wrapper in phase sections
  const legend = `
    <div class="legend">
      <span class="legend-title">Leyenda:</span>
      <span class="legend-item"><span class="legend-swatch exact"></span> Exacto (3pts)</span>
      <span class="legend-item"><span class="legend-swatch winner"></span> Ganador correcto (1pt)</span>
      <span class="legend-item"><span class="legend-swatch none"></span> Sin acierto (0pts)</span>
    </div>`;

  ['groups','round16','round8','quarters','semi','final'].forEach(phaseId => {
    const wrapper = document.querySelector(`#${phaseId} .table-wrapper`);
    if (!wrapper) return;

    // Progress indicator
    if (!document.getElementById(`progress-${phaseId}`)) {
      const prog = document.createElement('div');
      prog.className = 'progress-indicator';
      prog.id = `progress-${phaseId}`;
      wrapper.parentNode.insertBefore(prog, wrapper);
    }

    // Legend
    if (!document.querySelector(`#${phaseId} .legend`)) {
      const legEl = document.createElement('div');
      legEl.innerHTML = legend;
      wrapper.parentNode.insertBefore(legEl.firstElementChild, wrapper);
    }

    // Table collapse toggle — starts collapsed
    if (!document.getElementById(`tabla-toggle-${phaseId}`)) {
      tableVisible[phaseId] = false;
      wrapper.style.display = 'none';
      const toggleBtn = document.createElement('button');
      toggleBtn.id = `tabla-toggle-${phaseId}`;
      toggleBtn.className = 'tabla-toggle-btn';
      toggleBtn.textContent = '▼ Ver Tabla';
      toggleBtn.onclick = () => toggleTableVisibility(phaseId);
      wrapper.parentNode.insertBefore(toggleBtn, wrapper);
    }
  });
}

// ==================== CARGAR DATOS ====================

async function loadAllData() {
  try {
    console.log('📥 Cargando datos...');
    const [predictions, worldcupData] = await Promise.all([
      readPredictionsFromSheets(),
      fetchWorldCupResults()
    ]);
    await fetchESPNTimes();
    appState.predictions = predictions;
    appState.scores = calculateParticipantScores(appState.predictions, worldcupData);
    appState.participants = getRanking(appState.scores);
    await renderAllViews();
    initializeCharts();
    if (typeof renderStats === 'function') renderStats();
    setupTooltips();
    setupInfoPopup();
    appState.lastUpdated = new Date();
    console.log('✅ Datos cargados exitosamente');
  } catch (error) {
    console.error('❌ Error cargando datos:', error);
    showError('Error al cargar los datos. Verifica la consola (F12) para más detalles.');
  }
}

// ==================== REFRESH ====================

async function refreshResults() {
  const btn = document.getElementById('refresh-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Actualizando...';
  try {
    await loadAllData();
    showSuccess('✅ Resultados actualizados correctamente');
  } catch (error) {
    console.error('❌ Error actualizando:', error);
    showError('Error al actualizar los resultados.');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Actualizar Resultados';
  }
}

// ==================== RENDERIZADO GENERAL ====================

function detectCurrentPhase() {
  const phases = ['groups','round16','round8','quarters','semi','final'];
  let current = 'total';
  for (const phase of phases) {
    const hasData = appState.participants.some(p => (p[phase] ?? 0) > 0);
    if (hasData) current = phase;
  }
  return current;
}

async function renderAllViews() {
  const autoPhase = detectCurrentPhase();
  if (generalPhaseTab === 'total' || generalPhaseTab === autoPhase) {
    generalPhaseTab = autoPhase;
    document.querySelectorAll('#general-phase-tabs .gpt-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.phase === autoPhase);
    });
  }
  await renderGeneralTable();
  for (const phase of ['groups','round16','round8','quarters','semi','final']) {
    await renderPhase(phase);
  }
}

async function renderGeneralTable() {
  const tbody = document.querySelector('#general-table tbody');
  const banner = document.getElementById('whatif-banner');
  if (banner) banner.style.display = whatIfMode ? '' : 'none';

  if (!appState.participants || appState.participants.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Sin datos disponibles</td></tr>';
    return;
  }

  // Phase-column map: tab key → participant property
  const PHASE_FIELD = { total: 'total', groups: 'groups', round16: 'round16', round8: 'round8', quarters: 'quarters', semi: 'semi', final: 'final' };
  const PHASE_LABEL = { groups: 'Grupos', round16: '16vos', round8: '8vos', quarters: 'Cuartos', semi: 'Semifinal', final: 'Final' };
  const sortField = PHASE_FIELD[generalPhaseTab] ?? 'total';
  const byPhase   = generalPhaseTab !== 'total';

  // Build sorted list for the selected phase
  const baseList = (whatIfMode && whatIfRanking) ? whatIfRanking : appState.participants;
  const sorted = byPhase
    ? [...baseList].sort((a, b) => (b[sortField] ?? 0) - (a[sortField] ?? 0))
    : baseList;

  // Build dynamic column order: active phase first (if a phase is selected), then the rest, then TOTAL last
  const ALL_PHASES = ['groups','round16','round8','quarters','semi','final'];
  const phaseCols = byPhase
    ? [sortField, ...ALL_PHASES.filter(p => p !== sortField)]
    : ALL_PHASES;

  // Rebuild thead dynamically
  const thead = document.querySelector('#general-table thead tr');
  const phaseHeaders = phaseCols.map(col =>
    `<th class="${col === sortField ? 'gpt-active-col' : ''}">${PHASE_LABEL[col]}</th>`
  ).join('');
  thead.innerHTML = `
    <th>Posición</th>
    <th>Equipo</th>
    <th>Participante</th>
    ${phaseHeaders}
    <th class="${sortField === 'total' ? 'gpt-active-col' : ''}">TOTAL</th>`;

  tbody.innerHTML = sorted.map((p, idx) => {
    const phasePos = idx + 1;
    const displayPos = byPhase ? phasePos : p.position;

    // Delta shown in what-if mode (vs real position in total ranking)
    const delta = (whatIfMode && !byPhase && p.realPosition != null) ? p.realPosition - p.position : 0;
    const deltaHtml = (whatIfMode && !byPhase)
      ? (delta > 0 ? `<span class="wi-delta wi-up">▲${delta}</span>`
        : delta < 0 ? `<span class="wi-delta wi-down">▼${Math.abs(delta)}</span>`
        : `<span class="wi-delta wi-same">—</span>`)
      : '';

    const posBadge = displayPos === 1 ? '🥇' : displayPos === 2 ? '🥈' : displayPos === 3 ? '🥉' : `#${displayPos}`;
    const topClass = displayPos <= 3 ? `top-${displayPos}` : '';
    const badgeVariant = displayPos <= 3 ? ['gold','silver','bronze'][displayPos-1] : 'default';

    const realGroups = appState.scores[p.participant]?.groups ?? p.groups;
    const realRound16 = appState.scores[p.participant]?.round16 ?? p.round16;

    const phaseCells = phaseCols.map(col => {
      const isActive = col === sortField;
      const wiClass = (col === 'groups' && whatIfMode && p.groups !== realGroups)
        ? 'wi-changed-cell' : (col === 'round16' && whatIfMode && p.round16 !== realRound16)
        ? 'wi-changed-cell' : '';
      return `<td class="${wiClass}${isActive ? ' gpt-active-col' : ''}">${p[col]}</td>`;
    }).join('');

    return `
    <tr class="${topClass}">
      <td><span class="pos-badge pos-badge--${badgeVariant}">${posBadge}</span>${deltaHtml}</td>
      <td><span class="cell-btn" data-team-popup="${esc(p.team)}">${getFlag(p.team)} ${p.team || '-'}</span></td>
      <td><span class="cell-btn" data-participant-popup="${esc(p.participant)}">${esc(p.participant)}</span></td>
      ${phaseCells}
      <td class="${sortField === 'total' ? 'gpt-active-col' : ''}"><strong class="rank-total-pts">${p.total}</strong></td>
    </tr>`;
  }).join('');

  // Populate participant datalists
  const names = appState.participants.map(p => p.participant).sort();
  for (const phaseId of ['groups','round16','round8','quarters','semi','final']) {
    const dl = document.querySelector(`#datalist-${phaseId}`);
    if (!dl) continue;
    dl.innerHTML = names.map(n => `<option value="${n}">`).join('');
  }
}

function setGeneralPhaseTab(phase) {
  generalPhaseTab = phase;
  document.querySelectorAll('#general-phase-tabs .gpt-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.phase === phase);
  });
  renderGeneralTable();
}

function getTeamStatus(teamName) {
  return '🟢';
}

// ==================== PHASE RENDERING ====================

const PHASE_NAMES = {
  groups:   'FASE DE GRUPOS',
  round16:  'DIECISEISAVOS',
  round8:   'OCTAVOS',
  quarters: 'CUARTOS',
  semi:     'SEMIFINAL',
  final:    'FINAL'
};

async function renderPhase(phaseId) {
  const tableId = `${phaseId}-table`;
  const table = document.getElementById(tableId);
  if (!table) return;

  const tbody = table.querySelector('tbody');
  const selectedParticipant = document.querySelector(`#participant-${phaseId}`)?.value || '';
  const _hint = document.getElementById(`participant-hint-${phaseId}`);
  if (_hint) _hint.classList.toggle('hidden', !!selectedParticipant);

  // Collect matches
  const matchesByNumber = {};
  for (const [participantName, scoreData] of Object.entries(appState.scores)) {
    for (const [, matchData] of Object.entries(scoreData.matches || {})) {
      if (matchData.phase && getPhaseIdFromStr(matchData.phase) === phaseId) {
        const matchNum = matchData.id;
        if (!matchesByNumber[matchNum]) {
          matchesByNumber[matchNum] = {
            id: matchNum,
            teamLocal: matchData.teamLocal,
            teamVisitor: matchData.teamVisitor,
            group: matchData.group,
            result: matchData.result,
            predictions: {}
          };
        }
        matchesByNumber[matchNum].predictions[participantName] = matchData;
      }
    }
  }

  const allMatches = Object.values(matchesByNumber).sort((a, b) => a.id - b.id);

  const _section = document.getElementById(phaseId);

  if (allMatches.length === 0) {
    if (_section) renderPhasePlaceholder(phaseId, _section, table);
    const tf = table.querySelector('tfoot');
    if (tf) tf.innerHTML = '';
    renderProgressIndicator(phaseId, []);
    return;
  }

  // Phase now has data — tear down any placeholder
  if (_section) {
    _section.classList.remove('phase-empty');
    const _ph = _section.querySelector('.phase-placeholder-container');
    if (_ph) _ph.remove();
  }

  const participants = Object.keys(appState.scores).sort();
  if (selectedParticipant && participants.includes(selectedParticipant)) {
    participants.splice(participants.indexOf(selectedParticipant), 1);
    participants.unshift(selectedParticipant);
  }
  const isGroups = phaseId === 'groups';
  const numFixed = isGroups ? 3 : 2;

  // Populate team datalist from all matches in this phase
  const teamDl = document.querySelector(`#datalist-team-${phaseId}`);
  if (teamDl) {
    const teamNames = [...new Set(allMatches.flatMap(m => [m.teamLocal, m.teamVisitor].filter(Boolean)))].sort();
    teamDl.innerHTML = teamNames.map(t => `<option value="${t}">`).join('');
  }

  // Apply search filter
  const search = (document.querySelector(`#search-${phaseId}`)?.value || '').toLowerCase().trim();
  const sortedMatches = search
    ? allMatches.filter(m =>
        (m.teamLocal  || '').toLowerCase().includes(search) ||
        (m.teamVisitor || '').toLowerCase().includes(search))
    : allMatches;

  // Build thead
  const thead = table.querySelector('thead tr');

  const participantHeaders = participants.map((p, i) => {
    const colIdx = numFixed + i;
    const isHL   = selectedParticipant && p === selectedParticipant ? ' col-highlighted' : '';
    const nameParts = p.trim().split(' ');
    const firstName = nameParts[0];
    const lastName  = nameParts.slice(1).join(' ');
    const team = getTeamForParticipant(p);
    const flagHtml = team ? getFlag(team) : '';
    const nameHtml  = lastName
      ? `<span style="display:block;line-height:1.2">${flagHtml}${firstName}</span><span style="display:block;line-height:1.2">${lastName}</span>`
      : `<span style="display:block;line-height:1.2">${flagHtml}${firstName}</span>`;
    return `<th class="${isHL.trim()}" data-colidx="${colIdx}" data-participant="${p}">
      ${nameHtml}
    </th>`;
  }).join('');

  if (isGroups) {
    thead.innerHTML = `
      <th class="sticky-col">#</th>
      <th class="sticky-col">Grupo</th>
      <th class="sticky-col">Partido</th>
      ${participantHeaders}`;
  } else {
    thead.innerHTML = `
      <th class="sticky-col">#</th>
      <th class="sticky-col">Partido</th>
      ${participantHeaders}`;
  }

  // Build tbody
  let html = '';
  const totalCols = numFixed + participants.length;

  for (const match of sortedMatches) {
    const hasResult = match.result != null &&
      match.result.goalsTeamA !== null && match.result.goalsTeamA !== undefined &&
      match.result.goalsTeamB !== null && match.result.goalsTeamB !== undefined;

    const flagL = getFlag(match.teamLocal);
    const flagV = getFlag(match.teamVisitor);

    const matchDT = findMatchDateTime(match.teamLocal, match.teamVisitor);
    let dateTimeHtml = '';
    let isLive = false;
    const _td = new Date();
    const todayStr = `${_td.getFullYear()}-${String(_td.getMonth()+1).padStart(2,'0')}-${String(_td.getDate()).padStart(2,'0')}`;
    const watchLink = matchDT && matchDT.date === todayStr
      ? '<a href="https://futbol-libres.su/" target="_blank" class="watch-link">📺 Ver</a>'
      : '';
    if (matchDT && matchDT.date) {
      const [, month, day] = matchDT.date.split('-');
      const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const monthName = monthNames[parseInt(month, 10) - 1] || month;
      const timeStr = matchDT.time ? ` ${matchDT.time}` : '';
      dateTimeHtml = `<div class="match-datetime">${day} ${monthName}${timeStr}</div>`;

      if (!hasResult && matchDT.time) {
        const kickoff = matchDT.utcStr
          ? new Date(matchDT.utcStr)
          : new Date(`${matchDT.date}T${matchDT.time}:00`);
        const minutesElapsed = (Date.now() - kickoff.getTime()) / 60000;
        isLive = minutesElapsed >= 0 && minutesElapsed <= 135;
      }
    }

    let pendingDisplay;
    if (whatIfMode && (phaseId === 'groups' || phaseId === 'round16')) {
      const wiKey = `${match.teamLocal} vs ${match.teamVisitor}`;
      const wi = whatIfScores[wiKey];
      const wiA = wi?.goalsTeamA ?? '';
      const wiB = wi?.goalsTeamB ?? '';
      pendingDisplay = `<div class="result-scoreboard result-whatif">
          <span class="rsb-side rsb-local">${flagL}<span class="rsb-name">${match.teamLocal}</span></span>
          <span class="rsb-goals">
            <input class="whatif-score-input" type="number" min="0" max="20" value="${wiA}" placeholder="?"
              oninput="updateWhatIfScore('${match.teamLocal}', '${match.teamVisitor}', 'A', this.value)">
            <span class="rsb-sep">–</span>
            <input class="whatif-score-input" type="number" min="0" max="20" value="${wiB}" placeholder="?"
              oninput="updateWhatIfScore('${match.teamLocal}', '${match.teamVisitor}', 'B', this.value)">
          </span>
          <span class="rsb-side rsb-visitor"><span class="rsb-name">${match.teamVisitor}</span>${flagV}</span>
        </div>`;
    } else {
      pendingDisplay = `<div class="result-scoreboard result-pending">
          <span class="rsb-side rsb-local">${flagL}<span class="rsb-name">${match.teamLocal}</span></span>
          <span class="rsb-goals" style="color:#aaa">vs</span>
          <span class="rsb-side rsb-visitor"><span class="rsb-name">${match.teamVisitor}</span>${flagV}</span>
        </div>`;
    }
    const resultText = hasResult
      ? `<div class="result-scoreboard">
          <span class="rsb-side rsb-local">${flagL}<span class="rsb-name">${match.teamLocal}</span></span>
          <span class="rsb-goals"><strong>${match.result.goalsTeamA}</strong><span class="rsb-sep">–</span><strong>${match.result.goalsTeamB}</strong></span>
          <span class="rsb-side rsb-visitor"><span class="rsb-name">${match.teamVisitor}</span>${flagV}</span>
        </div>`
      : pendingDisplay;
    const statusBadge = hasResult
      ? '<span class="status-badge finished">Finalizado</span>'
      : isLive
        ? '<span class="status-badge live">🔴 En Curso</span>'
        : '<span class="status-badge pending">Pendiente</span>';

    const groupCell = isGroups ? `<td class="sticky-col">${match.group || '-'}</td>` : '';

    const predsHtml = participants.map((p, i) => {
      let pred   = match.predictions[p];
      const colIdx = numFixed + i;
      const isHL     = selectedParticipant && p === selectedParticipant ? ' col-highlighted' : '';
      
      if (!pred || !pred.prediction || pred.prediction === 'NaN-NaN') {
        return `<td class="no-match${isHL}" data-colidx="${colIdx}">
          <span class="score-pill"><span class="pill-score">-</span><span class="pill-pts">0pts</span></span>
        </td>`;
      }

      // Recalculate points in WHAT IF mode for pending group/round16 matches
      if (whatIfMode && !hasResult && match.id && (phaseId === 'groups' || phaseId === 'round16')) {
        const wiKey = `${match.teamLocal} vs ${match.teamVisitor}`;
        const wi = whatIfScores[wiKey];
        if (wi && wi.goalsTeamA !== null && wi.goalsTeamB !== null) {
          const wiResult = { goalsTeamA: wi.goalsTeamA, goalsTeamB: wi.goalsTeamB };
          const recalc = calculateScore(pred, wiResult, phaseId);
          pred = { ...pred, points: recalc.points, type: recalc.type };
        }
      }

      const actual  = hasResult ? `${match.result.goalsTeamA}-${match.result.goalsTeamB}` : 'Sin resultado';
      const tip     = `Pronóstico: ${pred.prediction} | Real: ${actual} | +${pred.points}pts`;

      return `<td class="${pred.type}${isHL}" data-colidx="${colIdx}" data-tooltip="${tip}">
        <span class="score-pill">
          <span class="pill-score">${pred.prediction}</span>
          <span class="pill-pts">${pred.points}pts</span>
        </span>
      </td>`;
    }).join('');

    html += `
      <tr>
        <td class="sticky-col">${match.id}</td>
        ${groupCell}
        <td class="sticky-col"><div class="result-cell">${dateTimeHtml}${resultText}${statusBadge}${watchLink}</div></td>
        ${predsHtml}
      </tr>`;
  }

  tbody.innerHTML = html || `<tr><td colspan="${totalCols}" class="loading">Sin datos</td></tr>`;

  // Running total tfoot
  let tfoot = table.querySelector('tfoot');
  if (!tfoot) { tfoot = document.createElement('tfoot'); table.appendChild(tfoot); }

  const totalCells = participants.map((p, i) => {
    const colIdx   = numFixed + i;
    const isHL = selectedParticipant && p === selectedParticipant ? ' col-highlighted' : '';
    const pts  = appState.scores[p]?.[phaseId] ?? 0;
    return `<td class="${isHL}" data-colidx="${colIdx}"><strong>${pts}pts</strong></td>`;
  }).join('');

  const fixedFooter = isGroups
    ? `<td class="sticky-col"><strong>TOTAL</strong></td><td class="sticky-col"></td><td class="sticky-col"></td>`
    : `<td class="sticky-col"><strong>TOTAL</strong></td><td class="sticky-col"></td>`;

  tfoot.innerHTML = `<tr>${fixedFooter}${totalCells}</tr>`;

  // Apply sticky left widths, render progress + cards
  applyStickyColumns(tableId, numFixed);
  renderProgressIndicator(phaseId, allMatches);
  renderPhaseCards(phaseId, sortedMatches, participants);
  renderCardGrid(phaseId, sortedMatches, participants, selectedParticipant);
  buildStickyPortal(phaseId);
  if (typeof renderPhaseStats === 'function') renderPhaseStats(phaseId);
}

// ==================== STICKY COLUMNS ====================

// Tracks pending IntersectionObservers so we don't create duplicates per table
const _stickyObservers = {};

function applyStickyColumns(tableId, numCols) {
  const applyOffsets = () => {
    const table = document.getElementById(tableId);
    if (!table) return false;
    const headerCells = Array.from(table.querySelectorAll('thead tr th'));
    if (!headerCells.length) return false;
    if (headerCells[0].offsetWidth === 0) return false; // still hidden

    let leftOffset = 0;
    for (let i = 0; i < Math.min(numCols, headerCells.length); i++) {
      const w = headerCells[i].offsetWidth;
      table.querySelectorAll(
        `thead tr th:nth-child(${i+1}), tbody tr td:nth-child(${i+1}), tfoot tr td:nth-child(${i+1})`
      ).forEach(cell => { cell.style.left = `${leftOffset}px`; });
      leftOffset += w;
    }
    return true;
  };

  requestAnimationFrame(() => {
    if (applyOffsets()) return;

    // Table is hidden; observe and apply the moment it enters the viewport
    const table = document.getElementById(tableId);
    if (!table) return;
    if (_stickyObservers[tableId]) _stickyObservers[tableId].disconnect();
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        obs.disconnect();
        delete _stickyObservers[tableId];
        requestAnimationFrame(applyOffsets);
      }
    });
    obs.observe(table);
    _stickyObservers[tableId] = obs;
  });
}


// ==================== PROGRESS INDICATOR ====================

function renderProgressIndicator(phaseId, allMatches) {
  const el = document.getElementById(`progress-${phaseId}`);
  if (!el) return;

  if (!allMatches.length) { el.innerHTML = ''; return; }

  const total  = allMatches.length;
  const played = allMatches.filter(m =>
    m.result != null &&
    m.result.goalsTeamA !== null && m.result.goalsTeamA !== undefined
  ).length;
  const pct = Math.round((played / total) * 100);

  el.innerHTML = `
    <span>⚽ <strong>${played}</strong> de <strong>${total}</strong> partidos jugados</span>
    <div class="progress-bar-track">
      <div class="progress-bar-fill" style="width:${pct}%"></div>
    </div>
    <span style="font-weight:700;color:var(--primary-btn)">${pct}%</span>`;
}

// ==================== MOBILE CARD VIEW ====================

function renderPhaseCards(phaseId, sortedMatches, participants) {
  const container = document.getElementById(`cards-${phaseId}`);
  if (!container) return;

  if (!sortedMatches.length) { container.innerHTML = ''; return; }

  let initialIndex = 0;
  const _now = Date.now();
  let _foundLive = false;
  for (let _i = 0; _i < sortedMatches.length; _i++) {
    const _m = sortedMatches[_i];
    const _hasRes = _m.result != null && _m.result.goalsTeamA !== null && _m.result.goalsTeamA !== undefined;
    if (!_hasRes) {
      const _dt = findMatchDateTime(_m.teamLocal, _m.teamVisitor);
      if (_dt && _dt.date && _dt.time) {
        const _kickoff = new Date(`${_dt.date}T${_dt.time}:00`);
        const _mins = (_now - _kickoff.getTime()) / 60000;
        if (_mins >= 0 && _mins <= 105) { initialIndex = _i; _foundLive = true; break; }
      }
    }
  }
  if (!_foundLive) {
    for (let _i = 0; _i < sortedMatches.length; _i++) {
      const _m = sortedMatches[_i];
      const _hasRes = _m.result != null && _m.result.goalsTeamA !== null && _m.result.goalsTeamA !== undefined;
      if (!_hasRes) { initialIndex = _i; break; }
    }
  }
  cardState[phaseId] = { matches: sortedMatches, index: initialIndex };
  showCard(phaseId);
}

function showCard(phaseId) {
  const state = cardState[phaseId];
  if (!state || !state.matches.length) return;
  const container = document.getElementById(`cards-${phaseId}`);
  if (!container) return;

  const match = state.matches[state.index];
  const participants = Object.keys(appState.scores).sort();
  const _selP = document.querySelector(`#participant-${phaseId}`)?.value || '';
  if (_selP && participants.includes(_selP)) {
    participants.splice(participants.indexOf(_selP), 1);
    participants.unshift(_selP);
  }
  const hasResult = match.result != null &&
    match.result.goalsTeamA !== null && match.result.goalsTeamA !== undefined;

  const predsHtml = participants.map(p => {
    let pred = match.predictions[p];
    
    if (!pred || !pred.prediction || pred.prediction === 'NaN-NaN') {
      return `<div class="card-pred-row no-match">
        <span class="card-pred-name">${p}</span>
        <span class="score-pill"><span class="pill-score">-</span><span class="pill-pts">0pts</span></span>
      </div>`;
    }

    // Recalculate points in WHAT IF mode for pending group/round16 matches
    if (whatIfMode && !hasResult && match.id && (phaseId === 'groups' || phaseId === 'round16')) {
      const wiKey = `${match.teamLocal} vs ${match.teamVisitor}`;
      const wi = whatIfScores[wiKey];
      if (wi && wi.goalsTeamA !== null && wi.goalsTeamB !== null) {
        const wiResult = { goalsTeamA: wi.goalsTeamA, goalsTeamB: wi.goalsTeamB };
        const recalc = calculateScore(pred, wiResult, phaseId);
        pred = { ...pred, points: recalc.points, type: recalc.type };
      }
    }

    return `<div class="card-pred-row ${pred.type}">
      <span class="card-pred-name">${p}</span>
      <span class="score-pill"><span class="pill-score">${pred.prediction}</span><span class="pill-pts">${pred.points}pts</span></span>
    </div>`;
  }).join('');

  const flagL = getFlag(match.teamLocal);
  const flagV = getFlag(match.teamVisitor);
  const cardMatchDT = findMatchDateTime(match.teamLocal, match.teamVisitor);
  let cardIsLive = false;
  if (!hasResult && cardMatchDT && cardMatchDT.date && cardMatchDT.time) {
    const kickoff = new Date(`${cardMatchDT.date}T${cardMatchDT.time}:00`);
    const minutesElapsed = (Date.now() - kickoff.getTime()) / 60000;
    cardIsLive = minutesElapsed >= 0 && minutesElapsed <= 105;
  }
  const _cardToday = new Date();
  const cardTodayStr = `${_cardToday.getFullYear()}-${String(_cardToday.getMonth()+1).padStart(2,'0')}-${String(_cardToday.getDate()).padStart(2,'0')}`;
  const cardWatchLink = cardMatchDT && cardMatchDT.date === cardTodayStr
    ? '<a href="https://futbol-libres.su/" target="_blank" class="watch-link watch-link-card">📺 Ver partidos en vivo</a>'
    : '';
  const statusBadge = hasResult
    ? '<span class="status-badge finished" style="display:block;text-align:center;margin:0.3rem 0">Finalizado</span>'
    : cardIsLive
      ? '<span class="status-badge live" style="display:block;text-align:center;margin:0.3rem 0">🔴 En Curso</span>'
      : '<span class="status-badge pending" style="display:block;text-align:center;margin:0.3rem 0">Pendiente</span>';

  container.innerHTML = `
    <div class="match-card">
      <div class="match-header">
        <div class="match-phase">Partido ${match.id}${match.group ? ` — Grupo ${match.group}` : ''}</div>
      </div>
      <div class="teams">
        <div class="team">${flagL} ${match.teamLocal}</div>
        <div style="font-weight:700;color:#999;font-size:1.2rem">vs</div>
        <div class="team">${flagV} ${match.teamVisitor}</div>
      </div>
      <div class="score">${hasResult ? `${match.result.goalsTeamA} - ${match.result.goalsTeamB}` : '? - ?'}</div>
      ${statusBadge}
      ${cardWatchLink}
      <div class="card-predictions">${predsHtml}</div>
    </div>
    <div class="card-nav">
      <button onclick="previousCard('${phaseId}')">← Anterior</button>
      <span class="card-counter">${state.index + 1} / ${state.matches.length}</span>
      <button onclick="nextCard('${phaseId}')">Siguiente →</button>
    </div>`;
}

function nextCard(phase) {
  const state = cardState[phase];
  if (!state) return;
  state.index = Math.min(state.index + 1, state.matches.length - 1);
  showCard(phase);
}

function previousCard(phase) {
  const state = cardState[phase];
  if (!state) return;
  state.index = Math.max(state.index - 1, 0);
  showCard(phase);
}

// ==================== CARD GRID VIEW ====================

function toggleView(phaseId) {
  viewMode[phaseId] = viewMode[phaseId] === 'grid' ? 'table' : 'grid';
  const btn = document.getElementById(`view-toggle-${phaseId}`);
  if (btn) btn.textContent = viewMode[phaseId] === 'grid' ? '☰ Tabla' : '⊞ Cuadrícula';
  renderPhase(phaseId);
  updateBackToTopVisibility();
}

function toggleTableVisibility(phaseId) {
  tableVisible[phaseId] = !tableVisible[phaseId];
  const wrapper = document.querySelector(`#${phaseId} .table-wrapper`);
  const btn = document.getElementById(`tabla-toggle-${phaseId}`);
  const isGrid = viewMode[phaseId] === 'grid';
  if (wrapper && !isGrid) wrapper.style.display = tableVisible[phaseId] ? '' : 'none';
  if (btn) btn.textContent = tableVisible[phaseId] ? '▲ Ocultar Tabla' : '▼ Ver Tabla';
}

// ==================== WHAT IF MODE ====================

function toggleWhatIf() {
  whatIfMode = !whatIfMode;
  if (!whatIfMode) {
    whatIfScores  = {};
    whatIfRanking = null;
  }
  ['whatif-btn', 'whatif-btn-round16'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.textContent = whatIfMode ? '✕ Salir de What IF' : '🔮 What IF';
      btn.classList.toggle('whatif-active', whatIfMode);
    }
  });
  const activeSection = document.querySelector('section.active');
  const activePhase = activeSection ? activeSection.id : 'groups';
  renderPhase(activePhase);
  renderGeneralTable();
}

function updateWhatIfScore(teamLocal, teamVisitor, side, rawValue) {
  const val = parseInt(rawValue, 10);
  const key = `${teamLocal} vs ${teamVisitor}`;
  if (!whatIfScores[key]) whatIfScores[key] = { goalsTeamA: null, goalsTeamB: null };
  if (side === 'A') whatIfScores[key].goalsTeamA = (rawValue === '' || isNaN(val)) ? null : val;
  else              whatIfScores[key].goalsTeamB = (rawValue === '' || isNaN(val)) ? null : val;
  recalcWhatIf();
}

function recalcWhatIf() {
  if (!whatIfMode) return;

  // Save current scroll position
  const scrollY = window.scrollY;

  const realPos = {};
  appState.participants.forEach(p => { realPos[p.participant] = p.position; });

  const hypo = [];
  for (const [, scoreData] of Object.entries(appState.scores)) {
    let extraGroups = 0;
    let extraRound16 = 0;
    for (const [, m] of Object.entries(scoreData.matches || {})) {
      const phaseUpper = m.phase?.toUpperCase() || '';
      let mPhaseId = null;
      if (phaseUpper.includes('GRUPO')) mPhaseId = 'groups';
      else if (phaseUpper.includes('DIECISEIS') || phaseUpper.includes('16')) mPhaseId = 'round16';
      if (!mPhaseId || m.result !== null) continue;
      const key1 = `${m.teamLocal} vs ${m.teamVisitor}`;
      const key2 = `${m.teamVisitor} vs ${m.teamLocal}`;
      let wi = whatIfScores[key1];
      let flipped = false;
      if (!wi) { wi = whatIfScores[key2]; flipped = true; }
      if (!wi || wi.goalsTeamA === null || wi.goalsTeamB === null) continue;
      const fakeResult = flipped
        ? { goalsTeamA: wi.goalsTeamB, goalsTeamB: wi.goalsTeamA }
        : wi;
      const pts = calculateScore({ goalsLocal: m.goalsLocal, goalsVisitor: m.goalsVisitor }, fakeResult, mPhaseId).points;
      if (mPhaseId === 'groups') extraGroups += pts;
      else extraRound16 += pts;
    }
    hypo.push({ ...scoreData, groups: scoreData.groups + extraGroups, round16: scoreData.round16 + extraRound16, total: scoreData.total + extraGroups + extraRound16 });
  }

  whatIfRanking = hypo
    .sort((a, b) => b.total - a.total)
    .map((item, i) => ({ ...item, position: i + 1, realPosition: realPos[item.participant] ?? i + 1 }));

  renderGeneralTable();
  
  // Re-render the current phase to update grid/table views with new predictions
  const activeSection = document.querySelector('section.active');
  const phaseId = activeSection ? activeSection.id : null;
  if (phaseId) {
    renderPhase(phaseId);
  }

  // Restore scroll position after DOM updates complete
  setTimeout(() => {
    window.scrollTo(0, scrollY);
  }, 0);
}

function updateBackToTopVisibility() {
  const topBtn = document.getElementById('back-to-top-btn');
  if (!topBtn) return;
  const activeSection = document.querySelector('section.active');
  const phaseId = activeSection ? activeSection.id : null;
  const isGrid = phaseId && viewMode[phaseId] === 'grid';
  const scrolledDown = window.scrollY > 200;
  topBtn.classList.toggle('visible', !!(isGrid && scrolledDown));
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', updateBackToTopVisibility, { passive: true });

function renderCardGrid(phaseId, sortedMatches, participants, selectedParticipant) {
  const gridContainer = document.getElementById(`card-grid-${phaseId}`);
  const tableWrapper  = document.querySelector(`#${phaseId} .table-wrapper`);
  const isGrid = viewMode[phaseId] === 'grid';

  if (tableWrapper) tableWrapper.style.display = (isGrid || !tableVisible[phaseId]) ? 'none' : '';
  if (!gridContainer) return;
  gridContainer.style.display = isGrid ? 'grid' : 'none';
  if (!isGrid) return;

  gridContainer.innerHTML = sortedMatches.map(match => {
    const hasResult = match.result != null &&
      match.result.goalsTeamA !== null && match.result.goalsTeamA !== undefined;
    const flagL = getFlag(match.teamLocal);
    const flagV = getFlag(match.teamVisitor);
    let score;
    
    if (hasResult) {
      score = `<strong>${match.result.goalsTeamA}-${match.result.goalsTeamB}</strong>`;
    } else if (whatIfMode && (phaseId === 'groups' || phaseId === 'round16')) {
      // Show WHAT IF input fields for pending matches in grid view
      const wiKey = `${match.teamLocal} vs ${match.teamVisitor}`;
      const wi = whatIfScores[wiKey];
      const wiA = wi?.goalsTeamA ?? '';
      const wiB = wi?.goalsTeamB ?? '';
      const teamLocalEsc = match.teamLocal.replace(/'/g, "\\'");
      const teamVisitorEsc = match.teamVisitor.replace(/'/g, "\\'");
      score = `<div style="display:flex; align-items:center; gap:0.3rem; justify-content:center;">
        <input class="whatif-score-input" type="number" min="0" max="20" value="${wiA}" placeholder="?"
          oninput="updateWhatIfScore('${teamLocalEsc}', '${teamVisitorEsc}', 'A', this.value)"
          style="width:50px;">
        <span style="font-weight:700;">–</span>
        <input class="whatif-score-input" type="number" min="0" max="20" value="${wiB}" placeholder="?"
          oninput="updateWhatIfScore('${teamLocalEsc}', '${teamVisitorEsc}', 'B', this.value)"
          style="width:50px;">
      </div>`;
    } else {
      score = '<span class="grid-vs-pending">vs</span>';
    }
    const gridMatchDT = findMatchDateTime(match.teamLocal, match.teamVisitor);
    let gridIsLive = false;
    if (!hasResult && gridMatchDT && gridMatchDT.date && gridMatchDT.time) {
      const kickoff = new Date(`${gridMatchDT.date}T${gridMatchDT.time}:00`);
      const minutesElapsed = (Date.now() - kickoff.getTime()) / 60000;
      gridIsLive = minutesElapsed >= 0 && minutesElapsed <= 105;
    }
    const _gridToday = new Date();
    const gridTodayStr = `${_gridToday.getFullYear()}-${String(_gridToday.getMonth()+1).padStart(2,'0')}-${String(_gridToday.getDate()).padStart(2,'0')}`;
    const gridWatchLink = gridMatchDT && gridMatchDT.date === gridTodayStr
      ? '<a href="https://futbol-libres.su/" target="_blank" class="watch-link watch-link-grid">📺 Ver partidos en vivo</a>'
      : '';
    const statusBadge = hasResult
      ? '<span class="status-badge finished">Finalizado</span>'
      : gridIsLive
        ? '<span class="status-badge live">🔴 En Curso</span>'
        : '<span class="status-badge pending">Pendiente</span>';

    const predsHtml = participants.map(p => {
      let pred  = match.predictions[p];
      const isHL  = selectedParticipant && p === selectedParticipant ? ' grid-hl' : '';
      
      if (!pred || !pred.prediction || pred.prediction === 'NaN-NaN') {
        return `<div class="grid-pred-row no-match${isHL}">
          <span class="grid-pred-name">${p}</span>
          <span class="score-pill"><span class="pill-score">-</span><span class="pill-pts">0pts</span></span>
        </div>`;
      }

      // Recalculate points in WHAT IF mode for pending group/round16 matches
      if (whatIfMode && !hasResult && match.id && (phaseId === 'groups' || phaseId === 'round16')) {
        const wiKey = `${match.teamLocal} vs ${match.teamVisitor}`;
        const wi = whatIfScores[wiKey];
        if (wi && wi.goalsTeamA !== null && wi.goalsTeamB !== null) {
          const wiResult = { goalsTeamA: wi.goalsTeamA, goalsTeamB: wi.goalsTeamB };
          const recalc = calculateScore(pred, wiResult, phaseId);
          pred = { ...pred, points: recalc.points, type: recalc.type };
        }
      }

      return `<div class="grid-pred-row ${pred.type}${isHL}">
        <span class="grid-pred-name">${p}</span>
        <span class="score-pill"><span class="pill-score">${pred.prediction}</span><span class="pill-pts">${pred.points}pts</span></span>
      </div>`;
    }).join('');

    return `<div class="grid-match-card">
      <div class="grid-card-header">
        <span class="grid-match-num">#${match.id}${match.group ? ` · Grupo ${match.group}` : ''}</span>
        ${statusBadge}
      </div>
      <div class="grid-teams">
        <span class="grid-team">${flagL} ${match.teamLocal}</span>
        <span class="grid-score">${score}</span>
        <span class="grid-team grid-team-right">${flagV} ${match.teamVisitor}</span>
      </div>
      ${gridWatchLink}
      <div class="grid-predictions">${predsHtml}</div>
    </div>`;
  }).join('');
}

// ==================== GROUP STANDINGS & PHASE PLACEHOLDER ====================

function computeGroupStandings() {
  const groupMap = {};
  const seenMatches = new Set();

  for (const scoreData of Object.values(appState.scores)) {
    for (const matchData of Object.values(scoreData.matches || {})) {
      if (!matchData.phase?.includes('GRUPO')) continue;
      if (seenMatches.has(matchData.id)) continue;
      seenMatches.add(matchData.id);

      const grp = (matchData.group || '?').trim();
      const tL = matchData.teamLocal;
      const tV = matchData.teamVisitor;
      const res = matchData.result;

      if (!groupMap[grp]) groupMap[grp] = {};
      const init = () => ({ pj: 0, pts: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 });
      if (!groupMap[grp][tL]) groupMap[grp][tL] = init();
      if (!groupMap[grp][tV]) groupMap[grp][tV] = init();

      if (res?.goalsTeamA != null) {
        const gl = res.goalsTeamA, gv = res.goalsTeamB;
        const sL = groupMap[grp][tL], sV = groupMap[grp][tV];
        sL.pj++; sV.pj++;
        sL.gf += gl; sL.gc += gv;
        sV.gf += gv; sV.gc += gl;
        if (gl > gv)      { sL.g++; sL.pts += 3; sV.p++; }
        else if (gl < gv) { sV.g++; sV.pts += 3; sL.p++; }
        else              { sL.e++; sL.pts++;     sV.e++; sV.pts++; }
      }
    }
  }

  const sorted = {};
  for (const [grp, teams] of Object.entries(groupMap)) {
    sorted[grp] = Object.entries(teams)
      .map(([name, s]) => ({ name, ...s, gd: s.gf - s.gc }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }
  return sorted;
}

function renderPhasePlaceholder(phaseId, section, table) {
  section.classList.add('phase-empty');

  let container = section.querySelector('.phase-placeholder-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'phase-placeholder-container';
    table.insertAdjacentElement('afterend', container);
  }

  const standings = computeGroupStandings();
  const groups = Object.keys(standings).sort();

  const phaseTitles = {
    round16: 'Dieciseisavos de Final',
    round8:  'Octavos de Final',
    quarters: 'Cuartos de Final',
    semi:    'Semifinal',
    final:   'Gran Final'
  };

  let html = `<div class="phase-placeholder-header">
    <span class="phase-placeholder-icon">⏳</span>
    <p class="phase-placeholder-title">Próximamente · ${phaseTitles[phaseId] || phaseId}</p>
    <p class="phase-placeholder-subtitle">Los partidos de esta fase se determinarán al concluir la Fase de Grupos</p>
  </div>`;

  if (groups.length > 0) {
    const groupsHtml = groups.map(grp => {
      const rows = standings[grp].map((t, i) => {
        const posClass = i === 0 ? 's-pos-1' : i === 1 ? 's-pos-2' : i === 2 ? 's-pos-3' : '';
        const gdStr = t.gd > 0 ? `+${t.gd}` : `${t.gd}`;
        const flag = getFlag(t.name);
        return `<tr class="${posClass}">
          <td class="grps-pos">${i + 1}</td>
          <td class="grps-team">${flag}<span>${t.name}</span></td>
          <td>${t.pj}</td><td>${t.g}</td><td>${t.e}</td><td>${t.p}</td>
          <td>${t.gf}</td><td>${t.gc}</td><td>${gdStr}</td>
          <td><strong>${t.pts}</strong></td>
        </tr>`;
      }).join('');
      return `<div class="grps-block">
        <div class="grps-title">Grupo ${grp}</div>
        <table class="grps-table">
          <thead><tr>
            <th>#</th><th>Equipo</th>
            <th title="Partidos Jugados">PJ</th>
            <th title="Ganados">G</th><th title="Empates">E</th><th title="Perdidos">P</th>
            <th title="Goles a favor">GF</th><th title="Goles en contra">GC</th>
            <th title="Diferencia de goles">DG</th><th title="Puntos">Pts</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }).join('');

    html += `<div class="grps-preview">
      <h3 class="grps-preview-title">Clasificación Actual por Grupo</h3>
      <div class="grps-grid">${groupsHtml}</div>
      <p class="grps-preview-note">🟢 Clasificado directo &nbsp;·&nbsp; 🔵 Segundo lugar &nbsp;·&nbsp; 🟡 Posible mejor tercero</p>
      <p class="grps-abbrev-note"><strong>PJ</strong> Partidos Jugados &nbsp;·&nbsp; <strong>G</strong> Ganados &nbsp;·&nbsp; <strong>E</strong> Empates &nbsp;·&nbsp; <strong>P</strong> Perdidos &nbsp;·&nbsp; <strong>GF</strong> Goles a Favor &nbsp;·&nbsp; <strong>GC</strong> Goles en Contra &nbsp;·&nbsp; <strong>DG</strong> Diferencia de Goles &nbsp;·&nbsp; <strong>Pts</strong> Puntos</p>
    </div>`;
  }

  container.innerHTML = html;
}

// ==================== INFO POPUP (CLICK-BASED) ====================

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const PHASE_ORDER_LIST = ['groups','round16','round8','quarters','semi','final'];
const PHASE_LABEL_MAP  = { groups:'Fase de Grupos', round16:'16vos', round8:'8vos', quarters:'Cuartos', semi:'Semifinal', final:'Final' };

function getPhaseIdFromStr(phase) {
  if (!phase) return null;
  const p = phase.toUpperCase();
  if (p.includes('GRUPOS'))                            return 'groups';
  if (p.includes('DIECISEIS') || p.includes('16'))     return 'round16';
  if (p.includes('OCTAVOS')   || p.includes('8'))      return 'round8';
  if (p.includes('CUARTOS'))                           return 'quarters';
  if (p.includes('SEMIFINAL'))                         return 'semi';
  if (p.includes('FINAL'))                             return 'final';
  return null;
}

function setupInfoPopup() {
  const table = document.getElementById('general-table');
  if (!table || table._popupSetup) return;
  table._popupSetup = true;

  table.addEventListener('click', e => {
    const teamEl        = e.target.closest('[data-team-popup]');
    const participantEl = e.target.closest('[data-participant-popup]');
    if (teamEl)        showTeamPopup(teamEl.dataset.teamPopup);
    else if (participantEl) showParticipantPopup(participantEl.dataset.participantPopup);
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeInfoPopup(); });

  const overlay = document.getElementById('info-popup-overlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeInfoPopup(); });
}

function showInfoPopup(content) {
  document.getElementById('info-popup-content').innerHTML = content;
  document.getElementById('info-popup-overlay').style.display = 'flex';
}

function closeInfoPopup() {
  const overlay = document.getElementById('info-popup-overlay');
  if (overlay) overlay.style.display = 'none';
}

function showParticipantPopup(name) {
  const scoreData = appState.scores[name];
  if (!scoreData) return;

  const byPhase = {};
  for (const m of Object.values(scoreData.matches || {})) {
    const phaseId = getPhaseIdFromStr(m.phase);
    if (!phaseId) continue;
    (byPhase[phaseId] = byPhase[phaseId] || []).push(m);
  }

  let html = `<div class="popup-title">${getFlag(scoreData.team)} ${esc(name)}</div>`;

  for (const phaseId of PHASE_ORDER_LIST) {
    const matches = byPhase[phaseId];
    if (!matches?.length) continue;
    html += `<div class="popup-phase-label">${PHASE_LABEL_MAP[phaseId]}</div>
<table class="popup-matches-table"><thead><tr>
  <th>Partido</th><th>Pronóstico</th><th>Real</th><th class="popup-pts-col">Pts</th>
</tr></thead><tbody>`;
    for (const m of matches) {
      const pred   = m.prediction ?? `${m.goalsLocal ?? '?'}-${m.goalsVisitor ?? '?'}`;
      const actual = m.result ? `${m.result.goalsTeamA}-${m.result.goalsTeamB}` : '-';
      const pts    = m.points ?? 0;
      const cls    = m.type === 'exact-match' ? 'pm-exact' : m.type === 'winner-match' ? 'pm-winner' : '';
      html += `<tr class="${cls}">
        <td>${getFlag(m.teamLocal)}${esc(m.teamLocal)} vs ${getFlag(m.teamVisitor)}${esc(m.teamVisitor)}</td>
        <td>${esc(pred)}</td>
        <td>${esc(actual)}</td>
        <td class="popup-pts-col">${pts}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `<div class="popup-total-row">Total: ${scoreData.total} pts</div>`;
  showInfoPopup(html);
}

function showTeamPopup(teamName) {
  if (!teamName) return;

  const seen = new Set();
  const matches = [];
  for (const scoreData of Object.values(appState.scores)) {
    for (const [key, m] of Object.entries(scoreData.matches || {})) {
      if ((m.teamLocal === teamName || m.teamVisitor === teamName) && !seen.has(key)) {
        seen.add(key);
        matches.push(m);
      }
    }
  }

  matches.sort((a, b) => PHASE_ORDER_LIST.indexOf(getPhaseIdFromStr(a.phase)) - PHASE_ORDER_LIST.indexOf(getPhaseIdFromStr(b.phase)));

  let html = `<div class="popup-title">${getFlag(teamName)} ${esc(teamName)}</div>`;

  if (!matches.length) {
    html += `<p style="color:#888;font-size:0.85rem">Sin partidos registrados.</p>`;
    showInfoPopup(html);
    return;
  }

  const byPhase = {};
  for (const m of matches) {
    const phaseId = getPhaseIdFromStr(m.phase) ?? 'groups';
    (byPhase[phaseId] = byPhase[phaseId] || []).push(m);
  }

  for (const phaseId of PHASE_ORDER_LIST) {
    const phaseMatches = byPhase[phaseId];
    if (!phaseMatches?.length) continue;
    html += `<div class="popup-phase-label">${PHASE_LABEL_MAP[phaseId]}</div>
<table class="popup-matches-table"><thead><tr>
  <th>Partido</th><th style="text-align:center">Fecha</th><th style="text-align:center">Resultado</th>
</tr></thead><tbody>`;
    for (const m of phaseMatches) {
      const actual = m.result ? `${m.result.goalsTeamA}-${m.result.goalsTeamB}` : 'Pendiente';
      const bold   = m.result ? 'font-weight:700' : '';
      const dt = findMatchDateTime(m.teamLocal, m.teamVisitor);
      let dateStr = '—';
      if (dt && dt.date) {
        const [, month, day] = dt.date.split('-');
        const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const monthName = monthNames[parseInt(month, 10) - 1] || month;
        dateStr = dt.time ? `${day} ${monthName} ${dt.time}` : `${day} ${monthName}`;
      }
      html += `<tr>
        <td>${esc(m.teamLocal)} vs ${esc(m.teamVisitor)}</td>
        <td style="text-align:center;color:#666;font-size:0.82rem;white-space:nowrap">${dateStr}</td>
        <td style="text-align:center;${bold}">${esc(actual)}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
  }

  showInfoPopup(html);
}

// ==================== TOOLTIP (FLOATING) ====================

function setupTooltips() {
  if (document.getElementById('tt-floating')) return;

  const tt = document.createElement('div');
  tt.id = 'tt-floating';
  tt.style.cssText = [
    'position:fixed', 'background:rgba(4,21,97,0.95)', 'color:white',
    'padding:5px 10px', 'border-radius:4px', 'font-size:0.72rem',
    'font-family:Lexend,Roboto,sans-serif', 'pointer-events:none',
    'z-index:9999', 'white-space:nowrap', 'box-shadow:0 2px 10px rgba(0,0,0,0.25)',
    'display:none', 'max-width:280px', 'white-space:normal', 'line-height:1.4'
  ].join(';');
  document.body.appendChild(tt);

  document.addEventListener('mouseover', e => {
    const cell = e.target.closest('[data-tooltip]');
    if (!cell) { tt.style.display = 'none'; return; }
    tt.textContent = cell.dataset.tooltip;
    tt.style.display = 'block';
  });

  document.addEventListener('mousemove', e => {
    if (tt.style.display === 'none') return;
    if (!e.target.closest('[data-tooltip]')) { tt.style.display = 'none'; return; }
    tt.style.left = `${e.clientX + 14}px`;
    tt.style.top  = `${e.clientY - 38}px`;
  });

  document.addEventListener('mouseout', e => {
    if (e.target.closest('[data-tooltip]') && !e.relatedTarget?.closest('[data-tooltip]')) {
      tt.style.display = 'none';
    }
  });
}

// ==================== MENSAJES ====================

function showError(message) {
  const el = document.getElementById('general-error');
  if (el) { el.textContent = message; el.style.display = 'block'; setTimeout(() => el.style.display='none', 5000); }
}

function showSuccess(message) {
  const el = document.getElementById('general-success');
  if (el) { el.textContent = message; el.style.display = 'block'; setTimeout(() => el.style.display='none', 5000); }
}

// ==================== INIT ====================

// ==================== STICKY HEADER PORTAL ====================

const stickyPortals    = {};   // { phaseId: { portal, observer, syncScroll } }

function updateHeaderHeight() {
  const h = document.querySelector('header')?.offsetHeight ?? 0;
  document.documentElement.style.setProperty('--header-h', `${h}px`);
}

function buildStickyPortal(phaseId) {
  const table  = document.getElementById(`${phaseId}-table`);
  const wrapper = table?.closest('.table-wrapper');
  const thead  = table?.querySelector('thead');
  if (!table || !wrapper || !thead) return;

  // Tear down previous portal for this phase
  if (stickyPortals[phaseId]) {
    stickyPortals[phaseId].observer.disconnect();
    wrapper.removeEventListener('scroll', stickyPortals[phaseId].syncScroll);
    window.removeEventListener('resize', stickyPortals[phaseId].syncScroll);
  }

  // Get or create the portal div (sibling before table-wrapper)
  let portal = document.getElementById(`sticky-portal-${phaseId}`);
  if (!portal) {
    portal = document.createElement('div');
    portal.id = `sticky-portal-${phaseId}`;
    portal.className = 'sticky-header-portal';
    wrapper.parentNode.insertBefore(portal, wrapper);
  }
  portal.style.display = 'none'; // always reset; observer will show it if needed

  // Build cloned thead (no sticky-left — portal handles its own overflow)
  const clonedThead = thead.cloneNode(true);
  clonedThead.querySelectorAll('th').forEach(th => {
    th.style.position = '';
    th.style.left     = '';
  });

  const portalTable = document.createElement('table');
  portalTable.className = table.className;
  portalTable.appendChild(clonedThead);
  portal.innerHTML = '';
  portal.appendChild(portalTable);

  // Sync column widths, horizontal scroll, and portal left/width to match the wrapper
  function syncScroll() {
    const rect = wrapper.getBoundingClientRect();
    portal.style.left  = rect.left + 'px';
    portal.style.width = rect.width + 'px';
    portal.style.right = 'auto';

    const liveCells   = Array.from(thead.querySelectorAll('th'));
    const portalCells = Array.from(portal.querySelectorAll('th'));
    liveCells.forEach((th, i) => {
      if (portalCells[i]) {
        portalCells[i].style.width    = th.offsetWidth + 'px';
        portalCells[i].style.minWidth = th.offsetWidth + 'px';
      }
    });
    portalTable.style.width     = table.offsetWidth + 'px';
    portalTable.style.transform = `translateX(-${wrapper.scrollLeft}px)`;
  }

  wrapper.addEventListener('scroll', syncScroll, { passive: true });
  window.addEventListener('resize', syncScroll, { passive: true });

  // Show portal only when original thead has scrolled above the nav bar
  const headerH = document.querySelector('header')?.offsetHeight ?? 0;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const show = !entry.isIntersecting;
      portal.style.display = show ? 'block' : 'none';
      if (show) syncScroll();
    });
  }, { rootMargin: `-${headerH}px 0px 0px 0px`, threshold: 0 });

  observer.observe(thead);

  stickyPortals[phaseId] = { portal, observer, syncScroll };
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Inicializando Quiniela Mundialista 2026...');
  initDarkMode();
  setupNavigation();
  setupDOM();
  updateHeaderHeight();
  window.addEventListener('resize', updateHeaderHeight);
  await loadAllData();
});

console.log('✅ app.js cargado');

