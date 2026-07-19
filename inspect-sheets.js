/* ============================================
   SCRIPT DE INSPECCIÓN DE GOOGLE SHEETS
   ============================================
   
   Este script temporal inspecciona ambos Google Sheets
   para verificar la estructura de datos.
   
   Uso: Pega este código en la consola del navegador
        (F12 → Console) para ejecutarlo.
*/

async function inspectGoogleSheets() {
  const API_KEY = GOOGLE_SHEETS_API_KEY;

  if (API_KEY === 'TU_API_KEY_AQUI') {
    console.error('❌ ERROR: Falta configurar GOOGLE_SHEETS_API_KEY en config.js');
    return;
  }

  console.log('%c🔍 Iniciando inspección de Google Sheets...', 'color: #041561; font-size: 14px; font-weight: bold;');

  // ==================== SHEET 1: CONTROL QUINIELA ====================
  console.log('\n%c📋 SHEET 1: Control Quiniela Mundialista', 'color: #CC0000; font-size: 12px; font-weight: bold;');

  try {
    const controlUrl = `${API_ENDPOINTS.SHEETS_API}/${SHEETS_CONFIG.CONTROL_SHEET}?key=${API_KEY}`;
    const controlResponse = await fetch(controlUrl);
    const controlData = await controlResponse.json();

    if (controlData.error) {
      console.error('❌ Error en Control Sheet:', controlData.error.message);
      console.log('   Verifica que:');
      console.log('   1. El GOOGLE_SHEETS_API_KEY sea correcto');
      console.log('   2. La API key tenga habilitada "Google Sheets API"');
      console.log('   3. El Sheet sea accesible públicamente');
    } else {
      console.log('✅ Sheets disponibles en Control:');
      controlData.sheets.forEach((sheet, idx) => {
        console.log(`   [${idx}] "${sheet.properties.title}" (ID: ${sheet.properties.sheetId})`);
      });

      // Leer primera pestaña
      if (controlData.sheets.length > 0) {
        const firstSheet = controlData.sheets[0].properties.title;
        const valuesUrl = `${API_ENDPOINTS.SHEETS_API}/${SHEETS_CONFIG.CONTROL_SHEET}/values/'${firstSheet}'!A1:Z50?key=${API_KEY}`;
        const valuesResponse = await fetch(valuesUrl);
        const valuesData = await valuesResponse.json();

        console.log(`\n📊 Primeras 10 filas de "${firstSheet}":`);
        if (valuesData.values) {
          valuesData.values.slice(0, 10).forEach((row, idx) => {
            console.log(`   Fila ${idx + 1}:`, row);
          });
        } else {
          console.log('   (Sin datos)');
        }
      }
    }
  } catch (error) {
    console.error('❌ Error fetching Control Sheet:', error);
  }

  // ==================== SHEET 2: PREDICCIONES ====================
  console.log('\n%c📋 SHEET 2: Copy of Pronostico Individual', 'color: #CC0000; font-size: 12px; font-weight: bold;');

  try {
    const predictionsUrl = `${API_ENDPOINTS.SHEETS_API}/${SHEETS_CONFIG.PREDICCIONES_SHEET}?key=${API_KEY}`;
    const predictionsResponse = await fetch(predictionsUrl);
    const predictionsData = await predictionsResponse.json();

    if (predictionsData.error) {
      console.error('❌ Error en Predicciones Sheet:', predictionsData.error.message);
    } else {
      console.log('✅ Sheets disponibles en Predicciones:');
      predictionsData.sheets.forEach((sheet, idx) => {
        console.log(`   [${idx}] "${sheet.properties.title}" (ID: ${sheet.properties.sheetId})`);
      });

      // Leer primeras 3 pestañas
      for (let i = 0; i < Math.min(3, predictionsData.sheets.length); i++) {
        const sheetName = predictionsData.sheets[i].properties.title;
        const valuesUrl = `${API_ENDPOINTS.SHEETS_API}/${SHEETS_CONFIG.PREDICCIONES_SHEET}/values/'${sheetName}'!A1:F50?key=${API_KEY}`;

        try {
          const valuesResponse = await fetch(valuesUrl);
          const valuesData = await valuesResponse.json();

          console.log(`\n📊 Primeras 15 filas de "${sheetName}":`);
          if (valuesData.values) {
            valuesData.values.slice(0, 15).forEach((row, idx) => {
              console.log(`   Fila ${idx + 1}:`, row);
            });
          } else {
            console.log('   (Sin datos)');
          }
        } catch (error) {
          console.error(`   ❌ Error leyendo "${sheetName}":`, error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error fetching Predicciones Sheet:', error);
  }

  // ==================== VERIFICAR WORLDCUP.JSON ====================
  console.log('\n%c🌍 Verificando feed de resultados (worldcup.json)...', 'color: #041561; font-size: 12px; font-weight: bold;');

  try {
    const wcResponse = await fetch(API_ENDPOINTS.WORLDCUP_JSON);
    const wcData = await wcResponse.json();

    console.log('✅ Datos disponibles:');
    console.log('   Torneos:', wcData.length);

    if (wcData.length > 0) {
      const tournament = wcData[0];
      console.log(`   Nombre del torneo: ${tournament.name}`);
      console.log(`   Equipos: ${tournament.teams.length}`);
      console.log(`   Estadios: ${tournament.stadiums.length}`);
      console.log(`   Rondas: ${tournament.rounds.length}`);

      // Mostrar primeros partidos
      console.log('\n   Primeros 5 partidos:');
      let matchCount = 0;
      for (const round of tournament.rounds) {
        for (const match of round.matches) {
          if (matchCount < 5) {
            console.log(`   - ${match.team1.name} vs ${match.team2.name} (${match.date || 'Sin fecha'})`);
            matchCount++;
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error fetching worldcup.json:', error);
  }

  console.log('\n%c✅ Inspección completada', 'color: #28a745; font-size: 12px; font-weight: bold;');
  console.log('Revisa los datos arriba e informa sobre la estructura de columnas en cada Sheet.');
}

// Nota: este script YA NO se ejecuta automáticamente al cargar la página —
// hacerlo duplicaba las llamadas a la Google Sheets API en cada carga (junto
// a la carga real de app.js/sheets.js) y provocaba errores 429 "Quota
// exceeded" que dejaban las tablas sin datos. Para inspeccionar los sheets,
// llama inspectGoogleSheets() manualmente desde la consola (F12).
