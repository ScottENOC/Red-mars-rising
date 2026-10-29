// Scenario-owned initial conditions. The campaign is state-driven; renderers consume this state.
export function createInitialWorldState() {
  return {
    schemaVersion: 2,
    scenarioId: 'first-expedition-arrival',
    time: { sol: 0, year: 2027, solOfYear: 1, lastProcessedSol: 0 },
    planet: { id: 'mars', meanDiameterKm: 6779, ageYears: 4_500_000_000 },
    terrain: { source: 'procedural-prototype', geologicalModifications: [] },
    climate: {
      meanSurfaceTemperatureC: -63, referenceMeanTemperatureC: -63,
      atmosphere: { pressurePa: 610, composition: 'present-day-approximation', co2Fraction: 0.953, waterVapourPa: 0.03 },
      water: { accessibleIceIndex: 35, subsurfaceWaterIndex: 20, surfaceLiquidWaterKm3: 0, atmosphericWaterKg: 1e9 },
      energyBalance: { greenhouseWm2: 0, humanWasteHeatWm2: 0, radiativeLossWm2: 0 }, history: []
    },
    surface: { ice: {
      residualCaps: { north: { extentDeg: 11.5, material: 'water-ice' }, south: { extentDeg: 8.5, material: 'water-ice-and-residual-co2' } },
      seasonalFrost: { north: { maxExtentDeg: 30, material: 'co2-frost' }, south: { maxExtentDeg: 40, material: 'co2-frost' } }
    } },
    campaign: { started: false, startingLocationId: null, startingSponsorId: null, sponsorRelations: {}, sponsorPatience: 0, sponsorPressure: 0, reputation: 0, autonomy: 0, diplomaticIncidents: [], flags: [], supportYearsRemaining: 5 },
    sponsors: [], settlements: [],
    shortlistedSites: [],
    pointsOfInterest: [
      {id:'mars-relay-1',name:'Mars Relay A',kind:'mars-orbit-comms',status:'operational',orbitPhase:0.08,description:'Communications and navigation relay; future target for hacking or destruction.'},
      {id:'mars-relay-2',name:'Mars Relay B',kind:'mars-orbit-comms',status:'operational',orbitPhase:0.37,description:'Second communications relay for partial coverage redundancy.'},
      {id:'mars-relay-3',name:'Mars Relay C',kind:'mars-orbit-comms',status:'operational',orbitPhase:0.68,description:'Third relay in the communications constellation.'},
      {id:'mars-relay-4',name:'Mars Relay D',kind:'mars-orbit-comms',status:'operational',orbitPhase:0.18,description:'Fourth relay in the communications constellation.'},
      {id:'mars-relay-5',name:'Mars Relay E',kind:'mars-orbit-comms',status:'operational',orbitPhase:0.49,description:'Fifth relay in the communications constellation.'},
      {id:'mars-relay-6',name:'Mars Relay F',kind:'mars-orbit-comms',status:'operational',orbitPhase:0.82,description:'Sixth relay in the communications constellation.'},
      {id:'mro',name:'Mars Reconnaissance Orbiter',kind:'mars-orbit-science',status:'operational',orbitPhase:0.12,description:'Legacy high-resolution imaging and communications spacecraft in this scenario.'},
      {id:'tgo',name:'ExoMars Trace Gas Orbiter',kind:'mars-orbit-science',status:'operational',orbitPhase:0.42,description:'Atmospheric science and relay spacecraft.'},
      {id:'odyssey',name:'Mars Odyssey',kind:'mars-orbit-science',status:'operational',orbitPhase:0.73,description:'Legacy mapping and relay spacecraft; assumed still operational in this alternate timeline.'},
      {id:'perseverance',name:'Perseverance Rover',kind:'mars-surface-robotic',status:'operational',lat:18.44,lon:77.45,description:'Legacy robotic rover at Jezero; no crewed base is implied.'},
      {id:'curiosity',name:'Curiosity Rover',kind:'mars-surface-robotic',status:'operational',lat:-5.4,lon:137.8,description:'Legacy robotic rover in Gale crater.'},
      {id:'zhurong',name:'Zhurong Rover',kind:'mars-surface-robotic',status:'inactive',lat:25.1,lon:109.9,description:'Inactive legacy Chinese rover; retained as a historical surface asset.'},
      {id:'mars-weather',name:'Mars Weather Orbiter',kind:'mars-orbit-science',status:'operational',orbitPhase:0.84,description:'Dust-storm and atmospheric observations.'},
      {id:'mars-crewship',name:'Ares Transfer Vehicle',kind:'mars-orbit-vehicle',status:'orbiting',orbitPhase:0.53,description:'Crew transfer vehicle remains in Mars orbit as a return vehicle and emergency refuge.'},
      {id:'phobos-station',name:'Phobos Survey Package',kind:'mars-orbit-science',status:'operational',orbitPhase:0.21,description:'Robotic survey package associated with Phobos; no crewed moon base.'},
      {id:'earth-mars-comms',name:'Earth–Mars Deep Space Network',kind:'earth-comms',status:'operational',description:'Ground antennas and relay links on Earth; light-time delays still apply.'},
      {id:'iss-expanded',name:'ISS Logistics Extension',kind:'earth-orbit-station',status:'operational',description:'Expanded orbital assembly and life-support test facility in this mild alternate history, not a direct launch slingshot.'},
      {id:'lunar-relay',name:'Lunar Communications Relay',kind:'lunar-relay',status:'operational',description:'Relay in lunar orbit supporting Earth-side deep-space communications and navigation.'}
    ],
    infrastructure: { routes: [], assets: [], projects: [] },
    logistics: { plannedCargoDrops: [
      {id:'cargo-drop-esa',sponsorId:'esa',sponsorName:'ESA',siteId:'utopia',siteName:'Utopia Planitia',arrivalSol:45,status:'scheduled',cargo:'Power and life-support cargo'},
      {id:'cargo-drop-cnsa',sponsorId:'cnsa',sponsorName:'CNSA',siteId:'deuteronilus',siteName:'Deuteronilus Mensae',arrivalSol:95,status:'scheduled',cargo:'Autonomous habitat and survey cargo'},
      {id:'cargo-drop-helios',sponsorId:'helios',sponsorName:'Helios Industrial',siteId:'amazonis',siteName:'Amazonis Planitia',arrivalSol:155,status:'scheduled',cargo:'Industrial equipment'}
    ], supplyShips: [
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
