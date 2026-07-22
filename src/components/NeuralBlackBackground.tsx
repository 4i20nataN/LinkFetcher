import React, { useRef, useEffect } from 'react';

/**
 * NeuralBlackBackground — Dark theme neural network animation.
 *
 * Performance optimizations:
 * 1. Offscreen canvas pre-rendering for node glow textures
 * 2. Spatial grid hashing for O(N*k) neighbor lookups
 * 3. Squared-distance comparisons (no Math.sqrt in hot path)
 * 4. Debounced resize with full node re-seed
 * 5. Frame skipping when document is hidden
 * 6. will-change CSS hint for GPU compositing
 */

const NODE_COUNT = 85;
const CONNECTION_DIST = 140;
const CONNECTION_DIST_SQ = CONNECTION_DIST * CONNECTION_DIST;
const MOUSE_RADIUS = 160;
const MOUSE_RADIUS_SQ = MOUSE_RADIUS * MOUSE_RADIUS;
const BG_COLOR = '#030406';
const VELOCITY = 0.35;
const TWO_PI = Math.PI * 2;
const GLOW_RADIUS_MULT = 4.5;

const COLORS = [
  { rgb: '255, 59, 48', r: 255, g: 59, b: 48 },
  { rgb: '48, 209, 88', r: 48, g: 209, b: 88 },
  { rgb: '0, 118, 255', r: 0, g: 118, b: 255 },
];

const CELL_SIZE = CONNECTION_DIST;

/** Pre-render glow + halo + core + bright spot for each color. */
function createNodeSprite(color: { rgb: string; r: number; g: number; b: number }, baseRadius: number): HTMLCanvasElement {
  const pad = (baseRadius + 2) * GLOW_RADIUS_MULT + 4;
  const size = Math.ceil(pad * 2);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = pad;
  const cy = pad;
  const r = baseRadius;

  // 1. Glow radial gradient — softer with mid-stop
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * GLOW_RADIUS_MULT);
  grad.addColorStop(0, `rgba(${color.rgb}, 0.30)`);
  grad.addColorStop(0.4, `rgba(${color.rgb}, 0.08)`);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * GLOW_RADIUS_MULT, 0, TWO_PI);
  ctx.fill();

  // 2. Halo
  ctx.fillStyle = `rgba(${color.rgb}, 0.5)`;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, 0, TWO_PI);
  ctx.fill();

  // 3. Core
  ctx.fillStyle = `rgb(${color.rgb})`;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TWO_PI);
  ctx.fill();

  // 4. Central bright spot
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.3, 0, TWO_PI);
  ctx.fill();

  return c;
}

/** Build sprites for a range of radii. Quantize to reduce sprite count. */
function buildSpriteSheet(): Map<string, HTMLCanvasElement> {
  const map = new Map<string, HTMLCanvasElement>();
  for (let ci = 0; ci < COLORS.length; ci++) {
    for (let ri = 0; ri <= 4; ri++) {
      const r = 2 + ri * 0.5;
      const key = `${ci}_${r.toFixed(1)}`;
      map.set(key, createNodeSprite(COLORS[ci], r));
    }
  }
  return map;
}

function quantizeRadius(r: number): string {
  const q = Math.round((r - 2) * 2) / 2;
  const clamped = Math.max(2, Math.min(4, q));
  return clamped.toFixed(1);
}

// Spatial hash grid for O(N*k) neighbor lookups
class SpatialGrid {
  private cellMap = new Map<number, number[]>();
  private w: number;
  private h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  clear() {
    this.cellMap.clear();
  }

  private cellKey(cx: number, cy: number): number {
    return cy * this.w + cx;
  }

  insert(idx: number, x: number, y: number) {
    const gx = Math.floor(x / CELL_SIZE);
    const gy = Math.floor(y / CELL_SIZE);
    const key = this.cellKey(gx, gy);
    let cell = this.cellMap.get(key);
    if (!cell) { cell = []; this.cellMap.set(key, cell); }
    cell.push(idx);
  }

