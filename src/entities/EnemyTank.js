import Phaser from 'phaser';

const DIRECTIONS = ['up', 'down', 'left', 'right'];

export default class EnemyTank extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, frame) {
    super(scene, x, y, texture, frame);
    this.speed = 110;
    this.direction = 'down';
    this.nextTurnTime = 0;
    this.nextFireTime = 0;
    this.fireRequested = false;
    this.turnDelay = [900, 1800];
    this.initialFireDelay = [3000, 5000];
    this.fireDelay = [1300, 2300];
  }

  spawn(x, y, time, config = {}) {
    this.setActive(true).setVisible(true);
    this.setDepth(9);
    this.body.enable = true;
    this.body.reset(x, y);
    this.body.setSize(28, 28).setOffset(2, 2);
    this.setCollideWorldBounds(true);
    this.speed = config.speed ?? this.speed;
    this.turnDelay = config.turnDelay ?? this.turnDelay;
    this.initialFireDelay = config.initialFireDelay ?? this.initialFireDelay;
    this.fireDelay = config.fireDelay ?? this.fireDelay;
    this.fireRequested = false;
    this.chooseDirection(time, false);
    this.nextFireTime = time + Phaser.Math.Between(...this.initialFireDelay);
    return this;
  }

  isBlocked(direction) {
    return Boolean(this.body?.blocked?.[direction]);
  }

  chooseDirection(time, avoidBlocked) {
    let candidates = DIRECTIONS;

    if (avoidBlocked) {
      const openDirections = candidates.filter(
        (direction) => !this.isBlocked(direction)
      );

      if (openDirections.length > 0) {
        candidates = openDirections;
      }
    }

    const nextDirection = Phaser.Utils.Array.GetRandom(candidates);
    this.setDirection(nextDirection, time);
  }

  setDirection(direction, time) {
    this.direction = direction;
    this.nextTurnTime = time + Phaser.Math.Between(...this.turnDelay);

    const angleByDirection = {
      up: 0,
      right: 90,
      down: 180,
      left: -90,
    };

    this.setAngle(angleByDirection[direction]);
    this.applyVelocity();
  }

  applyVelocity() {
    const velocityByDirection = {
      up: { x: 0, y: -this.speed },
      right: { x: this.speed, y: 0 },
      down: { x: 0, y: this.speed },
      left: { x: -this.speed, y: 0 },
    };

    const velocity = velocityByDirection[this.direction];
    this.setVelocity(velocity.x, velocity.y);
  }

  turnAfterCollision(time) {
    this.chooseDirection(time, true);
  }

  updateEnemy(time) {
    if (!this.active) {
      return;
    }

    if (time >= this.nextTurnTime || this.isBlocked(this.direction)) {
      this.chooseDirection(time, true);
    } else {
      this.applyVelocity();
    }

    if (time >= this.nextFireTime) {
      this.fireRequested = true;
      this.nextFireTime = time + Phaser.Math.Between(...this.fireDelay);
    }
  }
}