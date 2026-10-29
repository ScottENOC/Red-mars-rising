import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';
import { createInitialWorldState } from './world/world-state.js';
import { terrainHeight, terrainRadiusOffset, loadMolaTopography, updatePolarCaps, setTerrainWorldState } from './world/terrain.js';
import { createColonyAndLogistics } from './world/colony-logistics.js';
import { STARTING_LOCATIONS, SPONSORS, STRATEGIC_PROGRAMS, HABITAT_COMPONENT_CATALOGUE, ensureConstructionRecipeOptions, startCampaign } from './world/campaign-options.js';
import { processWorldTick, commissionProject, commissionStrategicProgram } from './world/world-tick.js';
import { METEOROID_TYPES } from './world/material-inventories.js';
import { ensureColonyPoliticalState, influenceColony, getColonyPoliticalSummary } from './world/colony-politics.js';

const TEXTURE_URL=new URL('../data/mars/8k_mars.jpg', import.meta.url).href;
const worldState = createInitialWorldState();
const SAVE_KEY = 'red-mars-rising-campaign-v1';
let savedGameLoaded = false;
let saveStatus = 'Not saved';
let saveStatusElement = null;
try {
 const rawSave = localStorage.getItem(SAVE_KEY);
 if (rawSave) {
  const save = JSON.parse(rawSave);
  if (save?.version === 1 && save.worldState && typeof save.worldState === 'object') {
   Object.assign(worldState, save.worldState);
   worldState.terrain ??= {source:'NASA MOLA MEGDR 4 pixels/degree',geologicalModifications:[],depositSites:[]};
   worldState.terrain.geologicalModifications ??= [];
   worldState.terrain.depositSites ??= [];
   savedGameLoaded = true;
   saveStatus = 'Loaded · Sol ' + (worldState.time?.sol ?? 0);
   window.__RMR_LOADED_SAVE = {elapsedGameSeconds:Math.max(0,Number(save.elapsedGameSeconds)||0)};
  }
 }
} catch (error) {
 console.warn('Could not load saved Red Mars Rising campaign; starting fresh.', error);
}
if (worldState.campaign?.started) {
 ensureConstructionRecipeOptions(worldState);
 worldState.campaign.strategicPrograms ??= STRATEGIC_PROGRAMS.map(p=>({...p,cost:{...p.cost},status:'available',remainingSols:p.durationSols,progress:0}));
 worldState.campaign.dependencyPolicy ??= 'accept-for-now';
 worldState.campaign.localManufacturingAssessment ??= null;
 worldState.campaign.logisticsReliability ??= 0.5;
 ensureColonyPoliticalState(worldState);
}
let colonyLogistics = null;
let terrainReady = false;
let lastProcessedClockSol = Math.max(0, Number(worldState.time?.sol) || 0);
const SHOW_GENERATED_POLAR_CAPS = true;
let lastIceSolarLongitude = -1;

// Mission timeline: the first crew leaves Earth in late 2026 and arrives in July 2027.
const MISSION_ARRIVAL_UTC = Date.UTC(2027, 6, 22, 0);
const ARRIVAL_LOCAL_SOL_SECONDS = 9 * 3600;
const MARS_SOL_SECONDS = 88775.244;
let elapsedGameSeconds = Math.max(0, Number(window.__RMR_LOADED_SAVE?.elapsedGameSeconds) || 0);
let clockRunning = false;
let clockSpeed = 60; // one game minute per real second by default
let clockUiElapsed = 0;
const clockStyle = document.createElement('style');
clockStyle.textContent = `
#missionClock{position:absolute;z-index:4;top:86px;right:clamp(14px,3.5vw,48px);display:flex;align-items:center;gap:12px;padding:8px 10px;background:#0b1018d9;border:1px solid #ffffff24;backdrop-filter:blur(16px);box-shadow:0 12px 40px #0005;font-variant-numeric:tabular-nums}
#missionClock .mc-now{display:flex;flex-direction:column;gap:3px;min-width:100px}
#missionClock .mc-date{font-size:12px;letter-spacing:.06em;color:#f1e8df}
#missionClock .mc-sol{font-size:10px;color:#b5b4b1;letter-spacing:.04em}
#missionClock .mc-controls{display:flex;gap:5px}
#missionClock button{border:1px solid #ffffff25;background:#ffffff08;padding:7px 8px;font-size:9px;letter-spacing:.05em;color:#ded6ce;white-space:nowrap}
#missionClock button:hover{border-color:#c17b60;color:#fff}
@media(max-width:760px){#missionClock{top:68px;right:12px;gap:6px;padding:6px 7px}#missionClock .mc-now{min-width:82px}#missionClock .mc-date{font-size:10px}#missionClock .mc-sol{font-size:9px}#missionClock .mc-controls{gap:3px}#missionClock button{padding:7px 5px;font-size:8px}}
@media(max-width:390px){#missionClock{top:63px;right:8px;gap:5px;padding:5px}#missionClock .mc-now{min-width:70px}#missionClock .mc-date{font-size:9px}#missionClock .mc-sol{font-size:8px}#missionClock button{padding:6px 4px;font-size:7px}}
`;
document.head.appendChild(clockStyle);

const campaignStyle=document.createElement('style');
campaignStyle.textContent=`
#campaignStart{position:absolute;z-index:10;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;background:#070a0feF;backdrop-filter:blur(18px);overflow:auto}
#campaignStart[hidden]{display:none}
.cs-card{width:min(880px,100%);max-height:calc(100dvh - 36px);overflow:auto;border:1px solid #ffffff28;background:linear-gradient(145deg,#141a22f7,#090d13f7);box-shadow:0 24px 90px #000b;padding:clamp(18px,4vw,36px)}
.cs-kicker{font-size:10px;letter-spacing:.22em;color:#d87957;text-transform:uppercase}
.cs-card h2{font:400 clamp(27px,4vw,42px)/1.05 Georgia,serif;margin:10px 0 12px}
.cs-intro{max-width:680px;color:#aeb2b5;font-size:13px;line-height:1.65;margin:0 0 22px}
.cs-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.cs-field label{display:block;color:#d7c3b7;font-size:10px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px}
.cs-field select{width:100%;background:#0a0f16;border:1px solid #ffffff2b;color:#f2e9df;padding:12px;font:inherit;font-size:13px;border-radius:0}
.cs-detail{margin-top:10px;min-height:124px;padding:14px;background:#ffffff06;border:1px solid #ffffff14;color:#aeb2b5;font-size:12px;line-height:1.6}
.cs-detail strong{display:block;color:#eee1d5;font-weight:500;margin-bottom:5px}
.cs-detail .cs-meta{color:#d49a7e;font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px}
.cs-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:20px;padding-top:16px;border-top:1px solid #ffffff1c}
.cs-note{max-width:470px;color:#8f979c;font-size:11px;line-height:1.5}
#csStart{border:1px solid #d87957;background:#3a2119;padding:13px 18px;color:#ffe6d8;font-size:11px;letter-spacing:.13em;text-transform:uppercase;white-space:nowrap}
#csStart:disabled{opacity:.45}
#campaignPanel{position:absolute;z-index:4;left:clamp(14px,3vw,38px);top:clamp(150px,22vh,220px);width:min(300px,calc(100vw - 28px));max-height:52vh;overflow:auto;background:#0b1018ed;border:1px solid #ffffff24;backdrop-filter:blur(16px);padding:14px;box-shadow:0 14px 42px #0006}
#campaignPanel[hidden]{display:none}
.cp-heading{display:flex;justify-content:space-between;gap:8px;color:#d9c2b3;font-size:10px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:8px}
.cp-metrics{font-size:11px;line-height:1.65;color:#aeb4b7;border-bottom:1px solid #ffffff18;padding-bottom:9px;margin-bottom:8px}
.cp-metrics strong{color:#eee4dc;font-weight:500}
.cp-diplomacy{border-bottom:1px solid #ffffff18;padding:8px 0 10px;margin-bottom:8px;color:#b7a89f;font-size:10px}.cp-diplomacy summary{cursor:pointer;letter-spacing:.08em;text-transform:uppercase}.cp-sponsor{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid #ffffff0d}.cp-sponsor strong{font-weight:500;color:#e7e2dc}.cp-sponsor span{color:#899197;text-align:right;font-size:9px}.cp-project{border-top:1px solid #ffffff12;padding:9px 0}
.cp-project strong{display:block;color:#e7e2dc;font-size:11px;font-weight:500}
.cp-project small{display:block;color:#899197;font-size:9px;line-height:1.5;margin:4px 0 7px}
.cp-project button{border:1px solid #ffffff24;background:#ffffff08;color:#d9c2b3;font-size:9px;letter-spacing:.08em;padding:7px 9px}
.cp-project button:disabled{opacity:.5}
@media(max-width:760px){#campaignStart{padding:10px}.cs-card{max-height:calc(100dvh - 20px);padding:18px}.cs-grid{grid-template-columns:1fr;gap:12px}.cs-detail{min-height:0}.cs-footer{align-items:flex-start;flex-direction:column}.cs-note{max-width:none}#csStart{width:100%}#campaignPanel{top:112px;left:10px;width:min(260px,calc(100vw - 20px));max-height:45vh;padding:10px}}
`;
document.head.appendChild(campaignStyle);
const campaignStart=document.createElement('section');
campaignStart.id='campaignStart';
campaignStart.innerHTML=`
 <div class="cs-card">
  <div class="cs-kicker">Red Mars Rising · First Expedition</div>
  <h2>Choose where humanity begins.</h2>
  <p class="cs-intro">Five years of expedition supplies are committed to the site you select. Every sponsor remains active in the wider Mars programme; your choice changes your starting support, political obligations and the relationships you inherit.</p>
  <div class="cs-grid">
   <div class="cs-field"><label for="csSite">Starting site</label><select id="csSite"></select><div class="cs-detail" id="csSiteDetail"></div></div>
   <div class="cs-field"><label for="csSponsor">Starting sponsor</label><select id="csSponsor"></select><div class="cs-detail" id="csSponsorDetail"></div></div>
  </div>
  <div class="cs-footer"><div class="cs-note">These are strategic abstractions, not guarantees: local water, construction conditions and future inundation depend on later surveys and the evolving climate model.</div><button id="csStart" type="button">Begin expedition</button></div>
 </div>`;
