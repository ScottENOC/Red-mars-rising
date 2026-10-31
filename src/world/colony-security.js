const clamp = (v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const live = c => c && !['failed','abandoned','severely-damaged'].includes(c.status);
const evidence = {
  'imminent-threat':{label:'Imminent threat',justification:28,description:'Verified preparations or an active attack by the target'},
  'repeated-interference':{label:'Repeated interference',justification:18,description:'Documented disruption of communications, navigation or shared infrastructure'},
  'debris-danger':{label:'Orbital safety emergency',justification:12,description:'A dangerous object or debris event requiring urgent intervention'},
  'political-dispute':{label:'Political dispute',justification:-18,description:'A serious disagreement without a direct security threat'}
};
export function ensureColonySecurity(w){
 if(!w?.campaign?.started)return null;
 w.colonySecurity??={proposals:[],history:[],nextId:1};
 const s=w.colonySecurity;s.proposals??=[];s.history??=[];s.nextId=Math.max(1,Number(s.nextId)||1);
 return s;
}
function capability(w,colonyId){
 const a=w.asteroidOperations?.aiCapabilities?.[colonyId];
 return a?.status==='operational';
}
function assess(w,proposer,target,reason){
 const e=evidence[reason]??evidence['political-dispute'];
 const p=proposer.politics??{},t=target.politics??{};
 const relation=Number(p.relations?.[target.id]??50);
 const stability=Number(p.politicalStability??50);
 const sovereignty=Number(p.ideologies?.sovereignty?.support??25);
 const salience=Number(p.ideologies?.sovereignty?.salience??50);
 const autonomy=Number(p.localAutonomy??20);
 const targetThreat=capability(w,target.id)?-12:8;
 const ownSecurity=capability(w,proposer.id)?12:-12;
 const retaliationRisk=(Number(target.population??0)>Number(proposer.population??0)*1.4?-12:0);
 const dependence=Number(p.sponsorDependence??50)>80?-8:0;
 const justification=clamp(42+e.justification+(100-relation)*.18);
 const safety=clamp(38+ownSecurity+targetThreat+retaliationRisk+dependence+(stability-50)*.18);
 const playerRelation=Number(p.relations?.[w.settlements?.find(c=>c.kind==='primary-colony')?.id]??50);
 const politicalWill=clamp(18+sovereignty*.34+salience*.12+autonomy*.18+(stability-50)*.12+(playerRelation-50)*.22);
 const total=justification*.42+safety*.38+politicalWill*.20;
 return {justification:Math.round(justification),safety:Math.round(safety),politicalWill:Math.round(politicalWill),score:Math.round(total),reason:e.description,relation:Math.round(relation),ownSecurity:capability(w,proposer.id),targetSecurity:capability(w,target.id)};
}
export function proposeColonyAttack(w,proposerId,targetId,reason='imminent-threat'){
 const s=ensureColonySecurity(w);if(!s)return {ok:false,reason:'No active campaign.'};
 const home=w.settlements?.find(c=>c.kind==='primary-colony');
 const proposer=w.settlements?.find(c=>c.id===proposerId&&c.kind==='rival-colony'&&live(c));
 const target=w.settlements?.find(c=>c.id===targetId&&live(c));
 if(!home||!proposer||!target||proposer.id===target.id)return {ok:false,reason:'Choose two different operating colonies.'};
 if(!evidence[reason])return {ok:false,reason:'Choose a recognised justification.'};
 if(s.proposals.some(p=>p.proposerId===proposerId&&p.targetId===targetId&&p.status==='under-review'))return {ok:false,reason:'That colony is already considering an operation.'};
 if(Number(w.economy?.funds??0)<12)return {ok:false,reason:'12 funds are needed for diplomatic engagement and evidence-sharing.'};
 w.economy.funds-=12;
 const assessment=assess(w,proposer,target,reason);
 const proposal={id:'colony-security-'+s.nextId++,proposerId:proposer.id,targetId:target.id,reason,createdSol:w.time.sol,decisionSol:w.time.sol+30,status:'under-review',assessment,playerBacked:true};
 s.proposals.push(proposal);
 s.history.push({sol:w.time.sol,description:'You urged '+proposer.name+' to consider an operation against '+target.name+'. Its council will review the justification and its own exposure.'});
 return {ok:true,reason:proposer.name+' has agreed to review the proposal, not to carry it out. A decision is expected after 30 sols.'};
}
export function processColonySecurity(w,sol,events=[]){
 const s=ensureColonySecurity(w);if(!s)return events;
 for(const proposal of s.proposals){
  if(proposal.status!=='under-review'||sol<proposal.decisionSol)continue;
  const proposer=w.settlements.find(c=>c.id===proposal.proposerId),target=w.settlements.find(c=>c.id===proposal.targetId);
  if(!live(proposer)||!live(target)){proposal.status='withdrawn';continue;}
  proposal.assessment=assess(w,proposer,target,proposal.reason);
  const a=proposal.assessment;
  // Approval requires both a credible justification and a credible prospect of surviving the response.
  const accepted=a.score>=62&&a.justification>=55&&a.safety>=52&&a.politicalWill>=42;
  proposal.status=accepted?'approved':'rejected';proposal.decidedSol=sol;
  proposal.decision=accepted?'Council authorised a limited counter-space operation.':'Council rejected the proposal: justification, political will or self-protection was insufficient.';
  s.history.push({sol,description:proposer.name+' '+(accepted?'authorised':'rejected')+' an operation against '+target.name+'. '+proposal.decision});
  if(accepted){
   proposal.mission={status:'active',launchedSol:sol,remainingSols:90};
   events.push({type:'colony-operation-authorised',sol,description:proposer.name+' has independently authorised a counter-space operation against '+target.name+'.'});
  }else events.push({type:'colony-operation-rejected',sol,description:proposer.name+' rejected pressure to attack '+target.name+'.'});
 }
 for(const proposal of s.proposals){
  if(proposal.status!=='approved'||proposal.mission?.status!=='active')continue;
  proposal.mission.remainingSols=Math.max(0,proposal.mission.remainingSols-1);
  if(proposal.mission.remainingSols===0){
   proposal.mission.status='complete';proposal.completedSol=sol;
   const targetColony=w.settlements.find(c=>c.id===proposal.targetId);
   const relayId=targetColony?.kind==='primary-colony'?'player-relay':'rival-relay-'+proposal.targetId;
   const relay=w.asteroidOperations?.orbitalAssets?.find(a=>a.id===relayId);
   if(relay)relay.status='disabled';
   proposal.outcome=relay?'Target communications relay disabled':'Operation completed; no operational relay was available at arrival.';
   s.history.push({sol,description:w.settlements.find(c=>c.id===proposal.proposerId)?.name+' completed an independently authorised counter-space operation.'});
   events.push({type:'colony-counterspace-attack',sol,description:w.settlements.find(c=>c.id===proposal.proposerId)?.name+' completed a counter-space operation against '+w.settlements.find(c=>c.id===proposal.targetId)?.name+'.'});
  }
 }
 // Autonomous councils can independently propose defensive counter-space action when threatened.
 const ops=w.asteroidOperations;
 if(ops?.defence?.status==='complete'){
  for(const colony of (w.settlements??[]).filter(c=>c.kind==='rival-colony'&&live(c)&&capability(w,c.id))){
   if(s.proposals.some(p=>p.proposerId===colony.id&&['under-review','approved'].includes(p.status)))continue;
   const hostile=ops.aiMissions?.some(m=>m.owner!==colony.id&&m.targetId==='rival-relay-'+colony.id&&m.status==='active');
   if(hostile){
    const player=w.settlements.find(c=>c.kind==='primary-colony');
    if(player)s.proposals.push({id:'autonomous-defence-'+colony.id+'-'+sol,proposerId:colony.id,targetId:player.id,reason:'imminent-threat',createdSol:sol,decisionSol:sol+10,status:'under-review',assessment:assess(w,colony,player,'imminent-threat'),playerBacked:false});
   }
  }
 }
 return events;
}
export function getColonySecuritySummary(w){
 const s=ensureColonySecurity(w);if(!s)return null;
 return {proposals:s.proposals.map(p=>({...p,assessment:{...p.assessment},mission:p.mission?{...p.mission}:null})),history:s.history.slice(-8),evidence:Object.entries(evidence).map(([id,e])=>({id,...e}))};
}
