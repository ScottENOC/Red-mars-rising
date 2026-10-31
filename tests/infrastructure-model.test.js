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
import { ensureSettlementInfrastructureAssets, installOxygenGenerator, processOxygenGenerators, processNonPrimaryColonyMetabolism, getColonyOxygenStatus } from '../src/world/infrastructure-services.js';
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

const OXYGEN_TEST_RATIO=18.01528/(0.5*31.9988);

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

test('sponsor independently dispatches oxygen equipment before reserves are exhausted',()=>{
  const w=campaignWorld();
  w.materials.colonies['first-colony'].gasesKg.oxygen=100;
  const events=[];
  processSponsorCommitments(w,1,events);
  const ship=w.colonyTrade.shipments.find(item=>item.kind==='infrastructure-equipment');
  assert.ok(ship);
  assert.equal(ship.equipment.kind,'oxygen-generator');
  assert.equal(ship.toId,'first-colony');
  assert.equal(ship.arrivalSol,241);
  assert.ok(events.some(event=>event.type==='sponsor-oxygen-relief-launched'));
});
