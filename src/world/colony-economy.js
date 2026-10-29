import { ensureSponsorCommitments, processSponsorCommitments } from './sponsor-commitments.js';
import { terrainElevationMeters } from './terrain.js';
const GOODS = ['food','components','machinery','electronics','aggregate'];
const clamp = (v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const round3 = v=>Math.round(v*1000)/1000;
const SPECIALISATIONS = {
  agriculture: {label:'Agriculture',produces:{food:0.35},description:'Greenhouse and biological production'},
  fabrication: {label:'Fabrication',produces:{components:0.34,aggregate:0.12},description:'Construction components and processed local feedstock'},
  engineering: {label:'Engineering',produces:{machinery:0.24,components:0.12},description:'Machinery repair and component fabrication'},
  electronics: {label:'Electronics and science',produces:{electronics:0.22,components:0.08},description:'Electronics repair, laboratory work and precision parts'},
  extraction: {label:'Resource extraction',produces:{aggregate:0.85},description:'Regolith excavation and aggregate processing'}
};
const STARTING_STOCKS = {
  agriculture:{food:95,components:12,machinery:8,electronics:7,aggregate:15},
  fabrication:{food:100,components:48,machinery:12,electronics:6,aggregate:80},
  engineering:{food:100,components:24,machinery:35,electronics:7,aggregate:25},
  electronics:{food:100,components:18,machinery:10,electronics:38,aggregate:20},
  extraction:{food:100,components:14,machinery:9,electronics:5,aggregate:100}
};
function selectSpecialisation(settlement,w){
  if(settlement.kind==='primary-colony') return 'agriculture';
  const sponsorIndex=Math.max(0,(w.sponsors??[]).findIndex(s=>s.id===settlement.sponsorId));
  const sequence=['extraction','fabrication','electronics','agriculture','engineering'];
  return sequence[(sponsorIndex-1+sequence.length)%sequence.length];
}
function relationship(a,b){
  const x=Number(a?.politics?.relations?.[b?.id]);
  const y=Number(b?.politics?.relations?.[a?.id]);
  return Number.isFinite(x)&&Number.isFinite(y)?(x+y)/2:Number.isFinite(x)?x:Number.isFinite(y)?y:50;
}
export function ensureColonyEconomies(w){
  if(!Array.isArray(w.settlements))return;
  w.colonyTrade ??= {shipments:[],nextShipmentId:1,lastProcessedSol:0,tradeLog:[]};
  w.campaign ??= {};
  w.campaign.colonyTradePolicy ??= {};
  w.colonyTrade.shipments ??=[];
  w.colonyTrade.tradeLog ??=[];
  w.colonyTrade.emergencyRequests ??=[];
  w.colonyTrade.aidHistory ??=[];
  w.campaign.emergencyAidPolicy ??={};
  ensureSponsorCommitments(w);
  for(const s of w.settlements){
    const spec=selectSpecialisation(s,w);
    s.economy ??={};
    const e=s.economy;
    e.specialisation ??=spec;
    e.inventory ??={};
    const initial=STARTING_STOCKS[e.specialisation]??STARTING_STOCKS.agriculture;
    for(const good of GOODS) if(!Number.isFinite(e.inventory[good])){
      if(s.kind==='primary-colony'){
        const mapped={components:(w.economy?.materials??100)*0.25,machinery:(w.economy?.machinery??40),electronics:(w.economy?.electronics??35),aggregate:Math.max(0,w.materials?.colonies?.[s.id]?.aggregateKg??0)/1000,food:80};
        e.inventory[good]=mapped[good]??initial[good]??20;
      }else e.inventory[good]=initial[good]??20;
    }
    e.importDependence ??=s.kind==='primary-colony'?72:85;
    e.shortages ??={};
    e.lastImportSol ??= -10000;
    e.pendingImport ??=false;
    e.pendingImports ??=[];
    e.lastTradeSol ??= -10000;
    e.stability ??=70;
    e.specialisationLabel ??=SPECIALISATIONS[e.specialisation]?.label??'General settlement';
  }
  return w.colonyTrade;
}
function addTradeLog(w,entry){
  w.colonyTrade.tradeLog.push(entry);
  if(w.colonyTrade.tradeLog.length>100)w.colonyTrade.tradeLog.splice(0,w.colonyTrade.tradeLog.length-100);
}
function routeDistanceKm(a,b){
  const rad=Math.PI/180,lat1=a.lat*rad,lat2=b.lat*rad,dl=(b.lon-a.lon)*rad;
  const dlat=lat2-lat1, wrapped=((dl+Math.PI*3)%(Math.PI*2))-Math.PI;
  const h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(wrapped/2)**2;
  return 3389.5*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}
function greatCirclePoint(a,b,t){
  const rad=Math.PI/180;
  const toVector=p=>({x:Math.cos(p.lat*rad)*Math.cos(p.lon*rad),y:Math.cos(p.lat*rad)*Math.sin(p.lon*rad),z:Math.sin(p.lat*rad)});
  const u=toVector(a),v=toVector(b);
  const dot=Math.max(-1,Math.min(1,u.x*v.x+u.y*v.y+u.z*v.z));
  const angle=Math.acos(dot);
  let x,y,z;
  if(angle<1e-6){x=u.x;y=u.y;z=u.z;}
  else {const sa=Math.sin(angle);const wa=Math.sin((1-t)*angle)/sa,wb=Math.sin(t*angle)/sa;x=u.x*wa+v.x*wb;y=u.y*wa+v.y*wb;z=u.z*wa+v.z*wb;}
  return {lat:Math.atan2(z,Math.hypot(x,y))/rad,lon:Math.atan2(y,x)/rad};
}
function routeTerrainProfile(from,to,distanceKm){
  const samples=[];
  for(let i=0;i<=16;i++){const p=greatCirclePoint(from,to,i/16);const elevation=terrainElevationMeters(p.lat,p.lon);if(!Number.isFinite(elevation))return null;samples.push(elevation);}
  let ascent=0,maxGrade=0;
  const segmentKm=Math.max(0.1,distanceKm/16);
  for(let i=1;i<samples.length;i++){const rise=samples[i]-samples[i-1];if(rise>0)ascent+=rise;maxGrade=Math.max(maxGrade,Math.abs(rise)/(segmentKm*1000));}
  return {minElevation:Math.min(...samples),maxElevation:Math.max(...samples),relief:Math.max(...samples)-Math.min(...samples),ascent,maxGrade};
}
function hasEstablishedRoad(w,from,to){
  return (w.infrastructure?.routes??[]).some(r=>(r.from===from.id&&r.to===to.id)||(r.from===to.id&&r.to===from.id));
}
function routeBeaconCount(w,from,to){
  const beacons=(w.infrastructure?.assets??[]).filter(a=>/beacon/i.test(String(a.kind??a.type??a.name??''))&&!['inactive','destroyed','disabled'].includes(a.status));
  if(!beacons.length)return 0;
  const samples=Array.from({length:17},(_,i)=>greatCirclePoint(from,to,i/16));
  return beacons.filter(asset=>Number.isFinite(asset.lat)&&Number.isFinite(asset.lon)&&samples.some(p=>routeDistanceKm(asset,p)<=50)).length;
}
function routeTravel(w,from,to,distanceKm){
  const profile=routeTerrainProfile(from,to,distanceKm);
  // 360 km/sol is the flat, ordinary-terrain baseline. Relief and steep sampled
  // grades slow an unengineered route; roads and navigation beacons improve progress.
  // These are strategic modifiers, not claims about a particular rover.
  let terrainFactor=1;
  if(profile)terrainFactor=Math.max(1,Math.min(4,1+profile.ascent/12000+profile.maxGrade*4+profile.relief/5000));
  const road=hasEstablishedRoad(w,from,to);
  const beacons=routeBeaconCount(w,from,to);
  const beaconFactor=1+Math.min(3,beacons)*0.08;
  const effectiveSpeed=360*(road?1.3:1)*beaconFactor/terrainFactor;
  return {travelSols:Math.max(2,Math.ceil(distanceKm/effectiveSpeed)+2),profile,road,beacons,effectiveSpeed:Math.round(effectiveSpeed)};
}
function routineExchangeAllowed(w,from,to){
  const primary=(w.settlements??[]).find(s=>s.kind==='primary-colony');
  if(!primary)return true;
  const other=from.id===primary.id?to:to.id===primary.id?from:null;
  if(!other)return true;
  return (w.campaign.colonyTradePolicy?.[other.id]??'normal')!=='no-routine';
}
function priorityFor(w,settlement){
  const primary=(w.settlements??[]).find(s=>s.kind==='primary-colony');
  return primary&&settlement.id!==primary.id&&w.campaign.colonyTradePolicy?.[settlement.id]==='prioritise'?1:0;
}
function aidReserve(good){return {food:35,components:12,machinery:8,electronics:6,aggregate:18}[good]??10;}
function emergencyThreshold(good){return {food:12,components:1,machinery:0.5,electronics:0.25,aggregate:1}[good]??1;}
function emergencyNeed(colony,good){return Number(colony?.economy?.inventory?.[good]??0)<emergencyThreshold(good);}
function aidPolicy(w,recipient){return w.campaign.emergencyAidPolicy?.[recipient.id]??'automatic';}
function noteAid(w,entry){
  w.colonyTrade.aidHistory.push(entry);
  if(w.colonyTrade.aidHistory.length>100)w.colonyTrade.aidHistory.splice(0,w.colonyTrade.aidHistory.length-100);
  addTradeLog(w,entry);
}
function relationIncident(w,recipient,sol,amount,reason){
  for(const other of (w.settlements??[])){
    if(other.id===recipient.id||['failed','abandoned'].includes(other.status))continue;
    const current=relationship(recipient,other);
    recipient.politics ??={relations:{}};
    other.politics ??={relations:{}};
    recipient.politics.relations ??={};
    other.politics.relations ??={};
    const next=clamp(current-amount);
    recipient.politics.relations[other.id]=next;
    other.politics.relations[recipient.id]=next;
  }
  noteAid(w,{sol,kind:'aid-consequences',toId:recipient.id,description:recipient.name+' collapsed after a feasible emergency aid request was refused; relations with other operating colonies deteriorated ('+reason+').'});
}
function assessEmergencyAid(w,sol,events){
  const alive=(w.settlements??[]).filter(s=>!['failed','abandoned'].includes(s.status));
  for(const recipient of alive){
    for(const good of GOODS){
      if(!emergencyNeed(recipient,good))continue;
      let request=w.colonyTrade.emergencyRequests.find(r=>r.toId===recipient.id&&r.good===good&&['open','in-transit'].includes(r.status));
      if(!request){
        request={id:'aid-request-'+(w.colonyTrade.nextShipmentId++),toId:recipient.id,good,openedSol:sol,status:'open',attempts:0,feasibleAidRefused:false};
        w.colonyTrade.emergencyRequests.push(request);
        noteAid(w,{sol,kind:'aid-requested',toId:recipient.id,good,description:recipient.name+' raised an emergency request for '+good+'; humanitarian aid is assessed separately from routine trade.'});
        events.push({type:'colony-emergency-aid-request',sol,description:recipient.name+' requested emergency '+good+' supplies.'});
      }
      if(request.status!=='open')continue;
      request.attempts++;
      const donors=alive.filter(d=>d.id!==recipient.id&&Number(d.economy.inventory[good]??0)>aidReserve(good));
      const ranked=donors.map(d=>({donor:d,rel:relationship(d,recipient),distance:routeDistanceKm(d,recipient)})).sort((a,b)=>b.rel-a.rel||a.distance-b.distance);
      const primary=(w.settlements??[]).find(s=>s.kind==='primary-colony');
      const primaryPolicy=primary&&recipient.id!==primary.id?aidPolicy(w,recipient):'automatic';
      const primaryCandidate=ranked.find(x=>x.donor.id===primary?.id);
      const foodRunway=good==='food'?Math.max(0,Math.floor((recipient.economy.inventory.food-2)/Math.max(0.1,recipient.population*0.018-(SPECIALISATIONS[recipient.economy.specialisation]?.produces.food??0)))):Infinity;
      if(primary&&primaryCandidate&&primaryPolicy==='protect-reserves'){
        const primaryRoute=routeTravel(w,primary,recipient,primaryCandidate.distance);
        if(good!=='food'||primaryRoute.travelSols<=foodRunway){request.feasibleAidRefused=true;request.refusedByPrimary=true;}
      }
      const donor=ranked.find(x=>x.donor.id!==primary?.id||primaryPolicy!=='protect-reserves');
      if(donor){
        const baseAid=good==='food'?25:good==='components'?5:good==='machinery'?4:good==='electronics'?3:8;
        const amount=Math.min(baseAid*(donor.donor.id===primary?.id&&aidPolicy(w,recipient)==='prioritise'?1.5:1),donor.donor.economy.inventory[good]-aidReserve(good));
        const route=routeTravel(w,donor.donor,recipient,donor.distance);
        const arrivesInTime=good!=='food'||route.travelSols<=Math.max(0,foodRunway);
        if(arrivesInTime){
          const shipment=createShipment(w,donor.donor,recipient,good,amount,sol,'emergency-aid');
          shipment.requestId=request.id;
          request.status='in-transit';request.shipmentId=shipment.id;request.donorId=donor.donor.id;request.amount=amount;request.arrivalSol=shipment.arrivalSol;
          noteAid(w,{sol,kind:'aid-dispatched',shipmentId:shipment.id,requestId:request.id,fromId:donor.donor.id,toId:recipient.id,good,amount,description:donor.donor.name+' dispatched '+amount+' units of '+good+' to '+recipient.name+' as emergency humanitarian aid; estimated arrival in '+route.travelSols+' sols.'});
          events.push({type:'colony-emergency-aid-dispatched',sol,description:donor.donor.name+' dispatched emergency '+good+' aid to '+recipient.name+'.'});
        }else if(sol-request.openedSol>=10){
          request.status='unreachable';
          noteAid(w,{sol,kind:'aid-unreachable',requestId:request.id,toId:recipient.id,good,description:'Emergency '+good+' aid for '+recipient.name+' could not arrive before the modelled survival window; no refusal penalty applies.'});
        }
      }else if(sol-request.openedSol>=10){
        request.status='unavailable';
        noteAid(w,{sol,kind:'aid-unavailable',requestId:request.id,toId:recipient.id,good,description:'No colony had enough '+good+' surplus to provide emergency aid to '+recipient.name+'; no refusal penalty applies.'});
      }
    }
  }
}
function createShipment(w,from,to,good,amount,sol,kind='trade'){
  const distanceKm=routeDistanceKm(from,to);
  const route=routeTravel(w,from,to,distanceKm);
  const travelSols=route.travelSols;
  const shipment={id:'colony-haul-'+w.colonyTrade.nextShipmentId++,kind,fromId:from.id,toId:to.id,good,amount:round3(amount),departSol:sol,arrivalSol:sol+travelSols,travelSols,distanceKm:Math.round(distanceKm),terrainProfile:route.profile?{reliefM:Math.round(route.profile.relief),ascentM:Math.round(route.profile.ascent),maxGradePct:Math.round(route.profile.maxGrade*100)}:null,roadUsed:route.road,navigationBeacons:route.beacons,effectiveSpeedKmPerSol:route.effectiveSpeed,status:'in-transit'};
  from.economy.inventory[good]=round3(Math.max(0,from.economy.inventory[good]-amount));
  w.colonyTrade.shipments.push(shipment);
  addTradeLog(w,{sol,kind:'departed',shipmentId:shipment.id,fromId:from.id,toId:to.id,good,amount:shipment.amount,description:amount+' units of '+good+' departed '+from.name+' for '+to.name+' ('+Math.round(distanceKm)+' km, about '+travelSols+' sols; '+route.effectiveSpeed+' km/sol'+(route.road?', established road':'')+(route.beacons?', '+route.beacons+' navigation beacon(s)':'')+(route.profile?', sampled relief '+Math.round(route.profile.relief)+' m':'')+').'});
  return shipment;
}
function deliverShipments(w,sol,events){
  for(const ship of w.colonyTrade.shipments){
    if(ship.status!=='in-transit'||sol<ship.arrivalSol)continue;
    const destination=w.settlements.find(s=>s.id===ship.toId);
    if(!destination||destination.status==='failed'||destination.status==='abandoned'){
      ship.status='lost';
      addTradeLog(w,{sol,kind:'lost',shipmentId:ship.id,description:'A shipment was lost because its destination is no longer operational.'});
      continue;
    }
    destination.economy.inventory[ship.good]=round3((destination.economy.inventory[ship.good]??0)+ship.amount);
    ship.status='delivered';
    if(ship.kind==='emergency-aid'){
      const request=w.colonyTrade.emergencyRequests.find(r=>r.id===ship.requestId);
      if(request)request.status='delivered';
      const sender=w.settlements.find(s=>s.id===ship.fromId);
      if(sender){
        sender.politics ??={relations:{} };destination.politics ??={relations:{}};
        sender.politics.relations ??={};destination.politics.relations ??={};
        const next=clamp(relationship(sender,destination)+3);
        sender.politics.relations[destination.id]=next;destination.politics.relations[sender.id]=next;
      }
      noteAid(w,{sol,kind:'aid-received',shipmentId:ship.id,requestId:ship.requestId,fromId:ship.fromId,toId:destination.id,good:ship.good,amount:ship.amount,description:(w.settlements.find(s=>s.id===ship.fromId)?.name??'A neighbouring colony')+' delivered emergency '+ship.good+' aid to '+destination.name+'.'});
    }
    if(ship.kind==='earth-import'){destination.economy.importDependence=clamp(destination.economy.importDependence+1);destination.economy.pendingImports=(destination.economy.pendingImports??[]).filter(good=>good!==ship.good);destination.economy.pendingImport=destination.economy.pendingImports.length>0;}
    addTradeLog(w,{sol,kind:'delivered',shipmentId:ship.id,fromId:ship.fromId,toId:ship.toId,good:ship.good,amount:ship.amount,description:ship.amount+' units of '+ship.good+' arrived at '+destination.name+'.'});
    events.push({type:'colony-shipment-arrived',sol,description:ship.amount+' units of '+ship.good+' arrived at '+destination.name+(ship.kind==='earth-import'?' from its Earth sponsor':' from '+(w.settlements.find(s=>s.id===ship.fromId)?.name??'another colony'))+'.'});
    if(ship.kind==='trade'){
      const from=w.settlements.find(s=>s.id===ship.fromId);
      if(from&&from.economy)from.economy.importDependence=clamp(from.economy.importDependence-0.5);
      destination.economy.importDependence=clamp(destination.economy.importDependence-0.5);
    }
  }
  w.colonyTrade.shipments=w.colonyTrade.shipments.filter(s=>s.status==='in-transit'||sol-s.arrivalSol<30);
}
function operateColonies(w,sol,events){
  const alive=(w.settlements??[]).filter(s=>!['failed','abandoned'].includes(s.status));
  for(const s of alive){
    const e=s.economy, spec=SPECIALISATIONS[e.specialisation]??SPECIALISATIONS.agriculture;
    const pop=Math.max(0,Number(s.population)||0);
    for(const good of GOODS){
      const baselineFood=good==='food'?0.45*Math.max(0.25,pop/45):0;
      const produced=((spec.produces[good]??0)*(Math.max(0.25,pop/45)))+baselineFood;
      const consumed=good==='food'?pop*0.018:good==='components'?0.035:good==='machinery'?0.018:good==='electronics'?0.012:0.025;
      e.inventory[good]=round3(Math.max(0,e.inventory[good]+produced-consumed));
      e.shortages[good]=e.inventory[good]< (good==='food'?12:good==='components'?3:good==='machinery'?2:good==='electronics'?1.5:3);
    }
    const food=e.inventory.food;
    if(food<5){
      e.stability=clamp(e.stability-0.15);
      if(sol%10===0){
        s.morale=clamp((s.morale??(s.kind==='primary-colony'?w.colonists.morale:65))-2);
        if(s.kind==='primary-colony')w.colonists.morale=clamp(w.colonists.morale-2);
        else {
          s.population=Math.max(0,Math.round((s.population??0)-1));
          if(s.population===0){
            s.status='failed';
            const refused=(w.colonyTrade.emergencyRequests??[]).some(r=>r.toId===s.id&&r.good==='food'&&r.feasibleAidRefused&&['open','unreachable','unavailable'].includes(r.status));
            if(refused)relationIncident(w,s,sol,8,'the player colony protected its reserves despite a feasible food shipment');
            for(const request of (w.colonyTrade.emergencyRequests??[]))if(request.toId===s.id&&['open','in-transit'].includes(request.status))request.status='recipient-failed';
            events.push({type:'colony-failed',sol,description:s.name+' has been abandoned after prolonged food shortages.'});
          }
        }
        events.push({type:'colony-food-crisis',sol,description:s.name+' is facing a severe food shortage; local stability is deteriorating.'});
      }
    }else e.stability=clamp(e.stability+0.01);
    if(s.kind==='primary-colony'){
      e.inventory.components=Math.max(0,Math.min(250,e.inventory.components));
      e.inventory.machinery=Math.max(0,Math.min(150,e.inventory.machinery));
      e.inventory.electronics=Math.max(0,Math.min(120,e.inventory.electronics));
    }
    if(sol%30===0&&(e.importDependence>35||s.kind==='primary-colony'||s.kind==='rival-colony')&&!(s.kind==='primary-colony'&&(w.campaign?.earthConflictDeclared||w.campaign?.warWithEarth||w.campaign?.survivalGuaranteeSuspended))){
      const thresholds={food:40,components:8,machinery:5,electronics:4,aggregate:8};
      const amounts={food:55,components:18,machinery:12,electronics:10,aggregate:30};
      for(const good of GOODS){
        const pending=w.colonyTrade.shipments.some(x=>x.toId===s.id&&x.kind==='earth-import'&&x.good===good&&x.status==='in-transit');
        if(e.inventory[good]>=thresholds[good]||pending)continue;
        const ship={id:'colony-haul-'+w.colonyTrade.nextShipmentId++,kind:'earth-import',fromId:'earth:'+s.sponsorId,toId:s.id,good,amount:amounts[good],departSol:sol,arrivalSol:sol+240,travelSols:240,distanceKm:null,status:'in-transit'};
        e.pendingImports=[...new Set([...(e.pendingImports??[]),good])];
        e.pendingImport=true;
        e.lastImportSol=sol;
        w.colonyTrade.shipments.push(ship);
        addTradeLog(w,{sol,kind:'ordered-earth-import',shipmentId:ship.id,toId:s.id,good,amount:ship.amount,description:s.name+' requested sponsor cargo of '+ship.amount+' units of '+good+'; estimated arrival in 240 sols.'});
        events.push({type:'colony-import-ordered',sol,description:s.name+' requested '+good+' cargo from its Earth sponsor.'});
      }
    }
    e.pendingImports=(e.pendingImports??[]).filter(good=>w.colonyTrade.shipments.some(x=>x.toId===s.id&&x.kind==='earth-import'&&x.good===good&&x.status==='in-transit'));
    e.pendingImport=e.pendingImports.length>0;
  }
}
function dispatchIntercolonyTrade(w,sol){
  const alive=(w.settlements??[]).filter(s=>!['failed','abandoned'].includes(s.status));
  for(const from of alive){
    for(const good of GOODS){
      if(from.economy.inventory[good]<=(good==='food'?45:good==='components'?18:good==='machinery'?12:good==='electronics'?10:25))continue;
      if(w.colonyTrade.shipments.some(x=>x.status==='in-transit'&&x.fromId===from.id&&x.good===good))continue;
      const needThreshold={food:25,components:10,machinery:6,electronics:5,aggregate:12}[good];
      const to=alive.filter(s=>s.id!==from.id&&relationship(from,s)>=50&&routineExchangeAllowed(w,from,s)&&s.economy.inventory[good]<needThreshold&&!w.colonyTrade.shipments.some(x=>x.status==='in-transit'&&x.kind==='trade'&&x.toId===s.id&&x.good===good))
        .sort((a,b)=>priorityFor(w,b)-priorityFor(w,a)||a.economy.inventory[good]-b.economy.inventory[good])[0];
      if(!to)continue;
      if(!routineExchangeAllowed(w,from,to))continue;
      const reserve={food:35,components:12,machinery:8,electronics:6,aggregate:18}[good];
      const targetStock={food:55,components:18,machinery:12,electronics:10,aggregate:25}[good];
      const amount=Math.min(good==='food'?30:good==='components'?12:good==='machinery'?8:good==='electronics'?6:18,from.economy.inventory[good]-reserve,targetStock-to.economy.inventory[good]);
      if(amount<=0)continue;
      createShipment(w,from,to,good,amount,sol,'trade');
    }
  }
}
export function processColonyEconomies(w,sol,events=[]){
  ensureColonyEconomies(w);
  deliverShipments(w,sol,events);
  operateColonies(w,sol,events);
  assessEmergencyAid(w,sol,events);
  processSponsorCommitments(w,sol,events);
  if(sol%5===0)dispatchIntercolonyTrade(w,sol);
  w.colonyTrade.lastProcessedSol=sol;
  return events;
}
export function getColonyEconomySummary(w,settlement){
  ensureColonyEconomies(w);
  const e=settlement?.economy;
  if(!e)return null;
  const inTransit=w.colonyTrade.shipments.filter(s=>s.status==='in-transit'&&(s.fromId===settlement.id||s.toId===settlement.id));
  return {specialisation:e.specialisationLabel,inventory:{...e.inventory},importDependence:Math.round(e.importDependence),stability:Math.round(e.stability),shortages:{...e.shortages},shipmentsInTransit:inTransit.length};
}
