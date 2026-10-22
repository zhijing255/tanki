const STORAGE_KEY = 'tank-battle-high-score';

export function readHighScore() {
  try {
    const value = Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score) {
  const highScore = Math.max(readHighScore(), Math.max(0, score));

  try {
    localStorage.setItem(STORAGE_KEY, String(highScore));
  } catch {
    // 游戏仍可正常运行，只是无法保存本地最高分。
  }

  return highScore;
}