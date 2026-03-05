class Bullet {
  constructor(x, y, vx, vy, isPlayer, color = null) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.isPlayer = isPlayer;
    this.color = color;
    this.active = true;

    if (isPlayer) {
      this.w = 4;
      this.h = 14;
    } else {
      this.w = 6;
      this.h = 8;
    }
  }

  get hitbox() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    // Deactivate if out of bounds
    if (this.y < -30 || this.y > CONFIG.HEIGHT + 30 ||
        this.x < -30 || this.x > CONFIG.WIDTH + 30) {
      this.active = false;
    }
  }

  draw(ctx) {
    if (this.isPlayer) {
      this.drawPlayerBullet(ctx);
    } else {
      this.drawEnemyBullet(ctx);
    }
  }

  drawPlayerBullet(ctx) {
    const x = this.x, y = this.y;
    const color = this.color || '#4af';

    // Core
    ctx.save();
    const grad = ctx.createLinearGradient(x, y - this.h / 2, x, y + this.h / 2);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawEnemyBullet(ctx) {
    const x = this.x, y = this.y;
    const color = this.color || '#f44';

    ctx.save();

    const grad = ctx.createRadialGradient(x, y, 0, x, y, this.w);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.4, color);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, this.w / 2 + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class BulletManager {
  constructor() {
    this.playerBullets = [];
    this.enemyBullets = [];
  }

  addPlayerBullet(x, y, vx = 0, vy = -CONFIG.PLAYER_BULLET_SPEED, color = null) {
    this.playerBullets.push(new Bullet(x, y, vx, vy, true, color));
  }

  addEnemyBullet(x, y, vx, vy, color = null) {
    this.enemyBullets.push(new Bullet(x, y, vx, vy, false, color));
  }

  update() {
    this.playerBullets = this.playerBullets.filter(b => { b.update(); return b.active; });
    this.enemyBullets  = this.enemyBullets.filter(b => { b.update(); return b.active; });
  }

  draw(ctx) {
    for (const b of this.playerBullets) b.draw(ctx);
    for (const b of this.enemyBullets)  b.draw(ctx);
  }

  clear() {
    this.playerBullets = [];
    this.enemyBullets  = [];
  }
}
