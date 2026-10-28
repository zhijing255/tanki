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
    this.maxBaseHealth = this.levelConfig.baseHealth;
    this.baseHealth = this.maxBaseHealth;
    this.baseAlive = true;
    this.gameOver = false;
    this.isPaused = false;
    this.introActive = false;
    this.invulnerableUntil = 0;
    this.touchControlsEnabled =
      new URLSearchParams(globalThis.location?.search ?? '').get('touch') ===
        '1' ||
      Boolean(this.sys.game.device?.input?.touch) ||
      (globalThis.navigator?.maxTouchPoints ?? 0) > 0;
    this.touchInput = {
      up: false,
      down: false,
      left: false,
      right: false,
      fire: false,
    };
    this.aiReadyAt = this.time.now + 6000;
    this.siegeSlotIndex = 0;
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
    this.createTouchControls();

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
    this.showLevelIntro();
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
      this.player,
      this.enemies,
      this.handlePlayerEnemyCollision,
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

  createTouchControls() {
    if (!this.touchControlsEnabled) {
      return;
    }

    this.input.addPointer(3);
    this.touchControls = [];

    const dpadBackground = this.add
      .circle(95, 525, 78, 0x0f172a, 0.55)
      .setDepth(39);
    this.touchControls.push({
      background: dpadBackground,
      text: null,
      isInput: false,
    });

    const upButton = this.createTouchControl(
      95,
      462,
      29,
      '▲',
      0x334155,
      () => {
        this.touchInput.up = true;
      },
      () => {
        this.touchInput.up = false;
      }
    );
    const downButton = this.createTouchControl(
      95,
      588,
      29,
      '▼',
      0x334155,
      () => {
        this.touchInput.down = true;
      },
      () => {
        this.touchInput.down = false;
      }
    );
    const leftButton = this.createTouchControl(
      32,
      525,
      29,
      '◀',
      0x334155,
      () => {
        this.touchInput.left = true;
      },
      () => {
        this.touchInput.left = false;
      }
    );
    const rightButton = this.createTouchControl(
      158,
      525,
      29,
      '▶',
      0x334155,
      () => {
        this.touchInput.right = true;
      },
      () => {
        this.touchInput.right = false;
      }
    );
    const fireButton = this.createTouchControl(
      710,
      540,
      45,
      '开火',
      0xdc2626,
      () => {
        this.touchInput.fire = true;
      },
      () => {
        this.touchInput.fire = false;
      },
      21
    );
    const pauseButton = this.createTouchControl(
      760,
      32,
      22,
      'Ⅱ',
      0x475569,
      () => this.togglePause(),
      () => {},
      18
    );

    this.touchControls.push(
      upButton,
      downButton,
      leftButton,
      rightButton,
      fireButton,
      pauseButton
    );
    this.setTouchControlsVisible(false);
  }

  createTouchControl(
    x,
    y,
    radius,
    label,
    color,
    onDown,
    onUp,
    fontSize = 28
  ) {
    const background = this.add
      .circle(x, y, radius, color, 0.72)
      .setDepth(40)
      .setStrokeStyle(2, 0xf8fafc, 0.55)
      .setInteractive({ useHandCursor: true });

    const textObject = this.add
      .text(x, y, label, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: `${fontSize}px`,
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0.5)
      .setDepth(41)
      .setAlpha(0.9);

    background.on('pointerdown', () => {
      background.setFillStyle(0xf8fafc, 0.4);
      onDown();
    });

    const release = () => {
      background.setFillStyle(color, 0.72);
      onUp();
    };

    background.on('pointerup', release);
    background.on('pointerout', release);
    background.on('pointerupoutside', release);

    return { background, text: textObject, isInput: true };
  }

  setTouchControlsVisible(visible) {
    if (!visible) {
      this.touchInput = {
        up: false,
        down: false,
        left: false,
        right: false,
        fire: false,
      };
    }

    (this.touchControls ?? []).forEach((control) => {
      control.background.setVisible(visible);

      if (control.background.input) {
        control.background.input.enabled = visible;
      }

      if (control.text) {
        control.text.setVisible(visible);
      }
    });
  }
  createHud() {
    this.add
      .rectangle(0, 0, GAME_WIDTH, HUD_HEIGHT, 0x0f172a)
      .setOrigin(0)
      .setDepth(29);

    const hudStyle = {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '15px',
      color: '#e2e8f0',
    };

    this.levelText = this.add
      .text(16, 8, '', hudStyle)
      .setDepth(30);
    this.scoreText = this.add
      .text(16, 34, '', {
        ...hudStyle,
        color: '#fbbf24',
        fontStyle: 'bold',
      })
      .setDepth(30);
    this.enemyText = this.add
      .text(145, 8, '', hudStyle)
      .setDepth(30);
    this.lifeText = this.add
      .text(145, 34, '', {
        ...hudStyle,
        color: '#fca5a5',
      })
      .setDepth(30);
    this.baseText = this.add
      .text(300, 8, '', hudStyle)
      .setDepth(30);

    this.baseBarBackground = this.add
      .rectangle(300, 36, 130, 14, 0x334155)
      .setOrigin(0)
      .setDepth(30);
    this.baseBarFill = this.add
      .rectangle(302, 38, 126, 10, 0x22c55e)
      .setOrigin(0)
      .setDepth(31);

    this.bulletText = this.add
      .text(460, 8, '', hudStyle)
      .setDepth(30);
    this.powerupHud = this.add
      .text(460, 34, '', {
        ...hudStyle,
        fontSize: '13px',
        color: '#67e8f9',
      })
      .setDepth(30);

    this.enemyLegend = this.add
      .text(GAME_WIDTH - 16, 50, '普通 红　快速 橙　重装 紫　狙击 蓝', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '11px',
        color: '#94a3b8',
      })
      .setOrigin(1, 0)
      .setDepth(30);

    this.pauseOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x020617, 0.78)
      .setOrigin(0)
      .setDepth(50)
      .setVisible(false);

    this.pauseText = this.add
      .text(GAME_WIDTH / 2, 230, '游戏暂停', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
        color: '#f9fafb',
      })
      .setOrigin(0.5)
      .setDepth(51)
      .setVisible(false);

    this.pauseResumeButton = this.createPauseButton(
      '继续游戏',
      340,
      0x22c55e,
      () => this.togglePause()
    );
    this.pauseRestartButton = this.createPauseButton(
      '重新开始本关',
      414,
      0xf59e0b,
      () => this.restartCurrentLevel()
    );
    this.pauseMenuButton = this.createPauseButton(
      '返回菜单',
      488,
      0xef4444,
      () => this.scene.start('MenuScene')
    );
    this.setPauseButtonsVisible(false);
  }

  createPauseButton(label, y, color, callback) {
    const background = this.add
      .rectangle(GAME_WIDTH / 2, y, 240, 52, color)
      .setStrokeStyle(3, 0xf8fafc)
      .setDepth(51)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    const textObject = this.add
      .text(GAME_WIDTH / 2, y, label, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '21px',
        fontStyle: 'bold',
        color: '#111827',
      })
      .setOrigin(0.5)
      .setDepth(52)
      .setVisible(false);

    background.on('pointerover', () => background.setAlpha(0.85));
    background.on('pointerout', () => background.setAlpha(1));
    background.on('pointerdown', callback);

    return { background, text: textObject };
  }

  setPauseButtonsVisible(visible) {
    [
      this.pauseResumeButton,
      this.pauseRestartButton,
      this.pauseMenuButton,
    ].forEach((button) => {
      button.background.setVisible(visible);
      button.text.setVisible(visible);

      if (button.background.input) {
        button.background.input.enabled = visible;
      }
    });
  }

  restartCurrentLevel() {
    this.scene.start('GameScene', {
      levelIndex: this.levelIndex,
      score: this.levelStartScore,
      levelStartScore: this.levelStartScore,
    });
  }

  showLevelIntro() {
    if (this.gameOver) {
      return;
    }

    this.introActive = true;
    this.isPaused = true;
    this.physics.pause();
    this.setTouchControlsVisible(false);

    const overlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x020617, 0.88)
      .setOrigin(0)
      .setDepth(60);
    const levelTitle = this.add
      .text(GAME_WIDTH / 2, 258, `第 ${this.levelIndex + 1} 关`, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '58px',
        fontStyle: 'bold',
        color: '#fbbf24',
      })
      .setOrigin(0.5)
      .setDepth(61);
    const levelName = this.add
      .text(GAME_WIDTH / 2, 330, this.levelConfig.name, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '30px',
        color: '#f8fafc',
      })
      .setOrigin(0.5)
      .setDepth(61);
    const readyText = this.add
      .text(GAME_WIDTH / 2, 390, '准备战斗', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setDepth(61);

    const targets = [overlay, levelTitle, levelName, readyText];

    this.tweens.add({
      targets,
      alpha: 0,
      delay: 850,
      duration: 350,
      onComplete: () => {
        targets.forEach((target) => target.destroy());

        if (!this.gameOver) {
          this.introActive = false;
          this.isPaused = false;
          this.physics.resume();
          this.setTouchControlsVisible(this.touchControlsEnabled);
        }
      },
    });
  }

  addScore(points, x, y) {
    this.score += points;

    if (!Number.isFinite(x) || !Number.isFinite(y) || points <= 0) {
      return;
    }

    const floatingText = this.add
      .text(x, y - 24, `+${points}`, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#fde68a',
        stroke: '#111827',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(45);

    this.tweens.add({
      targets: floatingText,
      y: floatingText.y - 34,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => floatingText.destroy(),
    });
  }

  updateHud(time = 0) {
    const remainingEnemies = this.enemyTotal - this.enemiesDefeated;
    const baseRatio = this.maxBaseHealth > 0
      ? this.baseHealth / this.maxBaseHealth
      : 0;
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

    this.levelText.setText(
      `关卡 ${this.levelIndex + 1}/${LEVELS.length}`
    );
    this.scoreText.setText(`分数 ${this.score}`);
    this.enemyText.setText(`敌人 ${remainingEnemies}`);
    this.lifeText.setText(`生命 ${this.lives}`);
    this.baseText.setText(
      this.baseAlive
        ? `基地 ${this.baseHealth}/${this.maxBaseHealth}`
        : '基地 失守'
    );
    this.bulletText.setText(
      `子弹 ${this.activePlayerBullets}/${this.playerBulletLimit}`
    );
    this.powerupHud.setText(
      activeEffects.length > 0 ? activeEffects.join('　') : '道具 无'
    );

    this.baseBarFill.width = Math.max(0, 126 * baseRatio);

    if (this.baseHealth <= 0 || this.baseHealth === 1) {
      this.baseBarFill.setFillStyle(0xef4444);
    } else if (
      this.baseHealth <= Math.ceil(this.maxBaseHealth / 2)
    ) {
      this.baseBarFill.setFillStyle(0xf59e0b);
    } else {
      this.baseBarFill.setFillStyle(0x22c55e);
    }
  }
  spawnPowerUp(x, y) {
    if (this.gameOver || Math.random() > POWERUP_DROP_CHANCE) {
      return;
    }

    const roll = Math.random();
    const texture =
      roll < 0.35
        ? 'powerup-shield'
        : roll < 0.6
          ? 'powerup-speed'
          : roll < 0.8
            ? 'powerup-triple'
            : 'powerup-repair';
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
    this.addScore(50, player.x, player.y);

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

    if (texture === 'powerup-repair' && this.baseAlive) {
      this.baseHealth = this.maxBaseHealth;
      this.base.clearTint();
      this.createExplosion(this.base.x, this.base.y, 0x4ade80);
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

    enemy.role = type.preferredRole;
    enemy.siegeSlot = this.siegeSlotIndex % 4;
    this.siegeSlotIndex += 1;

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

    const playerHasLine = this.hasClearLine(enemy, this.player);
    const baseHasLine = this.hasClearLine(enemy, this.base);

    if (
      enemy.role === 'base' &&
      this.time.now < this.aiReadyAt &&
      baseHasLine &&
      !playerHasLine
    ) {
      return;
    }

    let angle = enemy.angle;

    if (enemy.enemyType === 'sniper') {
      angle = this.getSniperAngle(enemy);
      enemy.setAngle(angle);
    } else if (this.hasClearLine(enemy, this.player)) {
      angle = this.getAimAngle(enemy, this.player);
      enemy.setAngle(angle);
    } else if (this.hasClearLine(enemy, this.base)) {
      angle = this.getAimAngle(enemy, this.base);
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
        this.addScore(10, wall.x, wall.y);
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

    if (wasEnemyBullet) {
      this.damageBase();
    }
  }

  damageBase() {
    if (!this.baseAlive || this.gameOver) {
      return;
    }

    this.baseHealth -= 1;
    this.createExplosion(this.base.x, this.base.y, 0xf97316);
    this.updateBaseHealthVisual();

    if (this.baseHealth <= 0) {
      this.baseHealth = 0;
      this.baseAlive = false;
      this.updateBaseHealthVisual();
      this.endGame(false, '基地被摧毁');
    }
  }

  updateBaseHealthVisual() {
    if (!this.base) {
      return;
    }

    if (this.baseHealth <= 0 || this.baseHealth === 1) {
      this.base.setTint(0xef4444);
      return;
    }

    if (this.baseHealth <= Math.ceil(this.maxBaseHealth / 2)) {
      this.base.setTint(0xf59e0b);
      return;
    }

    this.base.clearTint();
  }

  hitEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active || bullet.owner !== 'player') {
      return;
    }

    this.destroyBullet(bullet);

    if (!enemy.takeHit()) {
      this.addScore(50, enemy.x, enemy.y);
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
    this.addScore(enemy.scoreValue ?? 100, dropX, dropY);

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

  handlePlayerEnemyCollision(player, enemy) {
    if (this.gameOver || !enemy.active) {
      return;
    }

    enemy.turnAfterCollision(this.time.now);
    this.damagePlayer('玩家与敌人坦克相撞', player.x, player.y);
  }

  hitPlayer(bullet, player) {
    if (!bullet.active || this.gameOver) {
      return;
    }

    this.destroyBullet(bullet);
    this.damagePlayer('玩家生命耗尽', player.x, player.y);
  }

  damagePlayer(reason, x, y) {
    if (this.gameOver || this.respawnPending) {
      return false;
    }

    if (this.time.now < this.shieldUntil) {
      this.createExplosion(x, y, 0x67e8f9);
      return false;
    }

    if (this.time.now < this.invulnerableUntil) {
      return false;
    }

    this.createExplosion(x, y, 0xf97316);
    this.lives -= 1;

    if (this.lives <= 0) {
      this.endGame(false, reason);
      return true;
    }

    this.schedulePlayerRespawn();
    return true;
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

  getActorCell(actor) {
    let row = Math.floor((actor.y - HUD_HEIGHT) / TILE_SIZE);
    let column = Math.floor(actor.x / TILE_SIZE);

    if (this.isOpenCell(row, column, true)) {
      return { row, column };
    }

    const blockedDirectionOffsets = {
      up: [1, 0],
      down: [-1, 0],
      left: [0, 1],
      right: [0, -1],
    };

    for (const direction of ['up', 'down', 'left', 'right']) {
      if (!actor.body?.blocked?.[direction]) {
        continue;
      }

      const [rowOffset, columnOffset] =
        blockedDirectionOffsets[direction];
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;

      if (this.isOpenCell(nextRow, nextColumn, true)) {
        return { row: nextRow, column: nextColumn };
      }
    }

    const fallbackOffsets = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (const [rowOffset, columnOffset] of fallbackOffsets) {
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;

      if (this.isOpenCell(nextRow, nextColumn, true)) {
        return { row: nextRow, column: nextColumn };
      }
    }

    return { row, column };
  }

  getCellToken(row, column) {
    if (
      row < 0 ||
      row >= LEVEL_HEIGHT ||
      column < 0 ||
      column >= LEVEL_WIDTH
    ) {
      return LEVEL_TOKENS.wall;
    }

    return this.levelGrid[row][column];
  }

  isOpenCell(row, column, allowBase = false) {
    const token = this.getCellToken(row, column);

    if (
      token === LEVEL_TOKENS.wall ||
      token === LEVEL_TOKENS.steel ||
      (!allowBase && token === LEVEL_TOKENS.base)
    ) {
      return false;
    }

    return true;
  }

  directionBetween(fromRow, fromColumn, toRow, toColumn) {
    if (toRow < fromRow) return 'up';
    if (toRow > fromRow) return 'down';
    if (toColumn < fromColumn) return 'left';
    if (toColumn > fromColumn) return 'right';
    return null;
  }

  hasClearLine(from, to) {
    const fromCell = this.getActorCell(from);
    const toCell = this.getActorCell(to);

    if (
      fromCell.row !== toCell.row &&
      fromCell.column !== toCell.column
    ) {
      return false;
    }

    const rowStep = Math.sign(toCell.row - fromCell.row);
    const columnStep = Math.sign(toCell.column - fromCell.column);
    let row = fromCell.row + rowStep;
    let column = fromCell.column + columnStep;

    while (row !== toCell.row || column !== toCell.column) {
      if (!this.isOpenCell(row, column, false)) {
        return false;
      }

      row += rowStep;
      column += columnStep;
    }

    return true;
  }

  findDirectionToward(enemy, target, allowBase = false) {
    const start = this.getActorCell(enemy);
    const goal = this.getActorCell(target);
    const totalCells = LEVEL_WIDTH * LEVEL_HEIGHT;
    const start_index = start.row * LEVEL_WIDTH + start.column;
    const goal_index = goal.row * LEVEL_WIDTH + goal.column;

    if (
      start_index < 0 ||
      start_index >= totalCells ||
      goal_index < 0 ||
      goal_index >= totalCells ||
      start_index === goal_index
    ) {
      return null;
    }

    const visited = new Uint8Array(totalCells);
    const firstDirections = new Array(totalCells).fill(null);
    const queue = [start_index];
    let cursor = 0;
    visited[start_index] = 1;

    const offsets = [
      ['up', -1, 0],
      ['down', 1, 0],
      ['left', 0, -1],
      ['right', 0, 1],
    ];

    while (cursor < queue.length) {
      const currentIndex = queue[cursor];
      cursor += 1;
      const currentRow = Math.floor(currentIndex / LEVEL_WIDTH);
      const currentColumn = currentIndex % LEVEL_WIDTH;

      for (const [direction, rowOffset, columnOffset] of offsets) {
        const nextRow = currentRow + rowOffset;
        const nextColumn = currentColumn + columnOffset;

        if (
          nextRow < 0 ||
          nextRow >= LEVEL_HEIGHT ||
          nextColumn < 0 ||
          nextColumn >= LEVEL_WIDTH
        ) {
          continue;
        }

        if (!this.isOpenCell(nextRow, nextColumn, allowBase)) {
          continue;
        }

        const nextIndex = nextRow * LEVEL_WIDTH + nextColumn;

        if (visited[nextIndex]) {
          continue;
        }

        visited[nextIndex] = 1;
        firstDirections[nextIndex] =
          firstDirections[currentIndex] ?? direction;
        queue.push(nextIndex);

        if (nextIndex === goal_index) {
          return firstDirections[nextIndex];
        }
      }
    }

    return null;
  }

  isDirectionOpen(enemy, direction) {
    const cell = this.getActorCell(enemy);
    const offsets = {
      up: [-1, 0],
      down: [1, 0],
      left: [0, -1],
      right: [0, 1],
    };
    const [rowOffset, columnOffset] = offsets[direction];

    return this.isOpenCell(
      cell.row + rowOffset,
      cell.column + columnOffset,
      true
    );
  }

  getCellCenter(row, column) {
    return {
      x: column * TILE_SIZE + TILE_SIZE / 2,
      y: HUD_HEIGHT + row * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  getBaseApproachTargets() {
    const baseCell = this.getActorCell(this.base);
    const offsets = [
      [0, -2],
      [0, 2],
      [-2, 0],
      [0, 0],
    ];

    return offsets
      .map(([rowOffset, columnOffset]) => {
        const row = baseCell.row + rowOffset;
        const column = baseCell.column + columnOffset;

        return this.isOpenCell(row, column, true)
          ? this.getCellCenter(row, column)
          : null;
      })
      .filter(Boolean);
  }

  getSiegeTarget(enemy) {
    const targets = this.getBaseApproachTargets();

    if (targets.length === 0) {
      return this.base;
    }

    return targets[enemy.siegeSlot % targets.length];
  }

  findSeparationDirection(enemy, candidates) {
    let nearestEnemy = null;
    let nearestDistance = Infinity;

    this.enemies.getChildren().forEach((otherEnemy) => {
      if (!otherEnemy.active || otherEnemy === enemy) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        otherEnemy.x,
        otherEnemy.y
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEnemy = otherEnemy;
      }
    });

    if (!nearestEnemy || nearestDistance >= 44) {
      return null;
    }

    const escapeDirections = candidates.filter((direction) => {
      if (!this.isDirectionOpen(enemy, direction)) {
        return false;
      }

      const cell = this.getActorCell(enemy);
      const offsets = {
        up: [-1, 0],
        down: [1, 0],
        left: [0, -1],
        right: [0, 1],
      };
      const [rowOffset, columnOffset] = offsets[direction];
      const nextCenter = this.getCellCenter(
        cell.row + rowOffset,
        cell.column + columnOffset
      );
      const nextDistance = Phaser.Math.Distance.Between(
        nextCenter.x,
        nextCenter.y,
        nearestEnemy.x,
        nearestEnemy.y
      );

      return nextDistance > nearestDistance + 6;
    });

    if (escapeDirections.length > 0 && Math.random() < 0.75) {
      return Phaser.Utils.Array.GetRandom(escapeDirections);
    }

    return null;
  }
  chooseEnemyDirection(enemy, time, candidates) {
    if (!this.player || !this.base) {
      return null;
    }

    const separationDirection = this.findSeparationDirection(
      enemy,
      candidates
    );

    if (separationDirection) {
      return separationDirection;
    }

    if (this.hasClearLine(enemy, this.player)) {
      const playerCell = this.getActorCell(this.player);
      const enemyCell = this.getActorCell(enemy);
      return this.directionBetween(
        enemyCell.row,
        enemyCell.column,
        playerCell.row,
        playerCell.column
      );
    }

    const playerDistance = Phaser.Math.Distance.Between(
      enemy.x,
      enemy.y,
      this.player.x,
      this.player.y
    );
    const towardPlayer = this.findDirectionToward(
      enemy,
      this.player,
      false
    );

    if (
      enemy.role === 'hunter' &&
      towardPlayer &&
      candidates.includes(towardPlayer)
    ) {
      return towardPlayer;
    }

    if (
      enemy.role === 'base' &&
      time < this.aiReadyAt
    ) {
      if (
        playerDistance <= 220 &&
        towardPlayer &&
        candidates.includes(towardPlayer)
      ) {
        return towardPlayer;
      }

      const openCandidates = candidates.filter((direction) =>
        this.isDirectionOpen(enemy, direction)
      );

      return openCandidates.length > 0
        ? Phaser.Utils.Array.GetRandom(openCandidates)
        : null;
    }

    if (this.hasClearLine(enemy, this.base)) {
      const baseCell = this.getActorCell(this.base);
      const enemyCell = this.getActorCell(enemy);
      return this.directionBetween(
        enemyCell.row,
        enemyCell.column,
        baseCell.row,
        baseCell.column
      );
    }

    const siegeTarget = this.getSiegeTarget(enemy);
    const targetCell = this.getActorCell(siegeTarget);
    const targetToken = this.getCellToken(
      targetCell.row,
      targetCell.column
    );
    const towardSiege = this.findDirectionToward(
      enemy,
      siegeTarget,
      targetToken === LEVEL_TOKENS.base
    );

    if (towardSiege && candidates.includes(towardSiege)) {
      return towardSiege;
    }

    if (towardPlayer && candidates.includes(towardPlayer)) {
      return towardPlayer;
    }

    const towardBase = this.findDirectionToward(enemy, this.base, true);

    if (towardBase && candidates.includes(towardBase)) {
      return towardBase;
    }

    const openCandidates = candidates.filter((direction) =>
      this.isDirectionOpen(enemy, direction)
    );

    if (openCandidates.length > 0) {
      return Phaser.Utils.Array.GetRandom(openCandidates);
    }

    return null;
  }
  getAimAngle(from, to) {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 90 : -90;
    }

    return deltaY > 0 ? 180 : 0;
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
    if (this.gameOver || this.introActive) {
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
      this.setPauseButtonsVisible(true);
      this.setTouchControlsVisible(false);
      return;
    }

    this.physics.resume();
    this.time.paused = false;
    this.tweens.resumeAll();
    this.anims.resumeAll();
    this.pauseOverlay.setVisible(false);
    this.pauseText.setVisible(false);
    this.setPauseButtonsVisible(false);
    this.setTouchControlsVisible(this.touchControlsEnabled);
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
    this.introActive = false;
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

    const firePressed =
      this.keys.space.isDown || this.touchInput.fire;

    if (
      firePressed &&
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
    const upPressed = up.isDown || w.isDown || this.touchInput.up;
    const downPressed = down.isDown || s.isDown || this.touchInput.down;
    const leftPressed = left.isDown || a.isDown || this.touchInput.left;
    const rightPressed = right.isDown || d.isDown || this.touchInput.right;

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