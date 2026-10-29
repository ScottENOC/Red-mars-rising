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
  w.economy.water = Math.max(0, w.economy.water - .12 * (1 - site.waterAccess));
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
    if (project.id === 'water-extractor') { if (home && !home.infrastructure.includes('water-extractor')) home.infrastructure.push('water-extractor'); w.economy.water += 35; }
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
  if (sol >= 180 && sol % 90 === 0) {
    const sponsor = w.sponsors.find(s => s.id !== w.campaign.startingSponsorId && !s.colonyFounded);
    if (sponsor) {
      const sites = [
        {id:'rival-arcadia',name:'Arcadia Outpost',lat:46.7,lon:164},
        {id:'rival-elysium',name:'Elysium Industrial Camp',lat:4.5,lon:154.5},
        {id:'rival-hellas',name:'Hellas Research Station',lat:-42.4,lon:70.5},
        {id:'rival-valles',name:'Valles Survey Camp',lat:-13.9,lon:-59.2},
        {id:'rival-gale',name:'Gale Science Station',lat:-5.4,lon:137.8}
      ];
      const candidate = sites.find(p => !w.settlements.some(s => Math.abs(s.lat-p.lat)<3 && Math.abs(s.lon-p.lon)<3));
      if (candidate) {
        sponsor.colonyFounded = true; sponsor.status = 'colony-founded';
        w.settlements.push({...candidate,kind:'rival-colony',population:45,status:'established',sponsorId:sponsor.id,infrastructure:['habitats','power-array']});
        events.push({type:'rival-colony-founded',sol,description:sponsor.name+' has established '+candidate.name+'.'});
      }
    }
  }
  w.time.lastProcessedSol = sol;
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
