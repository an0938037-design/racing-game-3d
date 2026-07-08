const GameModule = (function() {

  let scene, camera, renderer;
  let car, carBody;
  let clock;
  let road;
  let walls = [];
  let coins = [];
  let obstacles = [];
  let trees = [];
  let laneMarkers = [];

  const ROAD_WIDTH = 12;
  const ROAD_LENGTH = 160;
  const HALF_WALL = 0.5;
  const WALL_HEIGHT = 1.5;
  const COIN_RADIUS = 0.5;
  const OBSTACLE_RADIUS = 0.8;

  const MAX_SPEED = 1.2;
  const MAX_REVERSE_SPEED = 0.5;
  const ACCELERATION = 0.025;
  const FRICTION = 0.015;
  const STEERING_SPEED = 0.04;

  let velocity = 0;
  let score = 0;
  let currentAction = 'STOP';
  let currentSteering = 0;
  let coinSpinAngle = 0;

  function init(container) {
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.006);

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
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    scene.add(sun);

    createWorld();
    createCar();
    createCoins();
    createObstacles();
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
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.9
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.8
    });
    road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, 0);
    road.receiveShadow = true;
    scene.add(road);

    const laneMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.6
    });
    for (let z = -ROAD_LENGTH / 2 + 2; z < ROAD_LENGTH / 2 - 2; z += 6) {
      const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 3),
        laneMat
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(0, 0.01, z);
      scene.add(marker);
      laneMarkers.push(marker);
    }

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      roughness: 0.5,
      emissive: 0x661111,
      emissiveIntensity: 0.3
    });
    const halfLen = ROAD_LENGTH / 2 + 2;
    const halfWid = ROAD_WIDTH / 2;

    function addWall(x, z, sx, sz) {
      const geo = new THREE.BoxGeometry(sx, WALL_HEIGHT, sz);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, WALL_HEIGHT / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      walls.push({
        mesh: mesh,
        minX: x - sx / 2,
        maxX: x + sx / 2,
        minZ: z - sz / 2,
        maxZ: z + sz / 2
      });
    }

    addWall(0, -halfLen, ROAD_WIDTH + 2, 0.5);
    addWall(0, halfLen, ROAD_WIDTH + 2, 0.5);
    addWall(-halfWid - 1, 0, 0.5, ROAD_LENGTH + 4);
    addWall(halfWid + 1, 0, 0.5, ROAD_LENGTH + 4);

    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      emissive: 0xffffff,
      emissiveIntensity: 0.1
    });
    for (let z = -halfLen + 2; z < halfLen - 2; z += 2) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 1.0, 0.8),
        stripeMat
      );
      stripe.position.set(0, 1.0, z);
      scene.add(stripe);
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

    car.position.set(0, 0, 20);
    car.rotation.y = Math.PI;
    scene.add(car);
  }

  function createCoins() {
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0xffaa00,
      emissiveIntensity: 0.2
    });

    for (let i = 0; i < 20; i++) {
      const coin = new THREE.Mesh(
        new THREE.TorusGeometry(COIN_RADIUS, 0.15, 12, 20),
        coinMat
      );
      const x = (Math.random() - 0.5) * (ROAD_WIDTH - 2);
      const z = (Math.random() - 0.5) * (ROAD_LENGTH - 10);
      coin.position.set(x, 1.2, z);
      coin.rotation.x = Math.PI / 2;
      coin.castShadow = true;
      scene.add(coin);
      coins.push({
        mesh: coin,
        collected: false,
        respawnTimer: 0
      });
    }
  }

  function createObstacles() {
    const obsMat = new THREE.MeshStandardMaterial({
      color: 0xff3333,
      roughness: 0.6,
      emissive: 0x881111,
      emissiveIntensity: 0.2
    });

    for (let i = 0; i < 8; i++) {
      const obs = new THREE.Mesh(
        new THREE.CylinderGeometry(OBSTACLE_RADIUS, OBSTACLE_RADIUS, 1.2, 12),
        obsMat
      );
      const x = (Math.random() - 0.5) * (ROAD_WIDTH - 2.5);
      const z = (Math.random() - 0.5) * (ROAD_LENGTH - 10);
      obs.position.set(x, 0.6, z);
      obs.castShadow = true;
      scene.add(obs);
      obstacles.push(obs);
    }
  }

  function createTrees() {
    for (let i = 0; i < 30; i++) {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
      const foliageMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 });

      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * (ROAD_WIDTH / 2 + 1.5 + Math.random() * 4);
      const z = (Math.random() - 0.5) * (ROAD_LENGTH - 5);

      if (Math.abs(x) < ROAD_WIDTH / 2 + 1) continue;

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 6), trunkMat);
      trunk.position.set(x, 0.75, z);
      trunk.castShadow = true;
      scene.add(trunk);
      trees.push(trunk);

      const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.8 + Math.random() * 0.4, 6, 6), foliageMat);
      foliage.position.set(x, 1.8 + Math.random() * 0.3, z);
      foliage.castShadow = true;
      scene.add(foliage);
      trees.push(foliage);
    }
  }

  function checkWallCollision(pos, radius) {
    const halfWid = ROAD_WIDTH / 2;
    const halfLen = ROAD_LENGTH / 2;
    const margin = radius + 0.3;

    let collided = false;

    if (pos.x > halfWid - margin) {
      pos.x = halfWid - margin;
      collided = true;
    }
    if (pos.x < -halfWid + margin) {
      pos.x = -halfWid + margin;
      collided = true;
    }
    if (pos.z > halfLen - margin) {
      pos.z = halfLen - margin;
      collided = true;
    }
    if (pos.z < -halfLen + margin) {
      pos.z = -halfLen + margin;
      collided = true;
    }

    return collided;
  }

  function checkCoinCollision() {
    const carPos = car.position;
    const collectDist = 1.5;

    for (const coin of coins) {
      if (coin.collected) continue;
      const dx = carPos.x - coin.mesh.position.x;
      const dz = carPos.z - coin.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < collectDist) {
        coin.collected = true;
        coin.mesh.visible = false;
        coin.respawnTimer = 120;
        score += 10;
      }
    }
  }

  function checkObstacleCollision() {
    const carPos = car.position;
    const hitDist = 1.2;

    for (const obs of obstacles) {
      const dx = carPos.x - obs.position.x;
      const dz = carPos.z - obs.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < hitDist) {
        const awayX = carPos.x - obs.position.x;
        const awayZ = carPos.z - obs.position.z;
        const len = Math.sqrt(awayX * awayX + awayZ * awayZ);
        if (len > 0.001) {
          car.position.x += (awayX / len) * 0.5;
          car.position.z += (awayZ / len) * 0.5;
        }
        velocity *= -0.3;
        return true;
      }
    }
    return false;
  }

  function respawnCoins() {
    for (const coin of coins) {
      if (coin.collected) {
        coin.respawnTimer--;
        if (coin.respawnTimer <= 0) {
          coin.mesh.position.x = (Math.random() - 0.5) * (ROAD_WIDTH - 2);
          coin.mesh.position.z = (Math.random() - 0.5) * (ROAD_LENGTH - 10);
          coin.collected = false;
          coin.mesh.visible = true;
        }
      }
    }
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
      const turnFactor = (velocity / MAX_SPEED) * STEERING_SPEED * deltaTime * 60;
      car.rotation.y += steerNorm * turnFactor;
    }

    const forwardX = Math.sin(car.rotation.y);
    const forwardZ = Math.cos(car.rotation.y);
    car.position.x += forwardX * velocity * deltaTime * 60;
    car.position.z += forwardZ * velocity * deltaTime * 60;

    checkWallCollision(car.position, 0.5);

    if (velocity !== 0) {
      let tilt = steerNorm * 0.08 * Math.min(Math.abs(velocity) / MAX_SPEED, 1);
      car.rotation.z = tilt;
    } else {
      car.rotation.z *= 0.9;
    }

    checkCoinCollision();
    checkObstacleCollision();
    respawnCoins();

    coinSpinAngle += 0.03 * deltaTime * 60;
    for (const coin of coins) {
      if (!coin.collected) {
        coin.mesh.rotation.z = coinSpinAngle;
        coin.mesh.position.y = 1.2 + Math.sin(coinSpinAngle * 2) * 0.15;
      }
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
    car.position.set(0, 0, 20);
    car.rotation.set(0, Math.PI, 0);
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
