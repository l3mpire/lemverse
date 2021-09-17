const linearLerp = (start, end, amt) => (1 - amt) * start + amt * end;
const lerpAmount = 0.5;

userChatCircle = {
  chatCircle: undefined,

  destroy() {
    this.chatCircle?.destroy();
    this.chatCircle = undefined;
  },

  init(container) {
    if (this.chatCircle) return;
    this.chatCircle = container.add.circle(0, 0, userProximitySensor.nearDistance);
    this.chatCircle.setStrokeStyle(1.5, 0xFF0000);
    this.chatCircle.setDepth(99998);
    this.chatCircle.visible = false;
  },

  update(x, y) {
    const wasVisible = this.chatCircle.visible;

    const callsCount = _.keys(calls).length;
    const remoteCallsCount = _.keys(remoteCalls).length;
    this.chatCircle.visible = userProximitySensor.nearUsersCount() > 0 && callsCount + remoteCallsCount > 0;
    if (callsCount !== remoteCallsCount) this.chatCircle.setStrokeStyle(1.5, 0xFF0000);
    else this.chatCircle.setStrokeStyle(1.5, 0xFFFFFF);

    if (this.chatCircle.visible) {
      if (wasVisible) {
        x = linearLerp(this.chatCircle.x, x, lerpAmount);
        y = linearLerp(this.chatCircle.y, y, lerpAmount);
      }

      this.chatCircle.setPosition(x, y);
    }
  },
};
