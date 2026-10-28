import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';
import { createInitialWorldState } from './world/world-state.js';
import { terrainHeight, updatePolarCaps } from './world/terrain.js';

const TEXTURE_URL='https://www.solarsystemscope.com/textures/download/8k_mars.jpg';
const worldState = createInitialWorldState();
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
renderer.toneMappingExposure=1.12;
space.appendChild(renderer.domElement);
const root=new THREE.Group();scene.add(root);
const ambient=new THREE.AmbientLight(0x9b9b9b,1.25);scene.add(ambient);
const key=new THREE.DirectionalLight(0xffdfc1,3.2);key.position.set(-3,1.5,4);scene.add(key);
const rim=new THREE.DirectionalLight(0x7189b1,1.7);rim.position.set(3,-1,-3);scene.add(rim);
const loader=new THREE.TextureLoader();loader.setCrossOrigin('anonymous');
let mars,gridGroup,markerGroup,stars,textureLoaded=false;

const sphereGeometry=new THREE.SphereGeometry(1,360,240),posAttr=sphereGeometry.attributes.position;
for(let i=0;i<posAttr.count;i++){const x=posAttr.getX(i),y=posAttr.getY(i),z=posAttr.getZ(i),lat=Math.asin(THREE.MathUtils.clamp(y,-1,1))*180/Math.PI,lon=Math.atan2(-x,z)*180/Math.PI,r=1+terrainHeight(lat,lon);posAttr.setXYZ(i,x*r,y*r,z*r);}sphereGeometry.computeVertexNormals();
const fallbackMat=new THREE.MeshStandardMaterial({color:0x9c5138,roughness:1});mars=new THREE.Mesh(sphereGeometry,fallbackMat);root.add(mars);
updatePolarCaps(THREE, root, worldState);
loader.load(TEXTURE_URL,texture=>{
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.RepeatWrapping;
 mars.material.dispose();mars.material=new THREE.MeshStandardMaterial({map:texture,roughness:1,metalness:0});textureLoaded=true;
 document.querySelector('#loading').classList.add('hidden');
},undefined,()=>{document.querySelector('#loading p').textContent='Terrain active · colour texture unavailable';setTimeout(()=>document.querySelector('#loading').classList.add('hidden'),900);});
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
function setView(flat){isFlat=flat;space.style.display=flat?'none':'block';flatMap.style.display=flat?'block':'none';document.querySelector('#globeBtn').classList.toggle('active',!flat);document.querySelector('#mapBtn').classList.toggle('active',flat);document.querySelector('#mapNote').textContent=flat?'Select a landmark':'Drag to turn · Pinch to zoom';document.querySelector('.zoom-controls').style.display=flat?'none':'flex';if(flat)drawFlatPins();else{document.querySelectorAll('.flat-pin').forEach(el=>el.remove());}}
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
function animate(){requestAnimationFrame(animate);root.quaternion.slerp(targetRotation,.09);camera.position.z+=(zoom-camera.position.z)*.12;stars.rotation.y+=.00004;renderer.render(scene,camera);}
setZoom(4.2);animate();
setTimeout(()=>document.querySelector('#loading').classList.add('hidden'),6500);
