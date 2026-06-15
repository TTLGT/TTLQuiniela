/* ============================================
   APP.JS — Lógica Principal de la Aplicación
   ============================================ */

// Estado global de la app
let appState = {
  participants: [],
  matches: {},
  predictions: {},
  results: {},
  scores: {},
  selectedParticipant: localStorage.getItem('selectedParticipant') || '',
  lastUpdated: null
};

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Inicializando Quiniela Mundialista 2026...');

  // Setup de navegación
  setupNavigation();

  // Cargar datos iniciales
  await loadAllData();
});

// ==================== NAVEGACIÓN ====================

function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remover clase active de todos los botones
      navButtons.forEach(b => b.classList.remove('active'));
      // Agregar active al botón clickeado
      btn.classList.add('active');

      // Ocultar todas las secciones
      document.querySelectorAll('section').forEach(section => {
        section.classList.remove('active');
      });

      // Mostrar la sección correspondiente
      const tabId = btn.getAttribute('data-tab');
      const section = document.getElementById(tabId);
      if (section) {
        section.classList.add('active');
      }
    });
  });
}

// ==================== CARGAR DATOS ====================

async function loadAllData() {
  try {
    console.log('📥 Cargando datos...');

    // Paso 1: Obtener predicciones de Google Sheets
    console.log('  1️⃣ Leyendo predicciones...');
    appState.predictions = await readPredictionsFromSheets();

    // Paso 2: Obtener resultados reales
    console.log('  2️⃣ Leyendo resultados reales...');
    const worldcupData = await fetchWorldCupResults();

    // Paso 3: Calcular puntuación
    console.log('  3️⃣ Calculando puntuación...');
    appState.scores = calculateParticipantScores(appState.predictions, worldcupData);
    appState.participants = getRanking(appState.scores);

    // Paso 4: Renderizar datos
    console.log('  4️⃣ Renderizando interfaz...');
    await renderAllViews();

    // Paso 5: Mostrar gráficas
    console.log('  5️⃣ Generando gráficas...');
    initializeCharts();

    console.log('✅ Datos cargados exitosamente');
    appState.lastUpdated = new Date();
  } catch (error) {
    console.error('❌ Error cargando datos:', error);
    showError('Error al cargar los datos. Verifica la consola (F12) para más detalles.');
  }
}

// ==================== REFRESH ====================

