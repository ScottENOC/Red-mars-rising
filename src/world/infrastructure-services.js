import { ensureInfrastructureModel, registerInfrastructureAsset, recordInfrastructureActivity } from './infrastructure-model.js';
import { ensureMaterialInventories, electrolyseWater, addColonyWaterFromReaction } from './material-inventories.js';

const OXYGEN_PER_WATER=0.5*31.9988/18.01528;
const ELECTRICITY_KWH_PER_KG_OXYGEN=4.5/OXYGEN_PER_WATER;
const GLUCOSE_MOLAR_G=6*12.011+12*1.00794+6*15.9994;
const O2_PER_GLUC=6*31.9988/GLUCOSE_MOLAR_G;
const CO2_PER_GLUC=6*(12.011+2*15.9994)/GLUCOSE_MOLAR_G;
const WATER_PER_GLUC=6*18.01528/GLUCOSE_MOLAR_G;

const TAG_OUTPUTS={
  greenhouse:['food','oxygen'],
  'power-array':['electricity'],
  habitats:['habitable-volume','life-support'],
  'water-extractor':['water'],
  laboratory:['research'],
  workshop:['repairs','fabrication'],
  rovers:['mobility','survey']
};

export function ensureSettlementInfrastructureAssets(w){
  ensureInfrastructureModel(w);
  for(const settlement of (w.settlements??[])){
    for(const tag of (settlement.infrastructure??[])){
      const id='asset-'+settlement.id+'-'+tag;
      if(w.infrastructure.assets.some(asset=>asset.id===id))continue;
      registerInfrastructureAsset(w,{
        id,name:settlement.name+' · '+tag.replaceAll('-',' '),domain:'surface',kind:tag,sourceTag:tag,
        status:settlement.status==='failed'?'inactive':'operational',
        location:{kind:'surface',lat:settlement.lat??null,lon:settlement.lon??null,siteId:settlement.locationId??null},
        ownerId:settlement.id,operatorId:settlement.id,funderId:settlement.sponsorId??null,
        dependencies:tag==='greenhouse'?['electricity','water','carbon dioxide']:tag==='water-extractor'?['electricity']:[],
        outputs:[...(TAG_OUTPUTS[tag]??[])],condition:{integrity:1}
      });
    }
  }
  return w.infrastructure.assets;
}

export function installOxygenGenerator(w,{
  colonyId,assetId,name='Portable oxygen generation unit',ownerId=null,funderId=null,
  builderId=null,operatorId=colonyId,controllerId=null,technologyProviderId=null,
  softwareProviderId=null,softwareControllerId=operatorId,softwareModifiedByIds=[],
  capacityOxygenKgPerSol=60,maxElectricityKWhPerSol=null,source='sponsor-relief-cargo'
}={}){
  const settlement=(w.settlements??[]).find(item=>item.id===colonyId);
  if(!settlement)throw new Error('Cannot install oxygen equipment at an unknown colony.');
  const capacity=Math.max(0,Number(capacityOxygenKgPerSol)||0);
  if(!assetId||capacity<=0)throw new Error('Oxygen equipment requires a stable asset id and positive production capacity.');
  const asset=registerInfrastructureAsset(w,{
    id:assetId,name,domain:'surface',kind:'oxygen-generator',status:'operational',
    ownerId:ownerId??colonyId,funderId,builderId:builderId??colonyId,
    operatorId:operatorId??colonyId,controllerId,
    technologyProviderId,softwareProviderId,softwareControllerId,
    softwareModifiedByIds:[...softwareModifiedByIds],
    location:{kind:'surface',lat:settlement.lat??null,lon:settlement.lon??null,siteId:settlement.locationId??null},
    dependencies:['water','electricity'],outputs:['oxygen'],
    capacityOxygenKgPerSol:capacity,
    maxElectricityKWhPerSol:Math.max(0,Number(maxElectricityKWhPerSol)||capacity*ELECTRICITY_KWH_PER_KG_OXYGEN),
    condition:{integrity:1},source
  });
  recordInfrastructureActivity(w,{type:'equipment-installed',assetId,colonyId,actorId:builderId??colonyId,description:name+' installed at '+settlement.name+'.'});
  return asset;
}

