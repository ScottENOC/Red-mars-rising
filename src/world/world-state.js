// Scenario-owned initial conditions. These are today's starting assumptions, not permanent laws.
export function createInitialWorldState() {
  return {
    schemaVersion: 1,
    scenarioId: 'first-expedition-arrival',
    time: { sol: 0 },
    planet: { id: 'mars', meanDiameterKm: 6779, ageYears: 4_500_000_000 },
    terrain: {
      source: 'procedural-prototype',
      // Geological changes will be stored separately from the baseline elevation.
      geologicalModifications: []
    },
    climate: {
      // Descriptive initial values only; no climate simulation is implemented yet.
      meanSurfaceTemperatureC: -63,
      atmosphere: { pressurePa: 610, composition: 'present-day-approximation' }
    },
    surface: {
      ice: {
        // Persistent deposits and seasonally exchanged CO2 frost are separate state.
        // Extents are angular distances from each pole; these initial values remain provisional.
        residualCaps: {
          north: { extentDeg: 11.5, material: 'water-ice' },
          south: { extentDeg: 8.5, material: 'water-ice-and-residual-co2' }
        },
        seasonalFrost: {
          north: { maxExtentDeg: 30, material: 'co2-frost' },
          south: { maxExtentDeg: 40, material: 'co2-frost' }
        }
      }
    },
    // A modest, functioning settlement exists when play begins; people are not
    // individually assigned to jobs. Projects are constrained by capability,
    // equipment, materials, expertise, time and sponsor commitments instead.
    settlements: [
      {
        id: 'jezero-base',
        name: 'Jezero Base',
        kind: 'primary-colony',
        lat: 18.38,
        lon: 77.58,
        population: 100,
        status: 'operational',
        infrastructure: ['habitats', 'landing-pad', 'greenhouse', 'power-array', 'laboratory', 'workshop', 'rovers']
      }
    ],
    logistics: {
      // Illustrative transfer windows and payloads for the visual prototype.
      // Distances are compressed in the renderer and are not to scale.
      supplyShips: [
        { id: 'supply-ship-1', cargo: 'Construction robots', phase: 0.22, cycleSols: 52 },
        { id: 'supply-ship-2', cargo: 'Greenhouse modules', phase: 0.58, cycleSols: 67 },
        { id: 'supply-ship-3', cargo: 'Life-support spares', phase: 0.82, cycleSols: 59 }
      ]
    },
    celestialBodies: [
      { id: 'phobos', kind: 'moon', status: 'orbiting' },
      { id: 'deimos', kind: 'moon', status: 'orbiting' }
    ],
    events: [
      { type: 'scenario-start', sol: 0, description: 'The first expedition establishes its initial settlement.' }
    ]
  };
}

export function setResidualIceExtent(worldState, hemisphere, extentDeg) {
  if (!['north', 'south'].includes(hemisphere)) throw new Error('hemisphere must be north or south');
  if (!Number.isFinite(extentDeg) || extentDeg < 0 || extentDeg > 45) throw new Error('extentDeg must be between 0 and 45');
  worldState.surface.ice.residualCaps[hemisphere].extentDeg = extentDeg;
}

export function recordWorldEvent(worldState, event) {
  if (!event || typeof event.type !== 'string') throw new Error('World events require a type');
  worldState.events.push({ ...event, sol: event.sol ?? worldState.time.sol });
}