document.querySelector('#app').appendChild(campaignStart);
const siteSelect=campaignStart.querySelector('#csSite');
const sponsorSelect=campaignStart.querySelector('#csSponsor');
const siteDetail=campaignStart.querySelector('#csSiteDetail');
const sponsorDetail=campaignStart.querySelector('#csSponsorDetail');
for(const site of STARTING_LOCATIONS){const option=document.createElement('option');option.value=site.id;option.textContent=site.name;siteSelect.appendChild(option);}
for(const sponsor of SPONSORS){const option=document.createElement('option');option.value=sponsor.id;option.textContent=sponsor.name;sponsorSelect.appendChild(option);}
siteSelect.value='elysium';sponsorSelect.value='nasa';
function refreshStartDetails(){
 const site=STARTING_LOCATIONS.find(x=>x.id===siteSelect.value),sponsor=SPONSORS.find(x=>x.id===sponsorSelect.value);
 siteDetail.innerHTML='<strong>'+site.terrain+'</strong><div class="cs-meta">'+site.climate+'</div><div><b>Water:</b> '+site.water+'</div><div><b>Build:</b> '+site.construction+' · <b>Security:</b> '+site.security+'</div><div><b>Opportunity:</b> '+site.opportunity+'</div>';
 sponsorDetail.innerHTML='<strong>'+sponsor.name+'</strong><div class="cs-meta">'+sponsor.type+' sponsor · patience '+sponsor.patience+'/100</div><div>'+sponsor.description+'</div><div><b>Strengths:</b> '+sponsor.strengths+'</div><div><b>Obligations:</b> '+sponsor.obligations+'</div>';
}
siteSelect.addEventListener('change',refreshStartDetails);sponsorSelect.addEventListener('change',refreshStartDetails);refreshStartDetails();
const campaignPanel=document.createElement('section');campaignPanel.id='campaignPanel';campaignPanel.hidden=true;document.querySelector('#app').appendChild(campaignPanel);
function buildHabitatComponentReport(){
 const project=worldState.infrastructure.projects.find(p=>p.id==='buried-habitat');
 if(!project)return '';
 const recipe=(project.recipeOptions??[]).find(r=>r.id===project.selectedRecipeId)??project.recipeOptions?.[0];
 if(!recipe)return '';
 const study=worldState.campaign.localManufacturingAssessment;
 const studyProgram=(worldState.campaign.strategicPrograms??[]).find(p=>p.id==='local-components-study');
 const cargoProgram=(worldState.campaign.strategicPrograms??[]).find(p=>p.id==='cargo-pipeline');
 const rows=HABITAT_COMPONENT_CATALOGUE.map(component=>{
  const provision=component.provision[recipe.id]??'Not specified in the selected recipe.';
  const imported=/imported/i.test(provision);
  const gap=/not separately specified/i.test(provision);
  return '<div style="padding:7px 0;border-top:1px solid #ffffff12"><strong>'+component.name+'</strong><div>'+component.function+'</div><div style="color:'+(gap?'#e0b47b':imported?'#d49a7e':'#b8c6b0')+'">'+provision+'</div><div style="opacity:.72">'+component.constraint+'</div></div>';
 }).join('');
 const studyStatus=study?'Assessment complete: low-confidence scenario estimate of '+study.potentialSubstitutionRange[0]+'–'+study.potentialSubstitutionRange[1]+'% substitution for selected non-critical components. This does not qualify or produce a pressure liner, structural frame or other finished part.':studyProgram?.status==='active'?'Local component study in progress; no manufacturing capability is created until further processing and qualification work is funded.':'No local component feasibility assessment completed.';
 const cargoStatus='Cargo reliability: '+Math.round((worldState.campaign.logisticsReliability??0.5)*100)+'% model score'+(cargoProgram?.status==='complete'?' (pipeline programme complete).':cargoProgram?.status==='active'?' (pipeline programme in progress).':'.');
 return '<details style="margin:8px 0;padding:9px;background:#111923;border:1px solid #ffffff22;border-radius:8px"><summary style="cursor:pointer;font-weight:700">Habitat component dependencies · '+recipe.name+'</summary><div style="margin-top:8px;font-size:11px;line-height:1.55">'+rows+'<div style="padding:8px 0;border-top:1px solid #ffffff20"><strong>Strategic implications</strong><div>'+studyStatus+'</div><div>'+cargoStatus+'</div><div style="margin-top:5px">Current recipe still relies on imported qualified pressure/critical hardware. To reduce this dependency, investigate component-specific feedstock processing, fabrication, inspection and qualification; do not assume 3D printing or the study alone makes parts usable.</div></div></div></details>';
}
function buildColonyPoliticsReport(){
 ensureColonyPoliticalState(worldState);
 const home=worldState.settlements.find(s=>s.kind==='primary-colony');
 if(!home)return '';
 const rivals=worldState.settlements.filter(s=>s.kind==='rival-colony');
 const pending=(worldState.sponsors??[]).filter(s=>s.id!==worldState.campaign.startingSponsorId&&!s.colonyFounded).length;
 const rows=rivals.map(colony=>{
  const p=getColonyPoliticalSummary(worldState,colony);
  const lastJoint=Number(colony.politics.lastPlayerActions['joint-research']);
  const lastAutonomy=Number(colony.politics.lastPlayerActions['martian-autonomy']);
  const jointReady=!Number.isFinite(lastJoint)||worldState.time.sol-lastJoint>=90;
  const autonomyReady=!Number.isFinite(lastAutonomy)||worldState.time.sol-lastAutonomy>=120;
  const sponsor=worldState.sponsors.find(s=>s.id===colony.sponsorId);
  return '<div style="padding:9px 0;border-top:1px solid #ffffff18"><strong>'+colony.name+'</strong><div>'+ (sponsor?.name??'Independent sponsor')+' · population '+Math.round(colony.population??0)+' · '+(colony.status??'status unknown')+'</div><div style="margin-top:4px">Martian identity index '+p.martianIdentity+' · local autonomy '+p.localAutonomy+' · sponsor influence '+p.sponsorInfluence+'</div><div>Political stability '+p.politicalStability+' · relationship with your colony '+p.relationToPlayer+' · cooperation '+p.cooperation+'</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:7px"><button data-colony-action="joint-research" data-colony-id="'+colony.id+'" '+(!jointReady||worldState.economy.funds<20?'disabled':'')+'>Joint research · 20 funds'+(!jointReady?' · cooldown':'')+'</button><button data-colony-action="martian-autonomy" data-colony-id="'+colony.id+'" '+(!autonomyReady||worldState.economy.funds<15?'disabled':'')+'>Support Martian autonomy · 15 funds'+(!autonomyReady?' · cooldown':'')+'</button></div></div>';
 }).join('');
 return '<details style="margin:8px 0;padding:9px;background:#111923;border:1px solid #ffffff22;border-radius:8px"><summary style="cursor:pointer;font-weight:700">Martian colonies & diplomacy · '+rivals.length+' established</summary><div style="margin-top:8px;font-size:12px;line-height:1.55"><div>Each colony has its own political state. Sponsor relationships shape initial conditions but do not dictate colony-to-colony relations. Identity, autonomy and cooperation can evolve independently; unity is not guaranteed.</div>'+(rivals.length?rows:'<div style="padding:8px 0">No rival crewed colony has arrived yet. '+pending+' sponsor expedition plan(s) remain active; this section will become actionable when another colony is established.</div>')+'<div style="opacity:.72;margin-top:6px">These 0–100 values are prototype political indices, not measured probabilities. Joint research and autonomy initiatives are early influence actions; trade, treaties, factions, sanctions and war are not implemented yet.</div></div></details>';
}
function renderCampaignPanel(){
 if(!worldState.campaign.started)return;
 const sponsor=worldState.sponsors.find(x=>x.id===worldState.campaign.startingSponsorId);
 const home=worldState.settlements.find(x=>x.kind==='primary-colony');
 const tempAnomaly=worldState.climate.energyBalance.temperatureAnomalyC??0;
 const materials=worldState.materials;
 const colonyStock=materials?.colonies?.[home.id];
 const siteDeposit=materials?.siteDeposits?.[home.locationId];
 const fmtMass=kg=>Number(kg??0).toLocaleString('en-AU',{maximumFractionDigits:0})+' kg';
 const planetaryWater=materials?Object.entries(materials.planetary.waterKg).filter(([key])=>!key.startsWith('site_')).map(([key,stock])=>'<div>'+({atmosphericVapour:'Atmospheric vapour',surfaceIce:'Surface ice',subsurfaceIce:'Undistributed subsurface ice',groundwater:'Groundwater',surfaceLiquid:'Surface liquid water',hydratedMinerals:'Hydrated minerals'}[key]??key)+': '+fmtMass(stock.mass)+'</div>').join(''):'';
 const meteorTypesHtml=materials?METEOROID_TYPES.map(type=>{const stock=materials.planetary.meteoroids.types[type.id];return '<div>'+type.label+': '+fmtMass(stock.retainedKg)+' retained ('+fmtMass(stock.massKg)+' entered)</div>';}).join(''):'';
 const impactDeposits=worldState.terrain?.depositSites??[];
 const impactDepositMassKg=impactDeposits.reduce((sum,deposit)=>sum+Number(deposit.totalMassKg??0),0);
 const impactDepositsHtml='<strong>Permanent impact deposits</strong><div>'+impactDeposits.length.toLocaleString('en-AU')+' local deposit records · '+fmtMass(impactDepositMassKg)+' retained material by composition</div>'+impactDeposits.slice(-5).reverse().map(deposit=>'<div>Sol '+deposit.sol+' · '+deposit.sourceLabel+' · '+fmtMass(deposit.totalMassKg)+' · '+deposit.lat.toFixed(2)+'°, '+deposit.lon.toFixed(2)+'°</div>').join('')+'<div style="opacity:.72">Deposits are recorded in local campaign state but extraction and assay mechanics are not implemented yet.</div>';
 const physicalStocks=colonyStock?.materialsKg??{};
 const thermalStock=colonyStock?.thermal;
 const physicalMaterialHtml='<strong>Physical colony stocks</strong><div>Dry food (glucose-equivalent): '+fmtMass(colonyStock?.foodKg)+' · Biomass: '+fmtMass(colonyStock?.biomassKg)+' · Solid waste: '+fmtMass(colonyStock?.solidWasteKg)+'</div><div>Regolith: '+fmtMass(physicalStocks.regolith)+' · Aggregate: '+fmtMass(physicalStocks.aggregate)+' · Metal-bearing concentrate: '+fmtMass(physicalStocks.metalConcentrate)+' · Tailings: '+fmtMass(physicalStocks.tailings)+'</div><div>Construction committed: '+fmtMass(physicalStocks.constructionInProgress)+' · Installed construction mass: '+fmtMass(physicalStocks.constructionComponents)+'</div><div>Nutrients: '+fmtMass(physicalStocks.nutrients)+' · Spare parts: '+fmtMass(physicalStocks.spareParts)+' · Polymers: '+fmtMass(physicalStocks.polymers)+'</div><div>Colony thermal stock: '+(thermalStock?.storedEnergyJ??0).toExponential(3)+' J · modelled internal temperature '+(thermalStock?.temperatureC??20).toFixed(4)+' °C</div><div>Thermal energy in '+(thermalStock?.heatInputCumulativeJ??0).toExponential(3)+' J · leaked out '+(thermalStock?.heatLossCumulativeJ??0).toExponential(3)+' J · electricity used '+(materials.energy.electricityConsumedKWh??0).toFixed(1)+' kWh</div><div>Planetary thermal anomaly stock: '+(worldState.climate.energyBalance?.storedThermalEnergyJ??0).toExponential(3)+' J · global temperature anomaly '+(worldState.climate.energyBalance?.temperatureAnomalyC??0).toExponential(3)+' °C</div><div style="opacity:.72">Food is a simplified dry carbohydrate-equivalent; crop nutrition, mineral nutrient cycles, refined metal production and waste treatment remain incomplete.</div>';
 const projectCards=worldState.infrastructure.projects.map(p=>{
  const recipe=(p.recipeOptions??[]).find(r=>r.id===p.selectedRecipeId)??p.recipeOptions?.[0]??null;
  const costs=recipe?.economyCost??p.cost;
  const missingStock=Object.entries(recipe?.localMaterialsKg??{}).filter(([key,amount])=>Number(physicalStocks[key]??0)+1e-9<amount);
  const missingEconomy=Object.entries(costs).filter(([key,amount])=>Number(worldState.economy[key]??0)<amount);
  const requirements=recipe?'<div>Local inputs: '+Object.entries(recipe.localMaterialsKg??{}).map(([key,value])=>key+' '+fmtMass(value)).join(' · ')+'</div><div>Imported components: '+fmtMass(Object.values(recipe.importedMaterialsKg??{}).reduce((sum,value)=>sum+Number(value||0),0))+' · '+recipe.risk+'</div>':'';
  const recipeSelect=(p.recipeOptions?.length??0)>1?'<label style="display:block;margin:6px 0 2px">Construction method<select data-project-recipe="'+p.id+'" '+(p.status!=='available'?'disabled':'')+' style="display:block;width:100%;margin-top:3px">'+p.recipeOptions.map(r=>'<option value="'+r.id+'" '+(r.id===recipe?.id?'selected':'')+'>'+r.name+'</option>').join('')+'</select></label>':'';
  const status=p.status==='active'?'Progress '+Math.round(p.progress*100)+'%'+(p.pausedReason?' · '+p.pausedReason:''):p.status==='complete'?'Completed':missingStock.length?'Waiting for local stocks: '+missingStock.map(([key,amount])=>key+' '+fmtMass(amount)+' required').join(', '):missingEconomy.length?'Insufficient abstract resources: '+missingEconomy.map(([key,amount])=>key+' '+amount+' required').join(', '):'Ready to commission';
  return '<div class="cp-project"><strong>'+p.name+'</strong><small>'+p.description+'<br>Cost: '+Object.entries(costs).map(([k,v])=>k+' '+v).join(' · ')+'<br>'+status+'</small>'+recipeSelect+'<small>'+requirements+'</small><button data-project="'+p.id+'" '+(p.status!=='available'||missingStock.length>0||missingEconomy.length>0?'disabled':'')+'>'+(p.status==='active'?'In progress':p.status==='complete'?'Complete':'Commission project')+'</button></div>';
 }).join('');
 const materialPanel=materials?'<details style="margin:8px 0;padding:8px;background:#111923;border:1px solid #ffffff22;border-radius:8px"><summary style="cursor:pointer;font-weight:700">Material inventories & conservation</summary><div style="margin-top:8px;font-size:12px;line-height:1.55"><strong>Planetary water reservoirs</strong>'+planetaryWater+'<strong>Colony water</strong><div>Tanks: '+fmtMass(colonyStock?.waterKg.tanks)+' · Wastewater/brine: '+fmtMass(colonyStock?.waterKg.wastewater)+' · Habitat humidity: '+fmtMass(colonyStock?.waterKg.habitatHumidity)+'</div><strong>Local ice deposit</strong><div>'+home.locationId+': '+fmtMass(materials.planetary.waterKg[siteDeposit?.waterStockId]?.mass)+' · confidence '+(siteDeposit?.confidence??'unknown')+' · '+(siteDeposit?.surveyed?'surveyed':'not surveyed')+'</div><strong>Colony gases</strong><div>H₂ '+fmtMass(colonyStock?.gasesKg.hydrogen)+' · O₂ '+fmtMass(colonyStock?.gasesKg.oxygen)+' · CO₂ '+fmtMass(colonyStock?.gasesKg.carbonDioxide)+'</div><strong>Natural meteoroids (cumulative)</strong><div>Incoming '+fmtMass(materials.planetary.meteoroids.incomingCumulativeKg)+' · Retained at surface '+fmtMass(materials.planetary.meteoroids.retainedCumulativeKg)+' · Atmospheric aerosols '+fmtMass(materials.planetary.atmosphereKg.meteoroidAerosols)+' · Craters over 8 m '+materials.planetary.meteoroids.craterImpactsGreaterThan8mCumulative+'</div>'+meteorTypesHtml+impactDepositsHtml+physicalMaterialHtml+'<strong>Balance diagnostics</strong><div>Tracked mass residual: '+fmtMass(materials.diagnostics.waterBalanceErrorKg)+' · H residual: '+fmtMass(materials.diagnostics.hydrogenBalanceErrorKg)+' · O residual: '+fmtMass(materials.diagnostics.oxygenBalanceErrorKg)+' · Colony matter residual: '+fmtMass(materials.diagnostics.colonyMatterBalanceErrorKg)+' · Carbon residual: '+fmtMass(materials.diagnostics.carbonBalanceErrorKg)+'</div><div>Atmospheric pressure from mass: '+worldState.climate.atmosphere.pressurePa.toFixed(3)+' Pa</div><div style="opacity:.72">Meteoroid class proportions and initial global water stocks are scenario estimates, not calibrated measurements. Type masses are cumulative; this panel is a prototype accounting view.</div></div></details>':'';
 campaignPanel.innerHTML='<div class="cp-heading"><span>Colony operations</span><span>Sol '+worldState.time.sol+'</span></div>'+
 '<div class="cp-metrics"><strong>'+home.name+'</strong><br>'+sponsor.name+' · '+worldState.settlements.length+' settlement(s)<br>Earth link: '+(worldState.pointsOfInterest.filter(p=>p.kind==='mars-orbit-comms'&&p.status==='operational').length)+' Mars relays · ~12.5 min one-way light time<br>Transfer vehicle: '+(worldState.pointsOfInterest.find(p=>p.id==='mars-crewship')?.status??'unknown')+' in Mars orbit<br>Funds '+worldState.economy.funds+' · Materials '+worldState.economy.materials+' · Water '+worldState.economy.water.toFixed(1)+'<br>Morale '+worldState.colonists.morale.toFixed(1)+' · Sponsor patience '+worldState.campaign.sponsorPatience.toFixed(1)+'<br>Global heat contribution: '+tempAnomaly.toExponential(3)+' °C anomaly</div>'+
 materialPanel+
 buildColonyPoliticsReport()+
 buildHabitatComponentReport()+
 '<div class="cp-heading"><span>Strategic priorities</span><span>Colony-level decisions</span></div>'+
 '<div class="cp-metrics"><strong>Import dependence</strong><br>Current policy: '+({ 'accept-for-now':'Accept dependence for now', 'investigate-local-production':'Investigate local production', 'strengthen-supply-chain':'Strengthen supply chain' }[worldState.campaign.dependencyPolicy]??'Accept dependence for now')+'<br>Imported specialist components remain a potential bottleneck. Local regolith processing currently produces aggregate and metal-bearing concentrate, not qualified metal parts or finished components. The player sets priorities; the colony handles day-to-day execution.</div>'+
 (worldState.campaign.localManufacturingAssessment?'<div class="cp-project"><strong>Local manufacturing assessment</strong><small>Preliminary estimate: '+worldState.campaign.localManufacturingAssessment.potentialSubstitutionRange[0]+'–'+worldState.campaign.localManufacturingAssessment.potentialSubstitutionRange[1]+'% substitution potential for '+worldState.campaign.localManufacturingAssessment.category+'. Confidence: low. This is not current production capacity; processing, quality assurance and component qualification are still needed.</small></div>':'')+
 (worldState.campaign.strategicPrograms??[]).map(p=>'<div class="cp-project"><strong>'+p.name+'</strong><small>'+p.description+'<br>Cost: '+Object.entries(p.cost).map(([k,v])=>k+' '+v).join(' · ')+'<br>'+ (p.status==='active'?'Progress '+Math.round(p.progress*100)+'%'+(p.pausedReason?' · '+p.pausedReason:''):p.status==='complete'?'Completed · '+p.outcome:'Duration '+p.durationSols+' sols')+'</small><button data-strategic-program="'+p.id+'" '+(p.status!=='available'?'disabled':'')+'>'+(p.status==='active'?'In progress':p.status==='complete'?'Complete':'Fund programme')+'</button></div>').join('')+
 '<div class="cp-project"><strong>Accept dependence for now</strong><small>Do not commit additional funds to these initiatives yet. Preserve remaining resources for other priorities; continue relying on sponsor deliveries and accept the risk of delays or interruptions.</small><button data-dependency-policy="accept-for-now">Accept for now</button></div>'+
 '<div class="cp-heading"><span>Projects</span><span>'+worldState.infrastructure.projects.filter(p=>p.status==='active').length+' active</span></div>'+
 projectCards+
 '<div class="cp-project"><strong>Campaign save</strong><small id="saveStatusText">'+saveStatus+'</small><button data-save-now="1">Save now</button></div>';
 saveStatusElement=campaignPanel.querySelector('#saveStatusText');
}
campaignPanel.addEventListener('change',event=>{
 const recipeSelect=event.target.closest('[data-project-recipe]');
 if(!recipeSelect)return;
 const project=worldState.infrastructure.projects.find(p=>p.id===recipeSelect.dataset.projectRecipe);
 if(!project||project.status!=='available')return;
 if((project.recipeOptions??[]).some(r=>r.id===recipeSelect.value))project.selectedRecipeId=recipeSelect.value;
 renderCampaignPanel();
});
campaignPanel.addEventListener('click',event=>{
 const policyButton=event.target.closest('[data-dependency-policy]');
 if(policyButton){worldState.campaign.dependencyPolicy=policyButton.dataset.dependencyPolicy;notify('Strategic policy updated');renderCampaignPanel();saveCampaign('strategic-policy');return;}
 const strategicButton=event.target.closest('[data-strategic-program]');
 if(strategicButton){const result=commissionStrategicProgram(worldState,strategicButton.dataset.strategicProgram);notify(result.ok?'Strategic programme commissioned':result.reason);renderCampaignPanel();return;}
 const diplomacyButton=event.target.closest('[data-colony-action]');
 if(diplomacyButton){
  const result=influenceColony(worldState,diplomacyButton.dataset.colonyId,diplomacyButton.dataset.colonyAction);
  notify(result.reason);
  renderCampaignPanel();
  if(result.ok)saveCampaign('colony-diplomacy');
  return;
 }
 const saveButton=event.target.closest('[data-save-now]');
 if(saveButton){const ok=saveCampaign('manual');notify(ok?'Campaign saved on this device':'Could not save campaign; check browser storage');return;}
 const button=event.target.closest('[data-project]');if(!button)return;
 const result=commissionProject(worldState,button.dataset.project);notify(result.ok?'Project commissioned':result.reason);renderCampaignPanel();
});
function beginSelectedCampaign(){
 if(worldState.campaign.started)return;
 const {site,sponsor}=startCampaign(worldState,siteSelect.value,sponsorSelect.value);
 locations.colony={name:worldState.settlements[0].name,lat:site.lat,lon:site.lon,zoom:.15,description:'The first settlement at '+site.name+'. Five years of expedition supplies are committed to this site.'};
 const colonyNav=document.querySelector('[data-place="colony"] .place-name');if(colonyNav)colonyNav.textContent=worldState.settlements[0].name+' · First colony';
 const jezeroNav=document.querySelector('[data-place="jezero"]');if(jezeroNav&&site.id==='jezero')jezeroNav.querySelector('.place-name').textContent='Jezero Crater · First colony';
 campaignStart.hidden=true;campaignPanel.hidden=false;
 clockRunning=true;document.querySelector('#mcPlay').textContent='Ⅱ PAUSE';
 if(terrainReady&&!colonyLogistics)colonyLogistics=createColonyAndLogistics(THREE,{root,scene,worldState,terrainRadiusOffset,notify});
 if(site.id==='elysium'||site.id==='arcadia')notify('Expedition landed at '+site.name+' · '+sponsor.name+' sponsorship');
 else notify('Expedition landed at '+site.name+' · '+sponsor.name+' sponsorship');
 renderCampaignPanel();
 if(terrainReady)focusPlace('colony');
}
campaignStart.querySelector('#csStart').addEventListener('click',beginSelectedCampaign);
if(savedGameLoaded && worldState.campaign.started){
 const home=worldState.settlements.find(s=>s.kind==='primary-colony');
 const site=STARTING_LOCATIONS.find(s=>s.id===home?.locationId);
 if(home&&site)locations.colony={name:home.name,lat:site.lat,lon:site.lon,zoom:.15,description:'Saved first settlement at '+site.name+'.'};
 campaignStart.hidden=true;campaignPanel.hidden=false;clockRunning=false;
 renderCampaignPanel();
}

