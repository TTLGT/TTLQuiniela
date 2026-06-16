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

// ==================== TEAM FLAGS ====================

const TEAM_FLAGS = {
  'Mexico': 'mx', 'USA': 'us', 'Canada': 'ca',
  'Argentina': 'ar', 'Brasil': 'br', 'Uruguay': 'uy',
  'Paraguay': 'py', 'Colombia': 'co', 'Ecuador': 'ec',
  'Peru': 'pe', 'Venezuela': 've', 'Chile': 'cl',
  'Bolivia': 'bo', 'España': 'es', 'Portugal': 'pt',
  'Francia': 'fr', 'Alemania': 'de', 'Paises Bajos': 'nl',
  'Holanda': 'nl', 'Belgica': 'be', 'Italia': 'it', 'Suiza': 'ch',
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
  'RD Congo': 'cd', 'Kenia': 'ke',
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
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        wrapper.scrollLeft += e.deltaY * 1.5;
      }
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
  });
}

// ==================== CARGAR DATOS ====================

async function loadAllData() {
  try {
    console.log('📥 Cargando datos...');
    appState.predictions = await readPredictionsFromSheets();
    const worldcupData = await fetchWorldCupResults();
    appState.scores = calculateParticipantScores(appState.predictions, worldcupData);
    appState.participants = getRanking(appState.scores);
    await renderAllViews();
    initializeCharts();
    setupTooltips();
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

async function renderAllViews() {
  await renderGeneralTable();
  for (const phase of ['groups','round16','round8','quarters','semi','final']) {
    await renderPhase(phase);
  }
}

async function renderGeneralTable() {
  const tbody = document.querySelector('#general-table tbody');
  if (!appState.participants || appState.participants.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Sin datos disponibles</td></tr>';
    return;
  }

  tbody.innerHTML = appState.participants.map(p => `
    <tr>
      <td><strong>#${p.position}</strong></td>
      <td>${p.participant}</td>
      <td>${getFlag(p.team)} ${p.team || '-'}</td>
      <td>${p.groups}</td>
      <td>${p.round16}</td>
      <td>${p.round8}</td>
      <td>${p.quarters}</td>
      <td>${p.semi}</td>
      <td>${p.final}</td>
      <td><strong style="color:var(--primary-btn);font-size:1.1rem">${p.total}</strong></td>
    </tr>
  `).join('');

  // Populate participant datalists
  const names = appState.participants.map(p => p.participant).sort();
  for (const phaseId of ['groups','round16','round8','quarters','semi','final']) {
    const dl = document.querySelector(`#datalist-${phaseId}`);
    if (!dl) continue;
    dl.innerHTML = names.map(n => `<option value="${n}">`).join('');
  }
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
  const phaseName = PHASE_NAMES[phaseId];

  // Collect matches
  const matchesByNumber = {};
  for (const [participantName, scoreData] of Object.entries(appState.scores)) {
    for (const [, matchData] of Object.entries(scoreData.matches || {})) {
      if (matchData.phase && matchData.phase.includes(phaseName.split(' ')[0])) {
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

  if (allMatches.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="loading">Sin partidos en esta fase</td></tr>`;
    const tf = table.querySelector('tfoot');
    if (tf) tf.innerHTML = '';
    renderProgressIndicator(phaseId, []);
    return;
  }

  const participants = Object.keys(appState.scores).sort();
  if (selectedParticipant && participants.includes(selectedParticipant)) {
    participants.splice(participants.indexOf(selectedParticipant), 1);
    participants.unshift(selectedParticipant);
  }
  const isGroups = phaseId === 'groups';
  const numFixed = isGroups ? 3 : 2;

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
    const nameHtml  = lastName
      ? `<span style="display:block;line-height:1.2">${firstName}</span><span style="display:block;line-height:1.2">${lastName}</span>`
      : `<span style="display:block;line-height:1.2">${firstName}</span>`;
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
        const kickoff = new Date(`${matchDT.date}T${matchDT.time}:00`);
        const minutesElapsed = (Date.now() - kickoff.getTime()) / 60000;
        isLive = minutesElapsed >= 0 && minutesElapsed <= 105;
      }
    }

    const resultText = hasResult
      ? `<div class="result-scoreboard">
          <span class="rsb-side rsb-local">${flagL}<span class="rsb-name">${match.teamLocal}</span></span>
          <span class="rsb-goals"><strong>${match.result.goalsTeamA}</strong><span class="rsb-sep">–</span><strong>${match.result.goalsTeamB}</strong></span>
          <span class="rsb-side rsb-visitor"><span class="rsb-name">${match.teamVisitor}</span>${flagV}</span>
        </div>`
      : `<div class="result-scoreboard result-pending">
          <span class="rsb-side rsb-local">${flagL}<span class="rsb-name">${match.teamLocal}</span></span>
          <span class="rsb-goals" style="color:#aaa">vs</span>
          <span class="rsb-side rsb-visitor"><span class="rsb-name">${match.teamVisitor}</span>${flagV}</span>
        </div>`;
    const statusBadge = hasResult
      ? '<span class="status-badge finished">Finalizado</span>'
      : isLive
        ? '<span class="status-badge live">🔴 En Curso</span>'
        : '<span class="status-badge pending">Pendiente</span>';

    const groupCell = isGroups ? `<td class="sticky-col">${match.group || '-'}</td>` : '';

    const predsHtml = participants.map((p, i) => {
      const pred   = match.predictions[p];
      const colIdx = numFixed + i;
      const isHL     = selectedParticipant && p === selectedParticipant ? ' col-highlighted' : '';
            if (!pred || !pred.prediction || pred.prediction === 'NaN-NaN') {
        return `<td class="no-match${isHL}" data-colidx="${colIdx}">
          <span class="score-pill"><span class="pill-score">-</span><span class="pill-pts">0pts</span></span>
        </td>`;
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

  cardState[phaseId] = { matches: sortedMatches, index: 0 };
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
    const pred = match.predictions[p];
    if (!pred || !pred.prediction || pred.prediction === 'NaN-NaN') {
      return `<div class="card-pred-row no-match">
        <span class="card-pred-name">${p}</span>
        <span class="score-pill"><span class="pill-score">-</span><span class="pill-pts">0pts</span></span>
      </div>`;
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
      <a href="https://futbol-libres.su/" target="_blank" class="watch-link watch-link-card">📺 Ver partidos en vivo</a>
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
}

function renderCardGrid(phaseId, sortedMatches, participants, selectedParticipant) {
  const gridContainer = document.getElementById(`card-grid-${phaseId}`);
  const tableWrapper  = document.querySelector(`#${phaseId} .table-wrapper`);
  const isGrid = viewMode[phaseId] === 'grid';

  if (tableWrapper) tableWrapper.style.display = isGrid ? 'none' : '';
  if (!gridContainer) return;
  gridContainer.style.display = isGrid ? 'grid' : 'none';
  if (!isGrid) return;

  gridContainer.innerHTML = sortedMatches.map(match => {
    const hasResult = match.result != null &&
      match.result.goalsTeamA !== null && match.result.goalsTeamA !== undefined;
    const flagL = getFlag(match.teamLocal);
    const flagV = getFlag(match.teamVisitor);
    const score = hasResult
      ? `<strong>${match.result.goalsTeamA}-${match.result.goalsTeamB}</strong>`
      : '<span class="grid-vs-pending">vs</span>';
    const gridMatchDT = findMatchDateTime(match.teamLocal, match.teamVisitor);
    let gridIsLive = false;
    if (!hasResult && gridMatchDT && gridMatchDT.date && gridMatchDT.time) {
      const kickoff = new Date(`${gridMatchDT.date}T${gridMatchDT.time}:00`);
      const minutesElapsed = (Date.now() - kickoff.getTime()) / 60000;
      gridIsLive = minutesElapsed >= 0 && minutesElapsed <= 105;
    }
    const statusBadge = hasResult
      ? '<span class="status-badge finished">Finalizado</span>'
      : gridIsLive
        ? '<span class="status-badge live">🔴 En Curso</span>'
        : '<span class="status-badge pending">Pendiente</span>';

    const predsHtml = participants.map(p => {
      const pred  = match.predictions[p];
      const isHL  = selectedParticipant && p === selectedParticipant ? ' grid-hl' : '';
      if (!pred || !pred.prediction || pred.prediction === 'NaN-NaN') {
        return `<div class="grid-pred-row no-match${isHL}">
          <span class="grid-pred-name">${p}</span>
          <span class="score-pill"><span class="pill-score">-</span><span class="pill-pts">0pts</span></span>
        </div>`;
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
      <a href="https://futbol-libres.su/" target="_blank" class="watch-link watch-link-grid">📺 Ver partidos en vivo</a>
      <div class="grid-predictions">${predsHtml}</div>
    </div>`;
  }).join('');
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

