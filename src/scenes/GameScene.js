import Phaser from 'phaser';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  HUD_HEIGHT,
  TILE_SIZE,
} from '../config/game.js';
import {
  LEVELS,
  LEVEL_HEIGHT,
  LEVEL_TOKENS,
  LEVEL_WIDTH,
} from '../config/levels.js';
import Bullet from '../entities/Bullet.js';
import { saveHighScore } from '../config/highScore.js';
import EnemyTank from '../entities/EnemyTank.js';
import {
  ENEMY_TYPES,
  chooseEnemyType,
  scaleDelayRange,
} from '../config/enemyTypes.js';

const PLAYER_SPEED = 160;
const MAX_PLAYER_BULLETS = 1;
const POWERUP_DURATION = 8000;
const POWERUP_LIFETIME = 10000;
const POWERUP_DROP_CHANCE = 0.3;
const POWERED_PLAYER_SPEED = 230;
const PLAYER_FIRE_COOLDOWN = 180;
const PLAYER_LIVES = 3;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data = {}) {
    this.levelIndex = Number(data.levelIndex) || 0;
    this.initialScore = Number(data.score) || 0;
    this.levelStartScore =
      Number(data.levelStartScore) || this.initialScore;
  }

  create() {
    this.levelConfig = LEVELS[this.levelIndex] ?? LEVELS[0];
    this.levelGrid = this.levelConfig.grid;
    this.enemyTotal = this.levelConfig.enemyTotal;
    this.maxActiveEnemies = this.levelConfig.maxActiveEnemies;
    this.activePlayerBullets = 0;
    this.lastPlayerFireTime = 0;
    this.score = this.initialScore;
    this.scoreCarry = 0;
    this.highScore = 0;
    this.playerSpeed = PLAYER_SPEED;
    this.playerBulletLimit = MAX_PLAYER_BULLETS;
    this.shieldUntil = 0;
    this.speedUntil = 0;
    this.tripleUntil = 0;
    this.enemiesToSpawn = this.enemyTotal;
    this.enemiesDefeated = 0;
    this.lives = PLAYER_LIVES;
    this.baseAlive = true;
    this.gameOver = false;
    this.isPaused = false;
    this.invulnerableUntil = 0;
    this.respawnPending = false;

    this.physics.world.setBounds(
      0,
      HUD_HEIGHT,
      GAME_WIDTH,
      GAME_HEIGHT - HUD_HEIGHT
    );

    this.walls = this.physics.add.staticGroup();
    this.baseGroup = this.physics.add.staticGroup();
    this.playerBullets = this.physics.add.group({
      classType: Bullet,
      maxSize: 12,
    });
    this.enemyBullets = this.physics.add.group({
      classType: Bullet,
      maxSize: 24,
    });
    this.powerups = this.physics.add.group();
    this.enemies = this.physics.add.group({
      classType: EnemyTank,
      maxSize: this.enemyTotal,
    });
    this.spawnPoints = [];

    this.createBackground();
    this.createLevel();
    this.createPlayer();
    this.createCollisions();
    this.createInput();
    this.createHud();

    for (let index = 0; index < this.maxActiveEnemies; index += 1) {
      this.spawnEnemy();
    }

    this.spawnTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.spawnEnemy,
      callbackScope: this,
    });

    this.physics.world.on('worldbounds', this.handleWorldBounds, this);
    this.events.once('shutdown', this.handleShutdown, this);
  }

  createBackground() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x111827).setOrigin(0);
    this.add
      .rectangle(0, HUD_HEIGHT, GAME_WIDTH, GAME_HEIGHT - HUD_HEIGHT, 0x0b1120)
      .setOrigin(0);

    const grid = this.add.graphics();
    grid.lineStyle(1, 0x172033, 0.9);

    for (let x = 0; x <= GAME_WIDTH; x += TILE_SIZE) {
      grid.lineBetween(x, HUD_HEIGHT, x, GAME_HEIGHT);
    }

    for (let y = HUD_HEIGHT; y <= GAME_HEIGHT; y += TILE_SIZE) {
      grid.lineBetween(0, y, GAME_WIDTH, y);
    }

    this.add.rectangle(0, HUD_HEIGHT, GAME_WIDTH, 2, 0x334155).setOrigin(0);
  }

  createLevel() {
    this.levelGrid.forEach((row, rowIndex) => {
      row.split('').forEach((token, columnIndex) => {
        const x = columnIndex * TILE_SIZE + TILE_SIZE / 2;
        const y = HUD_HEIGHT + rowIndex * TILE_SIZE + TILE_SIZE / 2;

        if (token === LEVEL_TOKENS.wall || token === LEVEL_TOKENS.steel) {
          const texture = token === LEVEL_TOKENS.wall ? 'brick' : 'steel';
          const wall = this.walls.create(x, y, texture).setDepth(5);

          wall.isBoundary =
            rowIndex === 0 ||
            rowIndex === LEVEL_HEIGHT - 1 ||
            columnIndex === 0 ||
            columnIndex === LEVEL_WIDTH - 1;
        }

        if (token === LEVEL_TOKENS.base) {
          this.base = this.baseGroup.create(x, y, 'base').setDepth(5);
        }

        if (token === LEVEL_TOKENS.enemy) {
          const marker = this.add
            .image(x, y, 'enemy-tank')
            .setAlpha(0.35)
            .setDepth(2);

          this.spawnPoints.push({ x, y, marker, used: false });
        }

        if (token === LEVEL_TOKENS.player) {
          this.playerSpawn = { x, y };
        }
      });
    });
  }

  createPlayer() {
    this.player = this.physics.add
      .sprite(this.playerSpawn.x, this.playerSpawn.y, 'player-tank')
      .setDepth(10);

    this.player.body.setSize(28, 28).setOffset(2, 2);
    this.player.setCollideWorldBounds(true);
    this.player.setAngle(0);
  }

  createCollisions() {
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.player, this.baseGroup);

    this.physics.add.collider(
      this.playerBullets,
      this.walls,
      this.hitWall,
      null,
      this
    );
    this.physics.add.collider(
      this.playerBullets,
      this.baseGroup,
      this.hitBase,
      null,
      this
    );
    this.physics.add.collider(
      this.playerBullets,
      this.enemies,
      this.hitEnemy,
      null,
      this
    );

    this.physics.add.collider(
      this.enemyBullets,
      this.walls,
      this.hitWall,
      null,
      this
    );
    this.physics.add.collider(
      this.enemyBullets,
      this.baseGroup,
      this.hitBase,
      null,
      this
    );
    this.physics.add.collider(
      this.enemyBullets,
      this.player,
      this.hitPlayer,
      null,
      this
    );

    this.physics.add.collider(
      this.enemies,
      this.walls,
      this.turnEnemyAfterCollision,
      null,
      this
    );
    this.physics.add.collider(
      this.enemies,
      this.baseGroup,
      this.turnEnemyAfterCollision,
      null,
      this
    );
    this.physics.add.collider(
      this.enemies,
      this.enemies,
      this.turnEnemiesAfterCollision,
      null,
      this
    );
    this.physics.add.overlap(
      this.player,
      this.powerups,
      this.collectPowerUp,
      null,
      this
    );
  }

  createInput() {
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
    });

    this.input.keyboard.on('keydown-P', this.togglePause, this);
    this.input.keyboard.once('keydown-ESC', () =>
      this.scene.start('MenuScene')
    );


  }

  createHud() {
    this.hudText = this.add
      .text(16, 16, '', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '16px',
        color: '#cbd5e1',
      })
      .setDepth(30);

    this.powerupHud = this.add
      .text(16, 40, '道具: 无', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '13px',
        color: '#67e8f9',
      })
      .setDepth(30);

    this.enemyLegend = this.add
      .text(GAME_WIDTH - 16, 40, '普通 红　快速 橙　重装 紫　狙击 蓝', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '13px',
        color: '#94a3b8',
      })
      .setOrigin(1, 0)
      .setDepth(30);

    this.pauseOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x020617, 0.72)
      .setOrigin(0)
      .setDepth(50)
      .setVisible(false);

    this.pauseText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '已暂停\n按 P 继续', {
        align: 'center',
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#f9fafb',
      })
      .setOrigin(0.5)
      .setDepth(51)
      .setVisible(false);
  }

  addScore(points) {
    this.score += points;
  }

  updateHud(time = 0) {
    const remainingEnemies = this.enemyTotal - this.enemiesDefeated;
    const baseStatus = this.baseAlive ? '安全' : '失守';
    const activeEffects = [];

    if (this.shieldUntil > time) {
      activeEffects.push(`护盾 ${Math.ceil((this.shieldUntil - time) / 1000)}s`);
    }

    if (this.speedUntil > time) {
      activeEffects.push(`加速 ${Math.ceil((this.speedUntil - time) / 1000)}s`);
    }

    if (this.tripleUntil > time) {
      activeEffects.push(`三连发 ${Math.ceil((this.tripleUntil - time) / 1000)}s`);
    }

    this.hudText.setText(
      `关卡: ${this.levelIndex + 1}/${LEVELS.length}　分数: ${this.score}　敌人数: ${remainingEnemies}　生命: ${this.lives}　基地: ${baseStatus}　子弹: ${this.activePlayerBullets}/${this.playerBulletLimit}`
    );
    this.powerupHud.setText(
      activeEffects.length > 0 ? activeEffects.join('　') : '道具: 无'
    );
  }

  spawnPowerUp(x, y) {
    if (this.gameOver || Math.random() > POWERUP_DROP_CHANCE) {
      return;
    }

    const roll = Math.random();
    const texture =
      roll < 0.4
        ? 'powerup-shield'
        : roll < 0.7
          ? 'powerup-speed'
          : 'powerup-triple';
    const powerup = this.powerups.create(x, y, texture);

    if (!powerup) {
      return;
    }

    powerup.setDepth(7);
    powerup.body.setSize(26, 26);
    powerup.expireAt = this.time.now + POWERUP_LIFETIME;

    this.tweens.add({
      targets: powerup,
      alpha: { from: 0.65, to: 1 },
      duration: 450,
      yoyo: true,
      repeat: -1,
    });
  }

  collectPowerUp(player, powerup) {
    if (!powerup.active || this.gameOver) {
      return;
    }

    const texture = powerup.texture.key;
    this.tweens.killTweensOf(powerup);
    powerup.disableBody(true, true);
    this.createExplosion(player.x, player.y, 0x67e8f9);
    this.addScore(50);

    if (texture === 'powerup-shield') {
      this.shieldUntil = this.time.now + POWERUP_DURATION;
      this.player.setTint(0x67e8f9);
    }

    if (texture === 'powerup-speed') {
      this.speedUntil = this.time.now + POWERUP_DURATION;
      this.playerSpeed = POWERED_PLAYER_SPEED;
    }

    if (texture === 'powerup-triple') {
      this.tripleUntil = this.time.now + POWERUP_DURATION;
      this.playerBulletLimit = 3;
    }
  }

  updatePowerUpEffects(time) {
    if (this.shieldUntil > 0 && time >= this.shieldUntil) {
      this.shieldUntil = 0;
      this.player.clearTint();
    }

    if (this.speedUntil > 0 && time >= this.speedUntil) {
      this.speedUntil = 0;
      this.playerSpeed = PLAYER_SPEED;
    }

    if (this.tripleUntil > 0 && time >= this.tripleUntil) {
      this.tripleUntil = 0;
      this.playerBulletLimit = MAX_PLAYER_BULLETS;
    }

    this.powerups.getChildren().forEach((powerup) => {
      if (powerup.active && time >= powerup.expireAt) {
        this.tweens.killTweensOf(powerup);
        powerup.disableBody(true, true);
      }
    });
  }

  spawnEnemy() {
    if (
      this.gameOver ||
      this.isPaused ||
      this.enemiesToSpawn <= 0 ||
      this.enemies.countActive(true) >= this.maxActiveEnemies
    ) {
      return;
    }

    const availablePoints = this.spawnPoints.filter((point) => !point.used);
    const point = Phaser.Utils.Array.GetRandom(
      availablePoints.length > 0 ? availablePoints : this.spawnPoints
    );

    if (!point) {
      return;
    }

    const type = chooseEnemyType(this.levelConfig.typeWeights);
    const baseEnemyConfig = this.levelConfig.enemy;
    const enemyConfig = {
      speed: Math.round(baseEnemyConfig.speed * type.speedMultiplier),
      turnDelay: baseEnemyConfig.turnDelay,
      initialFireDelay: scaleDelayRange(
        baseEnemyConfig.initialFireDelay,
        type.fireDelayMultiplier
      ),
      fireDelay: scaleDelayRange(
        baseEnemyConfig.fireDelay,
        type.fireDelayMultiplier
      ),
    };
    const enemy = this.enemies.create(point.x, point.y, type.texture);

    if (!enemy) {
      return;
    }

    enemy.spawn(
      point.x,
      point.y,
      this.time.now,
      enemyConfig,
      type
    );
    point.used = true;
    point.marker.setVisible(false);
    this.enemiesToSpawn -= 1;
  }

  firePlayerBullet() {
    if (this.gameOver || this.isPaused) {
      return;
    }

    if (this.activePlayerBullets >= this.playerBulletLimit) {
      return;
    }

    const angle = this.player.angle;
    const x = this.player.x + Math.cos(Phaser.Math.DegToRad(angle - 90)) * 20;
    const y = this.player.y + Math.sin(Phaser.Math.DegToRad(angle - 90)) * 20;
    const bullet = this.playerBullets.get(x, y, 'bullet');

    if (!bullet) {
      return;
    }

    bullet.fire(x, y, angle, 'player');
    this.activePlayerBullets += 1;
  }

  getSniperAngle(enemy) {
    const deltaX = this.player.x - enemy.x;
    const deltaY = this.player.y - enemy.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 90 : -90;
    }

    return deltaY > 0 ? 180 : 0;
  }

  fireEnemyBullet(enemy) {
    if (this.gameOver || this.isPaused || !enemy.active) {
      return;
    }

    let angle = enemy.angle;

    if (enemy.enemyType === 'sniper') {
      angle = this.getSniperAngle(enemy);
      enemy.setAngle(angle);
    }
    const x = enemy.x + Math.cos(Phaser.Math.DegToRad(angle - 90)) * 20;
    const y = enemy.y + Math.sin(Phaser.Math.DegToRad(angle - 90)) * 20;
    const bullet = this.enemyBullets.get(x, y, 'bullet');

    if (!bullet) {
      return;
    }

    bullet.fire(x, y, angle, 'enemy');
  }

  destroyBullet(bullet) {
    if (!bullet || !bullet.active) {
      return;
    }

    if (bullet.owner === 'player') {
      this.activePlayerBullets = Math.max(0, this.activePlayerBullets - 1);
    }

    this.createExplosion(bullet.x, bullet.y, 0xfbbf24);
    bullet.disableBody(true, true);
    bullet.owner = null;
  }

  hitWall(bullet, wall) {
    if (!bullet.active) {
      return;
    }

    const destroyedByPlayer = bullet.owner === 'player';

    if (wall.texture.key === 'brick' && !wall.isBoundary) {
      this.createExplosion(wall.x, wall.y, 0xf97316);
      wall.destroy();

      if (destroyedByPlayer) {
        this.addScore(10);
      }
    }

    this.destroyBullet(bullet);
  }

  hitBase(bullet) {
    if (!bullet.active) {
      return;
    }

    const wasEnemyBullet = bullet.owner === 'enemy';
    this.destroyBullet(bullet);

    if (wasEnemyBullet && this.baseAlive) {
      this.baseAlive = false;
      this.createExplosion(this.base.x, this.base.y, 0xef4444);
      this.base.setTint(0xef4444);
      this.endGame(false, '基地被摧毁');
    }
  }

  hitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active || bullet.owner !== 'player') {
      return;
    }

    this.destroyBullet(bullet);

    if (!enemy.takeHit()) {
      this.addScore(50);
      this.createExplosion(enemy.x, enemy.y, 0xf8fafc);
      return;
    }

    this.destroyEnemy(enemy);
  }

  destroyEnemy(enemy) {
    if (!enemy.active) {
      return;
    }

    const dropX = enemy.x;
    const dropY = enemy.y;

    this.createExplosion(enemy.x, enemy.y, 0xef4444);
    enemy.disableBody(true, true);
    this.enemiesDefeated += 1;
    this.addScore(enemy.scoreValue ?? 100);

    if (this.enemiesDefeated < this.enemyTotal) {
      this.spawnPowerUp(dropX, dropY);
    }

    if (
      this.enemiesDefeated >= this.enemyTotal &&
      this.enemiesToSpawn === 0 &&
      this.enemies.countActive(true) === 0
    ) {
      this.time.delayedCall(600, () => this.endGame(true, '全部敌人已消灭'));
    }
  }

  hitPlayer(bullet, player) {
    if (!bullet.active || this.gameOver) {
      return;
    }

    this.destroyBullet(bullet);

    if (this.time.now < this.shieldUntil) {
      this.createExplosion(player.x, player.y, 0x67e8f9);
      return;
    }

    if (this.time.now < this.invulnerableUntil) {
      return;
    }

    this.lives -= 1;

    if (this.lives <= 0) {
      this.endGame(false, '玩家生命耗尽');
      return;
    }

    this.schedulePlayerRespawn();
  }

  schedulePlayerRespawn() {
    if (this.respawnPending || this.gameOver) {
      return;
    }

    this.respawnPending = true;
    this.invulnerableUntil = this.time.now + 2000;

    this.time.delayedCall(0, () => {
      if (!this.gameOver) {
        this.respawnPlayer();
      }
    });
  }

  respawnPlayer() {
    this.respawnPending = false;
    this.tweens.killTweensOf(this.player);

    this.player.setActive(true).setVisible(true);
    this.player.setPosition(this.playerSpawn.x, this.playerSpawn.y);
    this.player.body.enable = true;
    this.player.body.moves = true;
    this.player.body.reset(this.playerSpawn.x, this.playerSpawn.y);
    this.player.setVelocity(0, 0);
    this.player.setAngle(0);
    this.player.setAlpha(1);
    this.player.setDepth(10);

    if (this.time.now >= this.shieldUntil) {
      this.player.clearTint();
    }
  }

  turnEnemyAfterCollision(enemy) {
    if (enemy.active) {
      enemy.turnAfterCollision(this.time.now);
    }
  }

  turnEnemiesAfterCollision(enemyA, enemyB) {
    this.turnEnemyAfterCollision(enemyA);
    this.turnEnemyAfterCollision(enemyB);
  }

  togglePause() {
    if (this.gameOver) {
      return;
    }

    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.physics.pause();
      this.time.paused = true;
      this.tweens.pauseAll();
      this.anims.pauseAll();
      this.pauseOverlay.setVisible(true);
      this.pauseText.setVisible(true);
      return;
    }

    this.physics.resume();
    this.time.paused = false;
    this.tweens.resumeAll();
    this.anims.resumeAll();
    this.pauseOverlay.setVisible(false);
    this.pauseText.setVisible(false);
  }

  endGame(won, reason) {
    if (this.gameOver) {
      return;
    }

    this.gameOver = true;
    this.highScore = saveHighScore(this.score);
    this.physics.pause();
    this.player.setVelocity(0, 0);
    this.tweens.pauseAll();

    const isLastLevel = this.levelIndex >= LEVELS.length - 1;
    const levelComplete = won && !isLastLevel;

    this.time.delayedCall(700, () => {
      this.scene.start('ResultScene', {
        won,
        reason,
        score: this.score,
        highScore: this.highScore,
        levelIndex: this.levelIndex,
        nextLevelIndex: Math.min(
          this.levelIndex + 1,
          LEVELS.length - 1
        ),
        levelComplete,
        restartScore: this.levelStartScore,
      });
    });
  }

  handleWorldBounds(body) {
    if (body.gameObject instanceof Bullet && body.gameObject.active) {
      this.destroyBullet(body.gameObject);
    }
  }

  handleShutdown() {
    if (this.physics?.world) {
      this.physics.world.off('worldbounds', this.handleWorldBounds, this);
    }

    if (this.input?.keyboard) {
      this.input.keyboard.off('keydown-P', this.togglePause, this);
    }
    this.activePlayerBullets = 0;
    this.lastPlayerFireTime = 0;
    this.score = 0;
    this.scoreCarry = 0;
    this.highScore = 0;
    this.playerSpeed = PLAYER_SPEED;
    this.playerBulletLimit = MAX_PLAYER_BULLETS;
    this.shieldUntil = 0;
    this.speedUntil = 0;
    this.tripleUntil = 0;
    this.gameOver = false;
    this.isPaused = false;
    this.respawnPending = false;
  }

  createExplosion(x, y, tint) {
    for (let index = 0; index < 8; index += 1) {
      const spark = this.add
        .image(x, y, 'spark')
        .setTint(tint)
        .setDepth(20);

      this.tweens.add({
        targets: spark,
        x: x + Phaser.Math.Between(-26, 26),
        y: y + Phaser.Math.Between(-26, 26),
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(140, 240),
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  update(time, delta) {
    if (!this.isPaused) {
      this.updatePowerUpEffects(time);
    }

    this.updateHud(time);

    if (this.gameOver || this.isPaused) {
      return;
    }

    this.scoreCarry += Math.min(delta, 1000);

    while (this.scoreCarry >= 1000) {
      this.scoreCarry -= 1000;
      this.addScore(1);
    }

    this.activePlayerBullets = this.playerBullets.countActive(true);

    if (
      this.keys.space.isDown &&
      time - this.lastPlayerFireTime >= PLAYER_FIRE_COOLDOWN
    ) {
      this.firePlayerBullet();
      this.lastPlayerFireTime = time;
    }

    this.updatePlayerMovement();

    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) {
        return;
      }

      enemy.updateEnemy(time);

      if (enemy.fireRequested) {
        enemy.fireRequested = false;
        this.fireEnemyBullet(enemy);
      }
    });
  }

  updatePlayerMovement() {
    this.player.setActive(true).setVisible(true);
    this.player.body.enable = true;
    this.player.body.moves = true;

    const { up, down, left, right, w, a, s, d } = this.keys;
    const upPressed = up.isDown || w.isDown;
    const downPressed = down.isDown || s.isDown;
    const leftPressed = left.isDown || a.isDown;
    const rightPressed = right.isDown || d.isDown;

    if (upPressed) {
      this.player.setVelocity(0, -this.playerSpeed);
      this.player.setAngle(0);
      return;
    }

    if (downPressed) {
      this.player.setVelocity(0, this.playerSpeed);
      this.player.setAngle(180);
      return;
    }

    if (leftPressed) {
      this.player.setVelocity(-this.playerSpeed, 0);
      this.player.setAngle(-90);
      return;
    }

    if (rightPressed) {
      this.player.setVelocity(this.playerSpeed, 0);
      this.player.setAngle(90);
      return;
    }

    this.player.setVelocity(0, 0);
  }
}