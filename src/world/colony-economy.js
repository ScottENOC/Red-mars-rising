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
  fabrication:{food:45,components:48,machinery:12,electronics:6,aggregate:80},
  engineering:{food:45,components:24,machinery:35,electronics:7,aggregate:25},
  electronics:{food:45,components:18,machinery:10,electronics:38,aggregate:20},
  extraction:{food:45,components:14,machinery:9,electronics:5,aggregate:100}
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
  w.colonyTrade.shipments ??=[];
  w.colonyTrade.tradeLog ??=[];
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
    e.pendingImport ??=false;\n    e.pendingImports ??=[];
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
  return 3389500*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}
function transitSols(distanceKm){
  // Abstract rover convoy speed, with a substantial allowance for navigation, terrain and loading.
  // This is a game pacing rule, not a vehicle performance prediction.
  return Math.max(3,Math.ceil(distanceKm/180)+2);
}
function createShipment(w,from,to,good,amount,sol,kind='trade'){
  const distanceKm=routeDistanceKm(from,to);
  const travelSols=transitSols(distanceKm);
  const shipment={id:'colony-haul-'+w.colonyTrade.nextShipmentId++,kind,fromId:from.id,toId:to.id,good,amount:round3(amount),departSol:sol,arrivalSol:sol+travelSols,travelSols,distanceKm:Math.round(distanceKm),status:'in-transit'};
  from.economy.inventory[good]=round3(Math.max(0,from.economy.inventory[good]-amount));
  w.colonyTrade.shipments.push(shipment);
  addTradeLog(w,{sol,kind:'departed',shipmentId:shipment.id,fromId:from.id,toId:to.id,good,amount:shipment.amount,description:amount+' units of '+good+' departed '+from.name+' for '+to.name+'.'});
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
    if(ship.kind==='earth-import'){destination.economy.importDependence=clamp(destination.economy.importDependence+0.1);destination.economy.pendingImports=(destination.economy.pendingImports??[]).filter(good=>good!==ship.good);destination.economy.pendingImport=destination.economy.pendingImports.length>0;}
    addTradeLog(w,{sol,kind:'delivered',shipmentId:ship.id,fromId:ship.fromId,toId:ship.toId,good:ship.good,amount:ship.amount,description:ship.amount+' units of '+ship.good+' arrived at '+destination.name+'.'});
    events.push({type:'colony-shipment-arrived',sol,description:ship.amount+' units of '+ship.good+' arrived at '+destination.name+(ship.kind==='trade'?' from '+(w.settlements.find(s=>s.id===ship.fromId)?.name??'another colony'):' from its Earth sponsor')+'.'});
    if(ship.kind==='trade'){
      const from=w.settlements.find(s=>s.id===ship.fromId);
      if(from&&from.economy)from.economy.importDependence=clamp(from.economy.importDependence-0.12);
      destination.economy.importDependence=clamp(destination.economy.importDependence-0.2);
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
      const baselineFood=good==='food'?0.45*Math.max(0.25,pop/45):0;\n      const produced=((spec.produces[good]??0)*(Math.max(0.25,pop/45)))+baselineFood;
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
        else s.population=Math.max(0,Math.round((s.population??0)-1));
        events.push({type:'colony-food-crisis',sol,description:s.name+' is facing a severe food shortage; local stability is deteriorating.'});
      }
    }else e.stability=clamp(e.stability+0.01);
    if(s.kind==='primary-colony'){
      e.inventory.components=Math.max(0,Math.min(250,e.inventory.components));
      e.inventory.machinery=Math.max(0,Math.min(150,e.inventory.machinery));
      e.inventory.electronics=Math.max(0,Math.min(120,e.inventory.electronics));
    }
    if(sol%90===0&&e.importDependence>35&&e.inventory.food<40&&!e.pendingImport){
      const sponsor=s.sponsorId;
      const ship={id:'colony-haul-'+w.colonyTrade.nextShipmentId++,kind:'earth-import',fromId:'earth:'+sponsor,toId:s.id,good:'food',amount:55,departSol:sol,arrivalSol:sol+240,travelSols:240,distanceKm:null,status:'in-transit'};
      e.pendingImport=true;
      e.lastImportSol=sol;
      w.colonyTrade.shipments.push(ship);
      addTradeLog(w,{sol,kind:'ordered-earth-import',shipmentId:ship.id,toId:s.id,good:'food',amount:55,description:s.name+' requested sponsor food cargo; estimated arrival in 240 sols.'});
      events.push({type:'colony-import-ordered',sol,description:s.name+' requested an emergency food shipment from its Earth sponsor.'});
    }
    if(e.pendingImport&&!w.colonyTrade.shipments.some(x=>x.toId===s.id&&x.kind==='earth-import'&&x.status==='in-transit'))e.pendingImport=false;
  }
}
function dispatchIntercolonyTrade(w,sol){
  const alive=(w.settlements??[]).filter(s=>!['failed','abandoned'].includes(s.status));
  for(const from of alive){
    for(const good of GOODS){
      if(from.economy.inventory[good]<=(good==='food'?45:good==='components'?18:good==='machinery'?12:good==='electronics'?10:25))continue;
      if(w.colonyTrade.shipments.some(x=>x.status==='in-transit'&&x.fromId===from.id&&x.good===good))continue;
      const needThreshold={food:25,components:10,machinery:6,electronics:5,aggregate:12}[good];
      const to=alive.filter(s=>s.id!==from.id&&relationship(from,s)>=50&&s.economy.inventory[good]<needThreshold&&!w.colonyTrade.shipments.some(x=>x.status==='in-transit'&&x.toId===s.id&&x.good===good))
        .sort((a,b)=>a.economy.inventory[good]-b.economy.inventory[good])[0];
      if(!to)continue;
      const reserve={food:35,components:12,machinery:8,electronics:6,aggregate:18}[good];
      const amount=Math.min(good==='food'?30:good==='components'?12:good==='machinery'?8:good==='electronics'?6:18,from.economy.inventory[good]-reserve,needThreshold-to.economy.inventory[good]);
      if(amount<=0)continue;
      createShipment(w,from,to,good,amount,sol,'trade');
    }
  }
}
export function processColonyEconomies(w,sol,events=[]){
  ensureColonyEconomies(w);
  deliverShipments(w,sol,events);
  operateColonies(w,sol,events);
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
