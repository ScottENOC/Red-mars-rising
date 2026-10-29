const PROGRAMME = {
 id:'mars-orbital-operations',
 name:'Mars orbital operations system',
 description:'A reusable surface-to-orbit vehicle, propellant and servicing infrastructure, navigation, communications and capture robotics.',
 durationSols:180,
 cost:{funds:90,materials:35,machinery:24},
};
const MISSION = {
 id:'asteroid-capture-01',
 name:'Capture near-Mars asteroid',
 description:'Survey, rendezvous with and redirect a small near-Mars asteroid into a stable, accessible orbit.',
 durationSols:120,
 cost:{funds:55,materials:12,machinery:10},
};
export function ensureAsteroidOperations(w){
 if(!w?.campaign?.started)return null;
 w.asteroidOperations??={programme:{...PROGRAMME,cost:{...PROGRAMME.cost},status:'available',progress:0,remainingSols:PROGRAMME.durationSols},missions:[],nextMissionId:1,orbitalAssets:[]};
 const s=w.asteroidOperations;
 s.missions??=[];s.orbitalAssets??=[];s.nextMissionId=Math.max(1,Number(s.nextMissionId)||1);
 s.programme??={...PROGRAMME,cost:{...PROGRAMME.cost},status:'available',progress:0,remainingSols:PROGRAMME.durationSols};
 return s;
}
function charge(w,cost){
 if(!w.economy||!w.campaign)return false;
 for(const [key,value] of Object.entries(cost))if(Number(w.economy[key]??0)<value)return false;
 for(const [key,value] of Object.entries(cost))w.economy[key]-=value;
 return true;
}
export function commissionOrbitalOperations(w){
 const s=ensureAsteroidOperations(w);if(!s)return {ok:false,reason:'No active campaign.'};
 if(s.programme.status!=='available')return {ok:false,reason:'The orbital operations programme has already been commissioned.'};
 if(!charge(w,s.programme.cost))return {ok:false,reason:'Insufficient funds, materials or machinery.'};
 s.programme.status='active';s.programme.remainingSols=s.programme.durationSols;s.programme.progress=0;
 return {ok:true,reason:'Mars orbital operations system commissioned. Construction and integration will take 180 sols.'};
}
export function launchAsteroidCapture(w){
 const s=ensureAsteroidOperations(w);if(!s)return {ok:false,reason:'No active campaign.'};
 if(s.programme.status!=='complete')return {ok:false,reason:'A functioning Mars orbital operations system is required before a capture mission can launch.'};
 if(s.missions.some(m=>m.status==='active'||m.status==='complete'))return {ok:false,reason:'The initial asteroid capture mission has already been launched or completed.'};
 if(!charge(w,MISSION.cost))return {ok:false,reason:'Insufficient funds, materials or machinery.'};
 const mission={id:'asteroid-mission-'+s.nextMissionId++,name:MISSION.name,description:MISSION.description,status:'active',launchedSol:w.time?.sol??0,durationSols:MISSION.durationSols,remainingSols:MISSION.durationSols,progress:0,target:{designation:'NMA-01',class:'small near-Mars asteroid',composition:'uncharacterised',orbit:'accessible capture candidate'},outcome:null};
 s.missions.push(mission);
 return {ok:true,reason:'Capture mission launched. The target remains uncharacterised until rendezvous and analysis.'};
}
export function processAsteroidOperations(w,sol,events=[]){
 const s=ensureAsteroidOperations(w);if(!s)return events;
 const p=s.programme;
 if(p.status==='active'){
  const shortfall=w.economy.powerCapacity<w.economy.powerDemand;
  if(!shortfall){p.remainingSols=Math.max(0,p.remainingSols-1);p.progress=1-p.remainingSols/p.durationSols;delete p.pausedReason;}
  else p.pausedReason='Power shortfall';
  if(p.remainingSols===0){p.status='complete';s.orbitalAssets.push({id:'mars-orbital-operations',name:'Mars orbital operations system',status:'operational',commissionedSol:sol,reusableVehicle:true,propellantInfrastructure:true,captureRobotics:true});events.push({type:'orbital-capability-complete',sol,description:'Mars orbital operations system is operational: reusable transport, servicing and capture capability is now available.'});}
 }
 for(const m of s.missions){
  if(m.status!=='active')continue;
  if(w.economy.powerCapacity>=w.economy.powerDemand){m.remainingSols=Math.max(0,m.remainingSols-1);m.progress=1-m.remainingSols/m.durationSols;}
  else m.pausedReason='Power shortfall';
  if(m.remainingSols===0){m.status='complete';m.outcome={designation:'NMA-01',status:'captured',orbit:'stable Mars orbit',composition:'awaiting detailed prospecting',capturedSol:sol};s.orbitalAssets.push({id:'captured-asteroid-NMA-01',name:'Captured asteroid NMA-01',status:'stable Mars orbit',capturedSol:sol,composition:'uncharacterised'});events.push({type:'asteroid-captured',sol,description:'Asteroid NMA-01 has been captured into a stable Mars orbit. Detailed prospecting and processing are now separate future projects.'});}
 }
 return events;
}
export function getAsteroidOperationsSummary(w){
 const s=ensureAsteroidOperations(w);if(!s)return null;
 return {programme:{...s.programme,cost:{...s.programme.cost}},missions:s.missions.map(m=>({...m,target:{...m.target},outcome:m.outcome?{...m.outcome}:null})),orbitalAssets:s.orbitalAssets.map(a=>({...a})),missionAvailable:s.programme.status==='complete'&&!s.missions.some(m=>m.status==='active'||m.status==='complete')};
}
