import { useEffect, useRef } from 'react';

/**
 * NeuralConstellationBackground — Light theme neural constellation animation.
 *
 * Performance optimizations over naive implementation:
 * 1. Single canvas (no dual canvas / mix-blend-mode — those kill mobile perf)
 * 2. Offscreen canvas pre-rendering for node glow textures (eliminates createRadialGradient per frame)
 * 3. Spatial grid hashing for O(N*k) neighbor lookups instead of O(N²)
 * 4. Squared-distance comparisons throughout (avoid Math.sqrt in hot path)
 * 5. Debounced resize with node re-positioning
 * 6. Frame skipping when document is hidden (battery/CPU savings)
 * 7. globalAlpha batching for connection fade (one style set per connection)
 * 8. will-change CSS hint for GPU compositing
 * 9. CSS gradient background (zero JS cost) replacing wave layers
 */

const IS_CAPACITOR = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

const NODE_COUNT = IS_CAPACITOR ? 40 : 60;
const CONNECTION_DIST = 120;
const CONNECTION_DIST_SQ = CONNECTION_DIST * CONNECTION_DIST;
const MOUSE_RADIUS = 150;
const MOUSE_RADIUS_SQ = MOUSE_RADIUS * MOUSE_RADIUS;
const VELOCITY = 0.3;
const TWO_PI = Math.PI * 2;
const GLOW_RADIUS_MULT = 4;

const CORE_COLOR = 'rgba(50, 56, 68, 0.9)';
const HALO_COLOR = 'rgba(255, 255, 255, 0.95)';
const GLOW_RGB = '255, 246, 230';
const LINE_RGB = '105, 118, 138';
const GLOW_CORE = '#ffffff';

interface NodeObj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  radius: number;
}

/** Pre-render the 3-layer node (glow + halo + core) into an offscreen canvas. */
function createNodeSprite(radius: number): HTMLCanvasElement {
  const pad = (radius + 2) * GLOW_RADIUS_MULT + 4;
  const size = Math.ceil(pad * 2);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = pad;
  const cy = pad;

  // 1. Glow radial gradient
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * GLOW_RADIUS_MULT);
  grad.addColorStop(0, `rgba(${GLOW_RGB}, 0.9)`);
  grad.addColorStop(0.2, `rgba(${GLOW_RGB}, 0.45)`);
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * GLOW_RADIUS_MULT, 0, TWO_PI);
  ctx.fill();

  // 2. Halo
  ctx.fillStyle = HALO_COLOR;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1.8, 0, TWO_PI);
  ctx.fill();

  // 3. Core
  ctx.fillStyle = CORE_COLOR;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TWO_PI);
  ctx.fill();

  // 4. Inner bright spot
  ctx.fillStyle = GLOW_CORE;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.8, 0, TWO_PI);
  ctx.fill();

  return c;
}

// Spatial grid for O(N*k) neighbor lookups
const CELL_SIZE = CONNECTION_DIST;

class SpatialGrid {
  private cellMap = new Map<number, number[]>();

  clear() { this.cellMap.clear(); }

  private key(gx: number, gy: number) { return gy * 10000 + gx; }

  insert(idx: number, x: number, y: number) {
    const gx = Math.floor(x / CELL_SIZE);
    const gy = Math.floor(y / CELL_SIZE);
    const k = this.key(gx, gy);
    let cell = this.cellMap.get(k);
    if (!cell) { cell = []; this.cellMap.set(k, cell); }
    cell.push(idx);
  }

  queryNeighbors(x: number, y: number, fn: (idx: number) => void) {
    const gx = Math.floor(x / CELL_SIZE);
    const gy = Math.floor(y / CELL_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = this.cellMap.get(this.key(gx + dx, gy + dy));
        if (cell) for (let k = 0; k < cell.length; k++) fn(cell[k]);
      }
    }
  }
}

export function NeuralConstellationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<NodeObj[]>([]);
  const mouseRef = useRef({ x: -1, y: -1, active: false });
  const gridRef = useRef<SpatialGrid>(new SpatialGrid());
  const spriteRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true })!;
    let w = 0;
    let h = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    // Pre-render a node sprite using a representative radius
    // (all nodes share similar visual weight; we adjust via drawImage scale)
    const representativeRadius = 3;
    spriteRef.current = createNodeSprite(representativeRadius);
    const spriteHalf = spriteRef.current.width / 2;

    function createNodes(): NodeObj[] {
      return Array.from({ length: NODE_COUNT }, () => {
        const baseRadius = Math.random() * 2.5 + 1;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * VELOCITY,
          vy: (Math.random() - 0.5) * VELOCITY,
          baseRadius,
          radius: baseRadius,
        };
      });
    }

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      gridRef.current = new SpatialGrid();
    }

    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        nodesRef.current = createNodes();
      }, 150);
    }

    resize();
    nodesRef.current = createNodes();

    // Mouse/touch handlers (skip on Capacitor — no cursor)
    const onMouseMove = IS_CAPACITOR ? undefined : (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };
    const clearMouse = () => { mouseRef.current.active = false; mouseRef.current.x = -1; mouseRef.current.y = -1; };

    window.addEventListener('resize', onResize);
    if (onMouseMove) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseleave', clearMouse);
    }

    function animate() {
      if (document.hidden) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, w, h);
      const nodes = nodesRef.current;
      const mouse = mouseRef.current;
      const grid = gridRef.current;

      // --- Phase 1: Update positions ---
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;

        // Mouse interaction (desktop only)
        if (!IS_CAPACITOR && mouse.active) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < MOUSE_RADIUS_SQ && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
            n.x += (dx / dist) * force * 0.35;
            n.y += (dy / dist) * force * 0.35;
            n.radius += (n.baseRadius + force * 1.8 - n.radius) * 0.1;
          } else {
            n.radius += (n.baseRadius - n.radius) * 0.05;
          }
        } else {
          n.radius += (n.baseRadius - n.radius) * 0.05;
        }
      }

      // --- Phase 2: Build spatial grid ---
      grid.clear();
      for (let i = 0; i < nodes.length; i++) {
        grid.insert(i, nodes[i].x, nodes[i].y);
      }

      // --- Phase 3: Draw connections ---
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        grid.queryNeighbors(a.x, a.y, (j) => {
          if (j <= i) return;
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < CONNECTION_DIST_SQ) {
            const factor = 1 - Math.sqrt(distSq) / CONNECTION_DIST;
            ctx.globalAlpha = factor;
            ctx.strokeStyle = `rgba(${LINE_RGB},0.15)`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        });
      }
      ctx.globalAlpha = 1;

      // --- Phase 4: Draw nodes using pre-rendered sprite ---
      const sprite = spriteRef.current;
      if (sprite) {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          // Scale sprite by node.radius relative to representativeRadius
          const scale = n.radius / representativeRadius;
          const drawW = sprite.width * scale;
          const drawH = sprite.height * scale;
          ctx.drawImage(sprite, n.x - drawW / 2, n.y - drawH / 2, drawW, drawH);
        }
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      if (onMouseMove) {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseleave', clearMouse);
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Simple CSS gradient background — zero JS cost, matches HTML source */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #ffffff 0%, #dbe1e9 100%)',
        }}
      />

      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          zIndex: 2, pointerEvents: 'none', willChange: 'transform',
        }}
      />
    </div>
  );
}