async function refreshResults() {
  try {
    const btn = document.getElementById('refresh-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Actualizando...';

    // Recargar datos
    await loadAllData();

    // Mostrar feedback
    showSuccess('✅ Resultados actualizados correctamente');

    // Restaurar botón
    btn.disabled = false;
    btn.textContent = '🔄 Actualizar Resultados';
  } catch (error) {
    console.error('❌ Error actualizando:', error);
    showError('Error al actualizar los resultados.');
    document.getElementById('refresh-btn').disabled = false;
    document.getElementById('refresh-btn').textContent = '🔄 Actualizar Resultados';
  }
}

// ==================== RENDERIZADO ====================

async function renderAllViews() {
  try {
    // Renderizar Tabla General
    await renderGeneralTable();

    // Renderizar vistas por fase
    await renderPhase('groups');
    await renderPhase('round16');
    await renderPhase('round8');
    await renderPhase('quarters');
    await renderPhase('semi');
    await renderPhase('final');
  } catch (error) {
    console.error('❌ Error renderizando vistas:', error);
  }
}

async function renderGeneralTable() {
  console.log('  📊 Renderizando Tabla General...');
  const tbody = document.querySelector('#general-table tbody');

  if (!appState.participants || appState.participants.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Sin datos disponibles</td></tr>';
    return;
  }

  let html = '';

  for (const participant of appState.participants) {
    const teamStatus = getTeamStatus(participant.team); // 🟢 o 🔴
    
    html += `
      <tr>
        <td><strong>#${participant.position}</strong></td>
        <td>${participant.participant} ${teamStatus}</td>
        <td>${participant.team || '-'}</td>
        <td>${participant.groups}</td>
        <td>${participant.round16}</td>
        <td>${participant.round8}</td>
        <td>${participant.quarters}</td>
        <td>${participant.semi}</td>
        <td>${participant.final}</td>
        <td><strong style="color: var(--primary-btn); font-size: 1.1rem;">${participant.total}</strong></td>
      </tr>
    `;
  }

  tbody.innerHTML = html;

  // Populate participant selectors para ver stats individuales
  const phases = ['groups', 'round16', 'round8', 'quarters', 'semi', 'final'];
  const participants = appState.participants.map(p => p.participant).sort();

  for (const phase of phases) {
    const select = document.querySelector(`#participant-${phase}`);
    if (select) {
      select.innerHTML = '<option value="">Todos</option>';
      for (const name of participants) {
        select.innerHTML += `<option value="${name}">${name}</option>`;
      }
    }
  }
}

function getTeamStatus(teamName) {
  // TODO: Verificar si el equipo está eliminado
  // Comparar con los resultados de worldcup.json
  // Por ahora retornar 🟢 (activo)
  return '🟢';
}

async function renderPhase(phaseId) {
  console.log(`  📊 Renderizando fase: ${phaseId}...`);

  const tableId = `${phaseId}-table`;
  const table = document.querySelector(`#${tableId}`);
  if (!table) return;

  const tbody = table.querySelector('tbody');
  const selectedParticipant = document.querySelector(`#participant-${phaseId}`)?.value;

  // Mapeo de phaseId a nombre de fase para el sheet
  const phaseNameMap = {
    'groups': 'FASE DE GRUPOS',
    'round16': 'DIECISEISAVOS',
    'round8': 'OCTAVOS',
    'quarters': 'CUARTOS',
    'semi': 'SEMIFINAL',
    'final': 'FINAL'
  };

  const phaseName = phaseNameMap[phaseId];
  let html = '';

  // Recolectar todos los partidos de esta fase
  const matchesByNumber = {};

  for (const [participantName, scoreData] of Object.entries(appState.scores)) {
    for (const [matchKey, matchData] of Object.entries(scoreData.matches || {})) {
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

  // Renderizar tabla
  const sortedMatches = Object.values(matchesByNumber).sort((a, b) => a.id - b.id);

  if (sortedMatches.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Sin partidos en esta fase</td></tr>';
    return;
  }

  // Encabezados dinámicos con nombre de cada participante
  const participants = Object.keys(appState.scores).sort();
  const headersHtml = participants.map(p => `<th>${p}</th>`).join('');

  // Regenerar encabezados siempre (incluyendo grupos que tiene columna Grupo extra)
  const thead = table.querySelector('thead tr');
  if (phaseId === 'groups') {
    thead.innerHTML = `
      <th>Partido</th>
      <th>Grupo</th>
      <th>Local</th>
      <th>Visitante</th>
      <th>Resultado Real</th>
      ${headersHtml}
    `;
  } else {
    thead.innerHTML = `
      <th>Partido</th>
      <th>Local</th>
      <th>Visitante</th>
      <th>Resultado Real</th>
      ${headersHtml}
    `;
  }

  for (const match of sortedMatches) {
    const resultHtml = match.result
      ? `${match.result.goalsTeamA}-${match.result.goalsTeamB}`
      : '<span style="color: #999;">-</span>';

    const groupCell = phaseId === 'groups' ? `<td>${match.group || '-'}</td>` : '';

    const predictionsHtml = participants.map(participant => {
      const pred = match.predictions[participant];
      if (!pred || pred.prediction === 'NaN-NaN') return '<td>-</td>';

      const className = pred.type;
      const predText = `${pred.prediction} <strong>${pred.points}pts</strong>`;
      return `<td class="${className}">${predText}</td>`;
    }).join('');

    html += `
      <tr>
        <td>${match.id}</td>
        ${groupCell}
        <td>${match.teamLocal}</td>
        <td>${match.teamVisitor}</td>
        <td><strong>${resultHtml}</strong></td>
        ${predictionsHtml}
      </tr>
    `;
  }

  tbody.innerHTML = html || '<tr><td colspan="10" class="loading">Sin datos</td></tr>';
}

// ==================== NAVEGACIÓN DE TARJETAS ====================

function nextCard(phase) {
  // TODO: Implementar navegación
  console.log('Siguiente tarjeta:', phase);
}

function previousCard(phase) {
  // TODO: Implementar navegación
  console.log('Tarjeta anterior:', phase);
}

// ==================== MENSAJES ====================

function showError(message) {
  const errorDiv = document.getElementById('general-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
}

function showSuccess(message) {
  const successDiv = document.getElementById('general-success');
  if (successDiv) {
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => {
      successDiv.style.display = 'none';
    }, 5000);
  }
}

console.log('✅ app.js cargado');
