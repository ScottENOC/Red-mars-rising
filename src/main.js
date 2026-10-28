import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';
import { createInitialWorldState } from './world/world-state.js';
import { terrainHeight, terrainRadiusOffset, loadMolaTopography, updatePolarCaps } from './world/terrain.js';

const TEXTURE_URL=new URL('../data/mars/8k_mars.jpg', import.meta.url).href;
const worldState = createInitialWorldState();

// Mission timeline: the first crew leaves Earth in late 2026 and arrives in July 2027.
const MISSION_DEPARTURE_UTC = Date.UTC(2026, 10, 18, 12);
const MISSION_ARRIVAL_UTC = Date.UTC(2027, 6, 22, 0);
const ARRIVAL_LOCAL_SOL_SECONDS = 9 * 3600;
const MARS_SOL_SECONDS = 88775.244;
let elapsedGameSeconds = 0;
let clockRunning = true;
let clockSpeed = 60; // one game minute per real second by default
let clockUiElapsed = 0;
const clockStyle = document.createElement('style');
clockStyle.textContent = `
#missionClock{position:absolute;z-index:4;top:86px;right:clamp(14px,3.5vw,48px);width:230px;padding:13px 14px;background:#0b1018e8;border:1px solid #ffffff24;backdrop-filter:blur(16px);box-shadow:0 12px 40px #0005;font-variant-numeric:tabular-nums}
#missionClock .mc-kicker{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#c17b60}
#missionClock .mc-date{font-size:17px;letter-spacing:.03em;margin-top:5px;color:#f1e8df}
#missionClock .mc-sol{font-size:10px;color:#b5b4b1;margin-top:4px;letter-spacing:.08em}
#missionClock .mc-route{font-size:9px;line-height:1.6;color:#888f93;margin-top:10px;border-top:1px solid #ffffff16;padding-top:8px}
#missionClock .mc-controls{display:flex;gap:6px;margin-top:10px}
#missionClock button{flex:1;border:1px solid #ffffff25;background:#ffffff08;padding:7px 5px;font-size:9px;letter-spacing:.08em;color:#ded6ce}
#missionClock button:active,#missionClock button:hover{border-color:#c17b60;color:#fff}
#missionClock .mc-status{color:#9caf91}
@media(max-width:760px){#missionClock{top:72px;right:12px;width:178px;padding:10px 11px}#missionClock .mc-date{font-size:14px}#missionClock .mc-route{font-size:8px;margin-top:7px;padding-top:6px}#missionClock .mc-controls{margin-top:7px}#missionClock button{padding:7px 3px;font-size:8px}}
@media(max-width:390px){#missionClock{top:66px;width:160px;padding:8px 9px}#missionClock .mc-date{font-size:12px}}
`;
document.head.appendChild(clockStyle);
const clockPanel = document.createElement('section');
clockPanel.id = 'missionClock';
clockPanel.setAttribute('aria-label', 'Mission date and Mars local time');
clockPanel.innerHTML = `
  <div class="mc-kicker">Mission clock</div>
  <div class="mc-date" id="mcDate">22 JUL 2027</div>
  <div class="mc-sol" id="mcSol">SOL 001 · 09:00 LMST</div>
  <div class="mc-route">EARTH DEPARTURE · 18 NOV 2026<br>MARS ARRIVAL · 22 JUL 2027</div>
  <div class="mc-controls"><button id="mcPlay" type="button">Ⅱ PAUSE</button><button id="mcSpeed" type="button">×60 SPEED</button></div>`;
