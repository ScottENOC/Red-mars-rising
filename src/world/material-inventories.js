// Conserved material inventories. All water masses are kilograms of H2O-equivalent;
// elemental inventories are tracked separately only for free H2 and O2 stocks.
export const MARS_SOL_SECONDS = 88775.244;
export const MARS_SOLS_PER_YEAR = 669;
export const METEOROID_MASS_FLUX_KG_PER_EARTH_YEAR = 29_600_000; // uncertain literature-scale estimate; includes mostly fine material entering Mars' atmosphere
export const EARTH_DAYS_PER_MARS_SOL = MARS_SOL_SECONDS / 86400;

export function createMaterialInventories() {
  return {
    units: { mass: 'kg', energy: 'J', time: 'sol' },
    provenance: 'Initial reservoir values are explicit scenario estimates, not a claim that Mars inventories are precisely known.',
    planetary: {
      waterKg: {
        atmosphericVapour: { mass: 1e9, confidence: 'very-low', note: 'Inherited prototype estimate; replace with a calibrated atmospheric column model.' },
        surfaceIce: { mass: 1e15, confidence: 'low', note: 'Order-of-magnitude gameplay reservoir; includes exposed polar and seasonal water ice, excludes CO2 frost.' },
        subsurfaceIce: { mass: 1e16, confidence: 'very-low', note: 'Broad scenario reservoir; accessible fraction is controlled separately by site and technology.' },
        groundwater: { mass: 0, confidence: 'unknown', note: 'No confirmed liquid groundwater inventory is assumed at campaign start.' },
        surfaceLiquid: { mass: 0, confidence: 'high', note: 'No stable open surface liquid-water reservoir assumed under present-day conditions.' },
        hydratedMinerals: { mass: 1e15, confidence: 'very-low', note: 'Illustrative water-equivalent bound; not currently extractable without processing.' }
      },
      meteoroidInputKgCumulative: 0,
      meteoroidMatterKg: 0,
      pendingMeteoroidInputKg: 0,
      naturalImpactsGreaterThan8mCumulative: 0,
      naturalImpactFractionalAccumulator: 0,
      lastNaturalImpactSol: 0
    },
    colonies: {},
    ledger: [],
    externalFlows: { importedWaterKg: 0, exportedWaterKg: 0, meteoroidMatterKg: 0 },
    diagnostics: { waterBalanceErrorKg: 0, lastWaterBalanceCheckSol: 0 }
  };
}

export function ensureMaterialInventories(w) {
  w.materials ??= createMaterialInventories();
  w.materials.colonies ??= {};
  w.materials.ledger ??= [];
  const home = w.settlements?.find(s => s.kind === 'primary-colony');
  if (home && !w.materials.colonies[home.id]) {
    // Legacy economy.water is an abstract gameplay stock; map it to 1,000 kg per unit.
    const waterKg = Math.max(0, Number(w.economy?.water ?? 0)) * 1000;
    w.materials.colonies[home.id] = {
      waterKg: { tanks: waterKg, processWater: 0, habitatHumidity: 0, wastewater: 0 },
      gasesKg: { hydrogen: 0, oxygen: 0, carbonDioxide: 0, nitrogen: 0, argon: 0 },
      note: 'Colony stores are separate from planetary reservoirs. Economy water is bridged at 1,000 kg per legacy unit.'
    };
  }
  return w.materials;
}

export function transferWater(w, { from, to, massKg, sol = w.time?.sol ?? 0, process = 'transfer', note = '' }) {
  const m = ensureMaterialInventories(w);
  if (!Number.isFinite(massKg) || massKg <= 0) throw new Error('Water transfer massKg must be a positive finite number.');
  const source = resolveWaterStock(m, from);
  const destination = resolveWaterStock(m, to);
  if (!source || !destination) throw new Error('Unknown water inventory endpoint.');
  if (source.stock.mass < massKg) throw new Error('Insufficient water in source inventory.');
  source.stock.mass -= massKg;
  destination.stock.mass += massKg;
  m.ledger.push({ sol, substance: 'H2O', massKg, from, to, process, note });
  return { ok: true, massKg, from, to };
}

function resolveWaterStock(m, endpoint) {
  const [scope, owner, compartment] = String(endpoint).split(':');
  if (scope === 'planet' && m.planetary.waterKg[owner]) return { stock: m.planetary.waterKg[owner] };
  if (scope === 'colony' && m.colonies[owner]?.waterKg?.[compartment] !== undefined) {
    return { stock: { get mass() { return m.colonies[owner].waterKg[compartment]; }, set mass(v) { m.colonies[owner].waterKg[compartment] = v; } } };
  }
  return null;
}

export function processNaturalMeteoroidFlux(w, sol) {
  const m = ensureMaterialInventories(w);
  // Literature estimates are quoted per Earth year; convert to this Martian-sol calendar.
  const kgThisSol = METEOROID_MASS_FLUX_KG_PER_EARTH_YEAR / 365.25 * EARTH_DAYS_PER_MARS_SOL;
  m.planetary.meteoroidInputKgCumulative += kgThisSol;
  m.externalFlows.meteoroidMatterKg += kgThisSol;
  m.planetary.naturalImpactFractionalAccumulator += 320 / MARS_SOLS_PER_YEAR;
  let impacts = 0;
  while (m.planetary.naturalImpactFractionalAccumulator >= 1) {
    m.planetary.naturalImpactFractionalAccumulator -= 1;
    impacts++;
  }
  if (impacts) {
    m.planetary.naturalImpactsGreaterThan8mCumulative += impacts;
    m.planetary.lastNaturalImpactSol = sol;
  }
  // Keep this as a planetary external-input ledger entry, not as water: the bulk
  // of incoming mass is not known to be water and most is fine material.
  m.ledger.push({ sol, substance: 'mixed meteoroid matter', massKg: kgThisSol, from: 'space', to: 'planet:surface-material', process: 'natural-flux', note: 'Aggregate background influx; composition unresolved.' });
  if (sol % 30 === 0) {
    w.events.push({
      type: 'natural-meteoroid-flux',
      sol,
      description: 'Background meteoroid influx added approximately ' + Math.round(kgThisSol * 30).toLocaleString('en-AU') + ' kg of mixed material to Mars over the last 30 sols. ' + m.planetary.naturalImpactsGreaterThan8mCumulative + ' modelled global impacts have formed craters larger than 8 m.'
    });
  }
}

export function checkWaterConservation(w) {
  const m = ensureMaterialInventories(w);
  const planetary = Object.values(m.planetary.waterKg).reduce((sum, stock) => sum + stock.mass, 0);
  const colony = Object.values(m.colonies).reduce((sum, c) => sum + Object.values(c.waterKg).reduce((a, x) => a + x, 0), 0);
  const total = planetary + colony;
  const baseline = m.diagnostics.initialTotalWaterKg ?? total;
  m.diagnostics.initialTotalWaterKg ??= total;
  const accounted = baseline + m.externalFlows.importedWaterKg - m.externalFlows.exportedWaterKg;
  m.diagnostics.waterBalanceErrorKg = total - accounted;
  m.diagnostics.lastWaterBalanceCheckSol = w.time?.sol ?? 0;
  return { totalWaterKg: total, accountedWaterKg: accounted, errorKg: m.diagnostics.waterBalanceErrorKg };
}
