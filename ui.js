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

      // Estimate middle finger from index-pinky midpoint, slightly extended
      const mid = {
        x: (index.x + pinky.x) / 2 + (index.x - wrist.x) * 0.08,
        y: (index.y + pinky.y) / 2 + (index.y - wrist.y) * 0.08
      };

      // Palm polygon (wrist to finger bases)
      overlayCtx.beginPath();
      overlayCtx.moveTo(wrist.x, wrist.y);
      overlayCtx.lineTo(thumb.x, thumb.y);
      overlayCtx.lineTo(index.x, index.y);
      overlayCtx.lineTo(mid.x, mid.y);
      overlayCtx.lineTo(pinky.x, pinky.y);
      overlayCtx.closePath();
      overlayCtx.fillStyle = 'rgba(255, 200, 50, 0.12)';
      overlayCtx.fill();
      overlayCtx.strokeStyle = 'rgba(255, 200, 50, 0.25)';
      overlayCtx.lineWidth = 1.5;
      overlayCtx.stroke();

      // Bones from wrist to each finger tip
      const bones = [
        { to: thumb, color: '#ffcc00', width: 3 },
        { to: index, color: '#ffcc00', width: 3 },
        { to: mid, color: '#ffcc00', width: 2.5 },
        { to: pinky, color: '#ffcc00', width: 2.5 }
      ];

      for (const b of bones) {
        overlayCtx.beginPath();
        overlayCtx.moveTo(wrist.x, wrist.y);
        overlayCtx.lineTo(b.to.x, b.to.y);
        overlayCtx.strokeStyle = b.color;
        overlayCtx.lineWidth = b.width;
        overlayCtx.stroke();
      }

      // Finger webs (connecting adjacent tips)
      const webLines = [
        { from: thumb, to: index },
        { from: index, to: mid },
        { from: mid, to: pinky }
      ];
      for (const wl of webLines) {
        overlayCtx.beginPath();
        overlayCtx.moveTo(wl.from.x, wl.from.y);
        overlayCtx.lineTo(wl.to.x, wl.to.y);
        overlayCtx.strokeStyle = 'rgba(255, 200, 50, 0.4)';
        overlayCtx.lineWidth = 1.5;
        overlayCtx.stroke();
      }

      // Joint circles at finger tips
      const tips = [thumb, index, mid, pinky];
      for (const t of tips) {
        overlayCtx.beginPath();
        overlayCtx.arc(t.x, t.y, 4, 0, Math.PI * 2);
        overlayCtx.fillStyle = '#ffdd44';
        overlayCtx.fill();
        overlayCtx.strokeStyle = '#ffffff';
        overlayCtx.lineWidth = 1.5;
        overlayCtx.stroke();
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
