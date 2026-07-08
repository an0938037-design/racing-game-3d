const ControllerModule = (function() {

  let steeringAngleDeg = 0;
  let steeringNormalized = 0;
  let speedAction = 'STOP';
  let armDistance = 0;
  let combinedState = 'STOP';

  const DEAD_ZONE_DEG = 10;
  const MAX_STEER_DEG = 45;
  const REVERSE_THRESHOLD = 0.6;
  const FORWARD_THRESHOLD = 1.3;

  const keys = {};

  document.addEventListener('keydown', e => { keys[e.key] = true; });
  document.addEventListener('keyup', e => { keys[e.key] = false; });

  function dist3D(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  function updateFromKeyboard() {
    let steer = 0;
    if (keys['ArrowLeft'] || keys['a']) steer = -1;
    if (keys['ArrowRight'] || keys['d']) steer = 1;

    steeringNormalized = steer;
    steeringAngleDeg = steer * MAX_STEER_DEG;

    if (keys['ArrowUp'] || keys['w']) {
      speedAction = 'FORWARD';
    } else if (keys['ArrowDown'] || keys['s']) {
      speedAction = 'REVERSE';
    } else {
      speedAction = 'STOP';
    }

    let dir = '';
    if (steeringNormalized < -0.05) dir = 'LEFT';
    else if (steeringNormalized > 0.05) dir = 'RIGHT';
    combinedState = dir ? speedAction + '+' + dir : speedAction;

    armDistance = speedAction === 'FORWARD' ? 0.5 : (speedAction === 'REVERSE' ? 0.1 : 0.3);
  }

  function update(landmarks) {
    if (!landmarks) {
      updateFromKeyboard();
      return;
    }

    const lw = landmarks.leftWrist;
    const rw = landmarks.rightWrist;
    const ls = landmarks.leftShoulder;
    const rs = landmarks.rightShoulder;

    if (!lw || !rw || !ls || !rs) {
      updateFromKeyboard();
      return;
    }

    // --- Steering ---
    const dx = rw.x - lw.x;
    const dy = rw.y - lw.y;
    let rawAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    if (Math.abs(rawAngle) < DEAD_ZONE_DEG) {
      steeringAngleDeg = 0;
    } else {
      steeringAngleDeg = Math.max(-MAX_STEER_DEG, Math.min(MAX_STEER_DEG, rawAngle));
    }

    steeringNormalized = steeringAngleDeg / MAX_STEER_DEG;

    // --- Speed via wrist-to-shoulder proximity ---
    // Hands near shoulders = REVERSE, hands far from body = FORWARD
    const dLeft = dist3D(ls, lw);
    const dRight = dist3D(rs, rw);
    const avgDist = (dLeft + dRight) / 2;
    const shoulderWidth = dist3D(ls, rs);
    const normalizedD = shoulderWidth > 0.01 ? avgDist / shoulderWidth : avgDist;

    armDistance = avgDist;

    if (normalizedD < REVERSE_THRESHOLD) {
      speedAction = 'REVERSE';
    } else if (normalizedD > FORWARD_THRESHOLD) {
      speedAction = 'FORWARD';
    } else {
      speedAction = 'STOP';
    }

    // --- Combined State ---
    let dir = '';
    if (steeringNormalized < -0.05) dir = 'LEFT';
    else if (steeringNormalized > 0.05) dir = 'RIGHT';
    combinedState = dir ? speedAction + '+' + dir : speedAction;
  }

  function getSteeringAngleDeg() {
    return steeringAngleDeg;
  }

  function getSteeringNormalized() {
    return steeringNormalized;
  }

  function getSpeedAction() {
    return speedAction;
  }

  function getArmDistance() {
    return armDistance;
  }

  function getCombinedState() {
    return combinedState;
  }

  return {
    update,
    getSteeringAngleDeg,
    getSteeringNormalized,
    getSpeedAction,
    getArmDistance,
    getCombinedState
  };
})();
