/* ============================================
   EQUIPOS Y PARTICIPANTES
   ============================================ */

// Asignación de equipos a participantes
const EQUIPOS = {
  "Alemania": ["Joe Ayala", "Kevin Romero", "Mary Gaytan"],
  "Argentina": ["Bryan Guerra", "Charly Molina", "Edvin Paredes", "Gus Mendez",
                "Isabel Ortiz", "Jose Ruano", "Jose Romero", "Josue Suazo",
                "Karen Molina", "Nery Molina", "Nery Mendez"],
  "Brasil": ["Edduar Gudiel", "Marvin Linares", "Paul Bats"],
  "Croacia": ["Gabe Mendez"],
  "España": ["Alexis Garcia", "Oliver Centeno"],
  "Francia": ["Saul Escobar"],
  "Paises Bajos": ["David Molina"],
  "Mexico": ["Erwin Solorzano", "Juan Diaz"],
  "USA": ["James Peña"]
};

// Función auxiliar para obtener el equipo de un participante
function getTeamForParticipant(participantName) {
  for (const [team, participants] of Object.entries(EQUIPOS)) {
    if (participants.includes(participantName)) {
      return team;
    }
  }
  return null;
}

// Función para obtener todos los participantes únicos
function getAllParticipants() {
  const participants = new Set();
  for (const team in EQUIPOS) {
    EQUIPOS[team].forEach(p => participants.add(p));
  }
  return Array.from(participants).sort();
}

console.log('✅ Equipos cargados:', Object.keys(EQUIPOS).length, 'equipos');
