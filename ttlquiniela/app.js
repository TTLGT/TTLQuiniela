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
let sortState      = {};  // { tableId: { colIndex, direction } }
let pinnedCols     = {};  // { phaseId: participantName | null }
let collapsedGroups = {}; // { groupLetter: bool }

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
  'Australia': 'au', 'Qatar': 'qa', 'Arabia Saudita': 'sa',
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
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
      const section = document.getElementById(btn.getAttribute('data-tab'));
      if (section) section.classList.add('active');
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

  // Populate participant selectors
  const names = appState.participants.map(p => p.participant).sort();
  for (const phaseId of ['groups','round16','round8','quarters','semi','final']) {
    const sel = document.querySelector(`#participant-${phaseId}`);
    if (!sel) continue;
    const prev = sel.value;
    sel.innerHTML = '<option value="">Todos</option>' +
      names.map(n => `<option value="${n}"${n === prev ? ' selected' : ''}>${n}</option>`).join('');
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
  const isGroups = phaseId === 'groups';
  const numFixed = isGroups ? 5 : 4;

  // Apply search filter
  const search = (document.querySelector(`#search-${phaseId}`)?.value || '').toLowerCase().trim();
  const sortedMatches = search
    ? allMatches.filter(m =>
        (m.teamLocal  || '').toLowerCase().includes(search) ||
        (m.teamVisitor || '').toLowerCase().includes(search))
    : allMatches;

  // Build thead
  const thead = table.querySelector('thead tr');
  const pinned = pinnedCols[phaseId] || null;
  const st = sortState[tableId];

  const participantHeaders = participants.map((p, i) => {
    const colIdx = numFixed + i;
    const isHL     = selectedParticipant && p === selectedParticipant ? ' col-highlighted' : '';
    const isPinned = pinned === p ? ' col-pinned' : '';
    let sortCls = 'sortable';
    if (st && st.colIndex === colIdx) sortCls += st.direction === 'asc' ? ' sort-asc' : ' sort-desc';
    const sortIcon = (st && st.colIndex === colIdx)
      ? (st.direction === 'asc' ? '↑' : '↓') : '↕';
    return `<th class="${sortCls}${isHL}${isPinned}" data-colidx="${colIdx}" data-participant="${p}">
      ${p}
      <button class="pin-btn${pinned === p ? ' pinned' : ''}" title="Fijar columna"
        onclick="event.stopPropagation();togglePinColumn('${phaseId}','${p}')">📌</button>
      <span class="sort-icon">${sortIcon}</span>
    </th>`;
  }).join('');

  if (isGroups) {
    thead.innerHTML = `
      <th class="sticky-col">Partido</th>
      <th class="sticky-col">Grupo</th>
      <th class="sticky-col">Local</th>
      <th class="sticky-col">Visitante</th>
      <th class="sticky-col">Resultado Real</th>
      ${participantHeaders}`;
  } else {
    thead.innerHTML = `
      <th class="sticky-col">Partido</th>
      <th class="sticky-col">Local</th>
      <th class="sticky-col">Visitante</th>
      <th class="sticky-col">Resultado Real</th>
      ${participantHeaders}`;
  }

  // Build tbody
  let html = '';
  let currentGroup = null;
  const totalCols = numFixed + participants.length;

  for (const match of sortedMatches) {
    // Collapsible group header row
    if (isGroups && match.group && match.group !== currentGroup) {
      currentGroup = match.group;
      const isCollapsed = collapsedGroups[currentGroup] ? ' collapsed' : '';
      html += `
        <tr class="group-header-row${isCollapsed}" data-group="${currentGroup}"
            onclick="toggleGroup('${currentGroup}','${tableId}')">
          <td colspan="${totalCols}">
            <span class="group-toggle-icon">▼</span> Grupo ${currentGroup}
          </td>
        </tr>`;
    }

    const hasResult = match.result != null &&
      match.result.goalsTeamA !== null && match.result.goalsTeamA !== undefined &&
      match.result.goalsTeamB !== null && match.result.goalsTeamB !== undefined;

    const resultText = hasResult
      ? `<strong>${match.result.goalsTeamA}-${match.result.goalsTeamB}</strong>`
      : '<span style="color:#999">-</span>';
    const statusBadge = hasResult
      ? '<span class="status-badge finished">Finalizado</span>'
      : '<span class="status-badge pending">Pendiente</span>';

    const groupRowAttr  = isGroups ? ` data-group="${match.group}"` : '';
    const groupHidden   = isGroups && collapsedGroups[match.group] ? ' hidden' : '';
    const groupCell     = isGroups ? `<td class="sticky-col">${match.group || '-'}</td>` : '';
    const flagL = getFlag(match.teamLocal);
    const flagV = getFlag(match.teamVisitor);

    const predsHtml = participants.map((p, i) => {
      const pred   = match.predictions[p];
      const colIdx = numFixed + i;
      const isHL     = selectedParticipant && p === selectedParticipant ? ' col-highlighted' : '';
      const isPinned = pinned === p ? ' col-pinned' : '';

      if (!pred || !pred.prediction || pred.prediction === 'NaN-NaN') {
        return `<td class="no-match${isHL}${isPinned}" data-colidx="${colIdx}">
          <span class="score-pill"><span class="pill-score">-</span><span class="pill-pts">0pts</span></span>
        </td>`;
      }

      const actual  = hasResult ? `${match.result.goalsTeamA}-${match.result.goalsTeamB}` : 'Sin resultado';
      const tip     = `Pronóstico: ${pred.prediction} | Real: ${actual} | +${pred.points}pts`;

      return `<td class="${pred.type}${isHL}${isPinned}" data-colidx="${colIdx}" data-tooltip="${tip}">
        <span class="score-pill">
          <span class="pill-score">${pred.prediction}</span>
          <span class="pill-pts">${pred.points}pts</span>
        </span>
      </td>`;
    }).join('');

    html += `
      <tr class="group-data-row${groupHidden}"${groupRowAttr}>
        <td class="sticky-col">${match.id}</td>
        ${groupCell}
        <td class="sticky-col">${flagL} ${match.teamLocal}</td>
        <td class="sticky-col">${flagV} ${match.teamVisitor}</td>
        <td class="sticky-col"><div class="result-cell">${resultText}${statusBadge}</div></td>
        ${predsHtml}
      </tr>`;
  }

  tbody.innerHTML = html || `<tr><td colspan="${totalCols}" class="loading">Sin datos</td></tr>`;

  // Running total tfoot
  let tfoot = table.querySelector('tfoot');
  if (!tfoot) { tfoot = document.createElement('tfoot'); table.appendChild(tfoot); }

  const totalCells = participants.map((p, i) => {
    const colIdx   = numFixed + i;
    const isHL     = selectedParticipant && p === selectedParticipant ? ' col-highlighted' : '';
    const isPinned = pinned === p ? ' col-pinned' : '';
    const pts      = appState.scores[p]?.[phaseId] ?? 0;
    return `<td class="${isHL}${isPinned}" data-colidx="${colIdx}"><strong>${pts}pts</strong></td>`;
  }).join('');

  const fixedFooter = isGroups
    ? `<td class="sticky-col"><strong>TOTAL</strong></td><td class="sticky-col"></td><td class="sticky-col"></td><td class="sticky-col"></td><td class="sticky-col"></td>`
    : `<td class="sticky-col"><strong>TOTAL</strong></td><td class="sticky-col"></td><td class="sticky-col"></td><td class="sticky-col"></td>`;

  tfoot.innerHTML = `<tr>${fixedFooter}${totalCells}</tr>`;

  // Apply sticky left widths, setup sortable headers, render progress + cards
  applyStickyColumns(tableId, numFixed);
  setupSortableHeaders(tableId, participants, numFixed, sortedMatches, phaseId);
  renderProgressIndicator(phaseId, allMatches);
  renderPhaseCards(phaseId, sortedMatches, participants);
}

