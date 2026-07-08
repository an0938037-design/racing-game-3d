(function() {

  let isRunning = false;
  let poseAvailable = false;

  async function init() {
    UIModule.init();

    const container = document.getElementById('game-container');
    GameModule.init(container);

    try {
      const video = document.getElementById('webcam');
      if (video) {
        await PoseModule.initialize(video, {
          onTrackingLost: () => {
            UIModule.showError(true);
            document.getElementById('error-banner').textContent = 'PLAYER NOT DETECTED - USE KEYBOARD (WASD/Arrow keys)';
          },
          onFrame: () => {
            UIModule.showError(false);
          }
        });
        poseAvailable = true;
        console.log('Pose tracking enabled');
      }
    } catch (err) {
      console.warn('Pose/webcam init failed, using keyboard only:', err.message);
      document.getElementById('init-banner').style.display = 'none';
      UIModule.showError(true);
      document.getElementById('error-banner').textContent = 'NO CAMERA - USE KEYBOARD (WASD / Arrow keys)';
      document.getElementById('error-banner').style.background = 'rgba(255, 165, 0, 0.85)';
    }

    document.getElementById('init-banner').style.display = 'none';
    isRunning = true;
    gameLoop(performance.now());
  }

  function gameLoop(timestamp) {
    if (!isRunning) return;

    UIModule.updateFPS(timestamp);

    const landmarks = poseAvailable ? PoseModule.getLandmarks() : null;

    ControllerModule.update(landmarks);

    const steeringNorm = ControllerModule.getSteeringNormalized();
    const speedAction = ControllerModule.getSpeedAction();
    const armDist = ControllerModule.getArmDistance();

    GameModule.updateCarPhysics(1 / 60, speedAction, steeringNorm);

    GameModule.render();

    const gameState = GameModule.getState();
    gameState.armDistance = armDist;
    gameState.action = ControllerModule.getCombinedState();

    if (landmarks) {
      UIModule.drawSkeleton(landmarks);
    }
    UIModule.updateHUD(gameState);

    requestAnimationFrame(gameLoop);
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => {
      console.error('Fatal error:', err);
    });
  });
})();
