import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureInfrastructureModel,
  getOrbitalInfrastructureAssets,
  getInfrastructureAssetSummary,
  registerInfrastructureAsset,
  ensureInfrastructureRelationship
} from '../src/world/infrastructure-model.js';
import { createMaterialInventories, ensureMaterialInventories, checkMaterialConservation } from '../src/world/material-inventories.js';
import { ensureSettlementInfrastructureAssets, installOxygenGenerator, processOxygenGenerators, processNonPrimaryColonyMetabolism, getColonyOxygenStatus, deliverInfrastructureEquipmentShipment } from '../src/world/infrastructure-services.js';
import { processSponsorCommitments } from '../src/world/sponsor-commitments.js';

function world(){
  return {
    time:{sol:42},
    sponsors:[{id:'nasa',name:'NASA',type:'national'}],
    settlements:[{id:'colony-a',name:'Colony A',kind:'primary-colony',sponsorId:'nasa'}],
    infrastructure:{routes:[{id:'road-a'}],assets:[{id:'beacon-a',kind:'navigation-beacon',status:'operational'}],projects:[{id:'project-a'}]},
    asteroidOperations:{orbitalAssets:[
      {id:'relay-a',name:'Relay A',owner:'player',status:'operational',kind:'communications-satellite'},
      {id:'relay-b',name:'Relay B',owner:'colony-a',status:'disabled',kind:'communications-satellite'}
    ]}
  };
}

test('legacy orbital assets migrate into the shared registry exactly once',()=>{
  const w=world();
  const legacy=w.asteroidOperations.orbitalAssets[0];
  ensureInfrastructureModel(w);
  assert.equal(w.asteroidOperations.orbitalAssets,undefined);
  assert.equal(w.infrastructure.assets.filter(a=>a.id==='relay-a').length,1);
  assert.equal(w.infrastructure.assets.find(a=>a.id==='relay-a'),legacy);
  assert.equal(legacy.domain,'orbital');
  assert.equal(legacy.ownerId,'colony-a');
  assert.equal(getOrbitalInfrastructureAssets(w).length,2);
  const count=w.infrastructure.relationships.length;
  ensureInfrastructureModel(w);
  assert.equal(w.infrastructure.relationships.length,count);
  assert.equal(w.infrastructure.routes[0].id,'road-a');
  assert.equal(w.infrastructure.projects[0].id,'project-a');
});

test('funding, construction, operation, control, occupancy and ownership remain independent',()=>{
  const w=world();
  registerInfrastructureAsset(w,{
    id:'shared-oxygen-plant',name:'Shared oxygen plant',domain:'surface',kind:'oxygen-generator',
    ownerId:'nasa',ownerIds:['colony-a'],funderId:'sponsor-x',builderId:'colony-a',operatorId:'colony-b',
    controllerId:'colony-c',maintainerId:'colony-a',technologyProviderIds:['nasa'],softwareProviderId:'nasa',softwareControllerId:'colony-c',softwareModifiedByIds:['colony-a'],occupantIds:['colony-a','colony-b'],
    dependencies:['electricity','filters'],outputs:['oxygen'],status:'operational'
  });
  const summary=getInfrastructureAssetSummary(w,'shared-oxygen-plant');
  assert.equal(summary.owner,'NASA, Colony A');
  assert.equal(summary.funder,'sponsor-x');
  assert.equal(summary.builder,'Colony A');
  assert.equal(summary.operator,'colony-b');
  assert.equal(summary.controller,'colony-c');
  assert.equal(summary.technologyProviders,'NASA');
  assert.equal(summary.softwareProviders,'NASA');
  assert.equal(summary.softwareControllers,'colony-c');
  assert.equal(summary.softwareModifiers,'Colony A');
  assert.equal(summary.occupants,'Colony A, colony-b');
  assert.deepEqual(summary.dependencies,['electricity','filters']);
  assert.deepEqual(summary.outputs,['oxygen']);
});

test('relationship records can change status without changing asset ownership',()=>{
  const w=world();
  registerInfrastructureAsset(w,{id:'station',name:'Station',ownerId:'nasa',operatorId:'colony-a',status:'operational'});
  ensureInfrastructureRelationship(w,{type:'operates',fromId:'colony-a',toId:'station',status:'suspended'});
  const summary=getInfrastructureAssetSummary(w,'station');
  assert.equal(summary.owner,'NASA');
  assert.equal(w.infrastructure.relationships.find(r=>r.id==='operates|colony-a|asset|station').status,'suspended');
});