  queryNeighbors(x: number, y: number, fn: (idx: number) => void) {
    const gx = Math.floor(x / CELL_SIZE);
    const gy = Math.floor(y / CELL_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = this.cellKey(gx + dx, gy + dy);
        const cell = this.cellMap.get(key);
        if (cell) {
          for (let k = 0; k < cell.length; k++) fn(cell[k]);
        }
      }
    }
  }
}

export const NeuralBlackBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // x, y, vx, vy, r
  const nodesRef = useRef<Float32Array>(new Float32Array(NODE_COUNT * 5));
  const colorIdxRef = useRef<Uint8Array>(new Uint8Array(NODE_COUNT));
  const brightnessRef = useRef<Float32Array>(new Float32Array(NODE_COUNT));
  const mouseRef = useRef({ x: -1, y: -1, active: false });
  const gridRef = useRef<SpatialGrid | null>(null);
  const spriteRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true })!;
    let w = 0;
    let h = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    spriteRef.current = buildSpriteSheet();

    function initNodes() {
      const nodes = nodesRef.current;
      const ci = colorIdxRef.current;
      const br = brightnessRef.current;
      for (let i = 0; i < NODE_COUNT; i++) {
        const base = i * 5;
        nodes[base] = Math.random() * w;
        nodes[base + 1] = Math.random() * h;
        nodes[base + 2] = (Math.random() - 0.5) * VELOCITY;
        nodes[base + 3] = (Math.random() - 0.5) * VELOCITY;
        nodes[base + 4] = Math.random() * 2.2 + 1.8;
        ci[i] = Math.floor(Math.random() * COLORS.length);
        br[i] = 0.7 + Math.random() * 0.3;
      }
    }

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      gridRef.current = new SpatialGrid(w, h);
      initNodes();
    }

    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    }

    resize();

    const onMouseMove = (e: MouseEvent) => { mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; mouseRef.current.active = true; };
    const onTouchStart = (e: TouchEvent) => { const t = e.touches[0]; mouseRef.current.x = t.clientX; mouseRef.current.y = t.clientY; mouseRef.current.active = true; };
    const onTouchMove = (e: TouchEvent) => { const t = e.touches[0]; mouseRef.current.x = t.clientX; mouseRef.current.y = t.clientY; mouseRef.current.active = true; };
    const clearMouse = () => { mouseRef.current.active = false; mouseRef.current.x = -1; mouseRef.current.y = -1; };

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', clearMouse);
    window.addEventListener('mouseleave', clearMouse);

    function animate() {
      if (document.hidden) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, w, h);
      const nodes = nodesRef.current;
      const ci = colorIdxRef.current;
      const br = brightnessRef.current;
      const mouse = mouseRef.current;
      const grid = gridRef.current!;

      // --- Phase 1: Update positions ---
      for (let i = 0; i < NODE_COUNT; i++) {
        const base = i * 5;
        let x = nodes[base];
        let y = nodes[base + 1];
        let vx = nodes[base + 2];
        let vy = nodes[base + 3];

        x += vx;
        y += vy;
        if (x < 0 || x > w) { vx *= -1; x = Math.max(0, Math.min(w, x)); }
        if (y < 0 || y > h) { vy *= -1; y = Math.max(0, Math.min(h, y)); }

        if (mouse.active) {
          const mdx = mouse.x - x;
          const mdy = mouse.y - y;
          const mdSq = mdx * mdx + mdy * mdy;
          if (mdSq < MOUSE_RADIUS_SQ && mdSq > 0) {
            const md = Math.sqrt(mdSq);
            const force = (MOUSE_RADIUS - md) / MOUSE_RADIUS;
            x += (mdx / md) * force * 0.25;
            y += (mdy / md) * force * 0.25;
          }
        }

        nodes[base] = x;
        nodes[base + 1] = y;
        nodes[base + 2] = vx;
        nodes[base + 3] = vy;
      }

      // --- Phase 2: Build spatial grid ---
      grid.clear();
      for (let i = 0; i < NODE_COUNT; i++) {
        grid.insert(i, nodes[i * 5], nodes[i * 5 + 1]);
      }

      // --- Phase 3: Draw connections ---
      ctx.lineWidth = 1.2;

      for (let i = 0; i < NODE_COUNT; i++) {
        const baseI = i * 5;
        const ax = nodes[baseI];
        const ay = nodes[baseI + 1];
        const ac = COLORS[ci[i]];

        grid.queryNeighbors(ax, ay, (j) => {
          if (j <= i) return;
          const baseJ = j * 5;
          const dx = ax - nodes[baseJ];
          const dy = ay - nodes[baseJ + 1];
          const distSq = dx * dx + dy * dy;
          if (distSq < CONNECTION_DIST_SQ) {
            const dist = Math.sqrt(distSq);
            const factor = 1 - dist / CONNECTION_DIST;
            const bc = COLORS[ci[j]];
            const mixR = (ac.r + bc.r) >> 1;
            const mixG = (ac.g + bc.g) >> 1;
            const mixB = (ac.b + bc.b) >> 1;
            ctx.strokeStyle = `rgba(${mixR},${mixG},${mixB},${(factor * 0.7).toFixed(2)})`;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(nodes[baseJ], nodes[baseJ + 1]);
            ctx.stroke();
          }
        });
      }

      // --- Phase 4: Draw nodes using pre-rendered sprites ---
      for (let i = 0; i < NODE_COUNT; i++) {
        const base = i * 5;
        const x = nodes[base];
        const y = nodes[base + 1];
        const r = nodes[base + 4];
        const key = `${ci[i]}_${quantizeRadius(r)}`;
        const sprite = spriteRef.current.get(key);
        if (sprite) {
          ctx.globalAlpha = br[i];
          const half = sprite.width / 2;
          ctx.drawImage(sprite, x - half, y - half);
        }
      }
      ctx.globalAlpha = 1;

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', clearMouse);
      window.removeEventListener('mouseleave', clearMouse);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      style={{ backgroundColor: BG_COLOR }}
    >
      {/* Ambient light gradients — 4 corners + center + base */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: '-10%',
          background: `
            radial-gradient(circle at 5% 5%, rgba(0, 118, 255, 0.12) 0%, rgba(0, 118, 255, 0.02) 45%, transparent 75%),
            radial-gradient(circle at 95% 5%, rgba(255, 59, 48, 0.12) 0%, rgba(255, 59, 48, 0.02) 45%, transparent 75%),
            radial-gradient(circle at 5% 95%, rgba(48, 209, 88, 0.12) 0%, rgba(48, 209, 88, 0.02) 45%, transparent 75%),
            radial-gradient(circle at 95% 95%, rgba(0, 180, 255, 0.10) 0%, rgba(0, 180, 255, 0.02) 45%, transparent 75%),
            radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.04) 0%, rgba(99, 102, 241, 0.008) 50%, transparent 80%),
            radial-gradient(circle at 15% 25%, rgba(99, 102, 241, 0.03) 0%, transparent 60%),
            radial-gradient(circle at 85% 75%, rgba(99, 102, 241, 0.03) 0%, transparent 60%)
          `,
          animation: 'bgmove 32s ease-in-out infinite alternate',
          willChange: 'transform',
        }} />
      </div>

      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          zIndex: 2, pointerEvents: 'none', willChange: 'transform',
        }}
      />

      <style>{`
        @keyframes bgmove {
          0% { transform: scale(1) rotate(0deg); }
          100% { transform: scale(1.08) rotate(2deg); }
        }
      `}</style>
    </div>
  );
};
