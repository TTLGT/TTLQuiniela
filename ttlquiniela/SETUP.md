# 🚀 Guía de Setup — Quiniela Mundialista 2026

## ✅ Fase 1 Completada: Archivos Base

Tu proyecto ahora tiene la estructura base. Archivos creados:

- `index.html` — Estructura HTML con tabs y vistas
- `styles.css` — Estilos con paleta de marca TTL
- `config.js` — Configuración global (incluyendo API key)
- `app.js` — Lógica principal de navegación
- `sheets.js` — Lectura de Google Sheets (placeholder)
- `scores.js` — Lectura de resultados reales (placeholder)
- `scoring.js` — Motor de puntuación (placeholder)
- `charts.js` — Gráficas con Chart.js (placeholder)
- `equipos.js` — Data de equipos y participantes
- `teams.js` — Mapeo de nombres de equipos
- `inspect-sheets.js` — Script de inspección (fase 2)

---

## 🔑 Fase 2: Configurar Google Sheets API

### Paso 1: Crear un proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Click en el selector de proyecto (arriba a la izquierda)
3. Click en **"Nuevo Proyecto"**
4. Nombre: `Quiniela Mundialista 2026`
5. Click **"Crear"**

### Paso 2: Habilitar Google Sheets API

1. En Google Cloud Console, ve a **"APIs y Servicios"** → **"Biblioteca"**
2. Busca **"Google Sheets API"**
3. Click en el resultado
4. Click en **"HABILITAR"**

### Paso 3: Crear credencial (API Key)

1. Ve a **"APIs y Servicios"** → **"Credenciales"**
2. Click en **"+ CREAR CREDENCIALES"** → **"Clave de API"**
3. Se generará una key (algo como: `AIzaSyD...`)
4. Click en **"Restricciones de clave"**
5. En **"Restricción de aplicación"**, selecciona **"APIs HTTP"**
6. En **"Restricciones de API"**, selecciona **"Google Sheets API"**
7. Click **"Guardar"**

### Paso 4: Agregar la key a config.js

1. Abre el archivo `config.js` en tu editor
2. Busca la línea:
   ```js
   const GOOGLE_SHEETS_API_KEY = "TU_API_KEY_AQUI";
   ```
3. Reemplaza `'TU_API_KEY_AQUI'` con tu clave real:
   ```js
   const GOOGLE_SHEETS_API_KEY = "AIzaSyD..."; // Tu key aquí
   ```

### ⚠️ IMPORTANTE: Seguridad

- **NO** subas `config.js` a GitHub con la API key. Usa un archivo `.env` o `.gitignore` en producción.
- La key visible en el código fuente es un riesgo de seguridad.
- En desarrollo local está bien, pero para producción usa un backend seguro.

---

## 🔍 Fase 2 (continuación): Inspeccionar los Google Sheets

### Objetivo

Verificar la estructura **real** de columnas en ambos Google Sheets antes de construir los parsers.

### Cómo ejecutar

1. **Abre el navegador** y ve a tu archivo `index.html`:

   ```
   file:///c:/Users/erwin_totaltransport/Desktop/TTLQuiniela/ttlquiniela/index.html
   ```

2. **Abre la Consola del navegador**:
   - Presiona `F12` → Tab **"Console"**

3. **Ejecuta el script de inspección**:

   ```javascript
   inspectGoogleSheets();
   ```

4. **Revisa la salida en consola**. Deberías ver:

```
🔍 Iniciando inspección de Google Sheets...

📋 SHEET 1: Control Quiniela Mundialista
✅ Sheets disponibles en Control:
   [0] "Nombre de la pestaña 1" (ID: 1234567)
   [1] "Nombre de la pestaña 2" (ID: 1234568)

📊 Primeras 10 filas de "Nombre de la pestaña 1":
   Fila 1: [ 'Encabezado 1', 'Encabezado 2', ... ]
   ...

📋 SHEET 2: Copy of Pronostico Individual
✅ Sheets disponibles en Predicciones:
   [0] "Erwin" (ID: 9876543)
   [1] "David" (ID: 9876544)
   ...

📊 Primeras 15 filas de "Erwin":
   Fila 1: [ '#', 'Grupo', 'Equipo Local', 'Goles Local', 'Goles Visitante', 'Equipo Visitante' ]
   Fila 2: [ '1', 'A', 'Mexico', '2', '1', 'USA' ]
   ...

🌍 Verificando feed de resultados (worldcup.json)...
✅ Datos disponibles:
   Torneos: 1
   Nombre del torneo: World Cup 2026
   Equipos: 32
   Estadios: 12
   Rondas: 7

   Primeros 5 partidos:
   - Mexico vs USA (2026-06-12)
   - Argentina vs France (2026-06-13)
   ...

✅ Inspección completada
```

### Qué reportar después

Una vez ejecutes la inspección, recopila:

1. **Nombres exactos de las pestañas** en ambos sheets
2. **Estructura de columnas** en "Copy of Pronostico Individual":
   - ¿Las fases eliminatorias están en la misma pestaña que Grupos?
   - ¿Cuáles son los encabezados de columna para cada sección?
3. **Cualquier discrepancia** en nombres de equipos entre el feed y los sheets
4. **Errores de API** si los hay (falta permiso, key inválida, etc.)

---

## 📋 Checklist de Setup

- [ ] Crear proyecto en Google Cloud Console
- [ ] Habilitar Google Sheets API
- [ ] Crear API Key y restringirla a Google Sheets API
- [ ] Pegar API Key en `config.js`
- [ ] Abrir `index.html` en navegador
- [ ] Abrir Consola (F12)
- [ ] Ejecutar `inspectGoogleSheets()`
- [ ] Reportar estructura de datos para la siguiente fase

---

## ❓ Próximas Fases

Después de la inspección:

**Fase 3**: Implementar parsers (sheets.js)

- Leer predicciones de cada participante
- Normalizar datos en un modelo unificado

**Fase 4**: Leer resultados reales (scores.js)

- Descargar worldcup.json
- Mapear partidos con predicciones

**Fase 5**: Calcular puntuación (scoring.js)

- Aplicar reglas de puntuación
- Generar Tabla General

Y más...

---

## 🆘 Troubleshooting

### Error: "API Key no configurada"

**Solución**: Asegúrate de que `config.js` esté cargado ANTES que `inspect-sheets.js` en `index.html`.

### Error: "Falta configurar GOOGLE_SHEETS_API_KEY"

**Solución**: En `config.js`, reemplaza `'TU_API_KEY_AQUI'` con tu verdadera API key.

### Error: "quotaExceeded" o "rateLimitExceeded"

**Solución**: Espera unos minutos. Google tiene límites de rate, especialmente en nuevas keys.

### Error: "Access Denied" o "Forbidden"

**Solución**: Verifica que:

1. El Sheet sea público ("Compartir" → "Cualquiera con el enlace")
2. La API Key tenga habilitada "Google Sheets API"

### Los nombres de equipos no coinciden

**Solución**: Los warnings en consola te mostrarán qué nombres falta mapear. Agrega el mapeo a `teams.js` en `TEAM_NAME_MAP`.

---

¡Avísame cuando completes la inspección y comparte la salida de consola!
