import Phaser from 'phaser';
import { ENEMY_TYPES } from '../config/enemyTypes.js';

const DIRECTIONS = ['up', 'down', 'left', 'right'];
const OPPOSITE_DIRECTION = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export default class EnemyTank extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, texture, frame) {
    super(scene, x, y, texture, frame);
    this.speed = 110;
    this.direction = 'down';
    this.nextTurnTime = 0;
    this.nextFireTime = 0;
    this.fireRequested = false;
    this.previousDirection = null;
    this.lastDirectionChangeTime = 0;
    this.turnDelay = [900, 1800];
    this.initialFireDelay = [3000, 5000];
    this.fireDelay = [1300, 2300];
  }

  spawn(x, y, time, config = {}, typeConfig = ENEMY_TYPES.normal) {
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
    this.previousDirection = null;
    this.lastDirectionChangeTime = 0;
    this.enemyType = typeConfig.id;
    this.health = typeConfig.health;
    this.scoreValue = typeConfig.score;
    this.setAlpha(1);
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

    const sceneChoice = this.scene.chooseEnemyDirection?.(
      this,
      time,
      candidates
    );
    const reverseDirection = OPPOSITE_DIRECTION[this.direction];
    const nonReverseCandidates = candidates.filter(
      (direction) => direction !== reverseDirection
    );
    let nextDirection = sceneChoice;

    if (
      nextDirection === reverseDirection &&
      nonReverseCandidates.length > 0
    ) {
      nextDirection = null;
    }

    if (!nextDirection || !candidates.includes(nextDirection)) {
      const preferredDirections = nonReverseCandidates.filter(
        (direction) => this.scene.isDirectionOpen?.(this, direction) !== false
      );

      if (preferredDirections.length > 0) {
        nextDirection = Phaser.Utils.Array.GetRandom(preferredDirections);
      } else if (nonReverseCandidates.length > 0) {
        nextDirection = Phaser.Utils.Array.GetRandom(nonReverseCandidates);
      } else {
        nextDirection = Phaser.Utils.Array.GetRandom(candidates);
      }
    }

    this.setDirection(nextDirection, time);
  }

  setDirection(direction, time) {
    if (direction !== this.direction) {
      this.previousDirection = this.direction;
      this.lastDirectionChangeTime = time;
    }

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

  takeHit() {
    this.health -= 1;
    this.setAlpha(0.45);

    this.scene.time.delayedCall(80, () => {
      if (this.active) {
        this.setAlpha(1);
      }
    });

    return this.health <= 0;
  }
}