test('pre-existing infrastructure assets and route/project collections are retained',()=>{
  const w=world();
  ensureInfrastructureModel(w);
  assert.ok(w.infrastructure.assets.some(a=>a.id==='beacon-a'));
  assert.equal(w.infrastructure.routes.length,1);
  assert.equal(w.infrastructure.projects.length,1);
});

function campaignWorld(){
  const w={
    time:{sol:0},campaign:{started:true,startingSponsorId:'nasa'},
    sponsors:[{id:'nasa',name:'NASA',type:'national',support:88,patience:58,pressure:40,status:'active',relations:{}}],
    settlements:[{id:'first-colony',name:'First Colony',kind:'primary-colony',status:'operational',sponsorId:'nasa',population:100,lat:10,lon:20,infrastructure:['habitats','greenhouse','power-array']}],
    economy:{water:100,powerCapacity:120,powerDemand:88},
    colonists:{population:100,health:82,morale:68},
    events:[]
  };
  w.materials=createMaterialInventories();
  ensureMaterialInventories(w);
  return w;
}

test('existing settlement infrastructure tags migrate to one shared asset each',()=>{
  const w=campaignWorld();
  ensureSettlementInfrastructureAssets(w);
  ensureSettlementInfrastructureAssets(w);
  assert.equal(w.infrastructure.assets.filter(a=>a.sourceTag==='greenhouse'&&a.ownerId==='first-colony').length,1);
  assert.equal(w.infrastructure.assets.find(a=>a.sourceTag==='greenhouse').outputs.includes('oxygen'),true);
});

test('electrolyser produces oxygen from water and electricity without creating free oxygen',()=>{
  const w=campaignWorld();
  const colony=w.materials.colonies['first-colony'];
  colony.gasesKg.oxygen=0;
  const waterBefore=colony.waterKg.tanks;
  const hydrogenBefore=colony.gasesKg.hydrogen;
  installOxygenGenerator(w,{colonyId:'first-colony',assetId:'test-oxygen-unit',capacityOxygenKgPerSol:40});
  const output=processOxygenGenerators(w,1,{powerAvailable:true,events:[]});
  assert.equal(output.length,1);
  assert.ok(Math.abs(colony.gasesKg.oxygen-40)<1e-6);
  assert.ok(colony.waterKg.tanks<waterBefore);
  assert.ok(colony.gasesKg.hydrogen>hydrogenBefore);
  assert.ok(w.materials.energy.electricityConsumedKWh>0);
  assert.ok(Math.abs(output[0].waterKg*OXYGEN_TEST_RATIO-40)<1e-5);
});

const OXYGEN_TEST_RATIO=0.5*31.9988/18.01528;

test('oxygen generation pauses during a colony power shortfall',()=>{
  const w=campaignWorld();
  const colony=w.materials.colonies['first-colony'];
  installOxygenGenerator(w,{colonyId:'first-colony',assetId:'paused-oxygen-unit',capacityOxygenKgPerSol:40});
  const before=colony.gasesKg.oxygen;
  processOxygenGenerators(w,1,{powerAvailable:false,events:[]});
  assert.equal(colony.gasesKg.oxygen,before);
  assert.equal(w.infrastructure.assets.find(a=>a.id==='paused-oxygen-unit').lastPausedReason,'Power shortfall');
});

test('new colonies receive physical life-support stores and enter the conservation baseline',()=>{
  const w=campaignWorld();
  checkMaterialConservation(w);
  w.settlements.push({id:'relief-colony',name:'Relief Colony',kind:'rival-colony',status:'established',sponsorId:'esa',population:45,lat:12,lon:24,infrastructure:['habitats','power-array']});
  ensureMaterialInventories(w);
  const c=w.materials.colonies['relief-colony'];
  assert.equal(c.gasesKg.oxygen,10000);
  assert.ok(c.foodKg>0);
  assert.equal(c.waterKg.tanks,15000);
  const balance=checkMaterialConservation(w);
  assert.ok(Math.abs(balance.waterBalanceErrorKg)<1e-5);
  assert.ok(Math.abs(balance.colonyMatterBalanceErrorKg)<1e-5);
  assert.ok(Math.abs(balance.carbonBalanceErrorKg)<1e-5);
});