const clockPanel = document.createElement('section');
clockPanel.id = 'missionClock';
clockPanel.setAttribute('aria-label', 'Mission date and Mars local time');
clockPanel.innerHTML = `
  <div class="mc-now"><div class="mc-date" id="mcDate">22 JUL 2027</div><div class="mc-sol" id="mcSol">SOL 001 · 09:00 LMST</div></div>
  <div class="mc-controls"><button id="mcPlay" type="button">▶ PLAY</button><button id="mcSpeed" type="button">×60</button></div>`;
document.querySelector('#app').appendChild(clockPanel);
document.querySelector('#mcPlay').addEventListener('click', () => {
  clockRunning = !clockRunning;
  document.querySelector('#mcPlay').textContent = clockRunning ? 'Ⅱ PAUSE' : '▶ PLAY';
  document.querySelector('#mcPlay').setAttribute('aria-label', clockRunning ? 'Pause game time' : 'Resume game time');
});
document.querySelector('#mcSpeed').addEventListener('click', () => {
  const speeds = [1, 10, 60, 300];
  clockSpeed = speeds[(speeds.indexOf(clockSpeed) + 1) % speeds.length];
  document.querySelector('#mcSpeed').textContent = '×' + clockSpeed;
});
const dateFormatter = new Intl.DateTimeFormat('en-AU', {day:'2-digit', month:'short', year:'numeric', timeZone:'UTC'});
function saveCampaign(reason = 'autosave') {
 if (!worldState.campaign?.started) return false;
 try {
  worldState.terrain ??= {source:'NASA MOLA MEGDR 4 pixels/degree',geologicalModifications:[],depositSites:[]};
  worldState.terrain.geologicalModifications ??= [];
  worldState.terrain.depositSites ??= [];
  // Keep the local save below browser storage limits; aggregate stocks and permanent terrain remain complete.
  const saveState = JSON.parse(JSON.stringify(worldState));
  const ledger = saveState.materials?.ledger;
  if (Array.isArray(ledger) && ledger.length > 1500) {
   const omitted = ledger.length - 1500;
   const prior = saveState.materials.ledgerArchive?.entriesOmitted ?? 0;
   saveState.materials.ledgerArchive = {
    entriesOmitted: prior + omitted,
    throughSol: ledger[omitted - 1]?.sol ?? saveState.materials.ledgerArchive?.throughSol ?? 0
   };
   saveState.materials.ledger = ledger.slice(-1500);
  }
  const payload = {version:1,savedAt:new Date().toISOString(),reason,elapsedGameSeconds,worldState:saveState};
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  saveStatus = 'Saved · Sol ' + (worldState.time?.sol ?? 0);
  if(saveStatusElement) saveStatusElement.textContent = saveStatus;
  return true;
 } catch (error) {
  saveStatus = 'Save failed';
  if(saveStatusElement) saveStatusElement.textContent = saveStatus;
  console.error('Red Mars Rising autosave failed.', error);
  return false;
 }
}
function updateMissionClock(deltaSeconds) {
  if (clockRunning) elapsedGameSeconds += deltaSeconds * clockSpeed;
  const completedSols=Math.floor(elapsedGameSeconds/MARS_SOL_SECONDS);
  if(worldState.campaign.started&&completedSols>lastProcessedClockSol){
    while(lastProcessedClockSol<completedSols){
      const tickEvents=processWorldTick(worldState);lastProcessedClockSol++;
      for(const event of tickEvents)if(['rival-colony-founded','rival-assessment','rival-plan-revised','rival-launch','cargo-drop-landed','project-complete','strategic-program-complete','sponsor-pressure','support-anniversary'].includes(event.type))notify(event.description);
    }
    renderCampaignPanel();
    saveCampaign('sol-autosave');
    const temp=worldState.climate.meanSurfaceTemperatureC;
    document.querySelector('#meanTemp').textContent=(temp<0?'−':'')+Math.abs(temp).toFixed(12)+'°C';
  }
  const missionDate = new Date(MISSION_ARRIVAL_UTC + elapsedGameSeconds * 1000);
  const localSolTime = ((ARRIVAL_LOCAL_SOL_SECONDS + elapsedGameSeconds) % MARS_SOL_SECONDS + MARS_SOL_SECONDS) % MARS_SOL_SECONDS;
  const hour = Math.floor(localSolTime / 3600);
  const minute = Math.floor((localSolTime % 3600) / 60);
  const solNumber = Math.floor(elapsedGameSeconds / MARS_SOL_SECONDS) + 1;
  document.querySelector('#mcDate').textContent = dateFormatter.format(missionDate).toUpperCase();
  document.querySelector('#mcSol').textContent = 'SOL ' + String(solNumber).padStart(3, '0') + ' · ' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ' LMST';
}
// Approximate Mars solar longitude from its mean orbital motion and equation of centre.
// This gives seasonal solar declination; the sol clock drives the subsolar longitude.
function marsSolarLongitude(dateMs) {
  const daysSinceJ2000 = (dateMs - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const rad = Math.PI / 180;
  const meanAnomaly = (19.3870 + 0.52402075 * daysSinceJ2000) * rad;
  const fictitiousMeanSun = (270.3863 + 0.5240384 * daysSinceJ2000) * rad;
  const equationOfCentre = (10.691 + 3.0 * Math.sin(meanAnomaly) + 0.623 * Math.sin(2 * meanAnomaly) +
    0.050 * Math.sin(3 * meanAnomaly) + 0.005 * Math.sin(4 * meanAnomaly) + 0.0005 * Math.sin(5 * meanAnomaly)) * rad;
  return ((fictitiousMeanSun + equationOfCentre) / rad % 360 + 360) % 360;
}
function marsSolarDeclination(dateMs) {
  return Math.asin(Math.sin(25.19 * Math.PI / 180) * Math.sin(marsSolarLongitude(dateMs) * Math.PI / 180));
}

const initialTemp = worldState.climate.meanSurfaceTemperatureC;
document.querySelector('#meanTemp').textContent = (initialTemp < 0 ? '−' : initialTemp > 0 ? '+' : '') + Math.abs(initialTemp) + '°C';
document.querySelector('#meanDiameter').textContent = worldState.planet.meanDiameterKm.toLocaleString('en-US') + ' km';
document.querySelector('#planetAge').textContent = (worldState.planet.ageYears / 1e9).toFixed(1) + ' billion';
document.querySelector('#pressure').textContent = worldState.climate.atmosphere.pressurePa + ' Pa';
const locations={
 olympus:{name:'Olympus Mons',lat:18.65,lon:-133.8,zoom:1.7,description:'A shield volcano rising roughly 22 kilometres above the surrounding plains.'},
 elysium:{name:'Elysium Planitia',lat:4.5,lon:154.5,zoom:1.75,description:'Near-equatorial plains with relatively favourable conditions for industry and a future space-elevator programme.'},
 arcadia:{name:'Arcadia Planitia',lat:46.7,lon:164,zoom:1.75,description:'Northern plains with promising buried water-ice prospects.'},
 valles:{name:'Valles Marineris',lat:-13.9,lon:-59.2,zoom:1.85,description:'A canyon system stretching thousands of kilometres across the Martian equator.'},
 hellas:{name:'Hellas Planitia',lat:-42.4,lon:70.5,zoom:1.65,description:'An immense impact basin whose low floor can gather frost and atmospheric haze.'},
 gale:{name:'Gale Crater',lat:-5.4,lon:137.8,zoom:2.1,description:'A layered mountain of sediment inside a crater explored by the Curiosity rover.'},
 north:{name:'North polar cap',lat:82,lon:15,zoom:1.55,description:'Seasonal frost and layered deposits preserve a record of changing Martian climate.'},
 jezero:{name:'Jezero Crater',lat:18.38,lon:77.58,zoom:2.0,description:'A preserved delta records a time when water flowed across the Martian surface.'},
 colony:{name:'First colony',lat:4.5,lon:154.5,zoom:0.15,description:'The first settlement: habitats, greenhouse, laboratory, landing pad and autonomous equipment.'}
};
const space=document.querySelector('#space');
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.1,160);
camera.position.set(0,0,4.2);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
space.appendChild(renderer.domElement);
const root=new THREE.Group();scene.add(root);
const groundScene=new THREE.Scene();groundScene.background=new THREE.Color(0x8a6556);
groundScene.add(new THREE.HemisphereLight(0xd9c7b7,0x382720,1.55));
const groundSun=new THREE.DirectionalLight(0xffd5b5,2);groundSun.position.set(-80,120,55);groundScene.add(groundSun);
let groundMode=false,savedGroundView=null;
{
 const size=6000,n=120,pos=[],idx=[];
 for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const px=(x/n-.5)*size,pz=(z/n-.5)*size;const y=Math.sin(px*.00115+1.3)*19+Math.cos(pz*.0014-.7)*15+Math.sin((px+pz)*.00075)*10+Math.cos((px-pz)*.0011)*7+Math.sin(px*.009+Math.cos(pz*.006))*1.4-38;pos.push(px,y,pz);}
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const a=z*(n+1)+x,b=a+1,c=a+n+1,d=c+1;idx.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
 groundScene.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x9a6048,roughness:1})));
 let seed=1827;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const rockGeo=new THREE.DodecahedronGeometry(1,0),rockMat=new THREE.MeshStandardMaterial({color:0x62463a,roughness:1,flatShading:true});
 for(let i=0;i<110;i++){const x=(rand()-.5)*size*.9,z=(rand()-.5)*size*.9,scale=.8+rand()*4;const y=Math.sin(x*.00115+1.3)*19+Math.cos(z*.0014-.7)*15+Math.sin((x+z)*.00075)*10+Math.cos((x-z)*.0011)*7-38;const rock=new THREE.Mesh(rockGeo,rockMat);rock.position.set(x,y+scale*.3,z);rock.scale.set(scale*1.3,scale*.65,scale);rock.rotation.set(rand()*.5,rand()*Math.PI,rand()*.4);groundScene.add(rock);}
}
function enterGroundView(){if(groundMode)return;savedGroundView={position:camera.position.clone(),focus:cameraFocus.clone(),zoom,rotation:targetRotation.clone(),far:camera.far};groundMode=true;document.body.classList.add('ground-mode');camera.far=10000;camera.updateProjectionMatrix();camera.position.set(0,1.7,0);camera.up.set(0,1,0);camera.lookAt(0,1.7,-1000);}
function exitGroundView(){if(!groundMode)return;groundMode=false;document.body.classList.remove('ground-mode');if(savedGroundView){camera.position.copy(savedGroundView.position);cameraFocus.copy(savedGroundView.focus);zoom=savedGroundView.zoom;targetRotation.copy(savedGroundView.rotation);camera.far=savedGroundView.far;camera.updateProjectionMatrix();}savedGroundView=null;camera.lookAt(cameraFocus);}
document.querySelector('#groundViewBtn').addEventListener('click',enterGroundView);
document.querySelector('#groundExit').addEventListener('click',exitGroundView);

