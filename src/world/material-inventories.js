// Material inventories for the Mars campaign.
// Water is tracked as H2O mass; free hydrogen and oxygen are tracked as elemental gas stocks.
// Initial global reservoirs are order-of-magnitude scenario estimates, not a calibrated geochemical model.
export const MARS_SOL_SECONDS = 88775.244;
export const EARTH_DAYS_PER_MARS_SOL = MARS_SOL_SECONDS / 86400;
export const METEOROID_MASS_FLUX_KG_PER_EARTH_YEAR = 29_600_000;
const WATER_MOLAR_MASS = 18.01528;
const H2_MOLAR_MASS = 2.01588;
const O2_MOLAR_MASS = 31.9988;
const WATER_H_MASS_FRACTION = 2 * 1.00794 / WATER_MOLAR_MASS;
const WATER_O_MASS_FRACTION = 15.9994 / WATER_MOLAR_MASS;
const H2_PER_WATER = H2_MOLAR_MASS / WATER_MOLAR_MASS;
const O2_PER_WATER = 0.5 * O2_MOLAR_MASS / WATER_MOLAR_MASS;

export const METEOROID_TYPES = [
  {id:'carbonaceous-chondrite',label:'Carbonaceous chondrite dust',fraction:0.55,composition:{silicates:0.42,waterIce:0.12,carbonOrganics:0.08,ironNickel:0.08,sulfides:0.06,otherMinerals:0.24},densityKgM3:2200,note:'Primitive, carbon-bearing material; some volatile content is lost during entry.'},
  {id:'ordinary-chondrite',label:'Ordinary chondrite dust',fraction:0.25,composition:{silicates:0.62,ironNickel:0.22,sulfides:0.06,otherMinerals:0.10},densityKgM3:3400,note:'Silicate-rich material with iron-nickel metal and sulfide minerals.'},
  {id:'enstatite-chondrite',label:'Enstatite chondrite dust',fraction:0.08,composition:{silicates:0.58,ironNickel:0.20,sulfides:0.12,otherMinerals:0.10},densityKgM3:3300,note:'Reduced, magnesium-silicate-rich material; simplified composition.'},
  {id:'achondrite',label:'Achondritic basaltic dust',fraction:0.04,composition:{silicates:0.78,ironNickel:0.05,sulfides:0.02,otherMinerals:0.15},densityKgM3:3000,note:'Differentiated rocky material broadly resembling basaltic crustal rocks.'},
  {id:'iron-stony-iron',label:'Iron and stony-iron particles',fraction:0.03,composition:{silicates:0.08,ironNickel:0.82,sulfides:0.04,otherMinerals:0.06},densityKgM3:6000,note:'Rare but metal-rich particles; dense micrometeorites can survive entry comparatively well.'},
  {id:'cometary-dust',label:'Cometary dust and volatile grains',fraction:0.05,composition:{silicates:0.30,waterIce:0.28,carbonOrganics:0.18,carbonDioxideIce:0.08,otherVolatiles:0.10,otherMinerals:0.06},densityKgM3:900,note:'Porous volatile-rich dust; much of its ice may vaporise during atmospheric entry.'}
];

export function createMaterialInventories() {
  const marsAtmosphereKg=610*(4*Math.PI*3_389_500**2)/3.71;
  const types=Object.fromEntries(METEOROID_TYPES.map(t=>[t.id,{massKg:0,retainedKg:0,ablatedIntoAtmosphereKg:0}]));
  return {
    units:{mass:'kg',energy:'kWh',heat:'J',time:'sol'},
    provenance:'Initial planetary reservoirs and meteoroid type fractions are transparent scenario estimates, not precision measurements.',
    planetary:{
      waterKg:{
        atmosphericVapour:{mass:1e9,confidence:'very-low',note:'Prototype water-vapour inventory; needs atmospheric-column calibration.'},
        surfaceIce:{mass:1e15,confidence:'low',note:'Order-of-magnitude exposed and seasonal water-ice reservoir; excludes CO2 frost.'},
        subsurfaceIce:{mass:1e16,confidence:'very-low',note:'Broad scenario reservoir; local accessibility and extraction rates are separate.'},
        groundwater:{mass:0,confidence:'unknown',note:'No confirmed global liquid-groundwater stock assumed.'},
        surfaceLiquid:{mass:0,confidence:'high',note:'No stable open surface liquid-water stock assumed at present-day conditions.'},
        hydratedMinerals:{mass:1e15,confidence:'very-low',note:'Illustrative water-equivalent bound; requires mineral processing.'}
      },
      atmosphereKg:{carbonDioxide:marsAtmosphereKg*.953,nitrogen:marsAtmosphereKg*.027,argon:marsAtmosphereKg*.016,oxygen:marsAtmosphereKg*.0013,carbonMonoxide:marsAtmosphereKg*.0008,otherGases:marsAtmosphereKg*(1-.953-.027-.016-.0013-.0008),meteoroidAerosols:0},
      meteoroids:{incomingCumulativeKg:0,retainedCumulativeKg:0,atmosphericAblatedCumulativeKg:0,pendingIncomingKg:0,types,surfaceDepositsKg:0,atmosphericTransientKg:0,atmosphericAblatedCumulativeKg:0,pendingAtmosphericDustSettledKg:0,craterImpactsGreaterThan8mCumulative:0,impactFractionalAccumulator:0,lastImpactSol:0,recentImpacts:[]},
      mineralDepositsKg:{silicates:0,ironNickel:0,sulfides:0,carbonOrganics:0,otherMinerals:0,waterIceUnprocessed:0,carbonDioxideIce:0,otherVolatiles:0},
      externalWaterInputsKg:0,externalWaterOutputsKg:0
    },
    colonies:{},ledger:[],energy:{electricityConsumedKWh:0,heatReleasedKWh:0,thermalHeatInputJ:0,thermalHeatLostJ:0,storedThermalEnergyJ:0},
    externalFlows:{importedWaterKg:0,exportedWaterKg:0,meteoroidMatterKg:0,colonyMatterImportsKg:0,colonyMatterExportsKg:0},
    diagnostics:{waterBalanceErrorKg:0,lastWaterBalanceCheckSol:0,hydrogenBalanceErrorKg:0,oxygenBalanceErrorKg:0,colonyMatterBalanceErrorKg:0,carbonBalanceErrorKg:0}
  };
}

