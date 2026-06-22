export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  COLLIDED = 'COLLIDED',
  GAMEOVER = 'GAMEOVER',
  PAUSED = 'PAUSED'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export enum Theme {
  DAY = 'DAY',
  NIGHT = 'NIGHT',
  CYBERPUNK = 'CYBERPUNK'
}

export enum BirdSkin {
  RETRO = 'RETRO',
  PHOENIX = 'PHOENIX',
  ROBO = 'ROBO',
  BAT = 'BAT'
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  type: 'feather' | 'trail' | 'star' | 'dust';
}

export interface Pipe {
  x: number;
  width: number;
  topHeight: number;
  bottomY: number;
  passed: boolean;
  speedY?: number; // For moving pipes in Hard mode
  dirY?: number;   // Moving pipe direction (-1 or 1)
  rangeY?: [number, number]; // Limits of moving up/down
}

export interface HighScore {
  name: string;
  score: number;
  difficulty: Difficulty;
  theme: Theme;
  skin: BirdSkin;
  date: string;
}

export interface GameStats {
  totalGames: number;
  highestScore: number;
  totalFlaps: number;
  totalPipesCleared: number;
}
