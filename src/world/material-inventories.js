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
    units:{mass:'kg',energy:'kWh',time:'sol'},
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
      atmosphereKg:{carbonDioxide:marsAtmosphereKg*.953,nitrogen:marsAtmosphereKg*.027,argon:marsAtmosphereKg*.016,oxygen:marsAtmosphereKg*.0013,carbonMonoxide:marsAtmosphereKg*.0008,otherGases:marsAtmosphereKg*(1-.953-.027-.016-.0013-.0008)},
      meteoroids:{incomingCumulativeKg:0,retainedCumulativeKg:0,atmosphericAblatedCumulativeKg:0,pendingIncomingKg:0,types,surfaceDepositsKg:0,atmosphericTransientKg:0,atmosphericAblatedCumulativeKg:0,craterImpactsGreaterThan8mCumulative:0,impactFractionalAccumulator:0,lastImpactSol:0},
      mineralDepositsKg:{silicates:0,ironNickel:0,sulfides:0,carbonOrganics:0,otherMinerals:0,waterIceUnprocessed:0,carbonDioxideIce:0,otherVolatiles:0},
      externalWaterInputsKg:0,externalWaterOutputsKg:0
    },
    colonies:{},ledger:[],energy:{electricityConsumedKWh:0,heatReleasedKWh:0},
    externalFlows:{importedWaterKg:0,exportedWaterKg:0,meteoroidMatterKg:0},
    diagnostics:{waterBalanceErrorKg:0,lastWaterBalanceCheckSol:0,hydrogenBalanceErrorKg:0,oxygenBalanceErrorKg:0}
  };
}

export function ensureMaterialInventories(w) {
  w.materials??=createMaterialInventories();
  const m=w.materials;
  m.colonies??={};m.ledger??=[];m.energy??={electricityConsumedKWh:0,heatReleasedKWh:0};
  m.externalFlows??={importedWaterKg:0,exportedWaterKg:0,meteoroidMatterKg:0};
  m.diagnostics??={waterBalanceErrorKg:0,lastWaterBalanceCheckSol:0,hydrogenBalanceErrorKg:0,oxygenBalanceErrorKg:0};
  const home=w.settlements?.find(s=>s.kind==='primary-colony');
  if(home&&!m.colonies[home.id]){
    const waterKg=Math.max(0,Number(w.economy?.water??0))*1000;
    m.colonies[home.id]={waterKg:{tanks:waterKg,processWater:0,habitatHumidity:0,wastewater:0},gasesKg:{hydrogen:0,oxygen:0,carbonDioxide:0,nitrogen:0,argon:0},energy:{storedKWh:0},foodKg:0,biomassKg:0,note:'Legacy economy water bridged at 1,000 kg per unit.'};
  }
  return m;
}

function waterStock(m,endpoint){
  const [scope,owner,compartment]=String(endpoint).split(':');
  if(scope==='planet'&&m.planetary.waterKg[owner])return {get mass(){return m.planetary.waterKg[owner].mass;},set mass(v){m.planetary.waterKg[owner].mass=v;}};
  if(scope==='colony'&&m.colonies[owner]?.waterKg?.[compartment]!==undefined)return {get mass(){return m.colonies[owner].waterKg[compartment];},set mass(v){m.colonies[owner].waterKg[compartment]=v;}};
  return null;
}
export function transferWater(w,{from,to,massKg,sol=0,process='transfer',note=''}){
  const m=ensureMaterialInventories(w);
  if(!Number.isFinite(massKg)||massKg<=0)throw new Error('Water transfer massKg must be positive and finite.');
  const a=waterStock(m,from),b=waterStock(m,to);
  if(!a||!b)throw new Error('Unknown water inventory endpoint.');
  if(a.mass+1e-9<massKg)throw new Error('Insufficient water in source inventory.');
  a.mass-=massKg;b.mass+=massKg;m.ledger.push({sol,substance:'H2O',massKg,from,to,process,note});
  return {ok:true,massKg,from,to};
}

