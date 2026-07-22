import { useEffect, useRef } from 'react';

interface NodeObj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  radius: number;
  glowIntensity: number;
  pulseDir: number;
}

const IS_CAPACITOR = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

const CONFIG = {
  nodeCount: IS_CAPACITOR ? 30 : 95,
  connectionDist: 155,
  mouseRadius: 200,
  coreColor: 'rgba(50, 56, 68, 0.9)',
  haloColor: 'rgba(255, 255, 255, 0.95)',
  lineColor: '105, 118, 138',
  glowColor: '255, 246, 230',
  interactiveGlow: '255, 253, 245',
  velocity: 0.45,
  baseRadiusMin: 1.5,
  baseRadiusRange: 2.5,
  glowPulse: 0.01,
};

export function NeuralConstellationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glareRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NodeObj[]>([]);
  const mouseRef = useRef({ x: null as number | null, y: null as number | null, active: false });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const glare = glareRef.current;
    if (!canvas || !glare) return;

    const ctx = canvas.getContext('2d')!;
    const glCtx = glare.getContext('2d')!;

    let w = 0;
    let h = 0;

    function resize() {
      w = canvas.width = glare.width = window.innerWidth;
      h = canvas.height = glare.height = window.innerHeight;
    }

    function createNodes(): NodeObj[] {
      return Array.from({ length: CONFIG.nodeCount }, () => {
        const baseRadius = Math.random() * CONFIG.baseRadiusRange + CONFIG.baseRadiusMin;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * CONFIG.velocity,
          vy: (Math.random() - 0.5) * CONFIG.velocity,
          baseRadius,
          radius: baseRadius,
          glowIntensity: Math.random() * 0.5 + 0.5,
          pulseDir: Math.random() > 0.5 ? CONFIG.glowPulse : -CONFIG.glowPulse,
        };
      });
    }

    function updateNode(n: NodeObj) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;

      n.glowIntensity += n.pulseDir;
      if (n.glowIntensity > 1 || n.glowIntensity < 0.4) n.pulseDir *= -1;

      if (!IS_CAPACITOR) {
        const mouse = mouseRef.current;
        if (mouse.active && mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const dist = Math.hypot(dx, dy);
          if (dist < CONFIG.mouseRadius) {
            const force = (CONFIG.mouseRadius - dist) / CONFIG.mouseRadius;
            n.x += (dx / dist) * force * 0.35;
            n.y += (dy / dist) * force * 0.35;
            n.radius = n.baseRadius + force * 1.8;
          } else {
            n.radius += (n.baseRadius - n.radius) * 0.05;
          }
        } else {
          n.radius += (n.baseRadius - n.radius) * 0.05;
        }
      } else {
        n.radius += (n.baseRadius - n.radius) * 0.05;
      }
    }

    function drawPhysical(c: CanvasRenderingContext2D, n: NodeObj) {
      c.shadowColor = 'rgba(15, 22, 38, 0.22)';
      c.shadowBlur = 8;
      c.shadowOffsetX = 1;
      c.shadowOffsetY = 3;

      c.beginPath();
      c.arc(n.x, n.y, n.radius + 1.8, 0, Math.PI * 2);
      c.fillStyle = CONFIG.haloColor;
      c.fill();

      c.shadowColor = 'transparent';
      c.shadowBlur = 0;
      c.shadowOffsetX = 0;
      c.shadowOffsetY = 0;

      c.beginPath();
      c.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      c.fillStyle = CONFIG.coreColor;
      c.fill();
    }

    function drawGlow(c: CanvasRenderingContext2D, n: NodeObj) {
      const r = n.radius * 6.5;
      const gradient = c.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
      gradient.addColorStop(0, `rgba(${CONFIG.glowColor}, ${0.9 * n.glowIntensity})`);
      gradient.addColorStop(0.2, `rgba(${CONFIG.glowColor}, ${0.45 * n.glowIntensity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      c.beginPath();
      c.arc(n.x, n.y, r, 0, Math.PI * 2);
      c.fillStyle = gradient;
      c.fill();

      c.beginPath();
      c.arc(n.x, n.y, n.radius * 0.8, 0, Math.PI * 2);
      c.fillStyle = '#ffffff';
      c.fill();
    }

    function animate() {
      ctx.clearRect(0, 0, w, h);
      glCtx.clearRect(0, 0, w, h);

      const nodes = nodesRef.current;
      for (const n of nodes) updateNode(n);

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);

          if (dist < CONFIG.connectionDist) {
            const factor = 1 - dist / CONFIG.connectionDist;

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineWidth = factor * 1.3;
            ctx.strokeStyle = `rgba(${CONFIG.lineColor}, ${factor * 0.4})`;
            ctx.stroke();

            glCtx.beginPath();
            glCtx.moveTo(a.x, a.y);
            glCtx.lineTo(b.x, b.y);
            glCtx.lineWidth = factor * 2.2;
            glCtx.strokeStyle = `rgba(${CONFIG.glowColor}, ${factor * 0.55})`;
            glCtx.stroke();
          }
        }

        if (!IS_CAPACITOR) {
          const mouse = mouseRef.current;
          if (mouse.active && mouse.x !== null && mouse.y !== null) {
            const dx = a.x - mouse.x;
            const dy = a.y - mouse.y;
            const dist = Math.hypot(dx, dy);
            if (dist < CONFIG.mouseRadius) {
              const factor = 1 - dist / CONFIG.mouseRadius;
              glCtx.beginPath();
              glCtx.moveTo(a.x, a.y);
              glCtx.lineTo(mouse.x, mouse.y);
              glCtx.lineWidth = factor * 2.5;
              glCtx.strokeStyle = `rgba(${CONFIG.interactiveGlow}, ${factor * 0.75})`;
              glCtx.stroke();
            }
          }
        }
      }

      for (const n of nodes) drawPhysical(ctx, n);
      for (const n of nodes) drawGlow(glCtx, n);

      rafRef.current = requestAnimationFrame(animate);
    }

    resize();
    nodesRef.current = createNodes();
    animate();

    const onResize = () => {
      resize();
      for (const n of nodesRef.current) {
        n.x = Math.min(Math.max(n.x, 0), w);
        n.y = Math.min(Math.max(n.y, 0), h);
      }
    };
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResizeDebounced = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(onResize, 150);
    };

    window.addEventListener('resize', onResizeDebounced);

    if (!IS_CAPACITOR) {
      const onMouseMove = (e: MouseEvent) => {
        mouseRef.current.x = e.clientX;
        mouseRef.current.y = e.clientY;
        mouseRef.current.active = true;
      };
      const onMouseLeave = () => { mouseRef.current.active = false; };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseleave', onMouseLeave);

      return () => {
        cancelAnimationFrame(rafRef.current);
        if (resizeTimer) clearTimeout(resizeTimer);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseleave', onMouseLeave);
        window.removeEventListener('resize', onResizeDebounced);
      };
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResizeDebounced);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      <div className="depth-bg">
        <div className="wave-layer wave-1" />
        <div className="wave-layer wave-2" />
        <div className="wave-layer wave-3" />
      </div>

      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full block z-[2]" style={{ mixBlendMode: 'multiply' }} />
      <canvas ref={glareRef} className="absolute top-0 left-0 w-full h-full block z-[3] pointer-events-none" style={{ mixBlendMode: 'screen' }} />

      <style>{`
        .depth-bg {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;
          background:
            radial-gradient(circle at 10% 10%, #ffffff 0%, rgba(255,255,255,0) 70%),
            radial-gradient(circle at 90% 80%, #dbe1e9 0%, #bdc7d4 100%);
          overflow: hidden;
        }
        .wave-layer {
          position: absolute; width: 150%; height: 150%; top: -25%; left: -25%;
          transform: rotate(-12deg); opacity: 0.85; pointer-events: none;
        }
        .wave-1 {
          background: radial-gradient(ellipse at 30% 40%, rgba(255,255,255,0.95) 0%, rgba(240,243,247,0.9) 50%, rgba(200,210,222,0.3) 100%);
          clip-path: ellipse(80% 45% at 35% 50%);
          filter: drop-shadow(-10px 15px 30px rgba(0,0,0,0.08));
        }
        .wave-2 {
          background: radial-gradient(ellipse at 70% 60%, rgba(255,255,255,0.85) 0%, rgba(228,233,241,0.8) 60%, rgba(185,197,212,0.4) 100%);
          clip-path: ellipse(75% 38% at 65% 55%);
          filter: drop-shadow(-15px 25px 45px rgba(0,0,0,0.12));
        }
        .wave-3 {
          background: radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.98) 0%, rgba(245,247,250,0.9) 70%, rgba(215,223,232,0.5) 100%);
          clip-path: ellipse(50% 25% at 50% 50%);
          filter: drop-shadow(0px 20px 40px rgba(0,0,0,0.06));
        }
      `}</style>
    </div>
  );
}