export function ensureMaterialInventories(w) {
  w.materials??=createMaterialInventories();
  const m=w.materials;
  m.colonies??={};m.siteDeposits??={};m.ledger??=[];m.energy??={electricityConsumedKWh:0,heatReleasedKWh:0};
  for(const stock of Object.values(m.planetary.waterKg??{}))stock.compensation??=0;
  m.externalFlows??={importedWaterKg:0,exportedWaterKg:0,meteoroidMatterKg:0};
  m.externalFlowsCompensation??={importedWaterKg:0,exportedWaterKg:0};
  m.diagnostics??={waterBalanceErrorKg:0,lastWaterBalanceCheckSol:0,hydrogenBalanceErrorKg:0,oxygenBalanceErrorKg:0};
  const home=w.settlements?.find(s=>s.kind==='primary-colony');
  for(const settlement of (w.settlements??[])){
    const isHome=settlement.kind==='primary-colony';
    if(!m.colonies[settlement.id]){
      const waterKg=isHome?Math.max(0,Number(w.economy?.water??0))*1000:Math.max(0,Number(settlement.initialLifeSupport?.waterKg??15000));
      m.colonies[settlement.id]={waterKg:{tanks:waterKg,processWater:0,habitatHumidity:0,wastewater:0},gasesKg:{hydrogen:0,oxygen:0,carbonDioxide:0,nitrogen:0,argon:0,carbonMonoxide:0},energy:{storedKWh:0},foodKg:0,biomassKg:0,note:isHome?'Legacy economy water bridged at 1,000 kg per unit.':'Initial settlement life-support stores.'};
    }
    const colony=m.colonies[settlement.id];
    if(!colony.physicalStocksVersion){
      const population=Math.max(0,Number(settlement.population??(isHome?w.colonists?.population:0))||0);
      colony.foodKg=Math.max(1000,population*0.62*(88775.244/86400)*90);
      colony.biomassKg=0;
      colony.solidWasteKg=0;
      colony.materialsKg={regolith:0,aggregate:0,metalConcentrate:0,tailings:0,constructionComponents:0,constructionInProgress:0,slag:0,nutrients:500,spareParts:250,polymers:100};
      colony.gasesKg.oxygen=(colony.gasesKg.oxygen??0)+(isHome?20000:Math.max(0,Number(settlement.initialLifeSupport?.oxygenKg??10000)));
      colony.thermal??={storedEnergyJ:0,capacityJPerK:2e9,referenceTemperatureC:20,temperatureC:20,heatInputCumulativeJ:0,heatLossCumulativeJ:0};
      colony.physicalStocksVersion=1;
      if(isHome){
        // Older prototype saves predate the physical food/gas manifest. Rebaseline once after migration.
        m.diagnostics.initialTotalWaterKg=undefined;
        m.diagnostics.initialHydrogenEquivalentKg=undefined;
        m.diagnostics.initialOxygenEquivalentKg=undefined;
        m.diagnostics.initialColonyMatterMassKg=undefined;
        m.diagnostics.initialCarbonKg=undefined;
        m.diagnostics.initialTrackedStocks=undefined;
      }else if(m.diagnostics.initialTrackedStocks){
        // A newly founded colony enters the tracked system boundary with its arrival manifest.
        // Add that manifest to the baseline so it is not misreported as unexplained matter creation.
        const snapshot=m.diagnostics.initialTrackedStocks;
        const c=colony;
        snapshot.colonies??={};
        snapshot.colonies[settlement.id]={
          waterKg:Object.fromEntries(Object.entries(c.waterKg).map(([key,value])=>[key,value-(c.waterCompensation?.[key]??0)])),
          gasesKg:{...c.gasesKg},foodKg:c.foodKg??0,biomassKg:c.biomassKg??0,solidWasteKg:c.solidWasteKg??0,
          materialsKg:{...(c.materialsKg??{})}
        };
        const initialMass=Object.values(c.waterKg).reduce((sum,value)=>sum+value,0)+Object.values(c.gasesKg).reduce((sum,value)=>sum+(Number(value)||0),0)+(c.foodKg??0)+(c.biomassKg??0)+(c.solidWasteKg??0)+Object.values(c.materialsKg??{}).reduce((sum,value)=>sum+(Number(value)||0),0);
        m.diagnostics.initialColonyMatterMassKg=(m.diagnostics.initialColonyMatterMassKg??0)+initialMass;
      }
    }
    colony.gasesKg.carbonDioxide??=0;
    colony.gasesKg.carbonMonoxide??=0;
    colony.solidWasteKg??=0;
    colony.biomassKg??=0;
    colony.materialsKg??={regolith:0,aggregate:0,metalConcentrate:0,tailings:0,constructionComponents:0,constructionInProgress:0,slag:0,nutrients:500,spareParts:250,polymers:100};
    colony.materialsKg.constructionComponents??=0;
    colony.materialsKg.constructionInProgress??=0;
    colony.thermal??={storedEnergyJ:0,capacityJPerK:2e9,referenceTemperatureC:20,temperatureC:20,heatInputCumulativeJ:0,heatLossCumulativeJ:0};
  }
  m.energy.thermalHeatInputJ??=0;m.energy.thermalHeatLostJ??=0;m.energy.storedThermalEnergyJ??=0;
  m.externalFlows.colonyMatterImportsKg??=0;m.externalFlows.colonyMatterExportsKg??=0;
  m.diagnostics.colonyMatterBalanceErrorKg??=0;m.diagnostics.carbonBalanceErrorKg??=0;
  if(home?.locationId&&!m.siteDeposits[home.locationId]){
    const access=Math.max(0,Math.min(1,Number(home.siteModifiers?.waterAccess??0.5)));
    const global=m.planetary.waterKg.subsurfaceIce;
    const allocatedKg=Math.min(global.mass,global.mass*(0.000001+access*0.000004));
    const y=-allocatedKg-(global.compensation??0),t=global.mass+y;
    global.compensation=(t-global.mass)-y;global.mass=t;
    const stockId='site_'+home.locationId+'_subsurfaceIce';
    m.planetary.waterKg[stockId]={mass:allocatedKg,compensation:0,confidence:'very-low',note:'Allocated local subsurface-ice deposit; estimated from site prospectivity, not a direct measurement.'};
    m.siteDeposits[home.locationId]={siteId:home.locationId,waterStockId:stockId,estimatedReserveKg:allocatedKg,waterAccess:access,surveyed:false,confidence:'very-low',extractionRateKgPerSol:500+access*1000,regolithAvailableKg:1e9,regolithConfidence:'low',regolithNote:'Illustrative accessible surface/regolith reserve for local processing; not a mapped mineable reserve.'};
  }
  if(home?.locationId&&m.siteDeposits[home.locationId]){
    const deposit=m.siteDeposits[home.locationId];
    deposit.regolithAvailableKg??=1e9;
    deposit.regolithConfidence??='low';
    deposit.regolithNote??='Illustrative accessible surface/regolith reserve for local processing; not a mapped mineable reserve.';
  }
  return m;
}

