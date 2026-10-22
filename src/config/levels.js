export const LEVEL_WIDTH = 25;
export const LEVEL_HEIGHT = 18;

const WALL = '#';
const STEEL = 'S';
const EMPTY = '.';
const PLAYER = 'P';
const BASE = 'B';
const ENEMY = 'E';

function createEmptyGrid() {
  const grid = Array.from({ length: LEVEL_HEIGHT }, () =>
    Array.from({ length: LEVEL_WIDTH }, () => EMPTY)
  );

  for (let x = 0; x < LEVEL_WIDTH; x += 1) {
    grid[0][x] = WALL;
    grid[LEVEL_HEIGHT - 1][x] = WALL;
  }

  for (let y = 0; y < LEVEL_HEIGHT; y += 1) {
    grid[y][0] = WALL;
    grid[y][LEVEL_WIDTH - 1] = WALL;
  }

  return grid;
}

function fill(grid, x, y, width, height, value) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      grid[row][column] = value;
    }
  }
}

function finalizeGrid(grid, enemySpawns) {
  grid[16][2] = PLAYER;
  grid[16][12] = BASE;

  enemySpawns.forEach(([x, y]) => {
    grid[y][x] = ENEMY;
  });

  return grid.map((row) => row.join(''));
}

function createLevelOneGrid() {
  const grid = createEmptyGrid();

  fill(grid, 5, 3, 4, 2, WALL);
  fill(grid, 16, 3, 4, 2, WALL);
  fill(grid, 9, 5, 7, 1, STEEL);
  fill(grid, 3, 8, 5, 1, WALL);
  fill(grid, 17, 8, 5, 1, WALL);
  fill(grid, 10, 9, 5, 3, WALL);
  fill(grid, 4, 12, 5, 2, WALL);
  fill(grid, 16, 12, 5, 2, WALL);
  fill(grid, 8, 14, 3, 1, STEEL);
  fill(grid, 14, 14, 3, 1, STEEL);

  return finalizeGrid(grid, [
    [1, 1],
    [12, 1],
    [23, 1],
  ]);
}

function createLevelTwoGrid() {
  const grid = createEmptyGrid();

  fill(grid, 4, 3, 5, 2, WALL);
  fill(grid, 16, 3, 5, 2, WALL);
  fill(grid, 2, 7, 6, 1, WALL);
  fill(grid, 17, 7, 6, 1, WALL);
  fill(grid, 9, 6, 2, 4, STEEL);
  fill(grid, 14, 6, 2, 4, STEEL);
  fill(grid, 4, 11, 5, 2, WALL);
  fill(grid, 16, 11, 5, 2, WALL);
  fill(grid, 10, 13, 5, 1, STEEL);
  fill(grid, 8, 15, 3, 1, WALL);
  fill(grid, 14, 15, 3, 1, WALL);

  return finalizeGrid(grid, [
    [1, 1],
    [6, 1],
    [12, 1],
    [17, 1],
    [23, 1],
    [1, 3],
  ]);
}

function createLevelThreeGrid() {
  const grid = createEmptyGrid();

  fill(grid, 3, 3, 4, 2, WALL);
  fill(grid, 18, 3, 4, 2, WALL);
  fill(grid, 8, 3, 2, 3, STEEL);
  fill(grid, 15, 3, 2, 3, STEEL);
  fill(grid, 2, 7, 7, 1, WALL);
  fill(grid, 16, 7, 7, 1, WALL);
  fill(grid, 10, 7, 5, 4, WALL);
  fill(grid, 4, 10, 4, 2, STEEL);
  fill(grid, 17, 10, 4, 2, STEEL);
  fill(grid, 3, 13, 5, 2, WALL);
  fill(grid, 17, 13, 5, 2, WALL);
  fill(grid, 9, 15, 3, 1, STEEL);
  fill(grid, 13, 15, 3, 1, STEEL);

  return finalizeGrid(grid, [
    [1, 1],
    [6, 1],
    [12, 1],
    [18, 1],
    [23, 1],
    [1, 3],
    [23, 3],
  ]);
}

export const LEVELS = [
  {
    name: '边境防线',
    grid: createLevelOneGrid(),
    enemyTotal: 10,
    maxActiveEnemies: 3,
    enemy: {
      speed: 110,
      turnDelay: [900, 1800],
      initialFireDelay: [3000, 5000],
      fireDelay: [1300, 2300],
    },
    typeWeights: { normal: 0.5, fast: 0.2, heavy: 0.15, sniper: 0.15 },
  },
  {
    name: '钢铁走廊',
    grid: createLevelTwoGrid(),
    enemyTotal: 12,
    maxActiveEnemies: 4,
    enemy: {
      speed: 135,
      turnDelay: [700, 1400],
      initialFireDelay: [2400, 4000],
      fireDelay: [950, 1700],
    },
    typeWeights: { normal: 0.4, fast: 0.25, heavy: 0.2, sniper: 0.15 },
  },
  {
    name: '核心要塞',
    grid: createLevelThreeGrid(),
    enemyTotal: 15,
    maxActiveEnemies: 5,
    enemy: {
      speed: 160,
      turnDelay: [550, 1100],
      initialFireDelay: [2000, 3400],
      fireDelay: [750, 1400],
    },
    typeWeights: { normal: 0.3, fast: 0.3, heavy: 0.2, sniper: 0.2 },
  },
];

export const LEVEL_GRID = LEVELS[0].grid;

export const LEVEL_TOKENS = {
  wall: WALL,
  steel: STEEL,
  empty: EMPTY,
  player: PLAYER,
  base: BASE,
  enemy: ENEMY,
};