// Scenario-owned initial conditions. The campaign is state-driven; renderers consume this state.
export function createInitialWorldState() {
  return {
    schemaVersion: 2,
    scenarioId: 'first-expedition-arrival',
    time: { sol: 0, year: 2027, solOfYear: 1, lastProcessedSol: 0 },
    planet: { id: 'mars', meanDiameterKm: 6779, ageYears: 4_500_000_000 },
    terrain: { source: 'procedural-prototype', geologicalModifications: [] },
    climate: {
      meanSurfaceTemperatureC: -63,
      atmosphere: { pressurePa: 610, composition: 'present-day-approximation', co2Fraction: 0.953, waterVapourPa: 0.03 },
      water: { accessibleIceIndex: 35, subsurfaceWaterIndex: 20, surfaceLiquidWaterKm3: 0, atmosphericWaterKg: 1e9 },
      energyBalance: { greenhouseWm2: 0, humanWasteHeatWm2: 0, radiativeLossWm2: 0 }, history: []
    },
    surface: { ice: {
      residualCaps: { north: { extentDeg: 11.5, material: 'water-ice' }, south: { extentDeg: 8.5, material: 'water-ice-and-residual-co2' } },
      seasonalFrost: { north: { maxExtentDeg: 30, material: 'co2-frost' }, south: { maxExtentDeg: 40, material: 'co2-frost' } }
    } },
    campaign: { started: false, startingLocationId: null, startingSponsorId: null, sponsorRelations: {}, sponsorPatience: 0, sponsorPressure: 0, reputation: 0, autonomy: 0, diplomaticIncidents: [], flags: [], supportYearsRemaining: 5 },
    sponsors: [], settlements: [], infrastructure: { routes: [], assets: [], projects: [] },
    logistics: { supplyShips: [
      { id: 'supply-ship-1', cargo: 'Construction robots', phase: 0.22, cycleSols: 52 },
      { id: 'supply-ship-2', cargo: 'Greenhouse modules', phase: 0.58, cycleSols: 67 },
      { id: 'supply-ship-3', cargo: 'Life-support spares', phase: 0.82, cycleSols: 59 }
    ] },
    celestialBodies: [{ id: 'phobos', kind: 'moon', status: 'orbiting' }, { id: 'deimos', kind: 'moon', status: 'orbiting' }],
    colonists: { population: 100, morale: 68, health: 82, science: 0, cumulativeWork: 0 },
    economy: { funds: 500, materials: 100, electronics: 35, machinery: 40, water: 100, powerCapacity: 120, powerDemand: 88 },
    events: [{ type: 'scenario-ready', sol: 0, description: 'The first expedition is ready to establish its settlement.' }]
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
