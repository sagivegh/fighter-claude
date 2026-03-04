const CONFIG = {
  // Canvas
  WIDTH: 480,
  HEIGHT: 720,

  // Player
  PLAYER_SPEED: 5,
  PLAYER_BULLET_SPEED: 12,
  PLAYER_SHOOT_RATE: 8,       // frames between shots
  PLAYER_MAX_LIVES: 3,
  PLAYER_INVINCIBLE_TIME: 180, // frames of invincibility after hit
  PLAYER_START_X: 240,
  PLAYER_START_Y: 600,

  // Power system
  POWER_MAX: 5,
  POWER_SHOOT_RATES: [8, 6, 5, 4, 3], // shoot rate per power level

  // Enemies
  ENEMY_BULLET_SPEED: 4,
  SCORE_PER_KILL: 100,
  SCORE_BOSS_KILL: 2000,

  // Levels
  MAX_LEVEL: 8,
  LEVEL_KILL_THRESHOLD: 30,   // enemies to kill to progress (scaled by level)
  BOSS_SPAWN_LEVEL: 5,        // first boss appears at level 5

  // Scrolling
  STAR_LAYERS: 3,
  BG_SCROLL_SPEED: [0.5, 1.0, 2.0],

  // Powerup
  POWERUP_SPEED: 2,
  POWERUP_SPAWN_CHANCE: 0.15,  // chance an enemy drops powerup on death

  // Visual
  EXPLOSION_DURATION: 25,
};