const ambient=new THREE.AmbientLight(0x777b84,0.12);scene.add(ambient);
const key=new THREE.DirectionalLight(0xffdfc1,2.8);
key.position.set(0,0,4);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
key.shadow.camera.left=-1.12;key.shadow.camera.right=1.12;key.shadow.camera.top=1.12;key.shadow.camera.bottom=-1.12;
key.shadow.camera.near=0.1;key.shadow.camera.far=8;key.shadow.camera.updateProjectionMatrix();
key.shadow.bias=-0.00002;key.shadow.normalBias=0.002;key.shadow.radius=2;scene.add(key);
const rim=new THREE.DirectionalLight(0x7189b1,0.07);rim.position.set(3,-1,-3);scene.add(rim);
// A dedicated close-up light keeps the focused moon's day/night boundary legible.
// It follows the solar direction, but aims at the moon rather than Mars' centre.
const moonKeyTarget=new THREE.Object3D();scene.add(moonKeyTarget);
const moonKey=new THREE.DirectionalLight(0xffdfc1,2.8);moonKey.target=moonKeyTarget;moonKey.castShadow=true;
moonKey.shadow.mapSize.set(1024,1024);
moonKey.shadow.camera.left=-0.065;moonKey.shadow.camera.right=0.065;moonKey.shadow.camera.top=0.065;moonKey.shadow.camera.bottom=-0.065;
moonKey.shadow.camera.near=0.01;moonKey.shadow.camera.far=0.35;moonKey.shadow.camera.updateProjectionMatrix();
moonKey.shadow.bias=-0.00005;moonKey.shadow.normalBias=0.001;moonKey.shadow.radius=2;scene.add(moonKey);
const loader=new THREE.TextureLoader();loader.setCrossOrigin('anonymous');
let mars,gridGroup,markerGroup,stars,textureLoaded=false,marsTexture=null,currentLod=-1;
function buildTerrainGeometry(segments=360,rings=240,useElevation=true) {
 const geometry=new THREE.SphereGeometry(1,segments,rings),positions=geometry.attributes.position;
 if(useElevation) for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  const lat=Math.asin(THREE.MathUtils.clamp(y,-1,1))*180/Math.PI,lon=Math.atan2(-x,z)*180/Math.PI;
  const r=1+terrainRadiusOffset(lat,lon);
  positions.setXYZ(i,x*r,y*r,z*r);
 }
 geometry.computeVertexNormals();return geometry;
}
function updateLod(){
 if(!mars)return;
 const lod=zoom<5.5?0:zoom<8.5?1:zoom<12?2:zoom<17?3:4;
 if(lod===currentLod)return;currentLod=lod;
 const old=mars.geometry;
 mars.geometry=buildTerrainGeometry(...[[360,240,true],[180,120,true],[96,64,true],[48,32,true],[32,24,false]][lod]);old.dispose();
 for(const child of root.children)if(child.userData?.polarCapHemisphere)child.visible=lod<4;
 if(lod===4&&mars.material.map){mars.material.map=null;mars.material.color.set(0x9c5138);mars.material.needsUpdate=true;}
 else if(lod<4&&!mars.material.map&&marsTexture){mars.material.map=marsTexture;mars.material.color.set(0xffffff);mars.material.needsUpdate=true;}
}
function showTerrainError(error) {
 const panel=document.querySelector('#terrainError'),details=document.querySelector('#terrainErrorDetails');
 const message=error instanceof Error ? `${error.name}: ${error.message}` : String(error);
 details.value=[
  'RED MARS RISING — REQUIRED TERRAIN DATA FAILED',
  `Time: ${new Date().toISOString()}`,
  `URL: ${'https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg004/megt90n000cb.img'}`,
  `Browser: ${navigator.userAgent}`,
  `Error: ${message}`,
  error instanceof Error && error.stack ? `Stack:\n${error.stack}` : ''
 ].filter(Boolean).join('\n\n');
 panel.hidden=false;
 document.querySelector('#loading').classList.add('hidden');
}
document.querySelector('#copyTerrainError').addEventListener('click',async()=>{
 const details=document.querySelector('#terrainErrorDetails');
 try {
  await navigator.clipboard.writeText(details.value);
  document.querySelector('#copyTerrainError').textContent='Copied';
 } catch (error) {
  details.focus();details.select();details.setSelectionRange(0,details.value.length);
  document.querySelector('#copyTerrainError').textContent='Select text, then Copy';
 }
});
// Remove the colour atlas's baked-in bright polar ice so world-state ice is rendered only once.
// This is a pragmatic visual mask, not a reconstruction of the geology beneath the real ice caps.
function removeEmbeddedPolarIce(sourceTexture){
 const image=sourceTexture.image;
 if(!image||!image.width||!image.height)return sourceTexture;
 // A 4K-wide derived texture keeps the one-off canvas operation manageable on phones.
 const canvas=document.createElement('canvas');
 canvas.width=Math.min(image.width,4096);
 canvas.height=Math.min(image.height,2048);
 const context=canvas.getContext('2d',{willReadFrequently:true});
 if(!context)return sourceTexture;
 context.drawImage(image,0,0,canvas.width,canvas.height);
 const imageData=context.getImageData(0,0,canvas.width,canvas.height);
 const pixels=imageData.data;
 const width=canvas.width,height=canvas.height;
 const donorRows={
  north:Math.round((90-60)/180*height),
  south:Math.round((90+60)/180*height)
 };
 for(let y=0;y<height;y++){
  const latitude=90-y/height*180;
  if(Math.abs(latitude)<65)continue;
  const donorBase=latitude>0?donorRows.north:donorRows.south;
  for(let x=0;x<width;x++){
   const i=(y*width+x)*4;
   const red=pixels[i],green=pixels[i+1],blue=pixels[i+2];
   const brightest=Math.max(red,green,blue),darkest=Math.min(red,green,blue);
   const chroma=brightest-darkest;
   // Target only bright, low-chroma pixels characteristic of the baked-in pale caps.
   if(darkest<145||chroma>42)continue;
   const whiteness=Math.min(1,(darkest-145)/65);
   const neutrality=Math.min(1,(42-chroma)/22);
   const blend=whiteness*neutrality;
   if(blend<=0)continue;
   let r=0,g=0,b=0,count=0;
   for(let offset=-3;offset<=3;offset++){
    const donorY=Math.max(0,Math.min(height-1,donorBase+offset));
    const di=(donorY*width+x)*4;
    r+=pixels[di];g+=pixels[di+1];b+=pixels[di+2];count++;
   }
   pixels[i]=red+(r/count-red)*blend;
   pixels[i+1]=green+(g/count-green)*blend;
   pixels[i+2]=blue+(b/count-blue)*blend;
  }
 }
 context.putImageData(imageData,0,0);
 const cleaned=new THREE.CanvasTexture(canvas);
 cleaned.colorSpace=sourceTexture.colorSpace;
 cleaned.wrapS=sourceTexture.wrapS;
 cleaned.wrapT=sourceTexture.wrapT;
 cleaned.anisotropy=sourceTexture.anisotropy;
 cleaned.needsUpdate=true;
 return cleaned;
}
function applyMarsTexture(texture){
 if(!mars)return;
 texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;
 if(mars.material) mars.material.dispose();
 mars.material=new THREE.MeshStandardMaterial({map:texture,roughness:1,metalness:0});textureLoaded=true;
}
// Do not create or display a globe until the measured elevation grid has passed validation.
loadMolaTopography().then(info=>{
 setTerrainWorldState(worldState);
 mars=new THREE.Mesh(buildTerrainGeometry(),new THREE.MeshStandardMaterial({color:0x9c5138,roughness:1}));
 mars.castShadow=true;
 mars.receiveShadow=true;
 root.add(mars);
 if(SHOW_GENERATED_POLAR_CAPS) {
  const arrivalLs = marsSolarLongitude(MISSION_ARRIVAL_UTC);
  updatePolarCaps(THREE,root,worldState,arrivalLs);
  lastIceSolarLongitude = Math.floor(arrivalLs);
 }
 worldState.terrain.source=info.source;
 terrainReady=true;
 if(worldState.campaign.started&&!colonyLogistics)colonyLogistics=createColonyAndLogistics(THREE,{root,scene,worldState,terrainRadiusOffset,notify});
 if(worldState.campaign.started)focusPlace('colony');else focusPlace(siteSelect.value);
 if(marsTexture)applyMarsTexture(marsTexture);
 document.querySelector('#loading p').textContent='NASA MOLA topography loaded';
 document.querySelector('#loading').classList.add('hidden');
}).catch(error=>{
 console.error('Required NASA MOLA terrain failed to load.',error);
 showTerrainError(error);
});
loader.load(TEXTURE_URL,texture=>{
 marsTexture=removeEmbeddedPolarIce(texture);
 if(mars)applyMarsTexture(marsTexture);
},undefined,error=>{
 console.warn('Mars colour texture unavailable; the elevation-based globe remains available.',error);
});
const starGeo=new THREE.BufferGeometry(),starPositions=[];
for(let i=0;i<1600;i++){const r=12+Math.random()*24,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);starPositions.push(r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta));}
starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xc8c5bf,size:.025,transparent:true,opacity:.7,sizeAttenuation:true}));scene.add(stars);
function xyz(lat,lon,r=1.009){const a=THREE.MathUtils.degToRad(lat),b=THREE.MathUtils.degToRad(lon);return new THREE.Vector3(-r*Math.cos(a)*Math.sin(b),r*Math.sin(a),r*Math.cos(a)*Math.cos(b));}
markerGroup=new THREE.Group();root.add(markerGroup);
const markerMeshes={};
Object.entries(locations).forEach(([id,p],i)=>{
 if(id==='colony')return; // The colony layer supplies its own zoom-aware marker.
 const pos=xyz(p.lat,p.lon,1.008);
 const pin=new THREE.Mesh(new THREE.SphereGeometry(.012,12,10),new THREE.MeshBasicMaterial({color:0xf1b08d}));
 pin.position.copy(pos);pin.userData={id};markerGroup.add(pin);markerMeshes[id]=pin;
 const ring=new THREE.Mesh(new THREE.RingGeometry(.016,.020,32),new THREE.MeshBasicMaterial({color:0xe1a181,transparent:true,opacity:.8,side:THREE.DoubleSide}));
 ring.position.copy(xyz(p.lat,p.lon,1.009));ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),pos.clone().normalize());ring.userData={id};markerGroup.add(ring);
});
gridGroup=new THREE.Group();root.add(gridGroup);
const lineMat=new THREE.LineBasicMaterial({color:0xe2c7b2,transparent:true,opacity:.23});
for(let lat=-75;lat<=75;lat+=15){const pts=[];for(let lon=-180;lon<=180;lon+=3)pts.push(xyz(lat,lon,1.002));gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lineMat));}
for(let lon=-180;lon<180;lon+=15){const pts=[];for(let lat=-90;lat<=90;lat+=3)pts.push(xyz(lat,lon,1.002));gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lineMat));}
gridGroup.visible=false;
let targetRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(-8),THREE.MathUtils.degToRad(18),0,'YXZ'));
root.quaternion.copy(targetRotation);
let zoom=4.2,minZoom=0.12,maxZoom=28,showLabels=true,showGrid=false;
const cameraFocus=new THREE.Vector3();let focusedMoon=null,focusedSurface=null;
let targetViewRotation=new THREE.Quaternion();
const moonSpecs={phobos:{name:'Phobos',orbit:2.76,periodHours:7.65,radius:0.00327,phase:.2,color:0x8b8178},deimos:{name:'Deimos',orbit:6.92,periodHours:30.3,radius:0.00183,phase:2.2,color:0xaaa097}};
const moonObjects={};
const moonAssetPromises={};
function loadMoonAssets(id){
 if(moonAssetPromises[id])return moonAssetPromises[id];
 const m=moonObjects[id];if(!m)return Promise.resolve();
 const base=new URL('../data/moons/optimized/',import.meta.url);
 moonAssetPromises[id]=fetch(new URL(id+'-mesh.json',base)).then(r=>{if(!r.ok)throw new Error('Moon mesh request failed: '+r.status);return r.json();}).then(data=>{
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.vertices.flat(),3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs.flat(),2));
  geometry.setIndex(data.indices);geometry.computeVertexNormals();
  m.body.geometry.dispose();m.body.geometry=geometry;
  return new Promise((resolve,reject)=>loader.load(new URL(id+'-texture.jpg',base).href,texture=>{
   texture.colorSpace=THREE.SRGBColorSpace;
   m.body.material.map=texture;m.body.material.color.set(0xffffff);m.body.material.needsUpdate=true;resolve();
  },undefined,reject));
 }).catch(error=>{console.warn('Could not load '+id+' surface assets; keeping fallback sphere.',error);delete moonAssetPromises[id];});
 return moonAssetPromises[id];
}
for(const [id,spec] of Object.entries(moonSpecs)){
 const pts=[];for(let i=0;i<=240;i++){const a=i/240*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*spec.orbit,0,Math.sin(a)*spec.orbit));}
 const orbitLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xc2a18e,transparent:true,opacity:.24}));orbitLine.visible=false;scene.add(orbitLine);
 const group=new THREE.Group();scene.add(group);
 const body=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshStandardMaterial({color:spec.color,roughness:1}));body.scale.setScalar(spec.radius);body.castShadow=true;body.receiveShadow=true;group.add(body);
 const marker=new THREE.Mesh(new THREE.SphereGeometry(.035,12,10),new THREE.MeshBasicMaterial({color:spec.color,transparent:true,opacity:.8,depthWrite:false}));group.add(marker);
 const halo=new THREE.Mesh(new THREE.SphereGeometry(.055,12,10),new THREE.MeshBasicMaterial({color:spec.color,transparent:true,opacity:.12,depthWrite:false}));group.add(halo);
 moonObjects[id]={group,body,marker,halo,orbitLine,focusedScale:false};
}
function updateMoonOrbits(){
 for(const [id,spec] of Object.entries(moonSpecs)){
  const m=moonObjects[id],a=spec.phase+elapsedGameSeconds/(spec.periodHours*3600)*Math.PI*2;
  m.group.position.set(Math.cos(a)*spec.orbit,Math.sin(a)*spec.orbit*.08,Math.sin(a)*spec.orbit*.997);
  m.orbitLine.visible=zoom>6.5;m.marker.visible=zoom>1.8&&!m.focusedScale;m.halo.visible=zoom>6.5&&!m.focusedScale;
  if(focusedMoon===id)cameraFocus.copy(m.group.position);
 }
}
function focusMoon(id){
 const m=moonObjects[id];if(!m)return;focusedSurface=null;focusedMoon=id;targetViewRotation.identity();loadMoonAssets(id);
 for(const [otherId,o] of Object.entries(moonObjects)){o.focusedScale=otherId===id;o.body.scale.setScalar(otherId===id?.03:moonSpecs[otherId].radius);o.marker.visible=otherId!==id&&zoom>1.8;o.halo.visible=otherId!==id&&zoom>6.5;}
 cameraFocus.copy(m.group.position);setZoom(.18);
 document.querySelectorAll('[data-moon]').forEach(el=>el.classList.toggle('active',el.dataset.moon===id));
 notify('Observing '+moonSpecs[id].name+' · close approach view');
}
let pointer=null,lastTrackball=null,pointers=new Map(),pinchStart=0,pinchZoom=zoom,dragged=false;
const raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2();
function setZoom(v){
 let next=THREE.MathUtils.clamp(v,minZoom,maxZoom);
 // Once the camera approaches the surface, switch from centre-distance zoom
 // to altitude-above-surface zoom so the camera never enters the solid planet.
 if(focusedSurface&&next>1.5){
  focusedSurface=null;cameraFocus.set(0,0,0);
  next=THREE.MathUtils.clamp(next+1,minZoom,maxZoom);
 }else if(!focusedSurface&&!focusedMoon&&next<1.12){
  const localNormal=new THREE.Vector3(0,0,1).applyQuaternion(root.quaternion.clone().invert()).normalize();
  const lat=Math.asin(THREE.MathUtils.clamp(localNormal.y,-1,1))*180/Math.PI;
  const lon=Math.atan2(-localNormal.x,localNormal.z)*180/Math.PI;
  const radius=1+terrainRadiusOffset(lat,lon)+0.002;
  focusedSurface=localNormal.multiplyScalar(radius);
  cameraFocus.copy(focusedSurface).applyQuaternion(root.quaternion);
  next=Math.max(minZoom,next-radius);
 }
 zoom=next;updateLod();
}
function notify(message){const t=document.querySelector('#toast');t.textContent=message;t.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove('show'),1800);}
function setActivePlace(id){document.querySelectorAll('.place').forEach(el=>el.classList.toggle('active',el.dataset.place===id));}
function resetView(announce=true){focusedMoon=null;focusedSurface=null;cameraFocus.set(0,0,0);for(const [id,m] of Object.entries(moonObjects)){m.focusedScale=false;m.body.scale.setScalar(moonSpecs[id].radius);}document.querySelectorAll('[data-moon]').forEach(el=>el.classList.remove('active'));targetRotation.setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(-8),THREE.MathUtils.degToRad(18),0,'YXZ'));setZoom(4.2);setActivePlace('global');if(announce)notify('Mars global view restored');}
function focusPlace(id){if(id==='global'){resetView();return;}const p=locations[id];if(!p)return;focusedMoon=null;focusedSurface=id==='colony'?xyz(p.lat,p.lon,1+terrainRadiusOffset(p.lat,p.lon)+0.002):null;cameraFocus.set(0,0,0);for(const [mid,m] of Object.entries(moonObjects)){m.focusedScale=false;m.body.scale.setScalar(moonSpecs[mid].radius);}document.querySelectorAll('[data-moon]').forEach(el=>el.classList.remove('active'));const v=xyz(p.lat,p.lon,1);const yaw=Math.atan2(-v.x,v.z);const pitch=Math.asin(v.y);targetRotation.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));setZoom(id==='colony'?0.12:p.zoom+0.45);setActivePlace(id);notify(p.name+' · '+p.description);}
siteSelect.addEventListener('change',()=>{if(terrainReady)focusPlace(siteSelect.value);});
document.querySelectorAll('[data-place]').forEach(el=>el.addEventListener('click',()=>{focusPlace(el.dataset.place);landmarksMenu.hidden=true;labelsBtn.setAttribute('aria-expanded','false');}));
document.querySelectorAll('[data-moon]').forEach(el=>el.addEventListener('click',()=>{focusMoon(el.dataset.moon);landmarksMenu.hidden=true;labelsBtn.setAttribute('aria-expanded','false');}));
const landmarksMenu=document.querySelector('#landmarksMenu'),labelsBtn=document.querySelector('#labelsBtn');
labelsBtn.addEventListener('click',()=>{landmarksMenu.hidden=!landmarksMenu.hidden;labelsBtn.classList.toggle('active',!landmarksMenu.hidden);labelsBtn.setAttribute('aria-expanded',String(!landmarksMenu.hidden));});
document.querySelector('#closeLandmarks').addEventListener('click',()=>{landmarksMenu.hidden=true;labelsBtn.classList.remove('active');labelsBtn.setAttribute('aria-expanded','false');});
document.querySelector('#gridBtn').addEventListener('click',e=>{showGrid=!showGrid;gridGroup.visible=showGrid;e.currentTarget.classList.toggle('active',showGrid);});
const dataMenu=document.querySelector('#dataMenu'),dataBtn=document.querySelector('#dataBtn');
dataBtn.addEventListener('click',()=>{dataMenu.hidden=!dataMenu.hidden;dataBtn.classList.toggle('active',!dataMenu.hidden);});
document.querySelector('#closeData').addEventListener('click',()=>{dataMenu.hidden=true;dataBtn.classList.remove('active');});
space.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(e.deltaY*.001));}, {passive:false});
function trackballPoint(clientX,clientY){
 const rect=renderer.domElement.getBoundingClientRect();
 const x=(2*(clientX-rect.left)/rect.width)-1;
 const y=1-(2*(clientY-rect.top)/rect.height);
 const length=x*x+y*y;
 if(length<=1)return new THREE.Vector3(x,y,Math.sqrt(1-length));
 const scale=1/Math.sqrt(length);return new THREE.Vector3(x*scale,y*scale,0);
}
space.addEventListener('pointerdown',e=>{space.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});dragged=false;if(pointers.size===1){pointer=e.pointerId;lastTrackball=trackballPoint(e.clientX,e.clientY);}else if(pointers.size===2){const a=[...pointers.values()];pinchStart=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);pinchZoom=zoom;lastTrackball=null;}space.classList.add('dragging');});
space.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const a=[...pointers.values()];const dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinchStart>0)setZoom(pinchZoom*pinchStart/dist);dragged=true;return;}if(pointer===e.pointerId){const next=trackballPoint(e.clientX,e.clientY);if(lastTrackball){const delta=new THREE.Quaternion().setFromUnitVectors(lastTrackball,next);if(focusedMoon&&moonObjects[focusedMoon])targetViewRotation.premultiply(delta).normalize();else targetRotation.premultiply(delta).normalize();}lastTrackball=next;if(pointers.size===1)dragged=true;}});
function endPointer(e){pointers.delete(e.pointerId);if(pointer===e.pointerId){pointer=null;lastTrackball=null;}if(pointers.size<2)pinchStart=0;if(!pointers.size)space.classList.remove('dragging');}
space.addEventListener('pointerup',endPointer);space.addEventListener('pointercancel',endPointer);
space.addEventListener('click',e=>{if(dragged)return;const rect=renderer.domElement.getBoundingClientRect();pointerNdc.x=((e.clientX-rect.left)/rect.width)*2-1;pointerNdc.y=-((e.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointerNdc,camera);const hits=raycaster.intersectObjects([...markerGroup.children,...Object.values(moonObjects).map(m=>m.marker),...(zoom>=1.6&&zoom<8.5?(colonyLogistics?.settlementPickTargets??[]):[]),...(zoom>=1.6?(colonyLogistics?.poiPickTargets??[]).filter(p=>p.visible):[]),...(zoom>11.5?(colonyLogistics?.shipPickTargets??[]):[])],false);if(hits.length){const hit=hits[0].object;if(hit.userData.kind==='supply-ship'){notify(hit.userData.cargo+' · inbound · about '+Math.ceil(hit.userData.etaSols??0)+' sols remaining');}else if(hit.userData.kind==='point-of-interest'||hit.userData.kind==='natural-impact-crater'){notify(hit.userData.name+' · '+hit.userData.status+' · '+hit.userData.description);}else if(hit.userData.kind==='settlement')focusPlace('colony');else if(hit.userData.id)focusPlace(hit.userData.id);else for(const [id,m] of Object.entries(moonObjects))if(hit===m.marker){focusMoon(id);break;}}});
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);}
addEventListener('resize',resize);
addEventListener('pagehide',()=>saveCampaign('pagehide'));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveCampaign('background')});
let previousFrameTime=performance.now();
function updateSolarLighting() {
 const missionDateMs=MISSION_ARRIVAL_UTC+elapsedGameSeconds*1000;
 const solarLongitude = marsSolarLongitude(missionDateMs);
 const iceLongitude = Math.floor(solarLongitude);
 if(mars && SHOW_GENERATED_POLAR_CAPS && iceLongitude !== lastIceSolarLongitude) {
  updatePolarCaps(THREE,root,worldState,solarLongitude);
  lastIceSolarLongitude = iceLongitude;
 }
 const declination=marsSolarDeclination(missionDateMs);
 const localSolSeconds=((ARRIVAL_LOCAL_SOL_SECONDS+elapsedGameSeconds)%MARS_SOL_SECONDS+MARS_SOL_SECONDS)%MARS_SOL_SECONDS;
 const localSolarHours=localSolSeconds/3600;
 const subsolarLongitude=(12-localSolarHours)*360/MARS_SOL_SECONDS*3600;
 const latitude=declination,longitude=THREE.MathUtils.degToRad(subsolarLongitude);
 const sunLocal=new THREE.Vector3(-Math.cos(latitude)*Math.sin(longitude),Math.sin(latitude),Math.cos(latitude)*Math.cos(longitude)).normalize();
 const sunDirection=sunLocal.clone().normalize();
 const sunWorld=sunDirection.clone().applyQuaternion(root.quaternion).multiplyScalar(4);
 key.position.copy(sunWorld);
 if(focusedMoon&&moonObjects[focusedMoon]){
  const focused=moonObjects[focusedMoon];
  moonKey.position.copy(focused.group.position).addScaledVector(sunDirection,0.22);
  moonKeyTarget.position.copy(focused.group.position);
  moonKey.visible=true;
  moonKey.shadow.camera.left=-0.065;moonKey.shadow.camera.right=0.065;moonKey.shadow.camera.top=0.065;moonKey.shadow.camera.bottom=-0.065;
 }else moonKey.visible=false;
}
function animate(now=performance.now()){
 requestAnimationFrame(animate);
 const dt=Math.min(Math.max((now-previousFrameTime)/1000,0),0.25);previousFrameTime=now;
 updateMissionClock(dt);
 if(!focusedMoon)root.quaternion.slerp(targetRotation,.09);
 if(focusedSurface&&!focusedMoon)cameraFocus.copy(focusedSurface).applyQuaternion(root.quaternion);
 updateMoonOrbits();
 if(colonyLogistics)colonyLogistics.update(zoom,elapsedGameSeconds);
 const scaleLabel=document.querySelector('#mapScaleLabel');
 if(scaleLabel)scaleLabel.textContent=zoom>22?'INTERPLANETARY TRANSIT · DISTANCES COMPRESSED':zoom>11.5?'WIDE ORBITAL VIEW':zoom<1.6?'SURFACE COLONY':'PLANETARY VIEW';
 if(!groundMode){
  const cameraOffset=new THREE.Vector3(0,0,zoom).applyQuaternion(focusedMoon?targetViewRotation:new THREE.Quaternion());
  const desiredCameraPosition=cameraFocus.clone().add(cameraOffset);
  camera.position.lerp(desiredCameraPosition,.12);camera.lookAt(cameraFocus);
 }
 stars.rotation.y+=.00004;markerGroup.visible=showLabels&&zoom<8.5;gridGroup.visible=showGrid&&zoom<8.5;updateSolarLighting();
 renderer.render(groundMode?groundScene:scene,camera);
}
setZoom(4.2);updateMissionClock(0);updateMoonOrbits();updateSolarLighting();animate();

