// Canonical registry for infrastructure assets, actors and their relationships.
// Existing colony economy, freight, project and asteroid-operation systems remain the
// operational owners of their respective mechanics; this module provides shared identity.
function primaryColonyId(w){
  return (w.settlements??[]).find(item=>item.kind==='primary-colony')?.id??null;
}
function ensureActor(w,id,data={}){
  if(!id)return null;
  const actors=w.infrastructure.actors;
  let actor=actors.find(item=>item.id===id);
  if(!actor){actor={id,type:data.type??'organisation',name:data.name??id,kind:data.kind??'organisation',status:'active'};actors.push(actor);}
  Object.assign(actor,{...data,id});
  return actor;
}
function relationshipId(type,fromId,toType,toId){
  return [type,fromId,toType,toId].join('|');
}
export function ensureInfrastructureRelationship(w,{type,fromId,toId,toType='asset',status=null,metadata=null,createdSol=null}){
  if(!fromId||!toId||!type)return null;
  const relationships=w.infrastructure.relationships;
  const id=relationshipId(type,fromId,toType,toId);
  let relation=relationships.find(item=>item.id===id);
  if(!relation){
    relation={id,type,fromId,toId,toType,status:status??'active',createdSol:createdSol??w.time?.sol??0,metadata:metadata?{...metadata}:{}};
    relationships.push(relation);
  }else{
    if(status!==null&&status!==undefined)relation.status=status;
    if(metadata)relation.metadata={...(relation.metadata??{}),...metadata};
  }
  return relation;
}
export function ensureInfrastructureModel(w){
  if(!w)return null;
  w.infrastructure??={routes:[],assets:[],projects:[]};
  const infra=w.infrastructure;
  infra.routes??=[];
  infra.assets??=[];
  infra.projects??=[];
  infra.actors??=[];
  infra.relationships??=[];
  infra.activities??=[];
  infra.nextActivityId=Math.max(1,Number(infra.nextActivityId)||1);

  for(const sponsor of (w.sponsors??[])){
    ensureActor(w,sponsor.id,{type:'sponsor',kind:sponsor.type??'sponsor',name:sponsor.name??sponsor.id,status:sponsor.status??'active',sponsorType:sponsor.type??null});
  }
  for(const settlement of (w.settlements??[])){
    ensureActor(w,settlement.id,{type:'colony',kind:settlement.kind??'colony',name:settlement.name??settlement.id,status:settlement.status??'active',sponsorId:settlement.sponsorId??null});
    if(settlement.sponsorId&&w.sponsors?.some(item=>item.id===settlement.sponsorId)){
      ensureInfrastructureRelationship(w,{type:'sponsored-by',fromId:settlement.id,toId:settlement.sponsorId,toType:'actor',metadata:{origin:'legacy-settlement-sponsor'}});
    }
  }

  // One-time migration: asteroid operations previously owned a second orbitalAssets
  // collection. Move those same records into the shared infrastructure registry.
  // The legacy collection is then removed; asteroid operations use the canonical registry.
  const legacyOrbital=w.asteroidOperations?.orbitalAssets;
  if(Array.isArray(legacyOrbital)){
    for(const legacy of legacyOrbital){
      if(!legacy?.id)continue;
      let asset=infra.assets.find(item=>item.id===legacy.id);
      if(!asset){asset=legacy;infra.assets.push(asset);}
      asset.domain='orbital';
      asset.subsystem='asteroid-operations';
      asset.location??={kind:'orbit',body:'mars',orbitPhase:asset.orbitPhase??null};
      asset.dependencies??=[];
      asset.outputs??=[];
      asset.condition??={integrity:asset.status==='disabled'?0.5:1};
      const rawOwner=asset.owner;
      const ownerId=asset.ownerId??(rawOwner==='player'?primaryColonyId(w):rawOwner);
      if(ownerId){
        asset.ownerId=ownerId;
        if(!infra.actors.some(item=>item.id===ownerId))ensureActor(w,ownerId,{type:'colony',kind:'colony',name:(w.settlements??[]).find(x=>x.id===ownerId)?.name??ownerId});
        ensureInfrastructureRelationship(w,{type:'owns',fromId:ownerId,toId:asset.id,metadata:{origin:'migrated-orbital-asset'}});
      }
      const operatorId=asset.operatorId??ownerId;
      if(operatorId)ensureInfrastructureRelationship(w,{type:'operates',fromId:operatorId,toId:asset.id,metadata:{origin:'migrated-orbital-asset'}});
    }
    delete w.asteroidOperations.orbitalAssets;
  }

  // Normalise pre-existing surface assets without replacing their existing identities
  // or the route/project arrays used by current simulation code.
  for(const asset of infra.assets){
    if(!asset?.id)continue;
    asset.domain??=(asset.orbitPhase!==undefined?'orbital':'surface');
    asset.dependencies??=[];
    asset.outputs??=[];
    asset.condition??={integrity:asset.status==='disabled'?0.5:1};
    asset.createdSol??=w.time?.sol??0;
    if(!asset.location&&Number.isFinite(asset.lat)&&Number.isFinite(asset.lon))asset.location={kind:'surface',lat:asset.lat,lon:asset.lon};
    const legacyOwner=asset.ownerId??(asset.owner==='player'?primaryColonyId(w):asset.owner??null);
    if(legacyOwner&&!asset.ownerId)asset.ownerId=legacyOwner;
    const roleFields=[
      {fields:['ownerId','ownerIds'],type:'owns'},
      {fields:['funderId','funderIds'],type:'funds'},
      {fields:['builderId','builderIds'],type:'built'},
      {fields:['operatorId','operatorIds'],type:'operates'},
      {fields:['controllerId','controllerIds'],type:'controls'},
      {fields:['maintainerId','maintainerIds'],type:'maintains'},
      {fields:['technologyProviderId','technologyProviderIds'],type:'provides-technology'},
      {fields:['softwareProviderId','softwareProviderIds'],type:'provides-software'},
      {fields:['softwareControllerId','softwareControllerIds'],type:'controls-software'}
    ];
    for(const role of roleFields){
      const ids=[...new Set(role.fields.flatMap(field=>Array.isArray(asset[field])?asset[field]:asset[field]?[asset[field]]:[]))];
      for(const actorId of ids){
        if(!infra.actors.some(item=>item.id===actorId))ensureActor(w,actorId,{type:'organisation',name:actorId});
        ensureInfrastructureRelationship(w,{type:role.type,fromId:actorId,toId:asset.id,metadata:{origin:'asset-'+role.type}});
      }
    }
    for(const actorId of [...new Set([...(asset.occupantIds??[]),...(asset.softwareModifiedByIds??[])])]){
      if(!infra.actors.some(item=>item.id===actorId))ensureActor(w,actorId,{type:'organisation',name:actorId});
      ensureInfrastructureRelationship(w,{type:(asset.softwareModifiedByIds??[]).includes(actorId)?'modified-software':'occupies',fromId:actorId,toId:asset.id});
    }
  }
  return infra;
}
export function getInfrastructureAssets(w,filter=null){
  const infra=ensureInfrastructureModel(w);
  return (infra?.assets??[]).filter(asset=>!filter||Object.entries(filter).every(([key,value])=>asset[key]===value));
}
export function getOrbitalInfrastructureAssets(w){
  return getInfrastructureAssets(w,{domain:'orbital',subsystem:'asteroid-operations'});
}
export function getInfrastructureRelationships(w,{assetId=null,actorId=null}={}){
  const infra=ensureInfrastructureModel(w);
  return (infra?.relationships??[]).filter(item=>(!assetId||item.toId===assetId||item.fromId===assetId)&&(!actorId||item.fromId===actorId||item.toId===actorId));
}
export function registerInfrastructureAsset(w,data){
  if(!data?.id)throw new Error('Infrastructure assets require a stable id.');
  const infra=ensureInfrastructureModel(w);
  let asset=infra.assets.find(item=>item.id===data.id);
  if(asset)Object.assign(asset,data);
  else{asset={domain:'surface',status:'operational',dependencies:[],outputs:[],condition:{integrity:1},createdSol:w.time?.sol??0,...data};infra.assets.push(asset);}
  ensureInfrastructureModel(w);
  return asset;
}
export function recordInfrastructureActivity(w,activity){
  const infra=ensureInfrastructureModel(w);
  if(!activity||typeof activity.type!=='string')throw new Error('Infrastructure activities require a type.');
  const entry={id:'infrastructure-activity-'+infra.nextActivityId++,sol:activity.sol??w.time?.sol??0,status:'active',...activity};
  infra.activities.push(entry);
  if(infra.activities.length>300)infra.activities.splice(0,infra.activities.length-300);
  return entry;
}
export function getInfrastructureAssetSummary(w,assetId){
  const asset=getInfrastructureAssets(w).find(item=>item.id===assetId);
  if(!asset)return null;
  const relations=getInfrastructureRelationships(w,{assetId});
  const actors=new Map((w.infrastructure.actors??[]).map(item=>[item.id,item]));
  const roles={};
  for(const relation of relations){
    const role=relation.type;
    const actor=actors.get(relation.fromId);
    (roles[role]??=[]).push(actor?.name??relation.fromId);
  }
  return {id:asset.id,name:asset.name??asset.id,domain:asset.domain,kind:asset.kind??asset.type??'infrastructure',status:asset.status??'unknown',owner:(roles.owns??[]).join(', ')||'Unassigned',funder:(roles.funds??[]).join(', ')||'Not recorded',builder:(roles.built??[]).join(', ')||'Not recorded',operator:(roles.operates??[]).join(', ')||'Not recorded',controller:(roles.controls??[]).join(', ')||'Not recorded',maintainer:(roles.maintains??[]).join(', ')||'Not recorded',technologyProviders:(roles['provides-technology']??[]).join(', ')||'Not recorded',softwareProviders:(roles['provides-software']??[]).join(', ')||'Not recorded',softwareControllers:(roles['controls-software']??[]).join(', ')||'Not recorded',softwareModifiers:(roles['modified-software']??[]).join(', ')||'Not recorded',occupants:(roles.occupies??[]).join(', ')||'None recorded',location:asset.location??null,dependencies:[...(asset.dependencies??[])],outputs:[...(asset.outputs??[])],condition:asset.condition??null,relationships:relations.map(item=>({...item}))};
}
