const UIModule = (function() {

  let overlayCanvas, overlayCtx;
  let fpsHistory = [];
  let lastFpsTime = 0;
  let fps = 0;
  let frameCount = 0;

  function init() {
    overlayCanvas = document.getElementById('overlay-canvas');
    overlayCtx = overlayCanvas.getContext('2d');

    const resizeOverlay = () => {
      const container = document.getElementById('webcam-container');
      overlayCanvas.width = container.clientWidth;
      overlayCanvas.height = container.clientHeight;
    };
    window.addEventListener('resize', resizeOverlay);
    resizeOverlay();
  }

  function drawSkeleton(landmarks) {
    if (!overlayCtx) return;
    const w = overlayCanvas.width;
    const h = overlayCanvas.height;

    overlayCtx.clearRect(0, 0, w, h);

    if (!landmarks) return;

    const scale = (point) => ({
      x: point.x * w,
      y: point.y * h
    });

    const ls = scale(landmarks.leftShoulder);
    const rs = scale(landmarks.rightShoulder);
    const le = scale(landmarks.leftElbow);
    const re = scale(landmarks.rightElbow);
    const lw = scale(landmarks.leftWrist);
    const rw = scale(landmarks.rightWrist);

    // Torso
    overlayCtx.beginPath();
    overlayCtx.moveTo(ls.x, ls.y);
    overlayCtx.lineTo(rs.x, rs.y);
    overlayCtx.strokeStyle = '#00ff88';
    overlayCtx.lineWidth = 3;
    overlayCtx.stroke();

    // Left arm
    overlayCtx.beginPath();
    overlayCtx.moveTo(ls.x, ls.y);
    overlayCtx.lineTo(le.x, le.y);
    overlayCtx.lineTo(lw.x, lw.y);
    overlayCtx.strokeStyle = '#00ff88';
    overlayCtx.lineWidth = 3;
    overlayCtx.stroke();

    // Right arm
    overlayCtx.beginPath();
    overlayCtx.moveTo(rs.x, rs.y);
    overlayCtx.lineTo(re.x, re.y);
    overlayCtx.lineTo(rw.x, rw.y);
    overlayCtx.strokeStyle = '#00ff88';
    overlayCtx.lineWidth = 3;
    overlayCtx.stroke();

    // Virtual steering line (bold, highlighted)
    overlayCtx.beginPath();
    overlayCtx.moveTo(lw.x, lw.y);
    overlayCtx.lineTo(rw.x, rw.y);
    overlayCtx.strokeStyle = '#ff4400';
    overlayCtx.lineWidth = 6;
    overlayCtx.shadowColor = '#ff4400';
    overlayCtx.shadowBlur = 12;
    overlayCtx.stroke();
    overlayCtx.shadowBlur = 0;

    // Joint circles
    const joints = [
      { pos: ls, color: '#00ff88' },
      { pos: rs, color: '#00ff88' },
      { pos: le, color: '#00ff88' },
      { pos: re, color: '#00ff88' },
      { pos: lw, color: '#ff4400' },
      { pos: rw, color: '#ff4400' }
    ];

    for (const j of joints) {
      overlayCtx.beginPath();
      overlayCtx.arc(j.pos.x, j.pos.y, 5, 0, Math.PI * 2);
      overlayCtx.fillStyle = j.color;
      overlayCtx.fill();
      overlayCtx.strokeStyle = '#ffffff';
      overlayCtx.lineWidth = 1.5;
      overlayCtx.stroke();
    }
  }

  function updateHUD(state) {
    const speedEl = document.getElementById('hud-speed');
    const steeringEl = document.getElementById('hud-steering');
    const armDistEl = document.getElementById('hud-armdist');
    const actionEl = document.getElementById('hud-action');
    const fpsEl = document.getElementById('hud-fps');
    const scoreEl = document.getElementById('hud-score');

    if (!state) return;

    const speedVal = Math.round(state.speed * 100);
    if (speedEl) speedEl.textContent = speedVal;

    const steerDeg = Math.round(state.steering * 45);
    const steerSign = steerDeg > 0 ? '+' : '';
    if (steeringEl) steeringEl.textContent = steerSign + steerDeg + '°';

    if (armDistEl) armDistEl.textContent = state.armDistance.toFixed(2);
    if (actionEl) actionEl.textContent = state.action || 'STOP';
    if (scoreEl) scoreEl.textContent = state.score || 0;
    if (fpsEl) fpsEl.textContent = fps;
  }

  function updateFPS(timestamp) {
    frameCount++;
    if (timestamp - lastFpsTime >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastFpsTime = timestamp;
    }
  }

  function showError(visible) {
    const banner = document.getElementById('error-banner');
    if (banner) {
      if (visible) {
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
  }

  return {
    init,
    drawSkeleton,
    updateHUD,
    updateFPS,
    showError
  };
})();
