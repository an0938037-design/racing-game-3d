const PoseModule = (function() {

  const SMOOTHING_WINDOW = 5;
  const LANDMARK_KEYS = [
    'leftShoulder', 'rightShoulder',
    'leftElbow', 'rightElbow',
    'leftWrist', 'rightWrist'
  ];
  const LANDMARK_IDS = [11, 12, 13, 14, 15, 16];

  let pose = null;
  let camera = null;
  let isTracking = false;
  let trackingLostCount = 0;
  const TRACKING_LOST_THRESHOLD = 10;

  let history = {};
  for (let key of LANDMARK_KEYS) {
    history[key] = [];
  }

  let currentLandmarks = null;
  let onTrackingLostCallback = null;
  let onFrameCallback = null;

  function smoothLandmark(key, newPoint) {
    history[key].push({ x: newPoint.x, y: newPoint.y, z: newPoint.z });
    if (history[key].length > SMOOTHING_WINDOW) {
      history[key].shift();
    }
    const len = history[key].length;
    if (len === 0) return newPoint;
    let sx = 0, sy = 0, sz = 0;
    for (let i = 0; i < len; i++) {
      sx += history[key][i].x;
      sy += history[key][i].y;
      sz += history[key][i].z;
    }
    return { x: sx / len, y: sy / len, z: sz / len, visibility: newPoint.visibility };
  }

  function onResults(results) {
    if (results.poseLandmarks && results.poseLandmarks.length > 0) {
      trackingLostCount = 0;
      if (!isTracking) {
        isTracking = true;
      }
      const landmarks = results.poseLandmarks;
      const extracted = {};
      for (let i = 0; i < LANDMARK_IDS.length; i++) {
        const id = LANDMARK_IDS[i];
        const key = LANDMARK_KEYS[i];
        const raw = landmarks[id];
        extracted[key] = smoothLandmark(key, raw);
      }
      currentLandmarks = extracted;
      if (onFrameCallback) onFrameCallback(extracted, results);
    } else {
      trackingLostCount++;
      if (trackingLostCount >= TRACKING_LOST_THRESHOLD && isTracking) {
        isTracking = false;
        currentLandmarks = null;
        if (onTrackingLostCallback) onTrackingLostCallback();
      }
    }
  }

  async function initialize(videoElement, config) {
    if (config) {
      if (config.onTrackingLost) onTrackingLostCallback = config.onTrackingLost;
      if (config.onFrame) onFrameCallback = config.onFrame;
    }

    pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5
    });

    pose.onResults(onResults);

    camera = new Camera(videoElement, {
      onFrame: async () => {
        try {
          await pose.send({ image: videoElement });
        } catch (e) {
          console.error('Pose send error:', e);
        }
      },
      width: 640,
      height: 480
    });

    await camera.start();
    return true;
  }

  function getLandmarks() {
    return currentLandmarks;
  }

  function getRawLandmarkById(id) {
    if (!currentLandmarks) return null;
    const idx = LANDMARK_IDS.indexOf(id);
    if (idx === -1) return null;
    return currentLandmarks[LANDMARK_KEYS[idx]];
  }

  function isPlayerDetected() {
    return isTracking && currentLandmarks !== null;
  }

  function stop() {
    if (camera) {
      camera.stop();
    }
    if (pose) {
      pose.close();
    }
  }

  return {
    initialize,
    getLandmarks,
    getRawLandmarkById,
    isPlayerDetected,
    stop
  };
})();
