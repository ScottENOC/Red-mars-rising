// Initial surface settlement and compressed interplanetary logistics layer.
// Visual scale is deliberately exaggerated: this is a strategy-map representation,
// not a physically scaled model of the Earth–Mars distance.
export function createColonyAndLogistics(THREE, { root, scene, worldState, terrainRadiusOffset, notify }) {
  const settlements = worldState.settlements ?? [];
  const orbitalGroup = new THREE.Group();
  orbitalGroup.name = 'interplanetary-logistics';
  scene.add(orbitalGroup);

  function surfacePoint(lat, lon, extra = 0.002) {
    const a = THREE.MathUtils.degToRad(lat);
    const b = THREE.MathUtils.degToRad(lon);
    const radius = 1 + terrainRadiusOffset(lat, lon) + extra;
    return new THREE.Vector3(-radius * Math.cos(a) * Math.sin(b), radius * Math.sin(a), radius * Math.cos(a) * Math.cos(b));
  }

  const colonyGroups = [];
  const colonyMarkers = [];
  const settlementPickTargets = [];
  const shortlistMarkers = [];
  const surfacePoiMarkers = [];
  const cargoDropMarkers = [];
  const orbitPoiMarkers = [];
  const earthPoiMarkers = [];
  const impactMarkerById = new Map();
  const craterMeshById = new Map();
  let lastCraterRecordCount = -1;
  function pointOnMars(lat, lon, extra = 0.012) {
    const a = THREE.MathUtils.degToRad(lat), b = THREE.MathUtils.degToRad(lon);
    const r = 1 + terrainRadiusOffset(lat, lon) + extra;
    return new THREE.Vector3(-r * Math.cos(a) * Math.sin(b), r * Math.sin(a), r * Math.cos(a) * Math.cos(b));
  }
  function addPoiMarker(parent, poi, position, color = 0x9fc2d8, radius = 0.009) {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), new THREE.MeshBasicMaterial({color}));
    marker.position.copy(position);
    marker.userData = {kind:'point-of-interest', id:poi.id, poiKind:poi.kind, name:poi.name, status:poi.status, description:poi.description ?? poi.rationale ?? ''};
    parent.add(marker);
    return marker;
  }
  for (const site of (worldState.shortlistedSites ?? [])) {
    shortlistMarkers.push(addPoiMarker(root,{...site,kind:'shortlisted-landing-site',status:'shortlisted'},pointOnMars(site.lat,site.lon,0.012),0xd5a16f,0.006));
  }
  for (const drop of (worldState.logistics?.plannedCargoDrops ?? [])) {
    const site = (worldState.shortlistedSites ?? []).find(x => x.id === drop.siteId);
    if (!site) continue;
    const marker = addPoiMarker(root,{id:drop.id,name:'Cargo drop · '+drop.siteName,kind:'cargo-drop',status:drop.status,description:drop.cargo+' · sponsor: '+drop.sponsorName},pointOnMars(site.lat,site.lon,0.018),drop.status==='landed'?0x8ecb93:0x75bce0,0.01);
    cargoDropMarkers.push({drop,marker});
  }
  for (const poi of (worldState.pointsOfInterest ?? [])) {
    if (poi.kind === 'mars-surface-robotic') {
      surfacePoiMarkers.push(addPoiMarker(root,poi,pointOnMars(poi.lat,poi.lon,0.014),poi.status==='inactive'?0x858585:0x87c58d,0.008));
      continue;
    }
    if (!poi.kind.startsWith('mars-orbit')) continue;
    orbitPoiMarkers.push({poi,marker:addPoiMarker(root,poi,new THREE.Vector3(),poi.kind==='mars-orbit-comms'?0x71c9e8:0xc4c6a5,0.012)});
  }

  function addRoad(group, points, material) {
    const curvePoints = points.map(([x, z]) => new THREE.Vector3(x, 0.003, z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curvePoints), material);
    group.add(line);
    return line;
  }

  function buildSettlement(settlement) {
    const anchor = surfacePoint(settlement.lat, settlement.lon, 0.002);
    const group = new THREE.Group();
    group.name = settlement.name;
    group.position.copy(anchor);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), anchor.clone().normalize());
    root.add(group);

    const padMat = new THREE.MeshStandardMaterial({ color: 0x756b61, roughness: 1, metalness: 0 });
    const roadMat = new THREE.LineBasicMaterial({ color: 0x9b8979, transparent: true, opacity: 0.78 });
    const habitatMat = new THREE.MeshStandardMaterial({ color: 0xc8b8a5, roughness: 0.85 });
    const greenhouseMat = new THREE.MeshStandardMaterial({ color: 0x638b7a, roughness: 0.4, metalness: 0.05, transparent: true, opacity: 0.82 });
    const equipmentMat = new THREE.MeshStandardMaterial({ color: 0x5e6468, roughness: 0.9 });
    const solarMat = new THREE.MeshStandardMaterial({ color: 0x263c55, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xe7b77c });

    // Landing pad and a compact network of tracks.
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.014, 32), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(-0.025, 0.0025, 0.008);
    group.add(pad);
    const padMark = new THREE.Mesh(new THREE.RingGeometry(0.011, 0.012, 32), lightMat);
    padMark.rotation.x = -Math.PI / 2;
    padMark.position.set(-0.025, 0.003, 0.008);
    group.add(padMark);
    addRoad(group, [[-0.025, 0.008], [-0.012, 0.006], [0, 0.002], [0.012, -0.002], [0.025, -0.008]], roadMat);
    addRoad(group, [[0, 0.002], [-0.005, 0.018], [-0.014, 0.026]], roadMat);
    addRoad(group, [[0.012, -0.002], [0.018, -0.016], [0.028, -0.022]], roadMat);

    const modules = [
      { x: -0.006, z: 0.004, type: 'habitat' },
      { x: 0.004, z: 0.001, type: 'habitat' },
      { x: 0.014, z: -0.006, type: 'habitat' },
      { x: -0.012, z: 0.022, type: 'lab' },
      { x: 0.025, z: -0.020, type: 'greenhouse' },
      { x: 0.025, z: 0.012, type: 'workshop' }
    ];
    for (const module of modules) {
      if (module.type === 'greenhouse') {
        const shell = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.006, 0.009), greenhouseMat);
        shell.position.set(module.x, 0.006, module.z);
        group.add(shell);
        const ribMat = new THREE.LineBasicMaterial({ color: 0xb4d4bd, transparent: true, opacity: 0.7 });
        for (const dx of [-0.004, 0, 0.004]) {
          addRoad(group, [[module.x + dx, module.z - 0.0045], [module.x + dx, module.z + 0.0045]], ribMat);
        }
        continue;
      }
      const isLab = module.type === 'lab';
      const isWorkshop = module.type === 'workshop';
      const radius = isLab ? 0.005 : isWorkshop ? 0.006 : 0.0048;
      const height = isLab ? 0.009 : isWorkshop ? 0.008 : 0.007;
      const bodyMat = isWorkshop ? equipmentMat : habitatMat;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), bodyMat);
      body.position.set(module.x, height / 2 + 0.002, module.z);
      group.add(body);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.88, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
      dome.position.set(module.x, height + 0.002, module.z);
      group.add(dome);
      if (isLab) {
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.0017, 8, 6), lightMat);
        beacon.position.set(module.x, height + 0.007, module.z);
        group.add(beacon);
      }
    }

    // Solar arrays and a small autonomous rover give the settlement a recognisable silhouette.
    for (const x of [-0.018, 0.038]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.0008, 0.006), solarMat);
      panel.position.set(x, 0.003, 0.002);
      panel.rotation.y = x < 0 ? -0.18 : 0.18;
      group.add(panel);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.003, 6), equipmentMat);
      mast.position.set(x, 0.004, 0.002);
      group.add(mast);
    }
    const rover = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.003, 0.004), equipmentMat);
    rover.position.set(0.007, 0.0035, -0.012);
    group.add(rover);
    group.visible = false;
    colonyGroups.push(group);

    const markerGroup = new THREE.Group();
    markerGroup.position.copy(surfacePoint(settlement.lat, settlement.lon, 0.009));
    markerGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), markerGroup.position.clone().normalize());
    root.add(markerGroup);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), new THREE.MeshBasicMaterial({ color: 0xf1b08d }));
    marker.position.y = 0.004;
    marker.userData = { kind: 'settlement', id: settlement.id };
    markerGroup.add(marker);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.017, 0.021, 32), new THREE.MeshBasicMaterial({ color: 0xe1a181, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.position.y = 0.003;
    markerGroup.add(ring);
    colonyMarkers.push(markerGroup);
    settlementPickTargets.push(marker);
    return { settlement, group, markerGroup };
  }

  const builtSettlements = settlements.map(buildSettlement);
  const routeMeshes = [];
  function rebuildSettlementRoutes() {
    for (const mesh of routeMeshes) {
      root.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    routeMeshes.length = 0;
    const byId = new Map(settlements.map(item => [item.id, item]));
    for (const routeSpec of worldState.infrastructure?.routes ?? []) {
      const from = byId.get(routeSpec.from);
      const to = byId.get(routeSpec.to);
      if (!from || !to) continue;
      const toUnit = (place) => {
        const lat = THREE.MathUtils.degToRad(place.lat);
        const lon = THREE.MathUtils.degToRad(place.lon);
        return new THREE.Vector3(-Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).normalize();
      };
      const a = toUnit(from);
      const b = toUnit(to);
      const angle = a.angleTo(b);
      const points = [];
      for (let i = 0; i <= 96; i++) {
        const t = i / 96;
        let direction;
        if (angle < 1e-5) direction = a.clone();
        else direction = a.clone().multiplyScalar(Math.sin((1 - t) * angle) / Math.sin(angle))
          .add(b.clone().multiplyScalar(Math.sin(t * angle) / Math.sin(angle))).normalize();
        const lat = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)) * 180 / Math.PI;
        const lon = Math.atan2(-direction.x, direction.z) * 180 / Math.PI;
        points.push(surfacePoint(lat, lon, 0.0035));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const road = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 96, 0.0015, 5, false),
        new THREE.MeshStandardMaterial({ color: 0x49352b, roughness: 1 })
      );
      road.name = routeSpec.name ?? 'Inter-settlement road';
      road.userData = { kind: 'settlement-route', id: routeSpec.id };
      root.add(road);
      routeMeshes.push(road);
    }
  }
  rebuildSettlementRoutes();

  // Earth and transfer paths are intentionally shown only at wide zoom. The
  // scene compresses interplanetary distances so both destinations fit on screen.
  const earthPosition = new THREE.Vector3(8.2, 1.2, 0);
  const earthGroup = new THREE.Group();
  earthGroup.name = 'Earth (schematic interplanetary scale)';
  earthGroup.position.copy(earthPosition);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.43, 40, 28), new THREE.MeshStandardMaterial({ color: 0x416b91, roughness: 0.95, metalness: 0 }));
  earthGroup.add(earth);
  const landMat = new THREE.MeshStandardMaterial({ color: 0x68866a, roughness: 1 });
  for (const [x, y, z, scale] of [
    [-0.12, 0.20, 0.31, 0.14], [0.17, 0.08, 0.34, 0.11], [-0.22, -0.05, 0.27, 0.12],
    [0.03, -0.20, 0.32, 0.16], [0.25, -0.12, 0.23, 0.09]
  ]) {
    const land = new THREE.Mesh(new THREE.SphereGeometry(scale, 10, 8), landMat);
    land.position.set(x, y, z);
    earthGroup.add(land);
  }
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(0.455, 32, 20), new THREE.MeshBasicMaterial({ color: 0x6fa9d9, transparent: true, opacity: 0.12, side: THREE.BackSide }));
  earthGroup.add(atmosphere);
  orbitalGroup.add(earthGroup);
  const earthSystemPois = (worldState.pointsOfInterest ?? []).filter(p => ['earth-comms','earth-orbit-station','lunar-relay','moon-asset'].includes(p.kind));
  for (const poi of earthSystemPois) {
    const pos = poi.kind === 'earth-comms' ? new THREE.Vector3(0.02,-0.03,0.426)
      : poi.kind === 'earth-orbit-station' ? new THREE.Vector3(0.52,0.12,0.08)
      : poi.kind === 'lunar-relay' ? new THREE.Vector3(0.88,0.2,0.02)
      : new THREE.Vector3(0.62,-0.3,-0.08);
    earthPoiMarkers.push({poi,marker:addPoiMarker(earthGroup,poi,pos,poi.kind==='earth-orbit-station'?0xf0c17a:0x91c8df,0.025)});
  }

  const arrival = new THREE.Vector3(1.12, 0.18, 0.02);
  const curve = new THREE.CatmullRomCurve3([
    earthPosition.clone(),
    new THREE.Vector3(6.2, 3.0, 0.8),
    new THREE.Vector3(3.4, 2.7, -0.6),
    new THREE.Vector3(1.12, 0.18, 0.02)
  ]);
  const route = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(100)), new THREE.LineDashedMaterial({ color: 0xd6a17e, dashSize: 0.16, gapSize: 0.12, transparent: true, opacity: 0.65 }));
  route.computeLineDistances();
  orbitalGroup.add(route);

  const shipSpecs = worldState.logistics?.supplyShips ?? [];
  const shipMeshes = [];
  const shipPickTargets = [];
  for (const spec of shipSpecs) {
    const ship = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.19, 8), new THREE.MeshStandardMaterial({ color: 0xd5b49a, roughness: 0.7, metalness: 0.25 }));
    hull.rotation.z = -Math.PI / 2;
    ship.add(hull);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0x777f84, roughness: 0.8 }));
    cargo.position.x = -0.06;
    ship.add(cargo);
    ship.userData = { kind: 'supply-ship', id: spec.id, cargo: spec.cargo ?? spec.name ?? 'Expedition supplies' };
    orbitalGroup.add(ship);
    shipMeshes.push({ spec, ship });
    shipPickTargets.push(hull);
    hull.userData = ship.userData;
  }

  const poiPickTargets = [...shortlistMarkers,...surfacePoiMarkers,...cargoDropMarkers.map(x=>x.marker),...orbitPoiMarkers.map(x=>x.marker),...earthPoiMarkers.map(x=>x.marker)];
  function buildImpactCraterMesh(impact) {
    const radiusM = Math.max(0.5, Number(impact.craterDiameterM || 10) / 2);
    const marsRadiusM = 3_389_500;
    const lat = THREE.MathUtils.degToRad(impact.lat), lon = THREE.MathUtils.degToRad(impact.lon);
    const centre = new THREE.Vector3(-Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
    const east = new THREE.Vector3(-Math.cos(lon), 0, -Math.sin(lon));
    const north = new THREE.Vector3(Math.sin(lat) * Math.sin(lon), Math.cos(lat), -Math.sin(lat) * Math.cos(lon));
    const vertices = [], indices = [], rings = 4, segments = 12;
    const radii = [0, 0.42, 0.78, 1.0, 1.9];
    const heightsM = [-radiusM * 0.32, -radiusM * 0.23, -radiusM * 0.025, radiusM * 0.07, radiusM * 0.012];
    const surfaceBase = 1 + terrainRadiusOffset(impact.lat, impact.lon);
    for (let j = 0; j <= rings; j++) {
      for (let i = 0; i <= segments; i++) {
        const angle = i / segments * Math.PI * 2;
        const tangent = east.clone().multiplyScalar(Math.cos(angle) * radii[j] * radiusM / marsRadiusM)
          .add(north.clone().multiplyScalar(Math.sin(angle) * radii[j] * radiusM / marsRadiusM));
        const direction = centre.clone().add(tangent).normalize();
        const point = direction.multiplyScalar(surfaceBase + heightsM[j] / marsRadiusM);
        vertices.push(point.x, point.y, point.z);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i, b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const colourByType = {
      'carbonaceous-chondrite':0x443b35,'ordinary-chondrite':0x77665a,'enstatite-chondrite':0x625c51,
      'basaltic-achondrite':0x6e5145,'iron-stony-iron':0x4d4542,'cometary-dust':0x9a8171
    };
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color:colourByType[impact.impactorTypeId] ?? 0x705b50, roughness:1, metalness:0, side:THREE.DoubleSide
    }));
    mesh.userData = {kind:'terrain-impact-crater', id:impact.id, impact};
    return mesh;
  }
  function syncPermanentCraters() {
    const records = worldState.terrain?.geologicalModifications ?? [];
    if (records.length === lastCraterRecordCount) return;
    lastCraterRecordCount = records.length;
    const liveIds = new Set(records.filter(x=>x.kind==='impact-crater').map(x=>x.id));
    for (const [id,mesh] of craterMeshById) {
      if (liveIds.has(id)) continue;
      root.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); craterMeshById.delete(id);
    }
    for (const crater of records) {
      if (crater.kind!=='impact-crater' || craterMeshById.has(crater.id)) continue;
      const mesh = buildImpactCraterMesh(crater);
      root.add(mesh); craterMeshById.set(crater.id,mesh);
    }
  }
  function syncImpactMarkers() {
    const impacts = worldState.materials?.planetary?.meteoroids?.recentImpacts ?? [];
    const currentIds = new Set(impacts.map(impact=>impact.id));
    for (const [id,marker] of impactMarkerById) {
      if (currentIds.has(id)) continue;
      root.remove(marker);
      marker.geometry.dispose();
      marker.material.dispose();
      impactMarkerById.delete(id);
      const index=poiPickTargets.indexOf(marker);
      if(index>=0)poiPickTargets.splice(index,1);
    }
    for (const impact of impacts) {
      if (impactMarkerById.has(impact.id)) continue;
      const poi = {
        id: impact.id,
        name: 'Natural impact crater',
        kind: 'natural-impact-crater',
        status: 'formed',
        description: impact.craterDiameterM.toFixed(1)+' m crater · '+impact.typeLabel+' · sol '+impact.sol
      };
      const marker = addPoiMarker(root,poi,pointOnMars(impact.lat,impact.lon,0.014),0xd58c63,0.006);
      marker.userData.impact = impact;
      impactMarkerById.set(impact.id,marker);
      poiPickTargets.push(marker);
    }
  }

  function update(zoom, elapsedGameSeconds) {
    while (builtSettlements.length < settlements.length) builtSettlements.push(buildSettlement(settlements[builtSettlements.length]));
    syncImpactMarkers();
    syncPermanentCraters();
    const detailVisible = zoom < 1.6;
    const markerVisible = zoom >= 1.6 && zoom < 8.5;
    for (const { group, markerGroup } of builtSettlements) {
      group.visible = detailVisible;
      markerGroup.visible = markerVisible;
    }
    for (const road of routeMeshes) road.visible = zoom < 8.5;
    const logisticsVisible = zoom > 8.5;
    orbitalGroup.visible = logisticsVisible;
    for (const marker of shortlistMarkers) marker.visible = zoom >= 1.6 && zoom < 8.5;
    for (const marker of surfacePoiMarkers) marker.visible = zoom >= 1.6 && zoom < 8.5;
    for (const marker of impactMarkerById.values()) marker.visible = zoom >= 1.6 && zoom < 8.5;
    for (const {drop,marker} of cargoDropMarkers) {
      marker.visible = zoom >= 1.6 && zoom < 8.5;
      marker.userData.status = drop.status;
      marker.material.color.set(drop.status==='landed'?0x8ecb93:0x75bce0);
    }
    for (const {poi,marker} of orbitPoiMarkers) {
      const phase = (poi.orbitPhase ?? 0) * Math.PI * 2 + elapsedGameSeconds / 9000;
      marker.position.set(Math.cos(phase)*1.18,Math.sin(phase*0.73)*0.22,Math.sin(phase)*1.18);
      marker.visible = logisticsVisible;
    }
    for (const {marker} of earthPoiMarkers) marker.visible = logisticsVisible;
    if (logisticsVisible) {
      for (const { spec, ship } of shipMeshes) {
        const progress = (spec.phase + elapsedGameSeconds / (spec.cycleSols * 88775.244)) % 1;
        ship.position.copy(curve.getPoint(progress));
        const tangent = curve.getTangent(progress).normalize();
        ship.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent);
        ship.visible = true;
        ship.userData.progress = progress;
        ship.userData.etaSols = Math.max(0, (1 - progress) * spec.cycleSols);
      }
    }
  }

  return {
    settlements: builtSettlements,
    shipPickTargets,
    settlementPickTargets,
    shortlistMarkers,
    orbitPoiMarkers,
    earthPoiMarkers,
    poiPickTargets,
    impactMarkers: impactMarkerById,
    routeMeshes,
    rebuildSettlementRoutes,
    update,
    getSettlement(id) { return builtSettlements.find(item => item.settlement.id === id); }
  };
}