// ==================== STICKY COLUMNS ====================

function applyStickyColumns(tableId, numCols) {
  requestAnimationFrame(() => {
    const table = document.getElementById(tableId);
    if (!table) return;
    const headerCells = Array.from(table.querySelectorAll('thead tr th'));
    if (!headerCells.length) return;

    let leftOffset = 0;
    for (let i = 0; i < Math.min(numCols, headerCells.length); i++) {
      const w = headerCells[i].offsetWidth;
      table.querySelectorAll(
        `thead tr th:nth-child(${i+1}), tbody tr td:nth-child(${i+1}), tfoot tr td:nth-child(${i+1})`
      ).forEach(cell => { cell.style.left = `${leftOffset}px`; });
      leftOffset += w;
    }
  });
}

// ==================== COLLAPSIBLE GROUPS ====================

function toggleGroup(groupLetter, tableId) {
  collapsedGroups[groupLetter] = !collapsedGroups[groupLetter];
  const table = document.getElementById(tableId);
  if (!table) return;
  table.querySelector(`.group-header-row[data-group="${groupLetter}"]`)
    ?.classList.toggle('collapsed', !!collapsedGroups[groupLetter]);
  table.querySelectorAll(`tr.group-data-row[data-group="${groupLetter}"]`)
    .forEach(row => row.classList.toggle('hidden', !!collapsedGroups[groupLetter]));
}

// ==================== SORTABLE COLUMNS ====================

function setupSortableHeaders(tableId, participants, numFixed, sortedMatches, phaseId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  table.querySelectorAll('thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const colIdx = parseInt(th.dataset.colidx);
      if (isNaN(colIdx)) return;
      const cur = sortState[tableId] || {};
      const dir = (cur.colIndex === colIdx && cur.direction === 'desc') ? 'asc' : 'desc';
      sortState[tableId] = { colIndex: colIdx, direction: dir };

      // Update icons
      table.querySelectorAll('thead th.sortable').forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
        const icon = h.querySelector('.sort-icon');
        if (icon) icon.textContent = '↕';
      });
      th.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');
      const icon = th.querySelector('.sort-icon');
      if (icon) icon.textContent = dir === 'asc' ? '↑' : '↓';

      // Sort data rows
      const tbody = table.querySelector('tbody');
      const rows  = Array.from(tbody.querySelectorAll('tr.group-data-row'));
      rows.sort((a, b) => {
        const aCell = a.querySelector(`td[data-colidx="${colIdx}"]`);
        const bCell = b.querySelector(`td[data-colidx="${colIdx}"]`);
        const aVal  = parseInt(aCell?.querySelector('.pill-pts')?.textContent) || 0;
        const bVal  = parseInt(bCell?.querySelector('.pill-pts')?.textContent) || 0;
        return dir === 'desc' ? bVal - aVal : aVal - bVal;
      });

      // Re-insert rows (group header rows stay in place)
      rows.forEach(row => tbody.appendChild(row));
    });
  });
}

// ==================== COLUMN PINNING ====================

function togglePinColumn(phaseId, participantName) {
  pinnedCols[phaseId] = pinnedCols[phaseId] === participantName ? null : participantName;
  renderPhase(phaseId);
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
  const statusBadge = hasResult
    ? '<span class="status-badge finished" style="display:block;text-align:center;margin:0.3rem 0">Finalizado</span>'
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

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Inicializando Quiniela Mundialista 2026...');
  initDarkMode();
  setupNavigation();
  setupDOM();
  await loadAllData();
});

console.log('✅ app.js cargado');