document.querySelector('#app').appendChild(clockPanel);
document.querySelector('#mcPlay').addEventListener('click', () => {
  clockRunning = !clockRunning;
  document.querySelector('#mcPlay').textContent = clockRunning ? 'Ⅱ PAUSE' : '▶ PLAY';
  document.querySelector('#mcPlay').setAttribute('aria-label', clockRunning ? 'Pause game time' : 'Resume game time');
});
document.querySelector('#mcSpeed').addEventListener('click', () => {
  const speeds = [1, 10, 60, 300];
  clockSpeed = speeds[(speeds.indexOf(clockSpeed) + 1) % speeds.length];
  document.querySelector('#mcSpeed').textContent = '×' + clockSpeed + ' SPEED';
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
const space=document.querySelector('#space'),flatMap=document.querySelector('#flatMap'),flatTexture=document.querySelector('#flatTexture');
flatTexture.src=TEXTURE_URL;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.1,100);
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
const loader=new THREE.TextureLoader();loader.setCrossOrigin('anonymous');
let mars,gridGroup,markerGroup,stars,textureLoaded=false,marsTexture=null;

function buildTerrainGeometry() {
 const geometry=new THREE.SphereGeometry(1,360,240),positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  const lat=Math.asin(THREE.MathUtils.clamp(y,-1,1))*180/Math.PI,lon=Math.atan2(-x,z)*180/Math.PI;
  const r=1+terrainRadiusOffset(lat,lon);
  positions.setXYZ(i,x*r,y*r,z*r);
 }
 geometry.computeVertexNormals();return geometry;
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
let zoom=4.2,minZoom=1.65,maxZoom=8,showLabels=true,showGrid=false,isFlat=false;
let pointer=null,lastTrackball=null,pointers=new Map(),pinchStart=0,pinchZoom=zoom,dragged=false;
const raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2();
function setZoom(v){zoom=THREE.MathUtils.clamp(v,minZoom,maxZoom);camera.position.z=zoom;}
function notify(message){const t=document.querySelector('#toast');t.textContent=message;t.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove('show'),1800);}
function setActivePlace(id){document.querySelectorAll('.place').forEach(el=>el.classList.toggle('active',el.dataset.place===id));}
function focusPlace(id){const p=locations[id];if(!p)return;const v=xyz(p.lat,p.lon,1);const yaw=Math.atan2(-v.x,v.z);const pitch=Math.asin(v.y);targetRotation.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));setZoom(Math.min(zoom,p.zoom+0.45));setActivePlace(id);notify(p.name+' · '+p.description);}
document.querySelectorAll('.place').forEach(el=>el.addEventListener('click',()=>focusPlace(el.dataset.place)));
document.querySelector('#zoomIn').addEventListener('click',()=>setZoom(zoom*.82));
document.querySelector('#zoomOut').addEventListener('click',()=>setZoom(zoom*1.22));
document.querySelector('#reset').addEventListener('click',()=>{targetRotation.setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(-8),THREE.MathUtils.degToRad(18),0,'YXZ'));setZoom(4.2);notify('Global view restored');});
document.querySelector('#labelsBtn').addEventListener('click',e=>{showLabels=!showLabels;markerGroup.visible=showLabels;e.currentTarget.classList.toggle('active',showLabels);});
document.querySelector('#gridBtn').addEventListener('click',e=>{showGrid=!showGrid;gridGroup.visible=showGrid;e.currentTarget.classList.toggle('active',showGrid);});
document.querySelector('#globeBtn').addEventListener('click',()=>setView(false));
document.querySelector('#mapBtn').addEventListener('click',()=>setView(true));
const dataMenu=document.querySelector('#dataMenu'),dataBtn=document.querySelector('#dataBtn');
dataBtn.addEventListener('click',()=>{dataMenu.hidden=!dataMenu.hidden;dataBtn.classList.toggle('active',!dataMenu.hidden);});
document.querySelector('#closeData').addEventListener('click',()=>{dataMenu.hidden=true;dataBtn.classList.remove('active');});
function setView(flat){isFlat=flat;space.style.display=flat?'none':'block';flatMap.style.display=flat?'block':'none';document.querySelector('#globeBtn').classList.toggle('active',!flat);document.querySelector('#mapBtn').classList.toggle('active',flat);document.querySelector('.zoom-controls').style.display=flat?'none':'flex';if(flat)drawFlatPins();else{document.querySelectorAll('.flat-pin').forEach(el=>el.remove());}}
function drawFlatPins(){document.querySelectorAll('.flat-pin').forEach(el=>el.remove());Object.entries(locations).forEach(([id,p])=>{const pin=document.createElement('button');pin.className='flat-pin';pin.style.left=((p.lon+180)/360*100)+'%';pin.style.top=((90-p.lat)/180*100)+'%';pin.innerHTML='<span>'+p.name+'</span>';pin.addEventListener('click',()=>{setView(false);focusPlace(id);});flatMap.appendChild(pin);});}
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
space.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const a=[...pointers.values()];const dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinchStart>0)setZoom(pinchZoom*pinchStart/dist);dragged=true;return;}if(pointer===e.pointerId){const next=trackballPoint(e.clientX,e.clientY);if(lastTrackball){const delta=new THREE.Quaternion().setFromUnitVectors(lastTrackball,next);targetRotation.premultiply(delta).normalize();}lastTrackball=next;if(pointers.size===1)dragged=true;}});
function endPointer(e){pointers.delete(e.pointerId);if(pointer===e.pointerId){pointer=null;lastTrackball=null;}if(pointers.size<2)pinchStart=0;if(!pointers.size)space.classList.remove('dragging');}
space.addEventListener('pointerup',endPointer);space.addEventListener('pointercancel',endPointer);
space.addEventListener('click',e=>{if(dragged)return;const rect=renderer.domElement.getBoundingClientRect();pointerNdc.x=((e.clientX-rect.left)/rect.width)*2-1;pointerNdc.y=-((e.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointerNdc,camera);const hits=raycaster.intersectObjects(markerGroup.children,false);if(hits.length&&hits[0].object.userData.id)focusPlace(hits[0].object.userData.id);});
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
 const sunWorld=sunLocal.applyQuaternion(root.quaternion).multiplyScalar(4);
 key.position.copy(sunWorld);
}
function animate(now=performance.now()){
 requestAnimationFrame(animate);
 const dt=Math.min(Math.max((now-previousFrameTime)/1000,0),0.25);previousFrameTime=now;
 updateMissionClock(dt);
 root.quaternion.slerp(targetRotation,.09);
 camera.position.z+=(zoom-camera.position.z)*.12;
 stars.rotation.y+=.00004;
 updateSolarLighting();
 renderer.render(scene,camera);
}
setZoom(4.2);updateMissionClock(0);updateSolarLighting();animate();