function addExternalWaterFlow(m,key,delta){
  m.externalFlowsCompensation??={importedWaterKg:0,exportedWaterKg:0};
  const old=Number(m.externalFlows[key])||0,comp=m.externalFlowsCompensation[key]||0;
  const y=delta-comp,next=old+y;
  m.externalFlowsCompensation[key]=(next-old)-y;
  m.externalFlows[key]=next;
}
function waterStock(m,endpoint){
  const [scope,owner,compartment]=String(endpoint).split(':');
  if(scope==='planet'&&m.planetary.waterKg[owner]){
    const stock=m.planetary.waterKg[owner];
    return {get mass(){return stock.mass;},set mass(v){stock.mass=v;},adjust(delta){const y=delta-(stock.compensation??0);const t=stock.mass+y;stock.compensation=(t-stock.mass)-y;stock.mass=t;}};
  }
  if(scope==='colony'&&m.colonies[owner]?.waterKg?.[compartment]!==undefined){
    const colony=m.colonies[owner];colony.waterCompensation??={};colony.waterCompensation[compartment]??=0;
    return {get mass(){return colony.waterKg[compartment];},set mass(v){colony.waterKg[compartment]=v;},adjust(delta){const y=delta-colony.waterCompensation[compartment];const t=colony.waterKg[compartment]+y;colony.waterCompensation[compartment]=(t-colony.waterKg[compartment])-y;colony.waterKg[compartment]=t;}};
  }
  return null;
}
export function transferWater(w,{from,to,massKg,sol=0,process='transfer',note=''}){
  const m=ensureMaterialInventories(w);
  if(!Number.isFinite(massKg)||massKg<=0)throw new Error('Water transfer massKg must be positive and finite.');
  const a=waterStock(m,from),b=waterStock(m,to);
  if(!a||!b)throw new Error('Unknown water inventory endpoint.');
  if(a.mass+1e-9<massKg)throw new Error('Insufficient water in source inventory.');
  a.adjust(-massKg);b.adjust(massKg);m.ledger.push({sol,substance:'H2O',massKg,from,to,process,note});
  return {ok:true,massKg,from,to};
}

function addMeteoroidComposition(m,type,incomingKg,retainedKg,sol,sourceLabel){
  const mineral=m.planetary.mineralDepositsKg,atmosphere=m.planetary.atmosphereKg;
  const ablatedKg=incomingKg-retainedKg;
  for(const [component,fraction] of Object.entries(type.composition)){
    const incomingComponent=incomingKg*fraction,retained=retainedKg*fraction,ablated=ablatedKg*fraction;
    if(component==='silicates'){mineral.silicates+=retained;atmosphere.meteoroidAerosols+=ablated;}
    else if(component==='ironNickel'){mineral.ironNickel+=retained;atmosphere.meteoroidAerosols+=ablated;}
    else if(component==='sulfides'){mineral.sulfides+=retained;atmosphere.meteoroidAerosols+=ablated;}
    else if(component==='carbonOrganics'){mineral.carbonOrganics+=retained;atmosphere.meteoroidAerosols+=ablated;}
    else if(component==='otherMinerals'){mineral.otherMinerals+=retained;atmosphere.meteoroidAerosols+=ablated;}
    else if(component==='carbonDioxideIce'){mineral.carbonDioxideIce+=retained;atmosphere.carbonDioxide+=ablated;}
    else if(component==='otherVolatiles'){mineral.otherVolatiles+=retained;atmosphere.otherGases+=ablated;}
    else if(component==='waterIce'){
      const retainedWater=retained,ablatedWater=ablated;
      const vapour=ablatedWater+retainedWater*.8,ice=retainedWater*.2;
      waterStock(m,'planet:atmosphericVapour').adjust(vapour);
      waterStock(m,'planet:surfaceIce').adjust(ice);
      const accountedWaterKg=vapour+ice;
      m.planetary.externalWaterInputsKg+=accountedWaterKg;addExternalWaterFlow(m,'importedWaterKg',accountedWaterKg);
      m.ledger.push({sol,substance:'H2O',massKg:accountedWaterKg,from:'space:'+sourceLabel,to:'planet:water-reservoirs',process:'meteoroid-volatile-delivery',note:'Recorded mass equals the sum actually added to atmospheric vapour and surface ice; ablated ice becomes vapour and retained ice is split between vapour and surface ice.'});
    }
  }
}

