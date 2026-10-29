// Scenario-owned initial conditions. These are today's starting assumptions, not permanent laws.
export function createInitialWorldState() {
  return {
    schemaVersion: 1,
    scenarioId: 'present-day-mars-before-arrival',
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
    celestialBodies: [
      { id: 'phobos', kind: 'moon', status: 'orbiting' },
      { id: 'deimos', kind: 'moon', status: 'orbiting' }
    ],
    events: []
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
