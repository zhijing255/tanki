import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game.js';

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  init(data) {
    this.won = Boolean(data.won);
    this.levelComplete = Boolean(data.levelComplete);
    this.levelIndex = Number(data.levelIndex) || 0;
    this.nextLevelIndex = Number(data.nextLevelIndex) || this.levelIndex + 1;
    this.restartScore = Number(data.restartScore) || 0;
    this.score = Number(data.score) || 0;
    this.highScore = Number(data.highScore) || 0;
    this.reason =
      data.reason ||
      (this.levelComplete
        ? '下一关敌人更多、速度更快'
        : this.won
          ? '全部关卡已完成'
          : '战斗结束');
  }

  create() {
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, this.won ? 0x06251b : 0x25090f)
      .setOrigin(0);

    const title = this.levelComplete
      ? `第 ${this.levelIndex + 1} 关完成`
      : this.won
        ? '全部关卡完成'
        : this.reason === '基地被摧毁'
          ? '基地失守'
          : '战斗失败';

    this.add
      .text(GAME_WIDTH / 2, 180, title, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: this.levelComplete ? '50px' : '54px',
        fontStyle: 'bold',
        color: this.won ? '#86efac' : '#fca5a5',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 248, this.reason, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '21px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        310,
        `得分: ${this.score}　最高分: ${this.highScore}`,
        {
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#fde68a',
        }
      )
      .setOrigin(0.5);

    const primaryLabel = this.levelComplete
      ? '进入下一关'
      : this.won
        ? '重新挑战'
        : '重试本关';

    const primaryButton = this.createButton(
      400,
      398,
      primaryLabel,
      () => this.startFromResult()
    );
    const menuButton = this.createButton(
      400,
      478,
      '返回菜单',
      () => this.scene.start('MenuScene')
    );

    primaryButton.setInteractive({ useHandCursor: true });
    menuButton.setInteractive({ useHandCursor: true });

    this.input.keyboard.once('keydown-ENTER', () => this.startFromResult());
    this.input.keyboard.once('keydown-ESC', () =>
      this.scene.start('MenuScene')
    );
  }

  startFromResult() {
    if (this.levelComplete) {
      this.scene.start('GameScene', {
        levelIndex: this.nextLevelIndex,
        score: this.score,
        levelStartScore: this.score,
      });
      return;
    }

    if (this.won) {
      this.scene.start('GameScene', {
        levelIndex: 0,
        score: 0,
        levelStartScore: 0,
      });
      return;
    }

    this.scene.start('GameScene', {
      levelIndex: this.levelIndex,
      score: this.restartScore,
      levelStartScore: this.restartScore,
    });
  }

  createButton(x, y, label, callback) {
    const background = this.add
      .rectangle(x, y, 240, 54, this.won ? 0x22c55e : 0xef4444)
      .setStrokeStyle(3, this.won ? 0x86efac : 0xfca5a5);

    this.add
      .text(x, y, label, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#111827',
      })
      .setOrigin(0.5);

    background.on('pointerover', () => background.setAlpha(0.85));
    background.on('pointerout', () => background.setAlpha(1));
    background.on('pointerdown', callback);

    return background;
  }
}