test('non-primary colonies consume oxygen through the existing food metabolism model',()=>{
  const w=campaignWorld();
  w.settlements.push({id:'relief-colony',name:'Relief Colony',kind:'rival-colony',status:'established',sponsorId:'esa',population:45,lat:12,lon:24,infrastructure:['habitats','power-array']});
  ensureMaterialInventories(w);
  const c=w.materials.colonies['relief-colony'];
  const oxygenBefore=c.gasesKg.oxygen,foodBefore=c.foodKg;
  processNonPrimaryColonyMetabolism(w,1,[]);
  assert.ok(c.gasesKg.oxygen<oxygenBefore);
  assert.ok(c.foodKg<foodBefore);
  assert.ok(c.gasesKg.carbonDioxide>0);
  assert.ok(getColonyOxygenStatus(w,'relief-colony').runwaySols>0);
});

test('oxygen distress does not create a separate relief settlement',()=>{
  const w=campaignWorld();
  w.materials.colonies['first-colony'].gasesKg.oxygen=100;
  const events=[];
  processSponsorCommitments(w,1,events);
  assert.equal(w.settlements.length,1);
  assert.equal(w.sponsorReliefOutposts,undefined);
  assert.equal(events.some(event=>String(event.type).includes('relief-outpost')),false);
});

test('legacy version-one oxygen reserves migrate once and preserve their conservation baseline',()=>{
  const w=campaignWorld();
  checkMaterialConservation(w);
  const c=w.materials.colonies['first-colony'];
  c.gasesKg.oxygen=5000;
  c.physicalStocksVersion=1;
  const baseline=w.materials.diagnostics.initialTrackedStocks.colonies['first-colony'];
  baseline.gasesKg.oxygen=5000;
  w.materials.diagnostics.initialColonyMatterMassKg-=15000;
  w.materials.diagnostics.initialTotalWaterKg-=15000;
  w.materials.diagnostics.initialOxygenEquivalentKg-=15000;
  ensureMaterialInventories(w);
  assert.equal(c.gasesKg.oxygen,20000);
  assert.equal(c.physicalStocksVersion,2);
  assert.equal(w.materials.diagnostics.initialTrackedStocks.colonies['first-colony'].gasesKg.oxygen,20000);
  const result=checkMaterialConservation(w);
  assert.ok(Math.abs(result.colonyMatterBalanceErrorKg)<1e-5);
});

test('sponsor oxygen cargo is installed on arrival with sponsor ownership and colony software control',()=>{
  const w=campaignWorld();
  w.colonyTrade={shipments:[{
    id:'relief-flight',kind:'infrastructure-equipment',fromId:'earth:nasa',toId:'first-colony',
    good:'oxygen-generator',amount:1,departSol:1,arrivalSol:241,status:'in-transit',
    equipment:{kind:'oxygen-generator',assetId:'delivered-oxygen-unit',name:'Portable oxygen unit',colonyId:'first-colony',ownerId:'nasa',funderId:'nasa',builderId:'nasa',operatorId:'first-colony',controllerId:'nasa',technologyProviderId:'nasa',softwareProviderId:'nasa',softwareControllerId:'first-colony',softwareModifiedByIds:['first-colony'],capacityOxygenKgPerSol:40}
  }],nextShipmentId:2,tradeLog:[]};
  const events=[];
  const destination=w.settlements[0];
  assert.equal(deliverInfrastructureEquipmentShipment(w,w.colonyTrade.shipments[0],destination,241,events),true);
  const asset=w.infrastructure.assets.find(item=>item.id==='delivered-oxygen-unit');
  assert.ok(asset);
  assert.equal(asset.ownerId,'nasa');
  assert.equal(asset.operatorId,'first-colony');
  assert.equal(asset.softwareProviderId,'nasa');
  assert.equal(asset.softwareControllerId,'first-colony');
  assert.ok(w.infrastructure.relationships.some(item=>item.type==='modified-software'&&item.fromId==='first-colony'&&item.toId===asset.id));
  assert.equal(w.colonyTrade.shipments[0].status,'delivered');
  assert.ok(events.some(event=>event.type==='sponsor-oxygen-equipment-arrived'));
});

test('oxygen generator output is capped by shared power headroom',()=>{
  const w=campaignWorld();
  w.economy.powerCapacity=90;
  w.economy.powerDemand=88;
  installOxygenGenerator(w,{colonyId:'first-colony',assetId:'power-limited-oxygen-unit',capacityOxygenKgPerSol:40});
  const output=processOxygenGenerators(w,1,{powerAvailable:true,events:[]});
  assert.equal(output.length,1);
  assert.ok(output[0].oxygenKg>0);
  assert.ok(output[0].oxygenKg<10);
  assert.ok(getColonyOxygenStatus(w,'first-colony').generatorCapacityKgPerSol<10);
});

