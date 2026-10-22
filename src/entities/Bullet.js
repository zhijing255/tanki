import Phaser from 'phaser';

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, frame) {
    super(scene, x, y, texture, frame);
    this.owner = null;
    this.speed = 360;
  }

  fire(x, y, angle, owner) {
    this.owner = owner;
    this.setActive(true).setVisible(true);
    this.setDepth(8);
    this.setAngle(angle);

    if (this.body) {
      this.body.enable = true;
      this.body.reset(x, y);
      this.setCollideWorldBounds(true);
      this.body.onWorldBounds = true;
    }

    const radians = Phaser.Math.DegToRad(angle - 90);
    this.setVelocity(
      Math.cos(radians) * this.speed,
      Math.sin(radians) * this.speed
    );

    return this;
  }
}