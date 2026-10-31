import { ensureInfrastructureModel, registerInfrastructureAsset, recordInfrastructureActivity } from './infrastructure-model.js';
import { ensureMaterialInventories, electrolyseWater } from './material-inventories.js';

const OXYGEN_PER_WATER=0.5*31.9988/18.01528;
const ELECTRICITY_KWH_PER_KG_OXYGEN=4.5/OXYGEN_PER_WATER;

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
  const demandKgPerSol=population*0.62*(88775.244/86400)*0.9*(0.5*31.9988/180.156);
  const generators=(w.infrastructure?.assets??[]).filter(asset=>asset.kind==='oxygen-generator'&&asset.status==='operational'&&(asset.operatorId??asset.ownerId)===colonyId);
  const capacityKgPerSol=generators.reduce((sum,asset)=>sum+Math.max(0,Number(asset.capacityOxygenKgPerSol)||0),0);
  return {colonyId,population,oxygenKg,demandKgPerSol,runwaySols:demandKgPerSol>0?oxygenKg/demandKgPerSol:null,generatorCapacityKgPerSol:capacityKgPerSol,generators:generators.map(asset=>asset.id)};
}
