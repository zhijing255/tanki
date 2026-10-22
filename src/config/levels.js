export const LEVEL_WIDTH = 25;
export const LEVEL_HEIGHT = 18;

const WALL = '#';
const STEEL = 'S';
const EMPTY = '.';
const PLAYER = 'P';
const BASE = 'B';
const ENEMY = 'E';

function createLevelGrid() {
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

  const fill = (x, y, width, height, value) => {
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        grid[row][column] = value;
      }
    }
  };

  fill(5, 3, 4, 2, WALL);
  fill(16, 3, 4, 2, WALL);
  fill(9, 5, 7, 1, STEEL);
  fill(3, 8, 5, 1, WALL);
  fill(17, 8, 5, 1, WALL);
  fill(10, 9, 5, 3, WALL);
  fill(4, 12, 5, 2, WALL);
  fill(16, 12, 5, 2, WALL);
  fill(8, 14, 3, 1, STEEL);
  fill(14, 14, 3, 1, STEEL);

  grid[16][2] = PLAYER;
  grid[16][12] = BASE;
  grid[1][23] = ENEMY;
  grid[1][12] = ENEMY;
  grid[1][1] = ENEMY;

  return grid.map((row) => row.join(''));
}

export const LEVEL_GRID = createLevelGrid();

export const LEVEL_TOKENS = {
  wall: WALL,
  steel: STEEL,
  empty: EMPTY,
  player: PLAYER,
  base: BASE,
  enemy: ENEMY,
};