import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.createTankTexture('player-tank', '#f59e0b', '#fbbf24', '#fef3c7');
    this.createTankTexture('enemy-tank', '#b91c1c', '#ef4444', '#fee2e2');
    this.createTankTexture('enemy-fast', '#c2410c', '#f97316', '#ffedd5');
    this.createTankTexture('enemy-heavy', '#5b21b6', '#a78bfa', '#f5f3ff');
    this.createTankTexture('enemy-sniper', '#075985', '#38bdf8', '#f0f9ff');
    this.createWallTexture('brick', '#9a3412', '#c2410c');
    this.createWallTexture('steel', '#64748b', '#cbd5e1');
    this.createBaseTexture();
    this.createBulletTexture();
    this.createSparkTexture();
    this.createPowerUpTexture('powerup-shield', '#0891b2', 'shield');
    this.createPowerUpTexture('powerup-speed', '#f59e0b', 'speed');
    this.createPowerUpTexture('powerup-triple', '#8b5cf6', 'triple');
    this.createPowerUpTexture('powerup-repair', '#16a34a', 'repair');

    this.scene.start('MenuScene');
  }

  createTankTexture(key, bodyColor, trackColor, turretColor) {
    const texture = this.textures.createCanvas(key, 32, 32);
    const context = texture.getContext();

    context.clearRect(0, 0, 32, 32);
    context.fillStyle = trackColor;
    context.fillRect(2, 3, 6, 26);
    context.fillRect(24, 3, 6, 26);

    context.fillStyle = bodyColor;
    context.fillRect(8, 5, 16, 22);

    context.fillStyle = turretColor;
    context.fillRect(13, 8, 6, 17);
    context.fillRect(14, 0, 4, 10);

    context.strokeStyle = '#111827';
    context.lineWidth = 2;
    context.strokeRect(3, 4, 26, 24);
    texture.refresh();
  }

  createWallTexture(key, baseColor, highlightColor) {
    const texture = this.textures.createCanvas(key, 32, 32);
    const context = texture.getContext();

    context.clearRect(0, 0, 32, 32);
    context.fillStyle = baseColor;
    context.fillRect(0, 0, 32, 32);

    context.fillStyle = highlightColor;
    context.fillRect(1, 1, 14, 6);
    context.fillRect(17, 1, 14, 6);
    context.fillRect(1, 9, 30, 6);
    context.fillRect(1, 17, 14, 6);
    context.fillRect(17, 17, 14, 6);
    context.fillRect(1, 25, 30, 6);

    context.strokeStyle = '#3f2519';
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, 31, 31);
    texture.refresh();
  }

  createBaseTexture() {
    const texture = this.textures.createCanvas('base', 32, 32);
    const context = texture.getContext();

    context.clearRect(0, 0, 32, 32);
    context.fillStyle = '#374151';
    context.fillRect(2, 2, 28, 28);
    context.fillStyle = '#f8fafc';
    context.beginPath();
    context.moveTo(16, 5);
    context.lineTo(20, 13);
    context.lineTo(28, 14);
    context.lineTo(22, 20);
    context.lineTo(24, 28);
    context.lineTo(16, 24);
    context.lineTo(8, 28);
    context.lineTo(10, 20);
    context.lineTo(4, 14);
    context.lineTo(12, 13);
    context.closePath();
    context.fill();
    context.strokeStyle = '#111827';
    context.lineWidth = 2;
    context.strokeRect(1, 1, 30, 30);
    texture.refresh();
  }

  createBulletTexture() {
    const texture = this.textures.createCanvas('bullet', 8, 12);
    const context = texture.getContext();

    context.clearRect(0, 0, 8, 12);
    context.fillStyle = '#fde68a';
    context.fillRect(1, 3, 6, 7);
    context.fillStyle = '#f97316';
    context.fillRect(2, 1, 4, 3);
    texture.refresh();
  }

  createSparkTexture() {
    const texture = this.textures.createCanvas('spark', 4, 4);
    const context = texture.getContext();

    context.clearRect(0, 0, 4, 4);
    context.fillStyle = '#fbbf24';
    context.fillRect(0, 0, 4, 4);
    texture.refresh();
  }

  createPowerUpTexture(key, color, icon) {
    const texture = this.textures.createCanvas(key, 28, 28);
    const context = texture.getContext();

    context.clearRect(0, 0, 28, 28);
    context.fillStyle = color;
    context.beginPath();
    context.arc(14, 14, 13, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#f8fafc';
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = '#f8fafc';

    if (icon === 'shield') {
      context.beginPath();
      context.moveTo(14, 5);
      context.lineTo(21, 8);
      context.lineTo(20, 16);
      context.lineTo(14, 23);
      context.lineTo(8, 16);
      context.lineTo(7, 8);
      context.closePath();
      context.fill();
    }

    if (icon === 'speed') {
      context.beginPath();
      context.moveTo(16, 4);
      context.lineTo(9, 15);
      context.lineTo(14, 15);
      context.lineTo(12, 24);
      context.lineTo(20, 12);
      context.lineTo(15, 12);
      context.closePath();
      context.fill();
    }

    if (icon === 'repair') {
      context.fillRect(12, 6, 4, 16);
      context.fillRect(6, 12, 16, 4);
    }

    if (icon === 'triple') {
      context.fillRect(6, 12, 5, 5);
      context.fillRect(12, 12, 5, 5);
      context.fillRect(18, 12, 5, 5);
    }

    texture.refresh();
  }
}