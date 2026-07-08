const ControllerModule = (function() {

  let steeringAngleDeg = 0;
  let steeringNormalized = 0;
  let speedAction = 'STOP';
  let armDistance = 0;
  let combinedState = 'STOP';

  const DEAD_ZONE_DEG = 10;
  const MAX_STEER_DEG = 45;
  const FORWARD_THRESHOLD = 0.65;
  const REVERSE_THRESHOLD = 0.45;

  function dist3D(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  function update(landmarks) {
    if (!landmarks) {
      steeringAngleDeg = 0;
      steeringNormalized = 0;
      speedAction = 'STOP';
      armDistance = 0;
      combinedState = 'STOP';
      return;
    }

    const lw = landmarks.leftWrist;
    const rw = landmarks.rightWrist;
    const ls = landmarks.leftShoulder;
    const rs = landmarks.rightShoulder;

    if (!lw || !rw || !ls || !rs) {
      steeringAngleDeg = 0;
      steeringNormalized = 0;
      speedAction = 'STOP';
      armDistance = 0;
      combinedState = 'STOP';
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

    // --- Arm Distance ---
    const dLeft = dist3D(ls, lw);
    const dRight = dist3D(rs, rw);
    armDistance = (dLeft + dRight) / 2;

    // --- State Machine ---
    if (armDistance > FORWARD_THRESHOLD) {
      speedAction = 'FORWARD';
    } else if (armDistance < REVERSE_THRESHOLD) {
      speedAction = 'REVERSE';
    } else {
      speedAction = 'STOP';
    }

    // --- Combined State ---
    let dir = '';
    if (steeringNormalized < -0.05) {
      dir = 'LEFT';
    } else if (steeringNormalized > 0.05) {
      dir = 'RIGHT';
    }
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
