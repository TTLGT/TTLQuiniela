/* ============================================
   CHARTS.JS — Inicialización de Gráficas
   Delegated to stats.js after data loads.
   ============================================ */

let charts = {};

function initializeCharts() {
  // The general-tab widgets (points gap, max possible) are rendered by
  // renderGeneralWidgets() inside renderStats(), which is called from
  // loadAllData() right after this function. Nothing to do here.
  console.log('📊 Charts init — delegated to stats.js');
}

console.log('✅ charts.js cargado');
