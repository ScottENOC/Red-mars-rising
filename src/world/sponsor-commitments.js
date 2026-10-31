import { getColonyOxygenStatus } from './infrastructure-services.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const PROJECTS={
 'space-elevator':{name:'Space elevator',category:'strategic infrastructure',operatingGrant:8,description:'A major transport link with continuing power, machinery, electronics and specialist-maintenance needs.',goods:{components:8,machinery:5,electronics:3},mode:'machinery',autonomyCost:18,baseScore:48},
 'research-laboratory':{name:'Advanced research laboratory',category:'research',operatingGrant:4,description:'Long-term scientific work, instruments, replacement electronics and operating support.',goods:{electronics:4,components:2,machinery:1},mode:'widgets',autonomyCost:3,baseScore:66},
 'geological-survey':{name:'Planetary geological survey',category:'exploration',operatingGrant:3,description:'Survey equipment, assay instruments and specialist analysis to identify useful deposits.',goods:{electronics:3,machinery:2,components:1},mode:'widgets',autonomyCost:0,baseScore:62},
 'strategic-extraction':{name:'Strategic mineral extraction',category:'resource exports',operatingGrant:5,description:'Equipment and maintenance for extracting and preparing materials important to Earth-side industry.',goods:{machinery:4,components:3,electronics:1},mode:'machinery',autonomyCost:8,baseScore:58},
 'local-manufacturing':{name:'Local manufacturing and repair',category:'self-sufficiency',operatingGrant:5,description:'Tools, production equipment and continuing support for making selected parts locally.',goods:{machinery:4,electronics:3,components:2},mode:'machinery',autonomyCost:22,baseScore:52},
 'life-support-resilience':{name:'Life-support resilience programme',category:'survival',operatingGrant:6,description:'Redundancy, repair tools and critical spares that improve the colony’s ability to recover from failures.',goods:{components:5,machinery:3,electronics:2},mode:'mixed',autonomyCost:12,baseScore:70}
};
function sponsorFor(w){return (w.sponsors??[]).find(s=>s.id===w.campaign?.startingSponsorId);}
function primaryColony(w){return (w.settlements??[]).find(s=>s.kind==='primary-colony');}
function record(w,entry){
 const state=w.sponsorCommitments;
 state.history.push(entry);
 if(state.history.length>100)state.history.splice(0,state.history.length-100);
 (w.events??=[]).push({type:'sponsor-commitment',sol:entry.sol,description:entry.description});
}
export function ensureSponsorCommitments(w){
 if(!w?.campaign?.started)return null;
 w.sponsorCommitments??={nextId:1,requests:[],commitments:[],history:[],lastProcessedSol:0,survivalGuaranteeActive:true,externalAppeals:[]};
 const s=w.sponsorCommitments;
 s.requests??=[];s.commitments??=[];s.history??=[];s.externalAppeals??=[];
 s.nextId=Math.max(1,Number(s.nextId)||1);
 // The founding survival obligation is a default commitment, not a project the player has to request.
 s.survivalGuaranteeActive=w.campaign.survivalGuaranteeSuspended===true?false:(s.survivalGuaranteeActive!==false);
 return s;
}
function sponsorApprovalScore(w,project,sponsor){
 const type=sponsor?.type??'national';
 const strengths=String(sponsor?.strengths??'').toLowerCase();
 const description=String(sponsor?.description??'').toLowerCase();
 let score=project.baseScore;
 if(type==='multilateral')score+=project.autonomyCost>10?14:5;
 if(type==='corporate')score+=project.autonomyCost>10?-18:project.category==='resource exports'?18:4;
 if(type==='scientific'||/science|research|exploration/.test(strengths+' '+description))score+=['research','exploration'].includes(project.category)?14:0;
 if(/industry|manufactur|engineering|logistics|resource/.test(strengths+' '+description)&&['self-sufficiency','resource exports','strategic infrastructure'].includes(project.category))score+=9;
 if((w.campaign?.sponsorPatience??70)<30)score-=12;
 if((w.campaign?.sponsorPressure??0)>70)score-=7;
 if(w.campaign?.earthConflictDeclared||w.campaign?.warWithEarth)score-=100;
 // A proposal that directly increases autonomy is more difficult for sponsors seeking leverage,
 // but no sponsor type is an absolute yes/no stereotype.
 return clamp(score,0,100);
}
function chooseSupportMode(project,sponsor){
 const type=sponsor?.type??'national';
 if(project.id==='local-manufacturing')return type==='corporate'?'restricted-machinery':'production-machinery';
 if(project.id==='space-elevator')return type==='corporate'?'licensed-machinery':'maintenance-and-spares';
 if(type==='corporate'&&project.autonomyCost>10)return 'licensed-widgets';
 if(type==='multilateral'&&project.autonomyCost>10)return 'open-production-capability';
 return project.mode==='mixed'?'mixed-support':project.mode==='machinery'?'machinery-and-spares':'consumables-and-instruments';
}
export function requestSponsorProject(w,projectId){
 const state=ensureSponsorCommitments(w);
 const project=PROJECTS[projectId];
 if(!state||!project)return {ok:false,reason:'That sponsor project is not available.'};
 if(state.requests.some(r=>r.projectId===projectId&&['pending','approved'].includes(r.status))||state.commitments.some(c=>c.projectId===projectId&&c.status==='active'))return {ok:false,reason:'A request or active commitment for this project already exists.'};
 const sponsor=sponsorFor(w);
 if(!sponsor)return {ok:false,reason:'No starting sponsor is available.'};
 const score=sponsorApprovalScore(w,project,sponsor);
 const id='sponsor-project-'+state.nextId++;
 const approved=score>=48;
 const mode=chooseSupportMode({...project,id:projectId},sponsor);
 const request={id,projectId,name:project.name,category:project.category,requestedSol:w.time?.sol??0,decisionSol:w.time?.sol??0,status:approved?'approved':'declined',score,reason:approved?'The sponsor approved the project and accepted a continuing support obligation.':'The sponsor declined this proposal under its current priorities and relationship with the colony.'};
 state.requests.push(request);
 record(w,{sol:w.time?.sol??0,kind:approved?'project-approved':'project-declined',requestId:id,projectId,description:sponsor.name+(approved?' approved ':' declined ')+project.name+'. '+request.reason});
 if(!approved)return {ok:true,approved:false,reason:sponsor.name+' declined the proposal. You can revisit it after circumstances change.'};
 const commitment={id:'commitment-'+id,requestId:id,projectId,name:project.name,category:project.category,status:'active',projectState:'approved',approvedSol:w.time?.sol??0,sponsorId:sponsor.id,sponsorName:sponsor.name,supportMode:mode,goods:{...project.goods},nextSupportSol:(w.time?.sol??0),lastSupportSol:null,suspendedReason:null,operationalSupport:true,maintenanceSupport:true,repairSupport:true,autonomyCost:project.autonomyCost,operatingGrant:project.operatingGrant??0,terms:typeTerms(sponsor,mode),supportHistory:[]};
 state.commitments.push(commitment);
 request.commitmentId=commitment.id;
 return {ok:true,approved:true,reason:sponsor.name+' approved '+project.name+'. Ongoing operations, maintenance and repair support are now a standing commitment; support mode: '+mode.replaceAll('-',' ')+'. Project construction itself is not yet simulated.'};
}
function typeTerms(sponsor,mode){
 if(mode==='licensed-machinery'||mode==='restricted-machinery'||mode==='licensed-widgets')return 'Sponsor-controlled equipment or proprietary interfaces may limit local repair and reproduction; continuing access depends on the sponsor honouring this commitment.';
 if(mode==='open-production-capability'||mode==='production-machinery')return 'Support includes production capability and a path toward local repair or manufacture, subject to local feedstock and qualification limits.';
 return 'Sponsor supplies recurring operating consumables, instruments, replacement parts and specialist support as required by the project.';
}
function logCommitment(w,c,sol,kind,description){
 c.supportHistory??=[];c.supportHistory.push({sol,kind,description});if(c.supportHistory.length>30)c.supportHistory.shift();
 record(w,{sol,kind,commitmentId:c.id,projectId:c.projectId,description});
}
function createSponsorShipment(w,home,good,amount,sol,kind,sourceId,description,commitmentId=null){
 w.colonyTrade??={shipments:[],nextShipmentId:1,tradeLog:[]};
 w.colonyTrade.shipments??=[];w.colonyTrade.tradeLog??=[];w.colonyTrade.nextShipmentId??=1;
 if(kind!=='project-support'&&w.colonyTrade.shipments.some(x=>x.status==='in-transit'&&x.toId===home.id&&x.good===good&&x.kind===kind))return null;
 const ship={id:'colony-haul-'+w.colonyTrade.nextShipmentId++,kind,fromId:sourceId,toId:home.id,good,amount,departSol:sol,arrivalSol:sol+240,travelSols:240,distanceKm:null,status:'in-transit',sponsorCommitment:true,commitmentId};
 w.colonyTrade.shipments.push(ship);
 const entry={sol,kind:'sponsor-commitment-shipment',shipmentId:ship.id,toId:home.id,good,amount,description};
 w.colonyTrade.tradeLog.push(entry);if(w.colonyTrade.tradeLog.length>100)w.colonyTrade.tradeLog.shift();
 return ship;
}
function processSponsorOxygenRelief(w,sol,state,events){
 const settlements=(w.settlements??[]).filter(item=>!['failed','abandoned'].includes(item.status));
 for(const settlement of settlements){
  const oxygen=getColonyOxygenStatus(w,settlement.id);
  if(!oxygen||oxygen.runwaySols===null||oxygen.runwaySols>300)continue;
  const existing=(w.infrastructure?.assets??[]).some(asset=>asset.kind==='oxygen-generator'&&asset.status==='operational'&&(asset.operatorId??asset.ownerId)===settlement.id);
  const pending=(w.colonyTrade?.shipments??[]).some(ship=>ship.kind==='infrastructure-equipment'&&ship.equipment?.kind==='oxygen-generator'&&ship.toId===settlement.id&&ship.status==='in-transit');
  if(existing||pending)continue;
  const preferred=(w.sponsors??[]).find(item=>item.id===settlement.sponsorId&&item.status!=='inactive');
  const primarySponsor=sponsorFor(w);
  const conflict=!!(w.campaign?.earthConflictDeclared||w.campaign?.warWithEarth||w.campaign?.survivalGuaranteeSuspended||w.campaign?.sponsorCommitmentsSuspended);
  let sponsor=preferred;
  if(!sponsor||conflict&&sponsor.id===w.campaign?.startingSponsorId){
   const candidates=(w.sponsors??[]).filter(item=>item.id!==w.campaign?.startingSponsorId&&item.status!=='inactive').map(item=>{
    const relation=Number(settlement.politics?.relations?.[item.id]??item.relations?.[primarySponsor?.id]??50);
    const score=25+(Number(item.support)||50)*.18+(Number(item.patience)||50)*.08+relation*.18-(Number(item.pressure)||50)*.12+(item.type==='multilateral'?5:0);
    return {item,score};
   }).sort((a,b)=>b.score-a.score);
   sponsor=candidates[0]?.score>=50?candidates[0].item:null;
  }
  if(!sponsor)continue;
  const relation=Number(settlement.politics?.relations?.[sponsor.id]??(sponsor.id===settlement.sponsorId?75:50));
  const score=35+(Number(sponsor.support)||50)*.18+(Number(sponsor.patience)||50)*.08+relation*.18-(Number(sponsor.pressure)||50)*.12+(sponsor.type==='multilateral'?5:0);
  if(score<45)continue;
  w.colonyTrade??={shipments:[],nextShipmentId:1,tradeLog:[]};
  w.colonyTrade.shipments??=[];w.colonyTrade.tradeLog??=[];w.colonyTrade.nextShipmentId??=1;
  const assetId='relief-oxygen-generator-'+settlement.id+'-'+sponsor.id;
  const ship={id:'colony-haul-'+w.colonyTrade.nextShipmentId++,kind:'infrastructure-equipment',fromId:'earth:'+sponsor.id,toId:settlement.id,good:'oxygen-generator',amount:1,departSol:sol,arrivalSol:sol+240,travelSols:240,distanceKm:null,status:'in-transit',equipment:{kind:'oxygen-generator',assetId,name:'Sponsor-supplied portable oxygen generator',colonyId:settlement.id,ownerId:sponsor.id,funderId:sponsor.id,builderId:sponsor.id,operatorId:settlement.id,controllerId:sponsor.id,technologyProviderId:sponsor.id,softwareProviderId:sponsor.id,softwareControllerId:settlement.id,softwareModifiedByIds:[settlement.id],capacityOxygenKgPerSol:40,source:'autonomous-sponsor-survival-relief'}};
  w.colonyTrade.shipments.push(ship);
  const description=sponsor.name+' independently dispatched a portable oxygen generator to '+settlement.name+' after its oxygen reserve fell to about '+Math.floor(oxygen.runwaySols)+' sols at current metabolic demand. Estimated arrival: 240 sols.';
  w.colonyTrade.tradeLog.push({sol,kind:'sponsor-relief-launched',shipmentId:ship.id,toId:settlement.id,good:'oxygen-generator',description});
  if(w.colonyTrade.tradeLog.length>100)w.colonyTrade.tradeLog.shift();
  record(w,{sol,kind:'oxygen-relief-launched',shipmentId:ship.id,toId:settlement.id,sponsorId:sponsor.id,oxygenRunwaySols:oxygen.runwaySols,description});
  events.push({type:'sponsor-oxygen-relief-launched',sol,description});
 }
}
export function processSponsorCommitments(w,sol,events=[]){
 const state=ensureSponsorCommitments(w);
 if(!state)return events;
 const home=primaryColony(w),sponsor=sponsorFor(w);
 if(!home||!sponsor)return events;
 const conflict=!!(w.campaign?.earthConflictDeclared||w.campaign?.warWithEarth||w.campaign?.survivalGuaranteeSuspended);
 const guaranteeSuspended=conflict||w.campaign?.sponsorCommitmentsSuspended===true;
 state.survivalGuaranteeActive=!guaranteeSuspended;
 if(guaranteeSuspended&&!state.survivalBreachRecorded){
  state.survivalBreachRecorded=true;
  record(w,{sol,kind:'survival-guarantee-suspended',description:sponsor.name+' suspended its founding survival guarantee following the Earth conflict. The colony must seek alternative aid.'});
 }
 if(!guaranteeSuspended&&state.survivalBreachRecorded){
  state.survivalBreachRecorded=false;
  record(w,{sol,kind:'survival-guarantee-restored',description:sponsor.name+' restored the founding survival guarantee.'});
 }
 for(const c of state.commitments){
  if(c.status!=='active')continue;
  const hostile=conflict||w.campaign?.sponsorCommitmentsSuspended===true;
  c.suspendedReason=hostile?'Earth conflict or sponsor sanction':null;
  if(hostile)continue;
  if(sol<(c.nextSupportSol??0))continue;
  const goods=Object.entries(c.goods??{});
  let dispatched=0;
  const operatingGrant=Number(c.operatingGrant)||0;
  if(operatingGrant>0&&w.economy){w.economy.funds=Number(w.economy.funds??0)+operatingGrant;c.lastOperatingGrantSol=sol;c.lastOperatingGrantAmount=operatingGrant;}
  for(const [good,amount] of goods){
   const ship=createSponsorShipment(w,home,good,amount,sol,'project-support','earth:'+c.sponsorId,sponsor.name+' supplied '+amount+' units of '+good+' under its ongoing '+c.name+' commitment.',c.id);
   if(ship)dispatched++;
  }
  c.lastSupportSol=sol;c.nextSupportSol=sol+30;
  logCommitment(w,c,sol,'support-cycle',(operatingGrant>0?'Sponsor transferred '+operatingGrant+' funds for operations. ':'')+(dispatched?'Sponsor dispatched recurring operations/maintenance support for '+c.name+'.':'Support cycle assessed; matching cargo is already in transit.'));
 }
 // Alternative external assistance is triggered by the survival crisis, not by ordinary low stocks.
 const criticallyLow=['food','components','machinery','electronics'].filter(g=>Number(home.economy?.inventory?.[g]??0)<({food:8,components:0.8,machinery:0.35,electronics:0.2}[g]));
 if(criticallyLow.length&&(!state.survivalGuaranteeActive||w.campaign?.sponsorCommitmentsSuspended===true)){
  for(const good of criticallyLow){
   if(state.externalAppeals.some(a=>a.good===good&&['open','in-transit'].includes(a.status)))continue;
   const alternatives=(w.sponsors??[]).filter(item=>item.id!==w.campaign.startingSponsorId).map(item=>({item,relation:Number(item.relations?.[w.campaign.startingSponsorId]??item.relations?.[sponsor.id]??50),multilateral:item.type==='multilateral'?1:0})).sort((a,b)=>b.relation-a.relation||b.multilateral-a.multilateral);
   const alternative=alternatives[0]?.item??null;
   const sourceName=alternative?.name??'International relief';
   const sourceId=alternative?'earth:'+alternative.id:'earth:international-relief';
   const appeal={id:'external-appeal-'+state.nextId++,openedSol:sol,good,status:'in-transit',source:sourceName,sourceSponsorId:alternative?.id??null,amount:good==='food'?45:good==='components'?8:good==='machinery'?5:4,arrivalSol:sol+240};
   state.externalAppeals.push(appeal);
   const ship=createSponsorShipment(w,home,good,appeal.amount,sol,'external-humanitarian-aid',sourceId,sourceName+' dispatched '+appeal.amount+' units of '+good+' after the founding sponsor guarantee was suspended; estimated arrival in 240 sols.');
   if(ship){ship.kind='external-humanitarian-aid';ship.externalAppealId=appeal.id;events.push({type:'external-aid-appeal',sol,description:'The colony appealed to '+sourceName+' for emergency '+good+' supplies; estimated arrival in 240 sols.'});}
  }
 }
 state.externalAppeals=state.externalAppeals.map(a=>{
  if(a.status==='in-transit'&&sol>=a.arrivalSol)a.status='delivered';
  return a;
 });
 processSponsorOxygenRelief(w,sol,state,events);
 state.lastProcessedSol=sol;
 return events;
}
export function getSponsorCommitmentSummary(w){
 const state=ensureSponsorCommitments(w);
 if(!state)return null;
 return {survivalGuaranteeActive:state.survivalGuaranteeActive,commitments:state.commitments.map(c=>({...c,goods:{...c.goods}})),requests:state.requests.slice(-10).reverse(),history:state.history.slice(-8).reverse(),externalAppeals:state.externalAppeals.slice(-8).reverse(),availableProjects:Object.entries(PROJECTS).map(([id,p])=>({id,...p}))};
}