function pseudoRandom01(seed){const value=Math.sin(seed*12.9898)*43758.5453;return value-Math.floor(value);}

export function processNaturalMeteoroidFlux(w,sol){
  const m=ensureMaterialInventories(w),r=m.planetary.meteoroids;
  const incomingKg=METEOROID_MASS_FLUX_KG_PER_EARTH_YEAR*EARTH_DAYS_PER_MARS_SOL/365.25;
  const retainedFraction=.90; // scenario assumption; survival depends on particle size and composition
  const retainedKg=incomingKg*retainedFraction,ablatedKg=incomingKg-retainedKg;
  r.incomingCumulativeKg+=incomingKg;r.retainedCumulativeKg+=retainedKg;r.atmosphericAblatedCumulativeKg+=ablatedKg;
  r.pendingIncomingKg+=incomingKg;m.externalFlows.meteoroidMatterKg+=incomingKg;r.atmosphericTransientKg+=incomingKg;
  for(const type of METEOROID_TYPES){
    const incoming=incomingKg*type.fraction,retained=incoming*retainedFraction,stock=r.types[type.id];
    stock.massKg+=incoming;stock.retainedKg+=retained;stock.ablatedIntoAtmosphereKg+=incoming-retained;
    addMeteoroidComposition(m,type,incoming,retained,sol,'micrometeoroid-dust');
  }
  r.surfaceDepositsKg+=retainedKg;r.atmosphericTransientKg=Math.max(0,r.atmosphericTransientKg-incomingKg);
  r.impactFractionalAccumulator+=320*EARTH_DAYS_PER_MARS_SOL/365.25;
  let impacts=0;while(r.impactFractionalAccumulator>=1){r.impactFractionalAccumulator-=1;impacts++;}
  if(impacts){
    r.craterImpactsGreaterThan8mCumulative+=impacts;r.lastImpactSol=sol;
    for(let i=0;i<impacts;i++){
      // Deterministic quasi-random size/type variation makes tests reproducible without flattening the population.
      const selector=pseudoRandom01(sol*31+i*17.17);
      let cumulative=0,chosen=METEOROID_TYPES[0];
      for(const type of METEOROID_TYPES){cumulative+=type.fraction;if(selector<cumulative){chosen=type;break;}}
      const sizeSelector=pseudoRandom01(sol*17+i*31);
      const diameterM=.5+sizeSelector*1.0;
      const impactMassKg=(4/3)*Math.PI*(diameterM/2)**3*chosen.densityKgM3;
      const retainedImpactKg=impactMassKg*.85;
      const stock=r.types[chosen.id];
      stock.massKg+=impactMassKg;stock.retainedKg+=retainedImpactKg;stock.ablatedIntoAtmosphereKg+=impactMassKg-retainedImpactKg;
      r.incomingCumulativeKg+=impactMassKg;r.retainedCumulativeKg+=retainedImpactKg;r.atmosphericAblatedCumulativeKg+=impactMassKg-retainedImpactKg;
      r.pendingIncomingKg+=impactMassKg;r.surfaceDepositsKg+=retainedImpactKg;m.externalFlows.meteoroidMatterKg+=impactMassKg;
      addMeteoroidComposition(m,chosen,impactMassKg,retainedImpactKg,sol,'impact-body');
      const lat=Math.asin(2*pseudoRandom01(sol*91+i*7.1)-1)*180/Math.PI;
      const lon=pseudoRandom01(sol*113+i*13.7)*360-180;
      const craterDiameterM=8+sizeSelector*12;
      const impact={id:'impact-'+sol+'-'+i,sol,lat,lon,impactorDiameterM:diameterM,craterDiameterM,typeId:chosen.id,typeLabel:chosen.label,massKg:impactMassKg,depositKg:retainedImpactKg,depositComposition:{...chosen.composition}};
      w.terrain??={source:'NASA MOLA MEGDR 4 pixels/degree',geologicalModifications:[],depositSites:[]};
      w.terrain.geologicalModifications??=[];
      const depositStocksKg=Object.fromEntries(Object.entries(chosen.composition).map(([component,fraction])=>[component,retainedImpactKg*fraction]));
      const geologicalRecord={id:impact.id,kind:'impact-crater',sol,lat,lon,craterDiameterM,impactorDiameterM:diameterM,impactorTypeId:chosen.id,impactorTypeLabel:chosen.label,impactorMassKg:impactMassKg,retainedDepositKg:retainedImpactKg,depositComposition:{...chosen.composition},depositStocksKg,terrainDeltaM:{floor:-craterDiameterM*0.16,rim:craterDiameterM*0.035,ejecta:craterDiameterM*0.006},status:'permanent'};
      w.terrain.geologicalModifications.push(geologicalRecord);
      w.terrain.depositSites??=[];
      w.terrain.depositSites.push({id:impact.id+'-deposit',impactId:impact.id,sol,lat,lon,sourceType:chosen.id,sourceLabel:chosen.label,stocksKg:{...depositStocksKg},totalMassKg:Object.values(depositStocksKg).reduce((sum,mass)=>sum+mass,0),accessibility:'unassessed'});
      r.recentImpacts.push(impact);if(r.recentImpacts.length>200)r.recentImpacts.shift();
      m.ledger.push({sol,substance:chosen.label,massKg:impactMassKg,from:'space',to:'planet:impact-site',process:'natural-crater-impact',note:'Modelled '+craterDiameterM.toFixed(1)+' m crater from '+diameterM.toFixed(2)+' m impactor; assumed density '+chosen.densityKgM3+' kg/m3 and 15% entry/impact mass loss.',impactId:impact.id,lat,lon});
    }
  }
  if(sol%30===0){
    m.ledger.push({sol,substance:'mixed meteoroid matter',massKg:r.pendingIncomingKg,from:'space',to:'planet:meteoroid-deposits',process:'natural-flux',note:'30-sol aggregate across modelled meteoroid classes.'});
    r.pendingIncomingKg=0;
    w.events.push({type:'natural-meteoroid-flux',sol,description:'Natural meteoroids deposited approximately '+Math.round(incomingKg*30*retainedFraction).toLocaleString('en-AU')+' kg of mixed mineral and volatile material over the last 30 sols. '+r.craterImpactsGreaterThan8mCumulative+' modelled impacts larger than 8 m have occurred globally.'});
  }
}