import { ensureSettlementLifecycle, transitionSettlementLifecycle, updateSettlementLifecycleFromPopulation } from '../src/world/settlement-lifecycle.js';

test('settlement lifecycle initialises idempotently and records its founding sponsor',()=>{
 const w={time:{sol:0},settlements:[{id:'base',name:'Jezero Base',kind:'primary-colony',sponsorId:'nasa',population:100,status:'operational'}]};
 ensureSettlementLifecycle(w);ensureSettlementLifecycle(w);
 assert.equal(w.settlements[0].lifecycle.phase,'active');
 assert.equal(w.settlements[0].lifecycle.occupations.length,1);
 assert.equal(w.settlements[0].lifecycle.occupations[0].sponsorId,'nasa');
 assert.equal(w.settlements[0].lifecycle.history.length,1);
});

test('a distressed colony can recover without changing its infrastructure',()=>{
 const w={time:{sol:12},events:[],settlements:[{id:'base',name:'Base',sponsorId:'nasa',population:80,status:'operational'}],infrastructure:{assets:[{id:'habitat',status:'operational'}]}};
 ensureSettlementLifecycle(w);
 transitionSettlementLifecycle(w,'base','distressed',{reason:'Life-support reserves are declining.'});
 transitionSettlementLifecycle(w,'base','active',{reason:'Life-support restored.'});
 assert.equal(w.settlements[0].status,'operational');
 assert.equal(w.infrastructure.assets[0].status,'operational');
 assert.equal(w.settlements[0].lifecycle.history.length,3);
});

test('zero population abandons a colony but preserves the settlement and its assets',()=>{
 const w={time:{sol:30},events:[],settlements:[{id:'base',name:'Base',kind:'primary-colony',sponsorId:'nasa',population:0,status:'operational'}],infrastructure:{assets:[{id:'habitat',ownerId:'base',status:'operational'}]},colonists:{population:100}};
 updateSettlementLifecycleFromPopulation(w,30,[]);
 assert.equal(w.settlements.length,1);
 assert.equal(w.settlements[0].status,'abandoned');
 assert.equal(w.infrastructure.assets[0].status,'operational');
 assert.equal(w.infrastructure.assets[0].ownerId,'base');
 assert.equal(w.colonists.population,0);
});

test('evacuation remains distinct from population-loss abandonment and later occupation is recorded',()=>{
 const w={time:{sol:50},events:[],settlements:[{id:'base',name:'Base',kind:'primary-colony',sponsorId:'nasa',population:12,status:'distressed'}],infrastructure:{assets:[{id:'habitat',status:'operational'}]},colonists:{population:12}};
 ensureSettlementLifecycle(w);
 transitionSettlementLifecycle(w,'base','evacuated',{reason:'The crew was evacuated.'});
 assert.equal(w.settlements[0].lifecycle.phase,'evacuated');
 assert.equal(w.settlements[0].lifecycle.occupations[0].status,'evacuated');
 transitionSettlementLifecycle(w,'base','active',{reason:'A later expedition has reoccupied the site.',sol:400,population:24,sponsorId:'esa'});
 assert.equal(w.settlements[0].lifecycle.phase,'active');
 assert.equal(w.settlements[0].lifecycle.occupations.length,2);
 assert.equal(w.settlements[0].population,24);
 assert.equal(w.settlements[0].sponsorId,'esa');
 assert.equal(w.settlements[0].lifecycle.occupations[1].sponsorId,'esa');
 assert.equal(w.infrastructure.assets[0].status,'operational');
});

test('reoccupation requires an arriving population',()=>{
 const w={time:{sol:1},settlements:[{id:'base',population:0,status:'abandoned'}]};
 ensureSettlementLifecycle(w);
 assert.throws(()=>transitionSettlementLifecycle(w,'base','active'),/positive arriving population/);
});

test('abandonment cannot be declared while people remain',()=>{
 const w={time:{sol:1},settlements:[{id:'base',population:5,status:'operational'}]};
 ensureSettlementLifecycle(w);
 assert.throws(()=>transitionSettlementLifecycle(w,'base','abandoned'),/population remains/);
});
