// Scenario-owned initial conditions. These are today's starting assumptions, not permanent laws.
export function createInitialWorldState() {
  return {
    schemaVersion: 1,
    scenarioId: 'present-day-mars-before-arrival',
    time: { sol: 0 },
    planet: { id: 'mars', meanDiameterKm: 6779 },
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
        // Ice extent is scenario state. Zero removes a cap; changing extent changes its rendered footprint.
        polarCaps: {
          north: { extentDeg: 11.5, material: 'water-ice-and-seasonal-frost' },
          south: { extentDeg: 8.5, material: 'water-ice-and-seasonal-frost' }
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

export function setPolarIceExtent(worldState, hemisphere, extentDeg) {
  if (!['north', 'south'].includes(hemisphere)) throw new Error('hemisphere must be north or south');
  if (!Number.isFinite(extentDeg) || extentDeg < 0 || extentDeg > 45) throw new Error('extentDeg must be between 0 and 45');
  worldState.surface.ice.polarCaps[hemisphere].extentDeg = extentDeg;
}

export function recordWorldEvent(worldState, event) {
  if (!event || typeof event.type !== 'string') throw new Error('World events require a type');
  worldState.events.push({ ...event, sol: event.sol ?? worldState.time.sol });
}
