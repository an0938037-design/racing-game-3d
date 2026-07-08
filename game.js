const GameModule = (function() {

  let scene, camera, renderer;
  let car, carBody;
  let clock;
  let trackCenterLine = [];
  let walls = [];
  let trees = [];

  const TRACK_HALF_WIDTH = 4;
  const WALL_HEIGHT = 1.5;
  const FIGURE8_SCALE = 16;

  const MAX_SPEED = 1.2;
  const MAX_REVERSE_SPEED = 0.5;
  const ACCELERATION = 0.025;
  const FRICTION = 0.015;
  const STEERING_SPEED = 0.04;

  let velocity = 0;
  let score = 0;
  let currentAction = 'STOP';
  let currentSteering = 0;

  function lemniscate(t, a) {
    const denom = 1 + Math.sin(t) * Math.sin(t);
    return {
      x: a * Math.cos(t) / denom,
      z: a * Math.sin(t) * Math.cos(t) / denom
    };
  }

  function init(container) {
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.004);

    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(65, aspect, 0.1, 200);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3a3a5c, 0.6);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    scene.add(sun);

    createWorld();
    createCar();
    createTrees();

    window.addEventListener('resize', function() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    return { scene, camera, renderer };
  }

  function createWorld() {
    const a = FIGURE8_SCALE;
    const numSegments = 120;
    const halfW = TRACK_HALF_WIDTH;

    // Ground
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // Generate figure-8 center line
    for (let i = 0; i <= numSegments; i++) {
      const t = (i / numSegments) * 2 * Math.PI;
      const p = lemniscate(t, a);
      trackCenterLine.push(new THREE.Vector3(p.x, 0, p.z));
    }

    // Build road mesh
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < trackCenterLine.length; i++) {
      const p = trackCenterLine[i];
      const next = trackCenterLine[(i + 1) % trackCenterLine.length];
      const tangent = new THREE.Vector3().copy(next).sub(p).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

      const left = new THREE.Vector3().copy(p).add(normal.clone().multiplyScalar(halfW));
      const right = new THREE.Vector3().copy(p).sub(normal.clone().multiplyScalar(halfW));

      positions.push(left.x, -0.02, left.z);
      positions.push(right.x, -0.02, right.z);
      uvs.push(i / trackCenterLine.length, 0);
      uvs.push(i / trackCenterLine.length, 1);
    }

    for (let i = 0; i < trackCenterLine.length - 1; i++) {
      const a2 = i * 2, b = i * 2 + 1;
      const c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      indices.push(a2, c, b);
      indices.push(b, c, d);
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.receiveShadow = true;
    scene.add(road);

    // Road edge markings (thin glowing lines)
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x4488ff,
      emissiveIntensity: 0.15
    });

    for (let i = 0; i < trackCenterLine.length - 1; i++) {
      const p = trackCenterLine[i];
      const next = trackCenterLine[(i + 1) % trackCenterLine.length];
      const tangent = new THREE.Vector3().copy(next).sub(p).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

      for (const side of [-1, 1]) {
        const edgePos = new THREE.Vector3().copy(p).add(
          normal.clone().multiplyScalar(halfW * side)
        );
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.05, 0.4),
          edgeMat
        );
        stripe.position.copy(edgePos);
        stripe.position.y = 0.02;
        const angle = Math.atan2(tangent.x, tangent.z);
        stripe.rotation.y = angle;
        scene.add(stripe);
        walls.push(stripe);
      }
    }

    // Barriers (low walls) along edges
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff4400,
      emissiveIntensity: 0.2
    });
    const wallSegments = [];
    const step = 3;
    for (let i = 0; i < trackCenterLine.length - 1; i += step) {
      const p = trackCenterLine[i];
      const next = trackCenterLine[Math.min(i + step, trackCenterLine.length - 1)];
      const mid = new THREE.Vector3().copy(p).add(next).multiplyScalar(0.5);
      const tangent = new THREE.Vector3().copy(next).sub(p).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
      const segLen = new THREE.Vector3().copy(next).sub(p).length();

      for (const side of [-1, 1]) {
        const wallPos = new THREE.Vector3().copy(mid).add(
          normal.clone().multiplyScalar(halfW * side)
        );
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, WALL_HEIGHT, segLen + 0.1),
          wallMat
        );
        wall.position.copy(wallPos);
        wall.position.y = WALL_HEIGHT / 2;
        const angle = Math.atan2(tangent.x, tangent.z);
        wall.rotation.y = angle;
        wall.castShadow = true;
        scene.add(wall);
        wallSegments.push(wall);
      }
    }
  }

  function createCar() {
    car = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 3.6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2266ff,
      roughness: 0.3,
      metalness: 0.7
    });
    carBody = new THREE.Mesh(bodyGeo, bodyMat);
    carBody.position.y = 0.45;
    carBody.castShadow = true;
    car.add(carBody);

    const cabinGeo = new THREE.BoxGeometry(1.4, 0.35, 1.8);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x3388ff,
      roughness: 0.2,
      metalness: 0.3,
      transparent: true,
      opacity: 0.8
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 0.85, -0.3);
    cabin.castShadow = true;
    car.add(cabin);

    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.9
    });
    const wheelPositions = [
      [-1.0, 0.2, 1.2],
      [1.0, 0.2, 1.2],
      [-1.0, 0.2, -1.2],
      [1.0, 0.2, -1.2]
    ];
    for (const wp of wheelPositions) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12),
        wheelMat
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wp[0], wp[1], wp[2]);
      wheel.castShadow = true;
      car.add(wheel);
    }

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffaa,
      emissive: 0xffffaa,
      emissiveIntensity: 0.5
    });
    for (const hx of [-0.5, 0.5]) {
      const hl = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        headlightMat
      );
      hl.position.set(hx, 0.35, 1.85);
      car.add(hl);
    }

    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      emissive: 0xff2200,
      emissiveIntensity: 0.3
    });
    for (const tx of [-0.5, 0.5]) {
      const tl = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        taillightMat
      );
      tl.position.set(tx, 0.35, -1.85);
      car.add(tl);
    }

    // Start at right edge of figure-8, facing the track direction
    const start = lemniscate(0, FIGURE8_SCALE);
    car.position.set(start.x, 0, start.z);
    car.rotation.y = 0;
    scene.add(car);
  }

  function createTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 });

    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 25;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const distFromCenter = Math.sqrt(x * x + z * z);
      if (distFromCenter < FIGURE8_SCALE * 0.7) continue;

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 6), trunkMat);
      trunk.position.set(x, 0.75, z);
      trunk.castShadow = true;
      scene.add(trunk);
      trees.push(trunk);

      const foliage = new THREE.Mesh(
        new THREE.SphereGeometry(0.8 + Math.random() * 0.4, 6, 6),
        foliageMat
      );
      foliage.position.set(x, 1.8 + Math.random() * 0.3, z);
      foliage.castShadow = true;
      scene.add(foliage);
      trees.push(foliage);
    }
  }

  function nearestTrackPoint(pos) {
    let minDist = Infinity;
    let nearest = null;
    let idx = 0;
    for (let i = 0; i < trackCenterLine.length; i++) {
      const p = trackCenterLine[i];
      const dx = pos.x - p.x;
      const dz = pos.z - p.z;
      const dist = dx * dx + dz * dz;
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
        idx = i;
      }
    }
    return { point: nearest, dist: Math.sqrt(minDist), index: idx };
  }

  function constrainToTrack(pos, radius) {
    const result = nearestTrackPoint(pos);
    if (!result.point) return false;

    const margin = TRACK_HALF_WIDTH - radius - 0.3;
    if (result.dist > margin) {
      const dir = new THREE.Vector3()
        .copy(pos)
        .sub(result.point)
        .normalize();
      pos.x = result.point.x + dir.x * margin;
      pos.z = result.point.z + dir.z * margin;
      return true;
    }
    return false;
  }

  function updateCarPhysics(deltaTime, action, steerNorm) {
    currentAction = action;
    currentSteering = steerNorm;

    if (action === 'FORWARD') {
      velocity = Math.min(velocity + ACCELERATION * deltaTime * 60, MAX_SPEED);
    } else if (action === 'REVERSE') {
      velocity = Math.max(velocity - ACCELERATION * deltaTime * 60, -MAX_REVERSE_SPEED);
    } else {
      if (Math.abs(velocity) < FRICTION * deltaTime * 60) {
        velocity = 0;
      } else {
        velocity -= Math.sign(velocity) * FRICTION * deltaTime * 60;
      }
    }

    if (Math.abs(velocity) > 0.01) {
      const turnFactor = (Math.abs(velocity) / MAX_SPEED) * STEERING_SPEED * deltaTime * 60;
      car.rotation.y += steerNorm * turnFactor;
    }

    const forwardX = Math.sin(car.rotation.y);
    const forwardZ = Math.cos(car.rotation.y);
    car.position.x += forwardX * velocity * deltaTime * 60;
    car.position.z += forwardZ * velocity * deltaTime * 60;

    constrainToTrack(car.position, 0.5);

    if (velocity !== 0) {
      let tilt = steerNorm * 0.08 * Math.min(Math.abs(velocity) / MAX_SPEED, 1);
      car.rotation.z = tilt;
    } else {
      car.rotation.z *= 0.9;
    }
  }

  function updateCamera() {
    const behind = new THREE.Vector3(0, 4, 8);
    const target = new THREE.Vector3(0, 1.5, -5);

    const carQuat = car.quaternion.clone();
    const behindWorld = behind.clone().applyQuaternion(carQuat).add(car.position);
    const targetWorld = target.clone().applyQuaternion(carQuat).add(car.position);

    camera.position.lerp(behindWorld, 0.08);
    camera.lookAt(targetWorld);
  }

  function getState() {
    return {
      velocity: velocity,
      speed: Math.abs(velocity),
      maxSpeed: MAX_SPEED,
      score: score,
      action: currentAction,
      steering: currentSteering
    };
  }

  function reset() {
    const start = lemniscate(0, FIGURE8_SCALE);
    car.position.set(start.x, 0, start.z);
    car.rotation.set(0, 0, 0);
    velocity = 0;
    score = 0;
  }

  function render() {
    const delta = Math.min(clock.getDelta(), 0.05);
    updateCamera();
    renderer.render(scene, camera);
    return delta;
  }

  return {
    init,
    updateCarPhysics,
    render,
    getState,
    reset,
    getScene: () => scene,
    getCamera: () => camera,
    getRenderer: () => renderer
  };
})();
