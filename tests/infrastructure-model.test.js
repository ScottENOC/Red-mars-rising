import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureInfrastructureModel,
  getOrbitalInfrastructureAssets,
  getInfrastructureAssetSummary,
  registerInfrastructureAsset,
  ensureInfrastructureRelationship
} from '../src/world/infrastructure-model.js';

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