function addRetainedMeteoroidComposition(m,type,massKg,sol){
  const mineral=m.planetary.mineralDepositsKg;
  for(const [component,fraction] of Object.entries(type.composition)){
    const mass=massKg*fraction;
    if(component==='silicates')mineral.silicates+=mass;
    else if(component==='ironNickel')mineral.ironNickel+=mass;
    else if(component==='sulfides')mineral.sulfides+=mass;
    else if(component==='carbonOrganics')mineral.carbonOrganics+=mass;
    else if(component==='otherMinerals')mineral.otherMinerals+=mass;
    else if(component==='carbonDioxideIce')mineral.carbonDioxideIce+=mass;
    else if(component==='otherVolatiles')mineral.otherVolatiles+=mass;
    else if(component==='waterIce'){
      const vapour=mass*.8;
      m.planetary.waterKg.atmosphericVapour.mass+=vapour;
      m.planetary.waterKg.surfaceIce.mass+=mass-vapour;
      m.planetary.externalWaterInputsKg+=mass;
      m.externalFlows.importedWaterKg+=mass;
      m.ledger.push({sol,substance:'H2O',massKg:mass,from:'space:impact-body',to:'planet:water-reservoirs',process:'impact-volatile-delivery',note:'Impact-delivered ice split between atmospheric vapour and surface ice by a scenario assumption.'});
    }
  }
}

export function processNaturalMeteoroidFlux(w,sol){
  const m=ensureMaterialInventories(w),r=m.planetary.meteoroids;
  const incomingKg=METEOROID_MASS_FLUX_KG_PER_EARTH_YEAR*EARTH_DAYS_PER_MARS_SOL/365.25;
  const retainedFraction=.90; // scenario assumption; survival depends on particle size and composition
  const retainedKg=incomingKg*retainedFraction,ablatedKg=incomingKg-retainedKg;
  r.incomingCumulativeKg+=incomingKg;r.retainedCumulativeKg+=retainedKg;r.atmosphericAblatedCumulativeKg+=ablatedKg;
  r.pendingIncomingKg+=incomingKg;m.externalFlows.meteoroidMatterKg+=incomingKg;r.atmosphericTransientKg+=incomingKg;
  const mineral=m.planetary.mineralDepositsKg;
  for(const type of METEOROID_TYPES){
    const incoming=incomingKg*type.fraction,retained=incoming*retainedFraction,stock=r.types[type.id];
    stock.massKg+=incoming;stock.retainedKg+=retained;stock.ablatedIntoAtmosphereKg+=incoming-retained;
    for(const [component,fraction] of Object.entries(type.composition)){
      const mass=retained*fraction;
      if(component==='silicates')mineral.silicates+=mass;
      else if(component==='ironNickel')mineral.ironNickel+=mass;
      else if(component==='sulfides')mineral.sulfides+=mass;
      else if(component==='carbonOrganics')mineral.carbonOrganics+=mass;
      else if(component==='otherMinerals')mineral.otherMinerals+=mass;
      else if(component==='carbonDioxideIce')mineral.carbonDioxideIce+=mass;
      else if(component==='otherVolatiles')mineral.otherVolatiles+=mass;
      else if(component==='waterIce'){
        const deliveredWater=incoming*fraction;
        const vapour=deliveredWater*.8;
        m.planetary.waterKg.surfaceIce.mass+=deliveredWater-vapour;
        m.planetary.waterKg.atmosphericVapour.mass+=vapour;
        m.planetary.externalWaterInputsKg+=deliveredWater;m.externalFlows.importedWaterKg+=deliveredWater;
        m.ledger.push({sol,substance:'H2O',massKg:deliveredWater,from:'space:meteoroid-ice',to:'planet:water-reservoirs',process:'natural-volatile-delivery',note:'Modelled water-bearing dust contributes vapour and surface ice; volatile fraction is an uncertain scenario assumption.'});
      }
    }
  }
  r.surfaceDepositsKg+=retainedKg;r.atmosphericTransientKg=Math.max(0,r.atmosphericTransientKg-incomingKg);
  r.impactFractionalAccumulator+=320*EARTH_DAYS_PER_MARS_SOL/365.25;
  let impacts=0;while(r.impactFractionalAccumulator>=1){r.impactFractionalAccumulator-=1;impacts++;}
  if(impacts){
    r.craterImpactsGreaterThan8mCumulative+=impacts;r.lastImpactSol=sol;
    for(let i=0;i<impacts;i++){
      // Deterministic quasi-random size/type variation makes tests reproducible without flattening the population.
      const selector=Math.abs(Math.sin((sol+i*17.17)*12.9898)*43758.5453)%1;
      let cumulative=0,chosen=METEOROID_TYPES[0];
      for(const type of METEOROID_TYPES){cumulative+=type.fraction;if(selector<cumulative){chosen=type;break;}}
      const sizeSelector=(Math.sin((sol*17+i*31)*.123)+1)/2;
      const diameterM=.35+sizeSelector*1.1;
      const impactMassKg=(4/3)*Math.PI*(diameterM/2)**3*chosen.densityKgM3;
      const retainedImpactKg=impactMassKg*.85;
      const stock=r.types[chosen.id];
      stock.massKg+=impactMassKg;stock.retainedKg+=retainedImpactKg;stock.ablatedIntoAtmosphereKg+=impactMassKg-retainedImpactKg;
      r.incomingCumulativeKg+=impactMassKg;r.retainedCumulativeKg+=retainedImpactKg;r.atmosphericAblatedCumulativeKg+=impactMassKg-retainedImpactKg;
      r.pendingIncomingKg+=impactMassKg;r.surfaceDepositsKg+=retainedImpactKg;m.externalFlows.meteoroidMatterKg+=impactMassKg;
      addRetainedMeteoroidComposition(m,chosen,retainedImpactKg,sol);
      m.ledger.push({sol,substance:chosen.label,massKg:impactMassKg,from:'space',to:'planet:impact-site',process:'natural-crater-impact',note:'Modelled impactor diameter '+diameterM.toFixed(2)+' m; assumed density '+chosen.densityKgM3+' kg/m3; 15% entry/impact mass loss.'});
    }
  }
  if(sol%30===0){
    m.ledger.push({sol,substance:'mixed meteoroid matter',massKg:r.pendingIncomingKg,from:'space',to:'planet:meteoroid-deposits',process:'natural-flux',note:'30-sol aggregate across modelled meteoroid classes.'});
    r.pendingIncomingKg=0;
    w.events.push({type:'natural-meteoroid-flux',sol,description:'Natural meteoroids deposited approximately '+Math.round(incomingKg*30*retainedFraction).toLocaleString('en-AU')+' kg of mixed mineral and volatile material over the last 30 sols. '+r.craterImpactsGreaterThan8mCumulative+' modelled impacts larger than 8 m have occurred globally.'});
  }
}

