import { useEffect, useRef } from 'react';

/**
 * NeuralConstellationBackground — Light theme "Neural Constellation · White Premium"
 * Faithfully ported from BACKGROUD-MELHORwhite.html with mobile perf optimizations:
 * 1. Spatial grid hashing for O(N*k) neighbor lookups
 * 2. Offscreen canvas pre-rendering for node sprites
 * 3. Frame skipping when document is hidden
 * 4. Debounced resize
 * 5. Capacitor guard (no mouse interaction on native)
 */

const IS_CAPACITOR = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

const CONFIG = {
  nodeCount: IS_CAPACITOR ? 50 : 85,
  connectionDist: 140,
  mouseRadius: 160,
  lineWidth: 1.2,
  nodeBaseSize: 1.8,
  glowRadiusMult: 4.5,
  velocity: 0.35,
  twoPi: Math.PI * 2,
};

const CORE_COLORS = [
  { r: 120, g: 115, b: 105 },
  { r: 140, g: 130, b: 110 },
  { r: 150, g: 140, b: 115 },
  { r: 130, g: 125, b: 108 },
];

const HALO_COLOR = 'rgba(180, 175, 165, 0.55)';
const LINE_RGB = '160, 155, 145';
const GLOW_RGB = '190, 180, 160';
const INTERACTIVE_RGB = '180, 175, 160';

interface NodeObj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  radius: number;
  glowIntensity: number;
  pulseDir: number;
  color: { r: number; g: number; b: number };
}

// Spatial grid for O(N*k) neighbor lookups
const CELL_SIZE = CONFIG.connectionDist;

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

/** Pre-render node sprite: halo + core + inner bright spot */
function createNodeSprite(radius: number, color: { r: number; g: number; b: number }): HTMLCanvasElement {
  const pad = (radius + 3) * CONFIG.glowRadiusMult + 8;
  const size = Math.ceil(pad * 2);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = pad;
  const cy = pad;

  // Shadow
  ctx.shadowColor = 'rgba(10, 15, 30, 0.3)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;

  // Halo (white ring)
  ctx.fillStyle = HALO_COLOR;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2.5, 0, CONFIG.twoPi);
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Core (colored)
  ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, CONFIG.twoPi);
  ctx.fill();

  // Inner bright spot — subtle
  ctx.fillStyle = 'rgba(200, 195, 185, 0.25)';
  ctx.beginPath();
  ctx.arc(cx - radius * 0.2, cy - radius * 0.2, radius * 0.3, 0, CONFIG.twoPi);
  ctx.fill();

  return c;
}

/** Pre-render glow sprite (radial gradient) */
function createGlowSprite(radius: number): HTMLCanvasElement {
  const r = radius * CONFIG.glowRadiusMult;
  const size = Math.ceil(r * 2 + 4);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, `rgba(${GLOW_RGB}, 0.30)`);
  grad.addColorStop(0.25, `rgba(${GLOW_RGB}, 0.12)`);
  grad.addColorStop(0.6, `rgba(${GLOW_RGB}, 0.04)`);
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, CONFIG.twoPi);
  ctx.fill();

  return c;
}

