const UIModule = (function() {

  let overlayCanvas, overlayCtx;
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

  function scale(point, w, h) {
    return { x: point.x * w, y: point.y * h };
  }

  function drawSkeleton(landmarks) {
    if (!overlayCtx) return;
    const w = overlayCanvas.width;
    const h = overlayCanvas.height;

    overlayCtx.clearRect(0, 0, w, h);

    if (!landmarks) return;

    const sc = (p) => scale(p, w, h);

    const ls = sc(landmarks.leftShoulder);
    const rs = sc(landmarks.rightShoulder);
    const le = sc(landmarks.leftElbow);
    const re = sc(landmarks.rightElbow);
    const lw = sc(landmarks.leftWrist);
    const rw = sc(landmarks.rightWrist);

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

    // Main joints (circles)
    const mainJoints = [
      { pos: ls, color: '#00ff88' },
      { pos: rs, color: '#00ff88' },
      { pos: le, color: '#00ff88' },
      { pos: re, color: '#00ff88' },
      { pos: lw, color: '#ff4400' },
      { pos: rw, color: '#ff4400' }
    ];

    for (const j of mainJoints) {
      overlayCtx.beginPath();
      overlayCtx.arc(j.pos.x, j.pos.y, 5, 0, Math.PI * 2);
      overlayCtx.fillStyle = j.color;
      overlayCtx.fill();
      overlayCtx.strokeStyle = '#ffffff';
      overlayCtx.lineWidth = 1.5;
      overlayCtx.stroke();
    }

    // --- Hand skeleton (finger bones) ---
    drawHandSkeleton(landmarks, w, h);
  }

  function drawHandSkeleton(lm, w, h) {
    const hands = [
      { wrist: lm.leftWrist, thumb: lm.leftThumb, index: lm.leftIndex, pinky: lm.leftPinky },
      { wrist: lm.rightWrist, thumb: lm.rightThumb, index: lm.rightIndex, pinky: lm.rightPinky }
    ];

    for (const hand of hands) {
      if (!hand.wrist || !hand.thumb || !hand.index || !hand.pinky) continue;

      const wrist = scale(hand.wrist, w, h);
      const thumb = scale(hand.thumb, w, h);
      const index = scale(hand.index, w, h);
      const pinky = scale(hand.pinky, w, h);

      // Draw finger bones
      const fingers = [
        { from: wrist, to: thumb, color: '#ffcc00' },
        { from: wrist, to: index, color: '#ffcc00' },
        { from: wrist, to: pinky, color: '#ffcc00' },
        { from: thumb, to: index, color: '#ff8800' }
      ];

      for (const f of fingers) {
        overlayCtx.beginPath();
        overlayCtx.moveTo(f.from.x, f.from.y);
        overlayCtx.lineTo(f.to.x, f.to.y);
        overlayCtx.strokeStyle = f.color;
        overlayCtx.lineWidth = 2.5;
        overlayCtx.stroke();
      }

      // Joint circles at finger tips
      const tips = [
        { pos: thumb, color: '#ffcc00' },
        { pos: index, color: '#ffcc00' },
        { pos: pinky, color: '#ffcc00' }
      ];

      for (const t of tips) {
        overlayCtx.beginPath();
        overlayCtx.arc(t.pos.x, t.pos.y, 3.5, 0, Math.PI * 2);
        overlayCtx.fillStyle = t.color;
        overlayCtx.fill();
      }
    }
  }

  function updateHUD(state) {
    const speedEl = document.getElementById('hud-speed');
    const steeringEl = document.getElementById('hud-steering');
    const armDistEl = document.getElementById('hud-armdist');
    const actionEl = document.getElementById('hud-action');
    const fpsEl = document.getElementById('hud-fps');

    if (!state) return;

    const speedVal = Math.round(state.speed * 100);
    if (speedEl) speedEl.textContent = speedVal;

    const steerDeg = Math.round(state.steering * 45);
    const steerSign = steerDeg > 0 ? '+' : '';
    if (steeringEl) steeringEl.textContent = steerSign + steerDeg + '°';

    if (armDistEl) armDistEl.textContent = state.armDistance.toFixed(3);
    if (actionEl) actionEl.textContent = state.action || 'STOP';
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