export function settleAtmosphericMeteoroidDust(w,sol){
  const m=ensureMaterialInventories(w),atmosphere=m.planetary.atmosphereKg;
  const settled=atmosphere.meteoroidAerosols*.001;
  if(settled>0){
    atmosphere.meteoroidAerosols-=settled;
    m.planetary.mineralDepositsKg.otherMinerals+=settled;
    m.planetary.meteoroids.surfaceDepositsKg+=settled;
    m.planetary.meteoroids.pendingAtmosphericDustSettledKg+=settled;
    if(sol%30===0){m.ledger.push({sol,substance:'mixed meteoroid dust',massKg:m.planetary.meteoroids.pendingAtmosphericDustSettledKg,from:'planet:atmosphere',to:'planet:mineralDeposits',process:'aerosol-settling',note:'Atmospheric dust deposition accumulated over the last 30 sols.'});m.planetary.meteoroids.pendingAtmosphericDustSettledKg=0;}
  }
}

export function syncAtmosphereFromInventories(w){
  const m=ensureMaterialInventories(w),g=m.planetary.atmosphereKg;
  const waterVapour=m.planetary.waterKg.atmosphericVapour.mass;
  const gasMass=g.carbonDioxide+g.nitrogen+g.argon+g.oxygen+g.carbonMonoxide+g.otherGases+waterVapour;
  const totalAtmosphereMass=gasMass+g.meteoroidAerosols;
  const area=4*Math.PI*3_389_500**2,gravity=3.71;
  w.climate.atmosphere??={};
  w.climate.atmosphere.pressurePa=totalAtmosphereMass*gravity/area;
  w.climate.atmosphere.composition='inventory-derived';
  w.climate.atmosphere.co2Fraction=g.carbonDioxide/gasMass;
  w.climate.atmosphere.nitrogenFraction=g.nitrogen/gasMass;
  w.climate.atmosphere.argonFraction=g.argon/gasMass;
  w.climate.atmosphere.oxygenFraction=g.oxygen/gasMass;
  w.climate.atmosphere.carbonMonoxideFraction=g.carbonMonoxide/gasMass;
  w.climate.atmosphere.waterVapourFraction=waterVapour/gasMass;
  w.climate.atmosphere.waterVapourPa=w.climate.atmosphere.pressurePa*w.climate.atmosphere.waterVapourFraction;
  w.climate.atmosphere.totalAtmosphericMassKg=totalAtmosphereMass;
  return w.climate.atmosphere;
}

