// Persistent settlement lifecycle, separate from the physical infrastructure registry.
const PHASES=new Set(['active','distressed','evacuated','abandoned']);
const TRANSITIONS={active:new Set(['distressed','evacuated','abandoned']),distressed:new Set(['active','evacuated','abandoned']),evacuated:new Set(['active']),abandoned:new Set(['active'])};
const STATUS={active:'operational',distressed:'distressed',evacuated:'evacuated',abandoned:'abandoned'};
const solNow=w=>Math.max(0,Number(w?.time?.sol)||0);
function inferredPhase(s){if(PHASES.has(s.lifecycle?.phase))return s.lifecycle.phase;if(['failed','abandoned'].includes(s.status))return 'abandoned';if(s.status==='evacuated')return 'evacuated';if(s.status==='distressed')return 'distressed';return 'active';}
function addHistory(state,entry){state.history??=[];const last=state.history.at(-1);if(last?.phase===entry.phase&&last?.sol===entry.sol)return last;state.history.push(entry);if(state.history.length>100)state.history.splice(0,state.history.length-100);return entry;}
export function ensureSettlementLifecycle(w){
 if(!Array.isArray(w?.settlements))return [];
 const sol=solNow(w);
 for(const s of w.settlements){
  const phase=inferredPhase(s);
  s.lifecycle??={phase,sinceSol:sol,history:[],occupations:[]};
  const state=s.lifecycle;
  if(!PHASES.has(state.phase))state.phase=phase;
  state.sinceSol=Number.isFinite(state.sinceSol)?state.sinceSol:sol;
  state.history=Array.isArray(state.history)?state.history:[];
  state.occupations=Array.isArray(state.occupations)?state.occupations:[];
  if(!state.history.length)addHistory(state,{phase:state.phase,sol:state.sinceSol,reason:'Initial state migrated from the existing settlement record.'});
  if(!state.occupations.length&&s.sponsorId)state.occupations.push({sponsorId:s.sponsorId,startSol:state.sinceSol,endSol:null,status:state.phase});
  s.status=STATUS[state.phase]??s.status;
 }
 return w.settlements;
}
export function transitionSettlementLifecycle(w,id,nextPhase,{reason='Conditions changed.',actorId=null,sol=solNow(w),population=null,sponsorId=null}={}){
 if(!PHASES.has(nextPhase))throw new Error('Unknown settlement lifecycle phase: '+nextPhase);
 ensureSettlementLifecycle(w);
 const s=(w.settlements??[]).find(x=>x.id===id);
 if(!s)throw new Error('Unknown settlement: '+id);
 const state=s.lifecycle,previous=state.phase;
 if(previous===nextPhase)return {ok:true,changed:false,settlement:s};
 if(!TRANSITIONS[previous]?.has(nextPhase))throw new Error('Invalid settlement lifecycle transition: '+previous+' -> '+nextPhase);
 if(nextPhase==='abandoned'&&Number(s.population)>0)throw new Error('A settlement cannot be abandoned while its population remains.');
 const isReoccupation=nextPhase==='active'&&['abandoned','evacuated'].includes(previous);
 if(isReoccupation&&!(Number(population)>0))throw new Error('Reoccupation requires a positive arriving population.');
 if(isReoccupation){s.population=Math.floor(Number(population));if(sponsorId)s.sponsorId=sponsorId;}
 if(nextPhase==='evacuated')s.population=0;
 state.phase=nextPhase;state.sinceSol=sol;state.lastReason=reason;
 if(['abandoned','evacuated'].includes(nextPhase)){const occupation=state.occupations.at(-1);if(occupation&&occupation.endSol==null){occupation.endSol=sol;occupation.status=nextPhase;}}
 if(isReoccupation)state.occupations.push({sponsorId:s.sponsorId??null,startSol:sol,endSol:null,status:'active',reoccupation:true,population:s.population});
 s.status=STATUS[nextPhase];
 if(s.kind==='primary-colony'&&['abandoned','evacuated'].includes(nextPhase)&&w.colonists)w.colonists.population=0;
 addHistory(state,{phase:nextPhase,previousPhase:previous,sol,reason,actorId});
 const event={type:'settlement-lifecycle',sol,settlementId:id,previousPhase:previous,phase:nextPhase,description:s.name+' changed from '+previous+' to '+nextPhase+'. '+reason};
 (w.events??=[]).push(event);
 return {ok:true,changed:true,settlement:s,event};
}
export function updateSettlementLifecycleFromPopulation(w,sol=solNow(w),events=[]){
 ensureSettlementLifecycle(w);
 for(const s of (w.settlements??[])){
  if(['evacuated','abandoned'].includes(s.lifecycle.phase))continue;
  if(s.status==='failed'||(Number.isFinite(Number(s.population))&&Number(s.population)<=0)){
   const result=transitionSettlementLifecycle(w,s.id,'abandoned',{sol,reason:s.status==='failed'?'The settlement failed and no population remains.':'The settlement has no remaining population.'});
   if(result.changed)events.push({type:'colony-abandoned',sol,settlementId:s.id,description:s.name+' is abandoned. Its physical settlement and infrastructure remain on Mars.'});
  }
 }
 return events;
}
