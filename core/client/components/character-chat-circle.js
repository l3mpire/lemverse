import Phaser from 'phaser';

const linearLerp = (start, end, amt) => (1 - amt) * start + amt * end;
const lerpAmount = 0.5;
const circleOffset = { x: 0, y: -25 };
const distanceBeforeTeleport = 100;

class CharacterChatCircle extends Phaser.GameObjects.Arc {
  constructor(scene, x, y, radius) {
    super(scene, x, y, radius);

    this.setStrokeStyle(2, 0xFFFFFF);
    this.setDepth(99998);

    scene.add.existing(this);
  }

  updatePosition(targetX, targetY) {
    if (!this.visible) return;

    let x = targetX + circleOffset.x;
    let y = targetY + circleOffset.y;

    const newPositionDistance = Math.hypot(this.x - x, this.y - y);
    if (newPositionDistance < distanceBeforeTeleport) {
      x = linearLerp(this.x, x, lerpAmount);
      y = linearLerp(this.y, y, lerpAmount);
    }

    this.setPosition(x, y);
  }
}

export default CharacterChatCircle;
