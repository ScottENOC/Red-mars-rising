import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';

// Procedural fallback terrain only. Replaceable by measured elevation data later.
function angularDistance(lat1,lon1,lat2,lon2){const a=THREE.MathUtils.degToRad(lat1),b=THREE.MathUtils.degToRad(lat2),dl=THREE.MathUtils.degToRad(lon2-lon1),dp=b-a;const q=Math.sin(dp/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2;return 2*Math.asin(Math.sqrt(Math.min(1,q)));}
const volcanoes=[[18.65,226.2,.095,.17],[12.7,248,.045,.10],[0,247,.042,.095],[-9,239.3,.05,.105],[24.8,147.2,.055,.12],[40.5,109.9,.035,.08]];
export function terrainHeight(lat,lon){let h=0;h+=.035*Math.exp(-(angularDistance(lat,lon,10,250)/.52)**2);h+=.018*Math.exp(-(angularDistance(lat,lon,25,147)/.22)**2);
for(const [a,b,amp,sigma] of volcanoes){const d=angularDistance(lat,lon,a,b);h+=amp*Math.exp(-(d/sigma)**2);h-=amp*.17*Math.exp(-(d/(sigma*.20))**2);}
const centre=-12+3*Math.sin((lon-55)*Math.PI/45),window=Math.exp(-((lon+65)/58)**8);h-=.062*Math.exp(-((lat-centre)/3.1)**2)*window;h-=.022*Math.exp(-((lat-centre-4.5)/1.8)**2)*window;
for(const [a,b,r,depth] of [[-42.4,70.5,.19,.085],[-50,316,.12,.055],[12,88,.105,.035],[45,110,.14,.045],[-20,290,.07,.025],[25,15,.045,.018],[-5,160,.04,.015]]){const d=angularDistance(lat,lon,a,b);h-=depth*Math.exp(-(d/r)**4);h+=depth*.24*Math.exp(-((d-r*1.1)/(r*.2))**2);}
h+=(lat<0?1:.45)*(.006*Math.sin(lon*1.7+lat*.8)*Math.sin(lat*2.1-lon*.4)+.004*Math.sin(lon*4.2+lat*3.7));h-=.022*Math.exp(-((lat-42)/22)**2);if(Math.abs(lat)>80)h+=.012*Math.min(1,(Math.abs(lat)-80)/8);return h;}


// Polar ice is generated from scenario state, never baked into the terrain geometry.
export function createPolarCapMesh(north, worldState) {
  const hemisphere = north ? 'north' : 'south';
  const capState = worldState.surface.ice.polarCaps[hemisphere];
  const radiusDeg = THREE.MathUtils.clamp(capState.extentDeg, 0, 45);
  if (radiusDeg <= 0) return null;
  const vertices = [], indices = [], segments = 96, rings = 18;
  for (let j = 0; j <= rings; j++) {
    const ang = THREE.MathUtils.degToRad(radiusDeg * j / rings);
    for (let i = 0; i <= segments; i++) {
      const lon = 2 * Math.PI * i / segments;
      const lat = north ? Math.PI / 2 - ang : -Math.PI / 2 + ang;
      const r = 1.012 + Math.max(0, terrainHeight(lat * 180 / Math.PI, lon * 180 / Math.PI));
      vertices.push(-r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon));
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) {
    const a = j * (segments + 1) + i, b = a + segments + 1;
    if (north) indices.push(a, b, a + 1, b, b + 1, a + 1);
    else indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color: 0xdedbd0, roughness: 1, side: THREE.DoubleSide}));
  mesh.userData.polarCapHemisphere = hemisphere;
  return mesh;
}

export function updatePolarCaps(THREEUnused, root, worldState) {
  for (const child of [...root.children]) {
    if (child.userData?.polarCapHemisphere) {
      root.remove(child); child.geometry.dispose(); child.material.dispose();
    }
  }
  for (const north of [true, false]) {
    const mesh = createPolarCapMesh(north, worldState);
    if (mesh) root.add(mesh);
  }
}
