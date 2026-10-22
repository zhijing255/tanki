import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game.js';

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  init(data) {
    this.won = Boolean(data.won);
    this.reason = data.reason || (this.won ? '全部敌人已被消灭' : '战斗结束');
    this.score = Number(data.score) || 0;
    this.highScore = Number(data.highScore) || 0;
  }

  create() {
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, this.won ? 0x06251b : 0x25090f)
      .setOrigin(0);

    this.add
      .text(GAME_WIDTH / 2, 190, this.won ? '任务完成' : this.reason === '基地被摧毁' ? '基地失守' : '战斗失败', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '56px',
        fontStyle: 'bold',
        color: this.won ? '#86efac' : '#fca5a5',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 258, this.reason, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '22px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        316,
        `得分: ${this.score}　最高分: ${this.highScore}`,
        {
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#fde68a',
        }
      )
      .setOrigin(0.5);

    const retryButton = this.createButton(400, 400, '重新开始', () =>
      this.scene.start('GameScene')
    );
    const menuButton = this.createButton(400, 480, '返回菜单', () =>
      this.scene.start('MenuScene')
    );

    retryButton.setInteractive({ useHandCursor: true });
    menuButton.setInteractive({ useHandCursor: true });

    this.input.keyboard.once('keydown-ENTER', () =>
      this.scene.start('GameScene')
    );
    this.input.keyboard.once('keydown-ESC', () =>
      this.scene.start('MenuScene')
    );
  }

  createButton(x, y, label, callback) {
    const background = this.add
      .rectangle(x, y, 220, 54, this.won ? 0x22c55e : 0xef4444)
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