export function processWaterClimate(w,sol){
  const m=ensureMaterialInventories(w),p=m.planetary.waterKg,temp=Number(w.climate?.meanSurfaceTemperatureC??-63);
  const sublimationRate=Math.max(.00001,.00008*Math.exp((temp+63)/35));
  const freezeRate=temp<0?Math.min(.02,.0005*(-temp)/63):0;
  const liquid=p.surfaceLiquid.mass;
  if(liquid>0){
    const evap=Math.min(liquid,liquid*sublimationRate);p.surfaceLiquid.mass-=evap;p.atmosphericVapour.mass+=evap;
    m.ledger.push({sol,substance:'H2O',massKg:evap,from:'planet:surfaceLiquid',to:'planet:atmosphericVapour',process:'evaporation',note:'Illustrative climate-dependent phase transfer.'});
    if(temp<0){const freeze=Math.min(p.surfaceLiquid.mass,p.surfaceLiquid.mass*freezeRate);p.surfaceLiquid.mass-=freeze;p.surfaceIce.mass+=freeze;m.ledger.push({sol,substance:'H2O',massKg:freeze,from:'planet:surfaceLiquid',to:'planet:surfaceIce',process:'freezing',note:'Cold surface conditions freeze liquid water.'});}
  }
  const iceLoss=Math.min(p.surfaceIce.mass,p.surfaceIce.mass*1e-7*sublimationRate);
  if(iceLoss>0){p.surfaceIce.mass-=iceLoss;p.atmosphericVapour.mass+=iceLoss;m.ledger.push({sol,substance:'H2O',massKg:iceLoss,from:'planet:surfaceIce',to:'planet:atmosphericVapour',process:'sublimation',note:'Illustrative surface-ice sublimation rate.'});}
  const condensationRate=temp<-20?.00015:temp<0?.00003:.000001;
  const condensed=Math.min(p.atmosphericVapour.mass,p.atmosphericVapour.mass*condensationRate);
  if(condensed>0){p.atmosphericVapour.mass-=condensed;p.surfaceIce.mass+=condensed;m.ledger.push({sol,substance:'H2O',massKg:condensed,from:'planet:atmosphericVapour',to:'planet:surfaceIce',process:'condensation/deposition',note:'Illustrative cold-trap deposition; no spatial resolution yet.'});}
  const escape=Math.min(p.atmosphericVapour.mass,p.atmosphericVapour.mass*1e-8);
  if(escape>0){p.atmosphericVapour.mass-=escape;m.planetary.externalWaterOutputsKg+=escape;m.externalFlows.exportedWaterKg+=escape;m.ledger.push({sol,substance:'H2O',massKg:escape,from:'planet:atmosphericVapour',to:'space',process:'atmospheric-escape',note:'Effective escape placeholder; hydrogen escape and oxygen residue are not yet resolved.'});}
}

