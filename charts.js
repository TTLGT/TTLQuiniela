/* ============================================
   CHARTS.JS — Gráficas con Chart.js
   ============================================ */

let charts = {};

function initializeCharts() {
  console.log('📊 Inicializando gráficas...');

  const container = document.getElementById('charts-container');
  if (!container) {
    console.error('❌ No se encontró contenedor de gráficas');
    return;
  }

  // Limpiar gráficas previas
  container.innerHTML = '';

  // TODO: Implementar gráficas:
  // 1. Ranking de puntos (barras horizontales)
  // 2. Evolución por fase (líneas)
  // 3. Aciertos exactos vs ganador vs fallos (barras apiladas)
  // 4. Tendencia de goles (goles predichos vs reales)
}

function createRankingChart(scores) {
  // TODO: Gráfica de ranking
  console.log('📊 Creando gráfica de ranking...');
}

function createEvolutionChart(scores) {
  // TODO: Gráfica de evolución por fase
  console.log('📊 Creando gráfica de evolución...');
}

function createAccuracyChart(scores) {
  // TODO: Gráfica de aciertos
  console.log('📊 Creando gráfica de aciertos...');
}

function createGoalsChart(scores) {
  // TODO: Gráfica de goles
  console.log('📊 Creando gráfica de goles...');
}

console.log('✅ charts.js cargado');
