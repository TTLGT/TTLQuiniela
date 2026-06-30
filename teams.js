/* ============================================
   MAPEO DE NOMBRES DE EQUIPOS
   ============================================ */

// Mapeo bidireccional: feed names Y sheet names -> app names
// Clave: cualquier nombre (del feed o del sheet), Valor: nombre normalizado en la app
const TEAM_NAME_MAP = {
  // América del Norte
  "Mexico": "Mexico",
  "México": "Mexico",
  "United States": "USA",
  "USA": "USA",
  "Canada": "Canada",

  // América del Sur
  "Argentina": "Argentina",
  "Brazil": "Brasil",
  "Brasil": "Brasil",
  "Brasil ": "Brasil",
  "Uruguay": "Uruguay",
  "Paraguay": "Paraguay",
  "Colombia": "Colombia",
  "Ecuador": "Ecuador",
  "Peru": "Peru",
  "Venezuela": "Venezuela",
  "Chile": "Chile",
  "Bolivia": "Bolivia",

  // Europa Occidental
  "Spain": "España",
  "España": "España",
  "Portugal": "Portugal",
  "France": "Francia",
  "Francia": "Francia",
  "Germany": "Alemania",
  "Alemania": "Alemania",
  "Netherlands": "Paises Bajos",
  "Paises Bajos": "Paises Bajos",
  "Países Bajos": "Paises Bajos",
  "Belgium": "Belgica",
  "Belgica": "Belgica",
  "Italy": "Italia",
  "Switzerland": "Suiza",
  "Suiza": "Suiza",
  "Austria": "Austria",
  "Czech Republic": "República Checa",
  "Chequia": "República Checa",
  "Republica Checa": "República Checa",
  "República Checa": "República Checa",
  "Poland": "Polonia",
  "England": "Inglaterra",
  "Inglaterra": "Inglaterra",
  "Scotland": "Escocia",
  "Escocia": "Escocia",
  "Wales": "Gales",
  "Ireland": "Irlanda",
  "Northern Ireland": "Irlanda del Norte",

  // Europa del Este
  "Ukraine": "Ucrania",
  "Russia": "Rusia",
  "Belarus": "Bielorusia",
  "Hungary": "Hungria",
  "Romania": "Rumania",
  "Serbia": "Serbia",
  "Croatia": "Croacia",
  "Croacia": "Croacia",
  "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  "Bosnia & Herzegovina": "Bosnia y Herzegovina",
  "Bosnia y Herzegovina": "Bosnia y Herzegovina",
  "Albania": "Albania",
  "Greece": "Grecia",
  "Bulgaria": "Bulgaria",
  "Slovakia": "Eslovaquia",
  "Slovenia": "Eslovenia",

  // Asia
  "Japan": "Japon",
  "Japon": "Japon",
  "South Korea": "Corea del Sur",
  "Corea del Sur": "Corea del Sur",
  "China": "China",
  "India": "India",
  "Iran": "Iran",
  "Saudi Arabia": "Arabia Saudita",
  "Arabia Saudita": "Arabia Saudita",
  "United Arab Emirates": "Emiratos Arabes",
  "Emiratos Arabes": "Emiratos Arabes",
  "Australia": "Australia",
  "New Zealand": "Nueva Zelanda",
  "Nueva Zelanda": "Nueva Zelanda",
  "Thailand": "Tailandia",
  "Vietnam": "Vietnam",
  "Singapore": "Singapur",
  "Qatar": "Qatar",
  "Curaçao": "Curazao",
  "Curacao": "Curazao",
  "Curaçao ": "Curazao",
  "Uzbekistan": "Uzbekistan",
  "Iraq": "Irak",
  "Irak": "Irak",

  // África
  "Egypt": "Egipto",
  "Egipto": "Egipto",
  "Morocco": "Marruecos",
  "Marruecos": "Marruecos",
  "Algeria": "Argelia",
  "Argelia": "Argelia",
  "Tunisia": "Tunez",
  "Tunez": "Tunez",
  "Senegal": "Senegal",
  "Cameroon": "Camerun",
  "Camerun": "Camerun",
  "Ghana": "Ghana",
  "Nigeria": "Nigeria",
  "South Africa": "Sudafrica",
  "Sudafrica": "Sudafrica",
  "Ivory Coast": "Costa de Marfil",
  "Costa de Marfil": "Costa de Marfil",
  "Kenya": "Kenia",
  "Cape Verde": "Cabo Verde",
  "Cabo Verde": "Cabo Verde",
  "Congo DR": "RD del Congo",
  "RD Congo": "RD del Congo",
  "DR Congo": "RD del Congo",
  "RD del Congo": "RD del Congo",
  "Congo, DR": "RD del Congo",
  "Rep. Dem. del Congo": "RD del Congo",
  "Congo DR ": "RD del Congo",
  "Congo": "RD del Congo",
  "Democratic Republic of Congo": "RD del Congo",
  "D.R. Congo": "RD del Congo",
  "Haiti": "Haiti",
  "Panama": "Panama",
  "Costa Rica": "Costa Rica",
  "Jamaica": "Jamaica",
  "Curacao": "Curazao",
  "Curazao": "Curazao",
  "Honduras": "Honduras",
  "Jordan": "Jordania",
  "Jordania": "Jordania",
  "Norway": "Noruega",
  "Noruega": "Noruega",
  "Sweden": "Suecia",
  "Suecia": "Suecia",
  "Turkey": "Turquia",
  "Turquia": "Turquia",
};

// Función para normalizar nombres de equipos
// Intenta encontrar el equivalente en TEAM_NAME_MAP
function normalizeTeamName(teamNameFromFeed) {
  if (!teamNameFromFeed) return null;

  const trimmed = (teamNameFromFeed || '').trim();

  // Búsqueda exacta
  if (TEAM_NAME_MAP[trimmed]) {
    return TEAM_NAME_MAP[trimmed];
  }

  // Búsqueda case-insensitive
  for (const [key, value] of Object.entries(TEAM_NAME_MAP)) {
    if (key.toLowerCase() === trimmed.toLowerCase()) {
      return value;
    }
  }

  // Si no encuentra coincidencia, loguea una advertencia
  console.warn(
    `⚠️ Nombre de equipo no mapeado: "${trimmed}". Agregarlo a TEAM_NAME_MAP en teams.js`
  );

  // Retorna el nombre original como fallback
  return trimmed;
}

console.log('✅ Mapeo de equipos cargado:', Object.keys(TEAM_NAME_MAP).length, 'equipos en el mapeo');
