import { ensureMaterialInventories, processNaturalMeteoroidFlux, processWaterClimate, settleAtmosphericMeteoroidDust, syncAtmosphereFromInventories, recycleColonyWater, transferWater, checkMaterialConservation, consumeColonyWaterForReaction, addColonyWaterFromReaction } from './material-inventories.js';
import { SHORTLISTED_SITES } from './campaign-options.js';

const MARS_RADIUS_M = 3_389_500;
const MARS_SURFACE_AREA_M2 = 4 * Math.PI * MARS_RADIUS_M ** 2;
const MARS_SOL_SECONDS = 88775.244;
const EARTH_DAYS_PER_MARS_SOL = MARS_SOL_SECONDS / 86400;
const GLUCOSE_MOLAR_G = 6*12.011 + 12*1.00794 + 6*15.9994;
const CO2_PER_GLUCOSE = 6*(12.011+2*15.9994)/GLUCOSE_MOLAR_G;
const WATER_PER_GLUCOSE = 6*(2*1.00794+15.9994)/GLUCOSE_MOLAR_G;
const O2_PER_GLUCOSE = 6*(2*15.9994)/GLUCOSE_MOLAR_G;
const STEFAN_BOLTZMANN = 5.670374419e-8;
const EFFECTIVE_EMISSIVITY = 0.75;
const CLIMATE_HEAT_CAPACITY_J_M2_K = 1e7;
const REFERENCE_TEMP_K = 210.15;
const RADIATIVE_FEEDBACK_W_M2_K = 4 * EFFECTIVE_EMISSIVITY * STEFAN_BOLTZMANN * REFERENCE_TEMP_K ** 3;

