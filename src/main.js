import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';
import { createInitialWorldState } from './world/world-state.js';
import { terrainHeight, terrainRadiusOffset, loadMolaTopography, updatePolarCaps } from './world/terrain.js';

const TEXTURE_URL=new URL('../data/mars/8k_mars.jpg', import.meta.url).href;
const worldState = createInitialWorldState();

// Mission timeline: the first crew leaves Earth in late 2026 and arrives in July 2027.
const MISSION_ARRIVAL_UTC = Date.UTC(2027, 6, 22, 0);
const ARRIVAL_LOCAL_SOL_SECONDS = 9 * 3600;
const MARS_SOL_SECONDS = 88775.244;
let elapsedGameSeconds = 0;
let clockRunning = true;
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
const clockPanel = document.createElement('section');
clockPanel.id = 'missionClock';
clockPanel.setAttribute('aria-label', 'Mission date and Mars local time');
clockPanel.innerHTML = `
  <div class="mc-now"><div class="mc-date" id="mcDate">22 JUL 2027</div><div class="mc-sol" id="mcSol">SOL 001 · 09:00 LMST</div></div>
  <div class="mc-controls"><button id="mcPlay" type="button">Ⅱ PAUSE</button><button id="mcSpeed" type="button">×60</button></div>`;
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
function updateMissionClock(deltaSeconds) {
  if (clockRunning) elapsedGameSeconds += deltaSeconds * clockSpeed;
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
function marsSolarDeclination(dateMs) {
  const daysSinceJ2000 = (dateMs - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const rad = Math.PI / 180;
  const meanAnomaly = (19.3870 + 0.52402075 * daysSinceJ2000) * rad;
  const fictitiousMeanSun = (270.3863 + 0.5240384 * daysSinceJ2000) * rad;
  const equationOfCentre = (10.691 + 3.0 * Math.sin(meanAnomaly) + 0.623 * Math.sin(2 * meanAnomaly) +
    0.050 * Math.sin(3 * meanAnomaly) + 0.005 * Math.sin(4 * meanAnomaly) + 0.0005 * Math.sin(5 * meanAnomaly)) * rad;
  const solarLongitude = fictitiousMeanSun + equationOfCentre;
  return Math.asin(Math.sin(25.19 * rad) * Math.sin(solarLongitude));
}

const initialTemp = worldState.climate.meanSurfaceTemperatureC;
document.querySelector('#meanTemp').textContent = (initialTemp < 0 ? '−' : initialTemp > 0 ? '+' : '') + Math.abs(initialTemp) + '°C';
document.querySelector('#meanDiameter').textContent = worldState.planet.meanDiameterKm.toLocaleString('en-US') + ' km';
document.querySelector('#planetAge').textContent = (worldState.planet.ageYears / 1e9).toFixed(1) + ' billion';
document.querySelector('#pressure').textContent = worldState.climate.atmosphere.pressurePa + ' Pa';
const locations={
 olympus:{name:'Olympus Mons',lat:18.65,lon:-133.8,zoom:1.7,description:'A shield volcano rising roughly 22 kilometres above the surrounding plains.'},
 valles:{name:'Valles Marineris',lat:-13.9,lon:-59.2,zoom:1.85,description:'A canyon system stretching thousands of kilometres across the Martian equator.'},
 hellas:{name:'Hellas Planitia',lat:-42.4,lon:70.5,zoom:1.65,description:'An immense impact basin whose low floor can gather frost and atmospheric haze.'},
 gale:{name:'Gale Crater',lat:-5.4,lon:137.8,zoom:2.1,description:'A layered mountain of sediment inside a crater explored by the Curiosity rover.'},
 north:{name:'North polar cap',lat:82,lon:15,zoom:1.55,description:'Seasonal frost and layered deposits preserve a record of changing Martian climate.'},
 jezero:{name:'Jezero Crater',lat:18.38,lon:77.58,zoom:2.0,description:'A preserved delta records a time when water flowed across the Martian surface.'}
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
function applyMarsTexture(texture){
 if(!mars)return;
 texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;
 if(mars.material) mars.material.dispose();
 mars.material=new THREE.MeshStandardMaterial({map:texture,roughness:1,metalness:0});textureLoaded=true;
}
// Do not create or display a globe until the measured elevation grid has passed validation.
loadMolaTopography().then(info=>{
 mars=new THREE.Mesh(buildTerrainGeometry(),new THREE.MeshStandardMaterial({color:0x9c5138,roughness:1}));
 mars.castShadow=true;
 mars.receiveShadow=true;
 root.add(mars);updatePolarCaps(THREE,root,worldState);
 worldState.terrain.source=info.source;
 if(marsTexture)applyMarsTexture(marsTexture);
 document.querySelector('#loading p').textContent='NASA MOLA topography loaded';
 document.querySelector('#loading').classList.add('hidden');
}).catch(error=>{
 console.error('Required NASA MOLA terrain failed to load.',error);
 showTerrainError(error);
});
loader.load(TEXTURE_URL,texture=>{
 marsTexture=texture;
 if(mars)applyMarsTexture(texture);
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
const cameraFocus=new THREE.Vector3();let focusedMoon=null;
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
 const m=moonObjects[id];if(!m)return;focusedMoon=id;targetViewRotation.identity();loadMoonAssets(id);
 for(const [otherId,o] of Object.entries(moonObjects)){o.focusedScale=otherId===id;o.body.scale.setScalar(otherId===id?.03:moonSpecs[otherId].radius);o.marker.visible=otherId!==id&&zoom>1.8;o.halo.visible=otherId!==id&&zoom>6.5;}
 cameraFocus.copy(m.group.position);setZoom(.18);
 document.querySelectorAll('[data-moon]').forEach(el=>el.classList.toggle('active',el.dataset.moon===id));
 notify('Observing '+moonSpecs[id].name+' · close approach view');
}
let pointer=null,lastTrackball=null,pointers=new Map(),pinchStart=0,pinchZoom=zoom,dragged=false;
const raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2();
function setZoom(v){zoom=THREE.MathUtils.clamp(v,minZoom,maxZoom);updateLod();}
function notify(message){const t=document.querySelector('#toast');t.textContent=message;t.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove('show'),1800);}
function setActivePlace(id){document.querySelectorAll('.place').forEach(el=>el.classList.toggle('active',el.dataset.place===id));}
function resetView(announce=true){focusedMoon=null;cameraFocus.set(0,0,0);for(const [id,m] of Object.entries(moonObjects)){m.focusedScale=false;m.body.scale.setScalar(moonSpecs[id].radius);}document.querySelectorAll('[data-moon]').forEach(el=>el.classList.remove('active'));targetRotation.setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(-8),THREE.MathUtils.degToRad(18),0,'YXZ'));setZoom(4.2);setActivePlace('global');if(announce)notify('Mars global view restored');}
function focusPlace(id){if(id==='global'){resetView();return;}const p=locations[id];if(!p)return;focusedMoon=null;cameraFocus.set(0,0,0);for(const [mid,m] of Object.entries(moonObjects)){m.focusedScale=false;m.body.scale.setScalar(moonSpecs[mid].radius);}document.querySelectorAll('[data-moon]').forEach(el=>el.classList.remove('active'));const v=xyz(p.lat,p.lon,1);const yaw=Math.atan2(-v.x,v.z);const pitch=Math.asin(v.y);targetRotation.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));setZoom(Math.min(zoom,p.zoom+0.45));setActivePlace(id);notify(p.name+' · '+p.description);}
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
space.addEventListener('click',e=>{if(dragged)return;const rect=renderer.domElement.getBoundingClientRect();pointerNdc.x=((e.clientX-rect.left)/rect.width)*2-1;pointerNdc.y=-((e.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointerNdc,camera);const hits=raycaster.intersectObjects([...markerGroup.children,...Object.values(moonObjects).map(m=>m.marker)],false);if(hits.length){const hit=hits[0].object;if(hit.userData.id)focusPlace(hit.userData.id);else for(const [id,m] of Object.entries(moonObjects))if(hit===m.marker){focusMoon(id);break;}}});
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);}
addEventListener('resize',resize);
let previousFrameTime=performance.now();
function updateSolarLighting() {
 const missionDateMs=MISSION_ARRIVAL_UTC+elapsedGameSeconds*1000;
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
 updateMoonOrbits();
 const cameraOffset=new THREE.Vector3(0,0,zoom).applyQuaternion(focusedMoon?targetViewRotation:new THREE.Quaternion());
  const desiredCameraPosition=cameraFocus.clone().add(cameraOffset);
  camera.position.lerp(desiredCameraPosition,.12);camera.lookAt(cameraFocus);
 stars.rotation.y+=.00004;markerGroup.visible=showLabels&&zoom<8.5;gridGroup.visible=showGrid&&zoom<8.5;updateSolarLighting();
 renderer.render(scene,camera);
}
setZoom(4.2);updateMissionClock(0);updateMoonOrbits();updateSolarLighting();animate();

