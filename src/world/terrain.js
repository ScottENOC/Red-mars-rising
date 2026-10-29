import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';

// NASA MOLA global topography is mandatory; never substitute invented terrain.
function angularDistance(lat1,lon1,lat2,lon2){const a=THREE.MathUtils.degToRad(lat1),b=THREE.MathUtils.degToRad(lat2),dl=THREE.MathUtils.degToRad(lon2-lon1),dp=b-a;const q=Math.sin(dp/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2;return 2*Math.asin(Math.sqrt(Math.min(1,q)));}
const volcanoes=[[18.65,226.2,.095,.17],[12.7,248,.045,.10],[0,247,.042,.095],[-9,239.3,.05,.105],[24.8,147.2,.055,.12],[40.5,109.9,.035,.08]];

const MOLA_URL = new URL('../../data/mola/megt90n000cb.img', import.meta.url).href;
const MOLA_PIXELS_PER_DEGREE = 4;
const MOLA_WIDTH = 360 * MOLA_PIXELS_PER_DEGREE;
const MOLA_HEIGHT = 180 * MOLA_PIXELS_PER_DEGREE;
let molaElevationAt = null;
let terrainWorldState = null;
let craterSpatialIndex = new Map();
let craterSpatialIndexCount = -1;
export function setTerrainWorldState(worldState) {
  terrainWorldState = worldState;
  craterSpatialIndexCount = -1;
}
function craterCell(lat, lon) {
  const latCell = Math.max(0, Math.min(179, Math.floor(lat + 90)));
  const lonCell = Math.floor((((lon % 360) + 360) % 360));
  return latCell + ':' + lonCell;
}
function getCraterCandidates(lat, lon) {
  const records = terrainWorldState?.terrain?.geologicalModifications ?? [];
  if (records.length !== craterSpatialIndexCount) {
    craterSpatialIndex = new Map();
    for (const crater of records) {
      if (crater.kind !== 'impact-crater') continue;
      const latCell = Math.max(0, Math.min(179, Math.floor(crater.lat + 90)));
      const lonCell = Math.floor((((crater.lon % 360) + 360) % 360));
      for (let dy = -1; dy <= 1; dy++) {
        const y = latCell + dy;
        if (y < 0 || y > 179) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const x = (lonCell + dx + 360) % 360;
          const key = y + ':' + x;
          if (!craterSpatialIndex.has(key)) craterSpatialIndex.set(key, []);
          craterSpatialIndex.get(key).push(crater);
        }
      }
    }
    craterSpatialIndexCount = records.length;
  }
  return craterSpatialIndex.get(craterCell(lat, lon)) ?? [];
}
// The PDS MEGDR topography image is a headerless, signed 16-bit big-endian grid
// in metres, simple cylindrical projection, 0–360°E and 90°N–90°S.
export async function loadMolaTopography() {
  const response = await fetch(MOLA_URL, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`MOLA data request failed (${response.status})`);
  const buffer = await response.arrayBuffer();
  const expectedBytes = MOLA_WIDTH * MOLA_HEIGHT * 2;
  if (buffer.byteLength !== expectedBytes) {
    throw new Error(`Unexpected MOLA grid size: ${buffer.byteLength} bytes`);
  }
  const view = new DataView(buffer);
  const elevation = new Int16Array(MOLA_WIDTH * MOLA_HEIGHT);
  let minElevation = Infinity, maxElevation = -Infinity;
  for (let i = 0; i < elevation.length; i++) {
    const value = view.getInt16(i * 2, false);
    elevation[i] = value;
    if (value < minElevation) minElevation = value;
    if (value > maxElevation) maxElevation = value;
  }
  // Reject an HTML error page or incorrect decoding even if the byte count matches.
  if (minElevation < -10000 || maxElevation > 25000 || minElevation >= maxElevation) {
    throw new Error(`MOLA elevation values out of range: ${minElevation} to ${maxElevation} m`);
  }

  molaElevationAt = (lat, lon) => {
    const wrappedLon = ((lon % 360) + 360) % 360;
    // Shift by half a cell: the PDS/ENVI registration correction places
    // grid sample centres half a pixel from the nominal map origin.
    const x = wrappedLon * MOLA_PIXELS_PER_DEGREE - 0.5;
    const y = THREE.MathUtils.clamp((90 - lat) * MOLA_PIXELS_PER_DEGREE - 0.5, 0, MOLA_HEIGHT - 1);
    const xWrapped = ((x % MOLA_WIDTH) + MOLA_WIDTH) % MOLA_WIDTH;
    const x0 = Math.floor(xWrapped), x1 = (x0 + 1) % MOLA_WIDTH;
    const y0 = Math.floor(y), y1 = Math.min(y0 + 1, MOLA_HEIGHT - 1);
    const fx = xWrapped - x0, fy = y - y0;
    const a = elevation[y0 * MOLA_WIDTH + x0], b = elevation[y0 * MOLA_WIDTH + x1];
    const c = elevation[y1 * MOLA_WIDTH + x0], d = elevation[y1 * MOLA_WIDTH + x1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
  return { source: 'NASA MOLA MEGDR 4 pixels/degree', width: MOLA_WIDTH, height: MOLA_HEIGHT };
}

// Elevation is converted from metres to a fraction of Mars' mean radius.
// Keep the globe at true vertical scale; no artistic terrain exaggeration.
export function terrainRadiusOffset(lat, lon, verticalExaggeration = 1) {
  if (!molaElevationAt) throw new Error('MOLA terrain requested before NASA elevation data finished loading');
  const base = molaElevationAt(lat, lon);
  let deltaM = 0;
  for (const crater of getCraterCandidates(lat, lon)) {
    const d = angularDistance(lat, lon, crater.lat, crater.lon) * 3_389_500;
    const radius = Math.max(0.5, crater.craterDiameterM / 2);
    if (d > radius * 2.2) continue;
    const x = d / radius;
    const floor = crater.terrainDeltaM?.floor ?? -radius * 0.32;
    const rim = crater.terrainDeltaM?.rim ?? radius * 0.07;
    deltaM += floor * Math.exp(-((x / 0.58) ** 2));
    deltaM += rim * Math.exp(-(((x - 1) / 0.18) ** 2));
    if (x >= 1) deltaM += (crater.terrainDeltaM?.ejecta ?? radius * 0.012) * Math.exp(-(x - 1) / 0.45);
  }
  return (base + deltaM) * verticalExaggeration / 3390000;
}

export function terrainHeight(lat,lon){let h=0;h+=.035*Math.exp(-1 * (angularDistance(lat,lon,10,250)/.52)**2);h+=.018*Math.exp(-1 * (angularDistance(lat,lon,25,147)/.22)**2);
for(const [a,b,amp,sigma] of volcanoes){const d=angularDistance(lat,lon,a,b);h+=amp*Math.exp(-1 * (d/sigma)**2);h-=amp*.17*Math.exp(-1 * (d/(sigma*.20))**2);}
const centre=-12+3*Math.sin((lon-55)*Math.PI/45),window=Math.exp(-1 * ((lon+65)/58)**8);h-=.062*Math.exp(-1 * ((lat-centre)/3.1)**2)*window;h-=.022*Math.exp(-1 * ((lat-centre-4.5)/1.8)**2)*window;
for(const [a,b,r,depth] of [[-42.4,70.5,.19,.085],[-50,316,.12,.055],[12,88,.105,.035],[45,110,.14,.045],[-20,290,.07,.025],[25,15,.045,.018],[-5,160,.04,.015]]){const d=angularDistance(lat,lon,a,b);h-=depth*Math.exp(-1 * (d/r)**4);h+=depth*.24*Math.exp(-1 * ((d-r*1.1)/(r*.2))**2);}
h+=(lat<0?1:.45)*(.006*Math.sin(lon*1.7+lat*.8)*Math.sin(lat*2.1-lon*.4)+.004*Math.sin(lon*4.2+lat*3.7));h-=.022*Math.exp(-1 * ((lat-42)/22)**2);if(Math.abs(lat)>80)h+=.012*Math.min(1,(Math.abs(lat)-80)/8);return h;}


// Polar ice is generated from separate persistent-deposit and seasonal-frost state.
function polarBoundaryVariation(lon, north) {
  return 0.055 * Math.sin(3 * lon + (north ? 0.4 : 1.1)) +
    0.032 * Math.sin(5 * lon - (north ? 0.7 : 0.2)) +
    0.018 * Math.cos(9 * lon + (north ? 0.1 : 1.7));
}

function createPolarCapMesh(north, capState, innerExtentDeg = 0, color = 0xdedbd0) {
  const outerExtentDeg = THREE.MathUtils.clamp(capState.extentDeg, 0, 45);
  const innerDeg = THREE.MathUtils.clamp(innerExtentDeg, 0, outerExtentDeg);
  if (outerExtentDeg <= 0 || outerExtentDeg <= innerDeg + 0.01) return null;
  const vertices = [], indices = [], segments = 96, rings = 18;
  for (let j = 0; j <= rings; j++) {
    for (let i = 0; i <= segments; i++) {
      const lon = 2 * Math.PI * i / segments;
      // Matching deterministic boundaries lets seasonal frost meet the residual cap
      // without a visible gap. The outline remains a provisional visual approximation.
      const variation = polarBoundaryVariation(lon, north);
      const radiusDeg = innerDeg + (outerExtentDeg - innerDeg) * j / rings;
      const ang = THREE.MathUtils.degToRad(radiusDeg * (1 + variation));
      const lat = north ? Math.PI / 2 - ang : -Math.PI / 2 + ang;
      const r = 1.0015 + terrainRadiusOffset(lat * 180 / Math.PI, lon * 180 / Math.PI);
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
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color, roughness: 1, side: THREE.DoubleSide
  }));
  mesh.userData.polarCapHemisphere = north ? 'north' : 'south';
  mesh.userData.polarIceLayer = innerDeg > 0 ? 'seasonal-frost' : 'residual-cap';
  return mesh;
}

export function updatePolarCaps(THREEUnused, root, worldState, solarLongitudeDeg = 156) {
  for (const child of [...root.children]) {
    if (child.userData?.polarCapHemisphere) {
      root.remove(child); child.geometry.dispose(); child.material.dispose();
    }
  }
  const ice = worldState.surface.ice;
  const ls = ((solarLongitudeDeg % 360) + 360) % 360;
  for (const north of [true, false]) {
    const hemisphere = north ? 'north' : 'south';
    const residual = ice.residualCaps[hemisphere];
    const residualExtent = THREE.MathUtils.clamp(residual.extentDeg, 0, 45);
    const persistentMesh = createPolarCapMesh(north, residual, 0, north ? 0xe0ded7 : 0xd7d4ca);
    if (persistentMesh) root.add(persistentMesh);

    // First-pass seasonal cycle: frost expands in that hemisphere's winter and retreats
    // toward the equinox. This is a transparent approximation, not a fitted climate model.
    const winterPeakLs = north ? 270 : 90;
    const seasonal = ice.seasonalFrost[hemisphere];
    const seasonalFactor = Math.max(0, Math.cos(THREE.MathUtils.degToRad(ls - winterPeakLs)));
    const seasonalExtent = Math.min(45, seasonal.maxExtentDeg * seasonalFactor);
    if (seasonalExtent > residualExtent + 0.25) {
      const frostMesh = createPolarCapMesh(north, { extentDeg: seasonalExtent }, residualExtent, north ? 0xe8e5dc : 0xe2dfd6);
      if (frostMesh) root.add(frostMesh);
    }
  }
}
