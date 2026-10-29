import { ensureMaterialInventories, processNaturalMeteoroidFlux, transferWater, checkWaterConservation } from './material-inventories.js';
import { SHORTLISTED_SITES } from './campaign-options.js';

const MARS_RADIUS_M = 3_389_500;
const MARS_SURFACE_AREA_M2 = 4 * Math.PI * MARS_RADIUS_M ** 2;
const MARS_SOL_SECONDS = 88775.244;
const STEFAN_BOLTZMANN = 5.670374419e-8;
const EFFECTIVE_EMISSIVITY = 0.75;
const CLIMATE_HEAT_CAPACITY_J_M2_K = 1e7;
const REFERENCE_TEMP_K = 210.15;
const RADIATIVE_FEEDBACK_W_M2_K = 4 * EFFECTIVE_EMISSIVITY * STEFAN_BOLTZMANN * REFERENCE_TEMP_K ** 3;

export function processWorldTick(w) {
  if (!w.campaign?.started) return [];
  const sol = ++w.time.sol;
  const events = [];
  const site = w.settlements.find(s => s.kind === 'primary-colony')?.siteModifiers ?? {waterAccess:.5,heatDemand:1};
  const climate = w.climate;
  climate.energyBalance ??= {};
  climate.energyBalance.accumulatedWasteHeatJPerM2 ??= 0;
  climate.energyBalance.temperatureAnomalyC ??= 0;

  // Every colonist contributes sensible heat. Keep the tiny energy input in the
  // model at full floating-point precision; never threshold or round it away.
  const population = w.settlements.reduce((sum, s) => sum + Math.max(0, s.population ?? 0), 0);
  const humanWasteHeatW = population * 100;
  const wasteHeatWm2 = humanWasteHeatW / MARS_SURFACE_AREA_M2;
  const anomaly = climate.energyBalance.temperatureAnomalyC;
  const radiativeLossWm2 = RADIATIVE_FEEDBACK_W_M2_K * anomaly;
  const netEnergyJm2 = (wasteHeatWm2 - radiativeLossWm2) * MARS_SOL_SECONDS;
  climate.energyBalance.humanWasteHeatWm2 = wasteHeatWm2;
  climate.energyBalance.humanWasteHeatW = humanWasteHeatW;
  climate.energyBalance.radiativeLossWm2 = radiativeLossWm2;
  climate.energyBalance.netEnergyJm2 = wasteHeatWm2 - radiativeLossWm2;
  climate.energyBalance.accumulatedWasteHeatJPerM2 += wasteHeatWm2 * MARS_SOL_SECONDS;
  climate.energyBalance.temperatureAnomalyC += netEnergyJm2 / CLIMATE_HEAT_CAPACITY_J_M2_K;
  climate.meanSurfaceTemperatureC = climate.referenceMeanTemperatureC + climate.energyBalance.temperatureAnomalyC;
  climate.energyBalance.effectiveHeatCapacityJm2K = CLIMATE_HEAT_CAPACITY_J_M2_K;
  climate.energyBalance.modelNote = 'Illustrative global energy-budget response; small heat inputs are accumulated without thresholds. Local heat distribution is not yet spatially resolved.';

  const powerShortfall = w.economy.powerCapacity < w.economy.powerDemand;
  w.colonists.morale = Math.max(0, Math.min(100, w.colonists.morale + (powerShortfall ? -.15 : .015)));
  w.colonists.health = Math.max(0, Math.min(100, w.colonists.health + (powerShortfall ? -.04 : .006)));
  const waterUseUnits = Math.min(w.economy.water, .12 * (1 - site.waterAccess));
  const homeColony = w.settlements.find(s => s.kind === 'primary-colony');
  if (homeColony && waterUseUnits > 0) {
    const stores = w.materials.colonies[homeColony.id].waterKg;
    const useKg = waterUseUnits * 1000;
    if (stores.tanks >= useKg) {
      transferWater(w, {from:'colony:' + homeColony.id + ':tanks',to:'colony:' + homeColony.id + ':wastewater',massKg:useKg,sol,process:'daily-use',note:'Used water enters wastewater pending treatment or disposal.'});
    } else {
      // Keep the legacy economy stock and material inventory in sync if a save is short.
      const availableKg = stores.tanks;
      if (availableKg > 0) transferWater(w, {from:'colony:' + homeColony.id + ':tanks',to:'colony:' + homeColony.id + ':wastewater',massKg:availableKg,sol,process:'daily-use',note:'Available tank water enters wastewater.'});
    }
  }
  w.economy.water = Math.max(0, w.economy.water - waterUseUnits);
  w.colonists.cumulativeWork += w.colonists.population * (w.colonists.morale / 100) * (powerShortfall ? .45 : 1);
  w.colonists.science += w.settlements.some(s => s.infrastructure?.includes('laboratory')) ? .08 : .02;

  for (const project of w.infrastructure.projects) {
    if (project.status !== 'active') continue;
    if (powerShortfall) { project.pausedReason = 'Power shortfall'; continue; }
    project.remainingSols = Math.max(0, project.remainingSols - 1);
    project.progress = 1 - project.remainingSols / project.durationSols;
    delete project.pausedReason;
    if (project.remainingSols !== 0) continue;
    project.status = 'complete';
    const home = w.settlements.find(s => s.kind === 'primary-colony');
    if (project.id === 'solar-expansion') { w.economy.powerCapacity += 35; w.economy.powerDemand += 4; }
    if (project.id === 'water-extractor') {
      if (home && !home.infrastructure.includes('water-extractor')) home.infrastructure.push('water-extractor');
      const stores = home && w.materials.colonies[home.id]?.waterKg;
      const extractedKg = 35_000;
      if (home && stores && w.materials.planetary.waterKg.subsurfaceIce.mass >= extractedKg) {
        transferWater(w, {from:'planet:subsurfaceIce',to:'colony:' + home.id + ':tanks',massKg:extractedKg,sol,process:'ice-extraction',note:'Pilot extractor transfers subsurface ice to colony tanks.'});
        w.economy.water += extractedKg / 1000;
      } else {
        events.push({type:'project-output-shortfall',sol,description:'The water extractor was completed, but its assumed source reservoir could not supply the planned output.'});
      }
    }
    if (project.id === 'buried-habitat' && home) { home.infrastructure.push('regolith-shielded-habitat'); w.colonists.morale = Math.min(100, w.colonists.morale + 2); }
    if (project.id === 'ice-survey') climate.water.accessibleIceIndex = Math.min(100, climate.water.accessibleIceIndex + Math.round(site.waterAccess * 20));
    events.push({type:'project-complete',sol,description:project.name+' completed.'});
  }

  // A sol is 1/669 of a Martian year for this campaign calendar.
  if (sol % 669 === 0 && w.campaign.supportYearsRemaining > 0) {
    w.campaign.supportYearsRemaining--;
    events.push({type:'support-anniversary',sol,description:'Expedition support anniversary; '+w.campaign.supportYearsRemaining+' years remain.'});
  }
  if (sol % 20 === 0) {
    const sponsor = w.sponsors.find(s => s.id === w.campaign.startingSponsorId);
    const patienceDrift = sponsor?.type === 'corporate' ? 1.4 : sponsor?.type === 'multilateral' ? .15 : .65;
    w.campaign.sponsorPatience = Math.max(0, w.campaign.sponsorPatience - patienceDrift);
    w.campaign.sponsorPressure = Math.min(100, w.campaign.sponsorPressure + (sponsor?.pressure ?? 40) / 100 * .3);
    if (w.campaign.sponsorPatience < 30 && sol % 100 === 0) events.push({type:'sponsor-pressure',sol,description:'Your sponsor is losing patience and may attach conditions to future support.'});
  }
  // Rival crews observe the first colony for at least 60 sols before reassessing.
  // They then wait for an Earth-Mars transfer opportunity (~780 sols) and spend
  // roughly 240 sols in transit. Cargo precursors can land before crewed missions.
  for (const sponsor of w.sponsors) {
    if (sponsor.id === w.campaign.startingSponsorId || sponsor.colonyFounded) continue;
    sponsor.rivalPlan ??= {status:'observing',assessment:null,launchSol:null,arrivalSol:null,siteId:null};
    const plan = sponsor.rivalPlan;
    if (plan.status === 'observing' && sol >= 60) {
      const healthy = w.colonists.health >= 45 && w.colonists.morale >= 40 && w.economy.powerCapacity >= w.economy.powerDemand;
      plan.assessment = healthy ? 'cautiously-encouraged' : 'high-risk';
      plan.assessedAtSol = sol;
      plan.status = healthy ? 'awaiting-launch-window' : 'reviewing-failure-risk';
      plan.launchSol = Math.max(780, Math.ceil((sol + (healthy ? 0 : 180)) / 780) * 780) + Math.max(0, w.sponsors.findIndex(x => x.id === sponsor.id)) * 4;
      plan.arrivalSol = plan.launchSol + 240;
      const reserved = new Set(w.sponsors.map(other => other.rivalPlan?.siteId).filter(Boolean));
      const site = (w.shortlistedSites ?? SHORTLISTED_SITES).find(p => !reserved.has(p.id) && !w.settlements.some(s => Math.abs(s.lat-p.lat)<4 && Math.abs(((s.lon-p.lon+540)%360)-180)<4));
      if (site) { plan.siteId = site.id; plan.siteName = site.name; }
      events.push({type:'rival-assessment',sol,description:sponsor.name+' has completed its first 60-sol safety review: '+(healthy?'the mission remains viable, pending the next launch window.':'the colony is showing warning signs; its crewed plan is under extended review.')});
    }
    if (plan.status === 'reviewing-failure-risk' && plan.launchSol && sol >= plan.launchSol - 240) {
      plan.status = 'awaiting-launch-window';
      events.push({type:'rival-plan-revised',sol,description:sponsor.name+' has approved a revised crewed mission after reviewing the first colony’s difficulties.'});
    }
    if (plan.status === 'awaiting-launch-window' && plan.launchSol && sol >= plan.launchSol) {
      plan.status = 'in-transit';
      events.push({type:'rival-launch',sol,description:sponsor.name+' has launched its crewed Mars expedition; estimated arrival in about eight months.'});
    }
    if (plan.status === 'in-transit' && plan.arrivalSol && sol >= plan.arrivalSol) {
      const reserved = new Set(w.sponsors.filter(other => other.id !== sponsor.id).map(other => other.rivalPlan?.siteId).filter(Boolean));
      const site = (w.shortlistedSites ?? SHORTLISTED_SITES).find(p => p.id === plan.siteId && !w.settlements.some(s => s.id===p.id)) ?? (w.shortlistedSites ?? SHORTLISTED_SITES).find(p => !reserved.has(p.id) && !w.settlements.some(s => Math.abs(s.lat-p.lat)<4 && Math.abs(((s.lon-p.lon+540)%360)-180)<4));
      if (!site) continue;
      sponsor.colonyFounded = true; sponsor.status = 'colony-founded'; plan.status = 'established';
      w.settlements.push({...site,kind:'rival-colony',population:45,status:'established',sponsorId:sponsor.id,infrastructure:['habitats','power-array']});
      events.push({type:'rival-colony-founded',sol,description:sponsor.name+' has established '+site.name+' after an eight-month voyage.'});
    }
  }
  for (const drop of (w.logistics?.plannedCargoDrops ?? [])) {
    if (drop.status === 'scheduled' && sol >= drop.arrivalSol) {
      drop.status = 'landed';
      events.push({type:'cargo-drop-landed',sol,description:drop.sponsorName+' cargo landed at '+drop.siteName+'; no crewed colony has been established.'});
    }
  }
  checkWaterConservation(w);\n  w.time.lastProcessedSol = sol;
  w.time.solOfYear = ((sol - 1) % 669) + 1;
  for (const event of events) w.events.push({...event,sol});
  return events;
}

export function commissionProject(w, projectId) {
  const project = w.infrastructure.projects.find(p => p.id === projectId);
  if (!project || project.status !== 'available') return {ok:false,reason:'Project is not available.'};
  for (const [resource, amount] of Object.entries(project.cost)) {
    if ((w.economy[resource] ?? 0) < amount) return {ok:false,reason:'Insufficient '+resource+'.'};
  }
  for (const [resource, amount] of Object.entries(project.cost)) w.economy[resource] -= amount;
  project.status = 'active'; project.remainingSols = project.durationSols; project.progress = 0;
  w.events.push({type:'project-start',sol:w.time.sol,description:project.name+' commissioned.'});
  return {ok:true,project};
}
