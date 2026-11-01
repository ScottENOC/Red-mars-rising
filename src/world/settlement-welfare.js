import { transitionSettlementLifecycle } from './settlement-lifecycle.js';

const SOL_DAYS = 88775.244 / 86400;
const FOOD_KG_PER_PERSON_SOL = 0.62 * SOL_DAYS;
const OXYGEN_KG_PER_PERSON_SOL = FOOD_KG_PER_PERSON_SOL * 0.9 * (6 * 31.9988 / (6 * 12.011 + 12 * 1.00794 + 6 * 15.9994));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || 0));

function resourceRunways(w, settlement) {
  const stocks = w.materials?.colonies?.[settlement.id];
  const people = Math.max(0, Number(settlement.population) || 0);
  if (!stocks || people <= 0) return { food: Infinity, oxygen: Infinity, water: Infinity };
  return {
    food: Math.max(0, Number(stocks.foodKg) || 0) / (people * FOOD_KG_PER_PERSON_SOL),
    oxygen: Math.max(0, Number(stocks.gasesKg?.oxygen) || 0) / (people * OXYGEN_KG_PER_PERSON_SOL),
    // A conservative planning proxy; the detailed water-use model remains authoritative.
    water: Math.max(0, Number(stocks.waterKg?.tanks) || 0) / (people * 2.5)
  };
}

function relationship(a, b) {
  const x = Number(a?.politics?.relations?.[b?.id]);
  const y = Number(b?.politics?.relations?.[a?.id]);
  return Number.isFinite(x) && Number.isFinite(y) ? (x + y) / 2 : Number.isFinite(x) ? x : Number.isFinite(y) ? y : 50;
}

function canReceiveRefugees(w, host, source, sol) {
  if (host.id === source.id || !['active', 'distressed'].includes(host.lifecycle?.phase)) return false;
  const policy = host.refugeePolicy ?? 'consider';
  if (policy === 'closed' || policy === 'restricted') return false;
  if (policy !== 'welcome' && relationship(host, source) < 55) return false;
  const hostRunway = resourceRunways(w, host);
  if (Math.min(hostRunway.food, hostRunway.oxygen, hostRunway.water) < 45) return false;
  if (Number(host.health ?? 70) < 45 || Number(host.morale ?? 60) < 40) return false;
  const population = Math.max(0, Number(host.population) || 0);
  const capacity = Math.max(population, Number(host.populationCapacity) || Math.ceil(population * 1.25));
  return capacity - population > 0;
}

/** Reassess settlement welfare and move small refugee groups to colonies willing and able to receive them. */
export function processSettlementWelfare(w, sol, events = []) {
  for (const source of (w.settlements ?? [])) {
    const population = Math.max(0, Number(source.population) || 0);
    if (!population || ['abandoned', 'evacuated'].includes(source.lifecycle?.phase)) continue;
    const runway = resourceRunways(w, source);
    let worstRunway = Math.min(runway.food, runway.oxygen, runway.water);
    source.welfare ??= {};
    const powerShortfall = source.kind === 'primary-colony' && Number(w.economy?.powerCapacity) < Number(w.economy?.powerDemand);
    source.welfare.powerShortfallSols = powerShortfall ? (Number(source.welfare.powerShortfallSols) || 0) + 1 : 0;
    if (source.welfare.powerShortfallSols >= 10) worstRunway = 0;
    source.welfare.runwaySols = {
      food: Number.isFinite(runway.food) ? Math.round(runway.food) : null,
      oxygen: Number.isFinite(runway.oxygen) ? Math.round(runway.oxygen) : null,
      water: Number.isFinite(runway.water) ? Math.round(runway.water) : null
    };
    source.welfare.lastAssessedSol = sol;
    const distressed = worstRunway <= 30;
    if (distressed && source.lifecycle?.phase === 'active') {
      transitionSettlementLifecycle(w, source.id, 'distressed', {
        sol, reason: 'Life-support reserves indicate fewer than 30 sols of food, oxygen or water runway.'
      });
      events.push({ type: 'colony-distressed', sol, settlementId: source.id,
        description: source.name + ' is in distress: life-support reserves are running low.' });
    } else if (!distressed && source.lifecycle?.phase === 'distressed' && worstRunway > 45) {
      transitionSettlementLifecycle(w, source.id, 'active', {
        sol, reason: 'Food, oxygen and water reserves have recovered above the 45-sol safety margin.'
      });
      events.push({ type: 'colony-distress-recovered', sol, settlementId: source.id,
        description: source.name + ' has recovered to a safer life-support reserve.' });
    }
    if (!distressed || sol % 10 !== 0) continue;

    source.welfare.refugees ??= { total: 0, destinations: [] };
    const hosts = (w.settlements ?? [])
      .filter(host => canReceiveRefugees(w, host, source, sol))
      .map(host => ({ host, relation: relationship(host, source), spare: Math.max(0,
        (Number(host.populationCapacity) || Math.ceil((Number(host.population) || 0) * 1.25)) - (Number(host.population) || 0)) }))
      .sort((a, b) => b.relation - a.relation || b.spare - a.spare);
    if (!hosts.length) continue;

    let remaining = population;
    for (const { host, spare } of hosts) {
      if (remaining <= 0) break;
      const group = Math.min(remaining, spare, Math.max(1, Math.ceil(population * 0.05)));
      if (group <= 0) continue;
      source.population -= group;
      host.population = (Number(host.population) || 0) + group;
      if (source.kind === 'primary-colony') w.colonists.population = Math.max(0, (Number(w.colonists.population) || 0) - group);
      if (host.kind === 'primary-colony') w.colonists.population = (Number(w.colonists.population) || 0) + group;
      remaining -= group;
      source.welfare.refugees.total += group;
      source.welfare.refugees.destinations.push({ sol, settlementId: host.id, population: group });
      host.welfare ??= {};
      host.welfare.refugeesReceived = (Number(host.welfare.refugeesReceived) || 0) + group;
      events.push({ type: 'refugees-relocated', sol, fromId: source.id, toId: host.id, population: group,
        description: group + ' colonists fled ' + source.name + ' and were welcomed by ' + host.name + '.' });
    }
    if (source.population <= 0) {
      source.population = 0;
      transitionSettlementLifecycle(w, source.id, 'evacuated', {
        sol, reason: 'All remaining colonists were evacuated to colonies that agreed to receive them.'
      });
      events.push({ type: 'colony-evacuated', sol, settlementId: source.id,
        description: source.name + ' has been evacuated; its infrastructure remains on Mars.' });
    }
  }
  return events;
}