export function recycleColonyWater(w,sol){
  const m=ensureMaterialInventories(w);
  for(const [id,c] of Object.entries(m.colonies)){
    const stock=c.waterKg,recovered=stock.wastewater*.85;
    if(recovered>0){
      const electricity=recovered*.001;stock.wastewater-=recovered;stock.tanks+=recovered;
      m.energy.electricityConsumedKWh+=electricity;
      if(w.economy)w.economy.water=(Number(w.economy.water)||0)+recovered/1000;
      m.ledger.push({sol,substance:'H2O',massKg:recovered,from:'colony:'+id+':wastewater',to:'colony:'+id+':tanks',process:'water-recycling',note:'85% recovered; 15% remains in brine/losses; electricity '+electricity.toFixed(3)+' kWh.'});
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
  target.mass+=massKg;m.planetary.externalWaterInputsKg+=massKg;m.externalFlows.importedWaterKg+=massKg;
  m.ledger.push({sol,substance:'H2O',massKg,from:source,to,process:'external-water-import',note:'External mass input with a physical source.'});
  return {ok:true,massKg,to};
}

export function checkMaterialConservation(w){
  const m=ensureMaterialInventories(w),p=m.planetary.waterKg;
  const planetary=Object.values(p).reduce((sum,x)=>sum+x.mass,0);
  const colony=Object.values(m.colonies).reduce((sum,c)=>sum+Object.values(c.waterKg).reduce((a,x)=>a+x,0),0);
  const total=planetary+colony;
  const initial=m.diagnostics.initialTotalWaterKg??total;m.diagnostics.initialTotalWaterKg??=total;
  const expected=initial+m.externalFlows.importedWaterKg-m.externalFlows.exportedWaterKg;
  m.diagnostics.waterBalanceErrorKg=total-expected;m.diagnostics.lastWaterBalanceCheckSol=w.time?.sol??0;
  const waterH=total*WATER_H_MASS_FRACTION+Object.values(m.colonies).reduce((a,c)=>a+(c.gasesKg.hydrogen??0),0);
  const waterO=total*WATER_O_MASS_FRACTION+Object.values(m.colonies).reduce((a,c)=>a+(c.gasesKg.oxygen??0),0);
  const initialH=m.diagnostics.initialHydrogenEquivalentKg??waterH;m.diagnostics.initialHydrogenEquivalentKg??=waterH;
  const initialO=m.diagnostics.initialOxygenEquivalentKg??waterO;m.diagnostics.initialOxygenEquivalentKg??=waterO;
  m.diagnostics.hydrogenBalanceErrorKg=waterH-(initialH+(m.externalFlows.importedWaterKg-m.externalFlows.exportedWaterKg)*WATER_H_MASS_FRACTION);
  m.diagnostics.oxygenBalanceErrorKg=waterO-(initialO+(m.externalFlows.importedWaterKg-m.externalFlows.exportedWaterKg)*WATER_O_MASS_FRACTION);
  return {totalWaterKg:total,waterBalanceErrorKg:m.diagnostics.waterBalanceErrorKg,hydrogenBalanceErrorKg:m.diagnostics.hydrogenBalanceErrorKg,oxygenBalanceErrorKg:m.diagnostics.oxygenBalanceErrorKg};
}
