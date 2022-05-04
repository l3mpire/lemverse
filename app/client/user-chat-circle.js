const linearLerp = (start, end, amt) => (1 - amt) * start + amt * end;
const lerpAmount = 0.5;
const circleOffset = { x: 0, y: -35 };
const distanceBeforeTeleport = 100;

userChatCircle = {
  chatCircle: undefined,

  destroy() {
    this.chatCircle?.destroy();
    this.chatCircle = undefined;
  },

  init(container) {
    if (this.chatCircle) return;
    this.chatCircle = container.add.circle(0, 0, userProximitySensor.nearDistance);
    this.chatCircle.setStrokeStyle(1.5, 0xFFFFFF);
    this.chatCircle.setDepth(99998);
    this.chatCircle.visible = false;
  },

  update(playerX, playerY, camera) {
    if (!this.chatCircle.visible) return;

    let x = playerX + circleOffset.x;
    let y = playerY + circleOffset.y;

    const newPositionDistance = Math.hypot(this.chatCircle.x - x, this.chatCircle.y - y);
    if (newPositionDistance < distanceBeforeTeleport) {
      x = linearLerp(this.chatCircle.x, x, lerpAmount);
      y = linearLerp(this.chatCircle.y, y, lerpAmount);
    }

    this.chatCircle.setPosition(x, y);
    this.chatCircle.setRadius(userProximitySensor.nearDistance * camera.zoom);
  },

  visible(value) {
    this.chatCircle.visible = value;
  },
};
