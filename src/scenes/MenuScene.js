import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game.js';
import { readHighScore } from '../config/highScore.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b1120).setOrigin(0);
    this.createGrid();

    this.add
      .image(GAME_WIDTH / 2, 178, 'player-tank')
      .setScale(3)
      .setAngle(-90);

    this.add
      .text(GAME_WIDTH / 2, 280, 'PHASER 坦克大战', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '46px',
        fontStyle: 'bold',
        color: '#f9fafb',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 330, '阶段 5-6：敌人 AI 与完整胜负流程', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    const highScore = readHighScore();

    if (highScore > 0) {
      this.add
        .text(GAME_WIDTH / 2, 570, `最高分: ${highScore}`, {
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#fbbf24',
        })
        .setOrigin(0.5);
    }

    const startButton = this.createButton(400, 420, '开始游戏', () => this.startGame());
    startButton.setInteractive({ useHandCursor: true });

    this.add
      .text(GAME_WIDTH / 2, 494, '方向键 / WASD 移动　空格射击　P 暂停', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 532, '点击开始按钮，或按 Enter / Space 键', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '16px',
        color: '#64748b',
      })
      .setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', this.startGame, this);
    this.input.keyboard.once('keydown-SPACE', this.startGame, this);
  }

  createGrid() {
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1e293b, 0.7);

    for (let x = 0; x <= GAME_WIDTH; x += 32) {
      grid.lineBetween(x, 0, x, GAME_HEIGHT);
    }

    for (let y = 0; y <= GAME_HEIGHT; y += 32) {
      grid.lineBetween(0, y, GAME_WIDTH, y);
    }
  }

  createButton(x, y, label, callback) {
    const background = this.add
      .rectangle(x, y, 220, 56, 0xf59e0b)
      .setStrokeStyle(3, 0xfbbf24);

    const text = this.add
      .text(x, y, label, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#111827',
      })
      .setOrigin(0.5);

    background.on('pointerover', () => background.setFillStyle(0xfbbf24));
    background.on('pointerout', () => background.setFillStyle(0xf59e0b));
    background.on('pointerdown', callback);

    return background;
  }

  startGame() {
    this.scene.start('GameScene', {
      levelIndex: 0,
      score: 0,
      levelStartScore: 0,
    });
  }
}