export function processOxygenGenerators(w,sol,{powerAvailable=true,events=[]}={}){
  ensureMaterialInventories(w);
  ensureSettlementInfrastructureAssets(w);
  const results=[];
  for(const asset of (w.infrastructure.assets??[])){
    if(asset.kind!=='oxygen-generator'||asset.domain!=='surface'||asset.status!=='operational')continue;
    const operatorId=asset.operatorId??asset.ownerId;
    const colony=w.materials.colonies[operatorId];
    if(!colony?.waterKg||!colony.gasesKg)continue;
    if(!powerAvailable){asset.lastPausedReason='Power shortfall';continue;}
    delete asset.lastPausedReason;
    const capacity=Math.max(0,Number(asset.capacityOxygenKgPerSol)||0);
    const electricityBudget=Math.max(0,Number(asset.maxElectricityKWhPerSol)||capacity*ELECTRICITY_KWH_PER_KG_OXYGEN);
    const byWater=Math.max(0,colony.waterKg.tanks)*OXYGEN_PER_WATER;
    const byPower=electricityBudget/ELECTRICITY_KWH_PER_KG_OXYGEN;
    const oxygenKg=Math.min(capacity,byWater,byPower);
    if(oxygenKg<=1e-9){asset.lastOutputKg=0;continue;}
    const waterKg=oxygenKg/OXYGEN_PER_WATER;
    const result=electrolyseWater(w,{colonyId:operatorId,massKg:waterKg,sol});
    asset.lastOutputKg=result.oxygenKg;
    asset.lastWaterInputKg=result.waterKg;
    asset.lastElectricityKWh=result.electricityKWh;
    asset.lastProcessedSol=sol;
    results.push({assetId:asset.id,colonyId:operatorId,...result});
    if(result.oxygenKg+1e-6<capacity&&sol%10===0){
      events.push({type:'oxygen-production-limited',sol,assetId:asset.id,description:asset.name+' produced '+result.oxygenKg.toFixed(1)+' kg of oxygen, below its '+capacity.toFixed(1)+' kg/sol capacity because water or electricity was limited.'});
    }
  }
  return results;
}

export function getColonyOxygenStatus(w,colonyId){
  const colony=w.materials?.colonies?.[colonyId];
  if(!colony)return null;
  const settlement=(w.settlements??[]).find(item=>item.id===colonyId);
  const population=Math.max(0,Number(settlement?.population)||0);
  const oxygenKg=Math.max(0,Number(colony.gasesKg?.oxygen)||0);
  // Approximate crew metabolic demand from the existing glucose-equivalent food model.
  const demandKgPerSol=population*0.62*(88775.244/86400)*0.9*O2_PER_GLUC;
  const generators=(w.infrastructure?.assets??[]).filter(asset=>asset.kind==='oxygen-generator'&&asset.status==='operational'&&(asset.operatorId??asset.ownerId)===colonyId);
  const capacityKgPerSol=generators.reduce((sum,asset)=>sum+Math.max(0,Number(asset.capacityOxygenKgPerSol)||0),0);
  return {colonyId,population,oxygenKg,demandKgPerSol,runwaySols:demandKgPerSol>0?oxygenKg/demandKgPerSol:null,generatorCapacityKgPerSol:capacityKgPerSol,generators:generators.map(asset=>asset.id)};
}

export function processNonPrimaryColonyMetabolism(w,sol,events=[]){
  ensureMaterialInventories(w);
  for(const settlement of (w.settlements??[])){
    if(settlement.kind==='primary-colony'||['failed','abandoned'].includes(settlement.status))continue;
    const colony=w.materials.colonies[settlement.id];
    if(!colony)continue;
    const people=Math.max(0,Number(settlement.population)||0);
    const dailyFoodKg=people*0.62*(88775.244/86400);
    const wasteFraction=0.10;
    const requestedFoodKg=Math.min(Math.max(0,colony.foodKg??0),dailyFoodKg);
    const oxygenLimitedFoodKg=Math.max(0,(colony.gasesKg.oxygen??0)/(O2_PER_GLUC*(1-wasteFraction)));
    const foodEatenKg=Math.min(requestedFoodKg,oxygenLimitedFoodKg);
    const metabolisedFoodKg=foodEatenKg*(1-wasteFraction);
    const oxygenUsedKg=metabolisedFoodKg*O2_PER_GLUC;
    const co2ProducedKg=metabolisedFoodKg*CO2_PER_GLUC;
    const metabolicWaterKg=metabolisedFoodKg*WATER_PER_GLUC;
    if(foodEatenKg>0){
      colony.foodKg-=foodEatenKg;
      colony.solidWasteKg=(colony.solidWasteKg??0)+foodEatenKg*wasteFraction;
      colony.gasesKg.oxygen=Math.max(0,colony.gasesKg.oxygen-oxygenUsedKg);
      colony.gasesKg.carbonDioxide=(colony.gasesKg.carbonDioxide??0)+co2ProducedKg;
      addColonyWaterFromReaction(w,{colonyId:settlement.id,massKg:metabolicWaterKg,sol,process:'human-metabolism',note:'Glucose-equivalent food oxidation yields CO2 and metabolic water; 10% of consumed food mass becomes solid waste.'});
      w.materials.ledger.push({sol,process:'human-metabolism',substance:'food',massKg:foodEatenKg,from:'colony:'+settlement.id+':food',to:'colony:'+settlement.id+':biomass-and-products',note:'Simplified colony respiration and food oxidation.'});
    }
    settlement.health=Math.max(0,Number(settlement.health??82)-(foodEatenKg+1e-9<dailyFoodKg?0.25:-0.006));
    settlement.morale=Math.max(0,Math.min(100,Number(settlement.morale??65)+(foodEatenKg+1e-9<dailyFoodKg?-0.35:0.01)));
    if(foodEatenKg+1e-9<dailyFoodKg&&sol%10===0){
      events.push({type:'colony-oxygen-or-food-shortage',sol,description:settlement.name+' cannot sustain full metabolic rations because food or breathable oxygen is insufficient; health and morale are declining.'});
    }
  }
}