export function processWaterClimate(w,sol){
  const m=ensureMaterialInventories(w),p=m.planetary.waterKg,temp=Number(w.climate?.meanSurfaceTemperatureC??-63);
  const sublimationRate=Math.max(.00001,.00008*Math.exp((temp+63)/35));
  const freezeRate=temp<0?Math.min(.02,.0005*(-temp)/63):0;
  const liquid=p.surfaceLiquid.mass;
  if(liquid>0){
    const evap=Math.min(liquid,liquid*sublimationRate);waterStock(m,'planet:surfaceLiquid').adjust(-evap);waterStock(m,'planet:atmosphericVapour').adjust(evap);
    m.ledger.push({sol,substance:'H2O',massKg:evap,from:'planet:surfaceLiquid',to:'planet:atmosphericVapour',process:'evaporation',note:'Illustrative climate-dependent phase transfer.'});
    if(temp<0){const freeze=Math.min(p.surfaceLiquid.mass,p.surfaceLiquid.mass*freezeRate);waterStock(m,'planet:surfaceLiquid').adjust(-freeze);waterStock(m,'planet:surfaceIce').adjust(freeze);m.ledger.push({sol,substance:'H2O',massKg:freeze,from:'planet:surfaceLiquid',to:'planet:surfaceIce',process:'freezing',note:'Cold surface conditions freeze liquid water.'});}
  }
  const iceLoss=Math.min(p.surfaceIce.mass,p.surfaceIce.mass*1e-7*sublimationRate);
  if(iceLoss>0){waterStock(m,'planet:surfaceIce').adjust(-iceLoss);waterStock(m,'planet:atmosphericVapour').adjust(iceLoss);m.ledger.push({sol,substance:'H2O',massKg:iceLoss,from:'planet:surfaceIce',to:'planet:atmosphericVapour',process:'sublimation',note:'Illustrative surface-ice sublimation rate.'});}
  const condensationRate=temp<-20?.00015:temp<0?.00003:.000001;
  const condensed=Math.min(p.atmosphericVapour.mass,p.atmosphericVapour.mass*condensationRate);
  if(condensed>0){waterStock(m,'planet:atmosphericVapour').adjust(-condensed);waterStock(m,'planet:surfaceIce').adjust(condensed);m.ledger.push({sol,substance:'H2O',massKg:condensed,from:'planet:atmosphericVapour',to:'planet:surfaceIce',process:'condensation/deposition',note:'Illustrative cold-trap deposition; no spatial resolution yet.'});}
  const escape=Math.min(p.atmosphericVapour.mass,p.atmosphericVapour.mass*1e-8);
  if(escape>0){waterStock(m,'planet:atmosphericVapour').adjust(-escape);m.planetary.externalWaterOutputsKg+=escape;addExternalWaterFlow(m,'exportedWaterKg',escape);m.ledger.push({sol,substance:'H2O',massKg:escape,from:'planet:atmosphericVapour',to:'space',process:'atmospheric-escape',note:'Effective escape placeholder; hydrogen escape and oxygen residue are not yet resolved.'});}
}

export function recycleColonyWater(w,sol){
  const m=ensureMaterialInventories(w);
  for(const [id,colony] of Object.entries(m.colonies)){
    const stock=colony.waterKg;
    const wastewaterRecovery=stock.wastewater*.85;
    if(wastewaterRecovery>0){
      transferWater(w,{from:'colony:'+id+':wastewater',to:'colony:'+id+':tanks',massKg:wastewaterRecovery,sol,process:'wastewater-recycling',note:'85% recovery; remaining water stays in concentrated wastewater/brine.'});
      const electricity=wastewaterRecovery*.001;
      m.energy.electricityConsumedKWh+=electricity;
      if(w.economy)w.economy.water=(Number(w.economy.water)||0)+wastewaterRecovery/1000;
      m.ledger.push({sol,substance:'electricity',energyKWh:electricity,from:'colony:'+id+':electricity',to:'colony:'+id+':water-treatment',process:'electricity-consumption',note:'Electricity used for wastewater treatment.'});
    }
    const humidityRecovery=stock.habitatHumidity*.95;
    if(humidityRecovery>0){
      transferWater(w,{from:'colony:'+id+':habitatHumidity',to:'colony:'+id+':tanks',massKg:humidityRecovery,sol,process:'humidity-condensation',note:'95% of habitat humidity condensed back into usable water; residual humidity remains in the habitat.'});
      const electricity=humidityRecovery*.0015;
      m.energy.electricityConsumedKWh+=electricity;
      if(w.economy)w.economy.water=(Number(w.economy.water)||0)+humidityRecovery/1000;
      m.ledger.push({sol,substance:'electricity',energyKWh:electricity,from:'colony:'+id+':electricity',to:'colony:'+id+':humidity-condenser',process:'electricity-consumption',note:'Electricity used for humidity recovery.'});
    }
  }
}

export function electrolyseWater(w,{colonyId,massKg,sol=0}){
  const m=ensureMaterialInventories(w),c=m.colonies[colonyId];
  if(!c||!Number.isFinite(massKg)||massKg<=0)throw new Error('Valid colony and positive water mass required.');
  if(c.waterKg.tanks<massKg)throw new Error('Insufficient tank water.');
  const h2=massKg*H2_PER_WATER,o2=massKg*O2_PER_WATER,energyKWh=massKg*4.5;
  c.waterKg.tanks-=massKg;c.gasesKg.hydrogen+=h2;c.gasesKg.oxygen+=o2;m.energy.electricityConsumedKWh+=energyKWh;
  m.ledger.push({sol,substance:'H2O',massKg,from:'colony:'+colonyId+':tanks',to:'colony:'+colonyId+':electrolysis',process:'electrolysis',note:'Products: '+h2+' kg H2 and '+o2+' kg O2; electricity '+energyKWh+' kWh.'});
  return {waterKg:massKg,hydrogenKg:h2,oxygenKg:o2,electricityKWh:energyKWh};
}

export function recombineHydrogenOxygen(w,{colonyId,hydrogenKg,sol=0}){
  const m=ensureMaterialInventories(w),c=m.colonies[colonyId];
  if(!c||!Number.isFinite(hydrogenKg)||hydrogenKg<=0)throw new Error('Valid colony and positive hydrogen mass required.');
  const waterKg=hydrogenKg/H2_PER_WATER,oxygenKg=waterKg*O2_PER_WATER;
  if(c.gasesKg.hydrogen+1e-9<hydrogenKg||c.gasesKg.oxygen+1e-9<oxygenKg)throw new Error('Insufficient stored hydrogen or oxygen.');
  c.gasesKg.hydrogen-=hydrogenKg;c.gasesKg.oxygen-=oxygenKg;c.waterKg.tanks+=waterKg;
  const heatKWh=waterKg*3.7;m.energy.heatReleasedKWh+=heatKWh;
  m.ledger.push({sol,substance:'H2O',massKg:waterKg,from:'colony:'+colonyId+':hydrogen+oxygen',to:'colony:'+colonyId+':tanks',process:'fuel-cell-recombination',note:'Recombined hydrogen and oxygen; released approximately '+heatKWh+' kWh heat.'});
  return {waterKg,hydrogenKg,oxygenKg,heatKWh};
}