export function processWorldTick(w) {
  if (!w.campaign?.started) return [];
  const sol = ++w.time.sol;
  const events = [];
  ensureMaterialInventories(w);
  checkMaterialConservation(w); // Establish the baseline before any external inputs or transfers this sol.
  processNaturalMeteoroidFlux(w, sol);
  processWaterClimate(w, sol);
  settleAtmosphericMeteoroidDust(w, sol);
  syncAtmosphereFromInventories(w);
  const site = w.settlements.find(s => s.kind === 'primary-colony')?.siteModifiers ?? {waterAccess:.5,heatDemand:1};
  const population = w.settlements.reduce((sum, s) => sum + Math.max(0, s.population ?? 0), 0);
  const climate = w.climate;
  climate.energyBalance ??= {};
  climate.energyBalance.accumulatedWasteHeatJPerM2 ??= 0;
  climate.energyBalance.temperatureAnomalyC ??= 0;


  const powerShortfall = w.economy.powerCapacity < w.economy.powerDemand;
  w.colonists.morale = Math.max(0, Math.min(100, w.colonists.morale + (powerShortfall ? -.15 : .015)));
  w.colonists.health = Math.max(0, Math.min(100, w.colonists.health + (powerShortfall ? -.04 : .006)));
  const homeColony = w.settlements.find(s => s.kind === 'primary-colony');
  const stores = homeColony ? w.materials.colonies[homeColony.id].waterKg : null;
  const requestedWaterUseUnits = Math.min(w.economy.water, .12 * (1 - site.waterAccess));
  const waterUseUnits = stores ? Math.min(requestedWaterUseUnits, stores.tanks / 1000) : requestedWaterUseUnits;
  if (homeColony && waterUseUnits > 0) {
    const usedWaterKg = waterUseUnits * 1000;
    const humidityKg = usedWaterKg * 0.05;
    const wastewaterKg = usedWaterKg - humidityKg;
    if (wastewaterKg > 0) transferWater(w, {from:'colony:' + homeColony.id + ':tanks',to:'colony:' + homeColony.id + ':wastewater',massKg:wastewaterKg,sol,process:'daily-use',note:'Used water enters wastewater pending treatment.'});
    if (humidityKg > 0) transferWater(w, {from:'colony:' + homeColony.id + ':tanks',to:'colony:' + homeColony.id + ':habitatHumidity',massKg:humidityKg,sol,process:'evaporation-in-habitat',note:'A fraction of used water enters habitat air as humidity.'});
  }
  w.economy.water = Math.max(0, w.economy.water - waterUseUnits);

  // Physical food/atmosphere cycle. Food is a dry glucose-equivalent proxy, not a nutritionally complete diet.
  // Stoichiometry uses glucose + O2 <-> CO2 + H2O; 10% of food mass becomes solid waste.
  const colony = homeColony && w.materials.colonies[homeColony.id];
  const siteDeposit = homeColony && w.materials.siteDeposits[homeColony.locationId];
  let processElectricityKWh = 0;
  let metabolicHeatW = 0;
  if (colony) {
    const people = Math.max(0, Number(homeColony.population ?? w.colonists.population) || 0);
    const dailyFoodKg = people * 0.62 * EARTH_DAYS_PER_MARS_SOL;
    const wasteFraction = 0.10;
    const requestedFoodKg = Math.min(Math.max(0,colony.foodKg),dailyFoodKg);
    const oxygenLimitedFoodKg = Math.max(0,(colony.gasesKg.oxygen??0)/(O2_PER_GLUCOSE*(1-wasteFraction)));
    const foodEatenKg = Math.min(requestedFoodKg,oxygenLimitedFoodKg);
    const metabolisedFoodKg = foodEatenKg*(1-wasteFraction);
    const oxygenUsedKg = metabolisedFoodKg*O2_PER_GLUCOSE;
    const co2ProducedKg = metabolisedFoodKg*CO2_PER_GLUCOSE;
    const metabolicWaterKg = metabolisedFoodKg*WATER_PER_GLUCOSE;
    if(foodEatenKg>0){
      colony.foodKg-=foodEatenKg;
      colony.solidWasteKg+=foodEatenKg*wasteFraction;
      colony.gasesKg.oxygen-=oxygenUsedKg;
      colony.gasesKg.carbonDioxide+=co2ProducedKg;
      addColonyWaterFromReaction(w,{colonyId:homeColony.id,massKg:metabolicWaterKg,sol,process:'human-metabolism',note:'Glucose-equivalent food oxidation yields CO₂ and metabolic water; 10% of consumed food mass becomes solid waste.'});
      w.materials.ledger.push({sol,process:'human-metabolism',substance:'food',massKg:foodEatenKg,from:'colony:'+homeColony.id+':food',to:'colony:'+homeColony.id+':biomass-and-products',note:'Food is partitioned into solid waste, CO₂ and metabolic water using a simplified glucose oxidation model.'});
    }
    metabolicHeatW=people*100;
    if(foodEatenKg+1e-9<dailyFoodKg){
      w.colonists.health=Math.max(0,w.colonists.health-0.25);
      w.colonists.morale=Math.max(0,w.colonists.morale-0.35);
      if(sol%10===0)events.push({type:'food-shortage',sol,description:'Food stocks and/or oxygen are insufficient for full rations; health and morale are declining.'});
    }

    // Greenhouse photosynthesis is limited by actual CO₂ and tank water, and is paused by power shortfall.
    if(!powerShortfall && homeColony.infrastructure?.includes('greenhouse')){
      const maxDryBiomassKg=people*0.25;
      const producibleByCO2=Math.max(0,colony.gasesKg.carbonDioxide??0)/CO2_PER_GLUCOSE;
      const producibleByWater=Math.max(0,colony.waterKg.tanks)/WATER_PER_GLUCOSE;
      const producedKg=Math.min(maxDryBiomassKg,producibleByCO2,producibleByWater);
      if(producedKg>0){
        const co2UsedKg=producedKg*CO2_PER_GLUCOSE;
        const waterUsedKg=producedKg*WATER_PER_GLUCOSE;
        consumeColonyWaterForReaction(w,{colonyId:homeColony.id,massKg:waterUsedKg,sol,process:'greenhouse-photosynthesis',note:'Water is a chemical reactant in the glucose-equivalent photosynthesis model.'});
        colony.gasesKg.carbonDioxide-=co2UsedKg;
        colony.foodKg+=producedKg*0.70;
        colony.biomassKg+=producedKg*0.30;
        const oxygenProducedKg=producedKg*O2_PER_GLUCOSE;
        colony.gasesKg.oxygen+=oxygenProducedKg;
        processElectricityKWh+=producedKg*20;
        w.materials.ledger.push({sol,process:'greenhouse-photosynthesis',substance:'dry glucose-equivalent biomass',massKg:producedKg,co2ConsumedKg:co2UsedKg,waterConsumedKg:waterUsedKg,oxygenProducedKg,edibleFoodKg:producedKg*0.70,inedibleBiomassKg:producedKg*0.30,note:'Simplified photosynthesis stoichiometry; crop diversity, nutrient chemistry and food quality are not yet represented.'});
      }
    }

    // Regolith mining and beneficiation retain all feed mass as aggregate, concentrate and tailings.
    // Rates and yields are explicit scenario assumptions, not a claim about a selected industrial process.
    if(!powerShortfall && homeColony.infrastructure?.includes('workshop') && siteDeposit){
      const minedKg=Math.min(1000,Math.max(0,siteDeposit.regolithAvailableKg??0));
      if(minedKg>0){
        siteDeposit.regolithAvailableKg-=minedKg;
        colony.materialsKg.regolith+=minedKg;
        w.materials.externalFlows.colonyMatterImportsKg+=minedKg;
        w.materials.ledger.push({sol,process:'regolith-mining',substance:'regolith',massKg:minedKg,from:'local-surface-deposit',to:'colony:'+homeColony.id+':materials.regolith',note:'Illustrative accessible regolith reserve; mining imports mass into the colony boundary.'});
      }
      const processedKg=Math.min(1000,Math.max(0,colony.materialsKg.regolith??0));
      if(processedKg>0){
        colony.materialsKg.regolith-=processedKg;
        colony.materialsKg.aggregate+=processedKg*0.70;
        colony.materialsKg.metalConcentrate+=processedKg*0.10;
        colony.materialsKg.tailings+=processedKg*0.20;
        processElectricityKWh+=(processedKg/1000)*50;
        w.materials.ledger.push({sol,process:'regolith-beneficiation',substance:'regolith feed',massKg:processedKg,aggregateKg:processedKg*0.70,metalConcentrateKg:processedKg*0.10,tailingsKg:processedKg*0.20,note:'Mass-conserving illustrative yield: 70% aggregate, 10% metal-bearing concentrate, 20% tailings. No refined metal is assumed.'});
      }
    }
    if(processElectricityKWh>0){
      w.materials.energy.electricityConsumedKWh+=processElectricityKWh;
      w.materials.energy.heatReleasedKWh+=(processElectricityKWh*0.80);
    }
  }
  w.colonists.cumulativeWork += w.colonists.population * (w.colonists.morale / 100) * (powerShortfall ? .45 : 1);
  w.colonists.science += w.settlements.some(s => s.infrastructure?.includes('laboratory')) ? .08 : .02;

  // Strategic programmes represent colony-level priorities; no individual worker assignments are exposed.
  for (const program of (w.campaign.strategicPrograms ?? [])) {
    if (program.status !== 'active') continue;
    if (powerShortfall) { program.pausedReason = 'Power shortfall'; continue; }
    program.remainingSols = Math.max(0, program.remainingSols - 1);
    program.progress = 1 - program.remainingSols / program.durationSols;
    delete program.pausedReason;
    if (program.remainingSols !== 0) continue;
    program.status = 'complete';
    if (program.id === 'local-components-study') {
      w.campaign.localManufacturingAssessment = {status:'preliminary',sol,confidence:'low',potentialSubstitutionRange:[60,80],category:'selected non-critical imported components',note:'Scenario estimate only. This is a research finding, not current production capacity; feedstock processing, quality assurance and component-specific qualification would still be required.'};
      w.campaign.dependencyPolicy = 'investigate-local-production';
      events.push({type:'strategic-program-complete',sol,description:'Local component study completed: selected non-critical component categories may offer a 60–80% substitution opportunity, but confidence is low and no production capability has been built yet.'});
    }
    if (program.id === 'cargo-pipeline') {
      w.campaign.logisticsReliability = Math.max(w.campaign.logisticsReliability ?? 0.5, 0.8);
      w.campaign.sponsorPatience = Math.min(100, w.campaign.sponsorPatience + 8);
      w.campaign.sponsorPressure = Math.max(0, w.campaign.sponsorPressure - 10);
      w.campaign.dependencyPolicy = 'strengthen-supply-chain';
      events.push({type:'strategic-program-complete',sol,description:'Sponsor cargo pipeline strengthened: shipment coordination is more reliable and sponsor confidence has improved, but material dependence remains.'});
    }
  }

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
      const deposit = home && w.materials.siteDeposits[home.locationId];
      const sourceId = deposit?.waterStockId;
      const source = sourceId && w.materials.planetary.waterKg[sourceId];
      const surveyMultiplier = deposit?.surveyed ? 1.5 : 1;
      const extractedKg = deposit ? Math.min(source?.mass ?? 0, deposit.extractionRateKgPerSol * surveyMultiplier * project.durationSols) : 0;
      if (home && stores && source && extractedKg > 0) {
        transferWater(w, {from:'planet:' + sourceId,to:'colony:' + home.id + ':tanks',massKg:extractedKg,sol,process:'site-specific-ice-extraction',note:'Extraction rate depends on local prospectivity and whether a prior survey improved targeting.'});
        w.materials.externalFlows.colonyMatterImportsKg += extractedKg;
        w.economy.water += extractedKg / 1000;
      } else {
        events.push({type:'project-output-shortfall',sol,description:'The water extractor was completed, but the local deposit or extraction technology could not supply water.'});
      }
    }
    if (project.id === 'buried-habitat' && home) { home.infrastructure.push('regolith-shielded-habitat'); w.colonists.morale = Math.min(100, w.colonists.morale + 2); }
    if (project.id === 'ice-survey') {
      climate.water.accessibleIceIndex = Math.min(100, climate.water.accessibleIceIndex + Math.round(site.waterAccess * 20));
      if (home && w.materials.siteDeposits[home.locationId]) {
        w.materials.siteDeposits[home.locationId].surveyed = true;
        w.materials.siteDeposits[home.locationId].confidence = 'medium';
      }
    }
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
  recycleColonyWater(w, sol);

  // Heat is an energy stock in joules relative to the colony's 20 °C reference state.
  // Metabolic and equipment waste heat charge the store; leakage removes energy from it.
  const heatColony=homeColony && w.materials.colonies[homeColony.id];
  let colonyHeatLossW=0;
  if(heatColony?.thermal){
    const thermal=heatColony.thermal;
    const equipmentHeatW=(processElectricityKWh*0.80*3.6e6)/MARS_SOL_SECONDS;
    const heatInputW=metabolicHeatW+equipmentHeatW;
    const heatInputJ=heatInputW*MARS_SOL_SECONDS;
    const heatLossW=Math.max(0,thermal.storedEnergyJ)/(2*MARS_SOL_SECONDS);
    const heatLossJ=heatLossW*MARS_SOL_SECONDS;
    thermal.storedEnergyJ+=heatInputJ-heatLossJ;
    thermal.temperatureC=thermal.referenceTemperatureC+thermal.storedEnergyJ/thermal.capacityJPerK;
    thermal.heatInputCumulativeJ+=heatInputJ;
    thermal.heatLossCumulativeJ+=heatLossJ;
    colonyHeatLossW=heatLossW;
    w.materials.energy.thermalHeatInputJ+=heatInputJ;
    w.materials.energy.thermalHeatLostJ+=heatLossJ;
    w.materials.energy.storedThermalEnergyJ=Object.values(w.materials.colonies).reduce((sum,c)=>sum+Math.max(0,c.thermal?.storedEnergyJ??0),0);
  }

  // Global thermal stock receives heat leaked from the colony and loses energy radiatively.
  climate.energyBalance??={};
  climate.energyBalance.storedThermalEnergyJ??=(climate.energyBalance.temperatureAnomalyC??0)*CLIMATE_HEAT_CAPACITY_J_M2_K*MARS_SURFACE_AREA_M2;
  climate.energyBalance.temperatureAnomalyC??=0;
  const anomaly=climate.energyBalance.temperatureAnomalyC;
  const radiativeLossWm2=RADIATIVE_FEEDBACK_W_M2_K*anomaly;
  const planetHeatInputJ=colonyHeatLossW*MARS_SOL_SECONDS;
  const planetRadiativeLossJ=radiativeLossWm2*MARS_SURFACE_AREA_M2*MARS_SOL_SECONDS;
  climate.energyBalance.storedThermalEnergyJ+=planetHeatInputJ-planetRadiativeLossJ;
  climate.energyBalance.humanWasteHeatW=population*100;
  climate.energyBalance.colonyHeatTransferW=colonyHeatLossW;
  climate.energyBalance.radiativeLossWm2=radiativeLossWm2;
  climate.energyBalance.netEnergyJm2=(colonyHeatLossW-MARS_SURFACE_AREA_M2*radiativeLossWm2)/MARS_SURFACE_AREA_M2;
  climate.energyBalance.accumulatedWasteHeatJPerM2+=(colonyHeatLossW/MARS_SURFACE_AREA_M2)*MARS_SOL_SECONDS;
  climate.energyBalance.temperatureAnomalyC=climate.energyBalance.storedThermalEnergyJ/(CLIMATE_HEAT_CAPACITY_J_M2_K*MARS_SURFACE_AREA_M2);
  climate.meanSurfaceTemperatureC=climate.referenceMeanTemperatureC+climate.energyBalance.temperatureAnomalyC;
  climate.energyBalance.effectiveHeatCapacityJm2K=CLIMATE_HEAT_CAPACITY_J_M2_K;
  climate.energyBalance.modelNote='Illustrative global energy-stock model. The colony thermal store tracks metabolic/equipment heat and heat leakage; the planetary anomaly tracks leaked colony heat minus radiative loss. Natural solar/seasonal forcing and local spatial heat transport remain unmodelled.';
  checkMaterialConservation(w);
  w.time.lastProcessedSol = sol;
  w.time.solOfYear = ((sol - 1) % 669) + 1;
  for (const event of events) w.events.push({...event,sol});
  return events;
}

export function commissionStrategicProgram(w, programId) {
  const program = (w.campaign.strategicPrograms ?? []).find(p => p.id === programId);
  if (!program || program.status !== 'available') return {ok:false,reason:'Strategic programme is not available.'};
  for (const [resource, amount] of Object.entries(program.cost)) {
    if ((w.economy[resource] ?? 0) < amount) return {ok:false,reason:'Insufficient '+resource+'.'};
  }
  for (const [resource, amount] of Object.entries(program.cost)) w.economy[resource] -= amount;
  program.status = 'active'; program.remainingSols = program.durationSols; program.progress = 0;
  w.campaign.dependencyPolicy = program.id === 'local-components-study' ? 'investigate-local-production' : 'strengthen-supply-chain';
  w.events.push({type:'strategic-program-start',sol:w.time.sol,description:program.name+' commissioned.'});
  return {ok:true,program};
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
