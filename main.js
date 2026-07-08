(function() {

  let isRunning = false;
  let trackingLost = false;

  async function init() {
    const video = document.getElementById('webcam');
    if (!video) {
      console.error('Webcam video element not found');
      return;
    }

    UIModule.init();

    await PoseModule.initialize(video, {
      onTrackingLost: () => {
        trackingLost = true;
        UIModule.showError(true);
      },
      onFrame: (landmarks, results) => {
        trackingLost = false;
        UIModule.showError(false);
      }
    });

    const container = document.getElementById('game-container');
    GameModule.init(container);

    isRunning = true;
    gameLoop(performance.now());
  }

  function gameLoop(timestamp) {
    if (!isRunning) return;

    UIModule.updateFPS(timestamp);

    const landmarks = PoseModule.getLandmarks();

    ControllerModule.update(landmarks);

    const steeringNorm = ControllerModule.getSteeringNormalized();
    const speedAction = ControllerModule.getSpeedAction();
    const armDist = ControllerModule.getArmDistance();

    if (trackingLost || !PoseModule.isPlayerDetected()) {
      GameModule.updateCarPhysics(1 / 60, 'STOP', 0);
    } else {
      GameModule.updateCarPhysics(1 / 60, speedAction, steeringNorm);
    }

    const delta = GameModule.render();

    const gameState = GameModule.getState();
    gameState.armDistance = armDist;
    gameState.action = ControllerModule.getCombinedState();

    UIModule.drawSkeleton(landmarks);
    UIModule.updateHUD(gameState);

    requestAnimationFrame(gameLoop);
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => {
      console.error('Initialization error:', err);
      UIModule.showError(true);
      document.getElementById('error-banner').textContent = 'INIT ERROR: ' + err.message;
    });
  });
})();