export function NeuralConstellationBackground() {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const glareCanvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<NodeObj[]>([]);
  const mouseRef = useRef({ x: -1, y: -1, active: false });
  const gridRef = useRef<SpatialGrid>(new SpatialGrid());
  const spritesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const glowSpriteRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    const glareCanvas = glareCanvasRef.current;
    if (!mainCanvas || !glareCanvas) return;

    const ctx = mainCanvas.getContext('2d', { alpha: true })!;
    const glCtx = glareCanvas.getContext('2d', { alpha: true })!;
    let w = 0;
    let h = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const repRadius = CONFIG.nodeBaseSize;

    // Pre-render glow sprite (shared by all nodes)
    glowSpriteRef.current = createGlowSprite(repRadius);
    const glowHalf = glowSpriteRef.current.width / 2;

    function createNodes(): NodeObj[] {
      return Array.from({ length: CONFIG.nodeCount }, () => {
        const baseRadius = Math.random() * 2.2 + CONFIG.nodeBaseSize;
        const color = CORE_COLORS[Math.floor(Math.random() * CORE_COLORS.length)];
        // Pre-render and cache sprite for this color
        const key = color.r * 10000 + color.g * 100 + color.b;
        if (!spritesRef.current.has(key)) {
          spritesRef.current.set(key, createNodeSprite(repRadius, color));
        }
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * CONFIG.velocity,
          vy: (Math.random() - 0.5) * CONFIG.velocity,
          baseRadius,
          radius: baseRadius,
          glowIntensity: Math.random() * 0.3 + 0.5,
          pulseDir: Math.random() > 0.5 ? 0.003 : -0.003,
          color,
        };
      });
    }

    function resize() {
      w = mainCanvas.width = glareCanvas.width = window.innerWidth;
      h = mainCanvas.height = glareCanvas.height = window.innerHeight;
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
      glCtx.clearRect(0, 0, w, h);
      const nodes = nodesRef.current;
      const mouse = mouseRef.current;
      const grid = gridRef.current;

      // --- Phase 1: Update positions + pulse ---
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;

        // Pulse
        n.glowIntensity += n.pulseDir;
        if (n.glowIntensity > 0.85 || n.glowIntensity < 0.45) n.pulseDir *= -1;

        // Mouse interaction (desktop only)
        if (!IS_CAPACITOR && mouse.active) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const distSq = dx * dx + dy * dy;
          const mrSq = CONFIG.mouseRadius * CONFIG.mouseRadius;
          if (distSq < mrSq && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const force = (CONFIG.mouseRadius - dist) / CONFIG.mouseRadius;
            n.x += (dx / dist) * force * 0.4;
            n.y += (dy / dist) * force * 0.4;
            n.radius += (n.baseRadius + force * 2.5 - n.radius) * 0.1;
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
      const cdSq = CONFIG.connectionDist * CONFIG.connectionDist;
      ctx.lineWidth = CONFIG.lineWidth;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        grid.queryNeighbors(a.x, a.y, (j) => {
          if (j <= i) return;
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < cdSq) {
            const factor = 1 - Math.sqrt(distSq) / CONFIG.connectionDist;
            const alpha = factor * 0.5;

            // Structural line (dark)
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = `rgba(${LINE_RGB}, 1)`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();

            // Glow line (on glare canvas) — subtle
            glCtx.globalAlpha = factor * 0.2;
            glCtx.strokeStyle = `rgba(${GLOW_RGB}, 1)`;
            glCtx.lineWidth = CONFIG.lineWidth * factor * 1.5;
            glCtx.beginPath();
            glCtx.moveTo(a.x, a.y);
            glCtx.lineTo(b.x, b.y);
            glCtx.stroke();
            glCtx.lineWidth = CONFIG.lineWidth;
          }
        });
      }
      ctx.globalAlpha = 1;
      glCtx.globalAlpha = 1;

      // --- Phase 3b: Mouse interaction lines (glare canvas) ---
      if (!IS_CAPACITOR && mouse.active) {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const distSq = dx * dx + dy * dy;
          const mrSq = CONFIG.mouseRadius * CONFIG.mouseRadius;
          if (distSq < mrSq) {
            const factor = 1 - Math.sqrt(distSq) / CONFIG.mouseRadius;
            glCtx.globalAlpha = factor * 0.25;
            glCtx.strokeStyle = `rgba(${INTERACTIVE_RGB}, 1)`;
            glCtx.lineWidth = factor * 1.5;
            glCtx.beginPath();
            glCtx.moveTo(n.x, n.y);
            glCtx.lineTo(mouse.x, mouse.y);
            glCtx.stroke();
          }
        }
        glCtx.globalAlpha = 1;
        glCtx.lineWidth = CONFIG.lineWidth;
      }

      // --- Phase 4: Draw nodes (main canvas) ---
      const sprite = spritesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const key = n.color.r * 10000 + n.color.g * 100 + n.color.b;
        const nodeSprite = sprite.get(key);
        if (nodeSprite) {
          const scale = n.radius / repRadius;
          const drawW = nodeSprite.width * scale;
          const drawH = nodeSprite.height * scale;
          ctx.drawImage(nodeSprite, n.x - drawW / 2, n.y - drawH / 2, drawW, drawH);
        }
      }

      // --- Phase 5: Draw glows (glare canvas) ---
      const glowSprite = glowSpriteRef.current;
      if (glowSprite) {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const intensity = 0.45 * n.glowIntensity;
          const scale = (n.radius / repRadius) * (n.radius / repRadius);
          const drawW = glowSprite.width * scale;
          const drawH = glowSprite.height * scale;
          glCtx.globalAlpha = intensity;
          glCtx.drawImage(glowSprite, n.x - drawW / 2, n.y - drawH / 2, drawW, drawH);

          // Central flare point (subtle)
          glCtx.globalAlpha = 0.12 * intensity;
          glCtx.fillStyle = 'rgba(200, 195, 180, 1)';
          glCtx.beginPath();
          glCtx.arc(n.x, n.y, n.radius * 0.8, 0, CONFIG.twoPi);
          glCtx.fill();
        }
        glCtx.globalAlpha = 1;
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
      {/* CSS background — matches HTML source */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, rgba(220, 218, 210, 0.4) 0%, transparent 60%),
            radial-gradient(circle at 80% 70%, rgba(210, 208, 200, 0.3) 0%, transparent 50%),
            #e4e2dc
          `,
        }}
      />

      {/* Depth wave layers — subtle */}
      <div className="absolute inset-0 z-[1]">
        <div
          className="absolute"
          style={{
            width: '120%', height: '70%', top: '-10%', left: '-10%',
            background: 'radial-gradient(ellipse at 30% 40%, rgba(210,208,200,0.30) 0%, rgba(200,198,192,0.15) 60%, transparent 100%)',
            clipPath: 'ellipse(80% 45% at 35% 50%)',
          }}
        />
        <div
          className="absolute"
          style={{
            width: '110%', height: '60%', bottom: '-10%', right: '-10%',
            background: 'radial-gradient(ellipse at 70% 60%, rgba(205,203,195,0.25) 0%, rgba(195,193,188,0.12) 60%, transparent 100%)',
            clipPath: 'ellipse(75% 38% at 65% 55%)',
          }}
        />
        <div
          className="absolute"
          style={{
            width: '80%', height: '40%', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(ellipse at 50% 50%, rgba(215,213,205,0.20) 0%, rgba(205,203,198,0.08) 70%, transparent 100%)',
            clipPath: 'ellipse(50% 25% at 50% 50%)',
          }}
        />
      </div>

      {/* Main canvas (nodes + structural lines) */}
      <canvas
        ref={mainCanvasRef}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          zIndex: 2, pointerEvents: 'none',
        }}
      />

      {/* Glare canvas (glows + flares, screen blend) */}
      <canvas
        ref={glareCanvasRef}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          zIndex: 3, pointerEvents: 'none',
        }}
      />
    </div>
  );
}