export function importWater(w,{massKg,to='planet:atmosphericVapour',sol=0,source='external delivery'}){
  const m=ensureMaterialInventories(w);
  if(!Number.isFinite(massKg)||massKg<=0)throw new Error('Imported water mass must be positive.');
  const target=waterStock(m,to);if(!target)throw new Error('Unknown water destination.');
  target.adjust(massKg);m.planetary.externalWaterInputsKg+=massKg;addExternalWaterFlow(m,'importedWaterKg',massKg);
  m.ledger.push({sol,substance:'H2O',massKg,from:source,to,process:'external-water-import',note:'External mass input with a physical source.'});
  return {ok:true,massKg,to};
}

const GLUCOSE_MOLAR_G = 6*12.011 + 12*1.00794 + 6*15.9994;
const CO2_MOLAR_G = 12.011 + 2*15.9994;
const CO_MOLAR_G = 12.011 + 15.9994;
const GLUCOSE_H_FRACTION = 12*1.00794/GLUCOSE_MOLAR_G;
const GLUCOSE_O_FRACTION = 6*15.9994/GLUCOSE_MOLAR_G;
const GLUCOSE_C_FRACTION = 6*12.011/GLUCOSE_MOLAR_G;
const CO2_O_FRACTION = 2*15.9994/CO2_MOLAR_G;
const CO2_C_FRACTION = 12.011/CO2_MOLAR_G;
const CO_O_FRACTION = 15.9994/CO_MOLAR_G;
const CO_C_FRACTION = 12.011/CO_MOLAR_G;
export function consumeColonyWaterForReaction(w,{colonyId,massKg,sol=0,process='chemical-reaction',note=''}){
  const m=ensureMaterialInventories(w);
  if(!Number.isFinite(massKg)||massKg<=0)throw new Error('Reaction water mass must be positive and finite.');
  const stock=waterStock(m,'colony:'+colonyId+':tanks');
  if(!stock||stock.mass+1e-9<massKg)throw new Error('Insufficient colony water for chemical reaction.');
  stock.adjust(-massKg);
  m.ledger.push({sol,substance:'water',massKg,from:'colony:'+colonyId+':tanks',to:'chemical-products',process,note});
  return massKg;
}
export function addColonyWaterFromReaction(w,{colonyId,massKg,sol=0,process='chemical-reaction',note=''}){
  const m=ensureMaterialInventories(w);
  if(!Number.isFinite(massKg)||massKg<=0)throw new Error('Reaction water mass must be positive and finite.');
  const stock=waterStock(m,'colony:'+colonyId+':tanks');
  if(!stock)throw new Error('Unknown colony water inventory.');
  stock.adjust(massKg);
  m.ledger.push({sol,substance:'water',massKg,from:'chemical-reaction',to:'colony:'+colonyId+':tanks',process,note});
  return massKg;
}
export function checkMaterialConservation(w){
  const m=ensureMaterialInventories(w),p=m.planetary.waterKg,colonies=Object.values(m.colonies);
  const currentSnapshot={
    planetaryWaterKg:Object.fromEntries(Object.entries(p).map(([key,x])=>[key,x.mass-(x.compensation??0)])),
    colonies:Object.fromEntries(Object.entries(m.colonies).map(([id,c])=>[id,{
      waterKg:Object.fromEntries(Object.entries(c.waterKg).map(([key,x])=>[key,x-(c.waterCompensation?.[key]??0)])),
      gasesKg:{...c.gasesKg},
      foodKg:c.foodKg??0,biomassKg:c.biomassKg??0,solidWasteKg:c.solidWasteKg??0,
      materialsKg:{...(c.materialsKg??{})}
    }]))
  };
  const snapshot=m.diagnostics.initialTrackedStocks??=JSON.parse(JSON.stringify(currentSnapshot));
  // Compare compartment-by-compartment deltas, not two ~10^16 kg totals. This preserves
  // small transfers that would be rounded away when subtracting planet-sized totals.
  let trackedDeltaKg=0,waterDeltaKg=0,hydrogenDeltaKg=0,oxygenDeltaKg=0,carbonDeltaKg=0;
  const pKeys=new Set([...Object.keys(snapshot.planetaryWaterKg),...Object.keys(currentSnapshot.planetaryWaterKg)]);
  for(const key of pKeys){
    const delta=(currentSnapshot.planetaryWaterKg[key]??0)-(snapshot.planetaryWaterKg[key]??0);
    trackedDeltaKg+=delta;waterDeltaKg+=delta;
    hydrogenDeltaKg+=delta*WATER_H_MASS_FRACTION;
    oxygenDeltaKg+=delta*WATER_O_MASS_FRACTION;
  }
  const colonyIds=new Set([...Object.keys(snapshot.colonies),...Object.keys(currentSnapshot.colonies)]);
  let colonyMass=0;
  for(const id of colonyIds){
    const now=currentSnapshot.colonies[id],before=snapshot.colonies[id];
    const waterKeys=new Set([...Object.keys(now?.waterKg??{}),...Object.keys(before?.waterKg??{})]);
    for(const key of waterKeys){
      const delta=(now?.waterKg?.[key]??0)-(before?.waterKg?.[key]??0);
      trackedDeltaKg+=delta;waterDeltaKg+=delta;
      hydrogenDeltaKg+=delta*WATER_H_MASS_FRACTION;
      oxygenDeltaKg+=delta*WATER_O_MASS_FRACTION;
      colonyMass+=now?.waterKg?.[key]??0;
    }
    const gasKeys=new Set([...Object.keys(now?.gasesKg??{}),...Object.keys(before?.gasesKg??{})]);
    for(const key of gasKeys){
      const delta=(now?.gasesKg?.[key]??0)-(before?.gasesKg?.[key]??0);
      trackedDeltaKg+=delta;
      if(key==='hydrogen')hydrogenDeltaKg+=delta;
      if(key==='oxygen')oxygenDeltaKg+=delta;
      if(key==='carbonDioxide'){oxygenDeltaKg+=delta*CO2_O_FRACTION;carbonDeltaKg+=delta*CO2_C_FRACTION;}
      if(key==='carbonMonoxide'){oxygenDeltaKg+=delta*CO_O_FRACTION;carbonDeltaKg+=delta*CO_C_FRACTION;}
      colonyMass+=now?.gasesKg?.[key]??0;
    }
    for(const key of ['foodKg','biomassKg','solidWasteKg']){
      const delta=(now?.[key]??0)-(before?.[key]??0);
      trackedDeltaKg+=delta;
      hydrogenDeltaKg+=delta*GLUCOSE_H_FRACTION;
      oxygenDeltaKg+=delta*GLUCOSE_O_FRACTION;
      carbonDeltaKg+=delta*GLUCOSE_C_FRACTION;
      colonyMass+=now?.[key]??0;
    }
    const materialKeys=new Set([...Object.keys(now?.materialsKg??{}),...Object.keys(before?.materialsKg??{})]);
    for(const key of materialKeys){
      const current=now?.materialsKg?.[key]??0,initial=before?.materialsKg?.[key]??0;
      // Industrial stocks are part of colonyMatterBalance, not the water/food/gas chemistry subtotal.
      colonyMass+=current;
    }
  }
  const waterNetExternal=(m.externalFlows.importedWaterKg-(m.externalFlowsCompensation?.importedWaterKg??0))-(m.externalFlows.exportedWaterKg-(m.externalFlowsCompensation?.exportedWaterKg??0));
  m.diagnostics.waterBalanceErrorKg=trackedDeltaKg-waterNetExternal;
  m.diagnostics.lastWaterBalanceCheckSol=w.time?.sol??0;
  m.diagnostics.hydrogenBalanceErrorKg=hydrogenDeltaKg-waterNetExternal*WATER_H_MASS_FRACTION;
  m.diagnostics.oxygenBalanceErrorKg=oxygenDeltaKg-waterNetExternal*WATER_O_MASS_FRACTION;
  m.diagnostics.initialTrackedStocks??=snapshot;
  const initialColony=m.diagnostics.initialColonyMatterMassKg??colonyMass;
  m.diagnostics.initialColonyMatterMassKg??=colonyMass;
  m.diagnostics.colonyMatterBalanceErrorKg=colonyMass-(initialColony+m.externalFlows.colonyMatterImportsKg-m.externalFlows.colonyMatterExportsKg);
  m.diagnostics.carbonBalanceErrorKg=carbonDeltaKg;
  const planetaryWater=Object.values(p).reduce((sum,x)=>sum+x.mass-(x.compensation??0),0);
  const colonyWater=colonies.reduce((sum,c)=>sum+Object.entries(c.waterKg).reduce((a,[key,x])=>a+x-(c.waterCompensation?.[key]??0),0),0);
  const hydrogenGas=colonies.reduce((sum,c)=>sum+(c.gasesKg.hydrogen??0),0);
  const oxygenGas=colonies.reduce((sum,c)=>sum+(c.gasesKg.oxygen??0),0);
  const organicMass=colonies.reduce((sum,c)=>sum+Math.max(0,c.foodKg??0)+Math.max(0,c.biomassKg??0)+Math.max(0,c.solidWasteKg??0),0);
  const totalWaterDerivedMassKg=planetaryWater+colonyWater+hydrogenGas+oxygenGas+
    colonies.reduce((sum,c)=>sum+(c.gasesKg.carbonDioxide??0)+(c.gasesKg.carbonMonoxide??0),0)+organicMass;
  m.diagnostics.initialTotalWaterKg??=totalWaterDerivedMassKg;
  const waterMass=planetaryWater+colonyWater;
  const waterH=waterMass*WATER_H_MASS_FRACTION+hydrogenGas+organicMass*GLUCOSE_H_FRACTION;
  const waterO=waterMass*WATER_O_MASS_FRACTION+oxygenGas+
    organicMass*GLUCOSE_O_FRACTION+
    colonies.reduce((sum,c)=>sum+(c.gasesKg.carbonDioxide??0)*CO2_O_FRACTION+(c.gasesKg.carbonMonoxide??0)*CO_O_FRACTION,0);
  m.diagnostics.initialHydrogenEquivalentKg??=waterH;
  m.diagnostics.initialOxygenEquivalentKg??=waterO;
  return {totalWaterDerivedMassKg,waterBalanceErrorKg:m.diagnostics.waterBalanceErrorKg,hydrogenBalanceErrorKg:m.diagnostics.hydrogenBalanceErrorKg,oxygenBalanceErrorKg:m.diagnostics.oxygenBalanceErrorKg,colonyMatterBalanceErrorKg:m.diagnostics.colonyMatterBalanceErrorKg,carbonBalanceErrorKg:m.diagnostics.carbonBalanceErrorKg};
}
