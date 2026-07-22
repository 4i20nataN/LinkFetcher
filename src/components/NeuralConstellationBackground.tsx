import { useEffect, useRef } from 'react';

interface NodeColor { r: number; g: number; b: number }

interface NodeObj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  radius: number;
  glowIntensity: number;
  pulseDir: number;
  color: NodeColor;
}

const COLOR_OPTIONS: NodeColor[] = [
  { r: 50, g: 56, b: 68 },
  { r: 70, g: 80, b: 100 },
  { r: 90, g: 70, b: 60 },
  { r: 40, g: 60, b: 80 },
];

export function NeuralConstellationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glareRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NodeObj[]>([]);
  const mouseRef = { x: null as number | null, y: null as number | null, active: false };
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const glare = glareRef.current;
    if (!canvas || !glare) return;

    const ctx = canvas.getContext('2d')!;
    const glCtx = glare.getContext('2d')!;

    const CONFIG = {
      nodeCount: 60,
      connectionDist: 160,
      mouseRadius: 220,
      coreColor: '#1a1a24',
      haloColor: 'rgba(255, 255, 255, 0.95)',
      lineColor: '60, 70, 90',
      glowColor: '255, 215, 180',
      interactiveGlow: '255, 240, 200',
      lineWidth: 1.8,
      nodeBaseSize: 3.5,
      glowIntensity: 1.2,
    };

    let w = 0;
    let h = 0;

    function resize() {
      w = canvas.width = glare.width = window.innerWidth;
      h = canvas.height = glare.height = window.innerHeight;
    }

    function createNodes(): NodeObj[] {
      return Array.from({ length: CONFIG.nodeCount }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        baseRadius: Math.random() * 2 + CONFIG.nodeBaseSize,
        radius: 0,
        glowIntensity: Math.random() * 0.6 + 0.4,
        pulseDir: Math.random() > 0.5 ? 0.008 : -0.008,
        color: COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)],
      })).map(n => { n.radius = n.baseRadius; return n; });
    }

    function updateNode(n: NodeObj) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;

      n.glowIntensity += n.pulseDir;
      if (n.glowIntensity > 1.2 || n.glowIntensity < 0.3) n.pulseDir *= -1;

      const mouse = mouseRef;
      if (mouse.active && mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const dist = Math.hypot(dx, dy);
        if (dist < CONFIG.mouseRadius) {
          const force = (CONFIG.mouseRadius - dist) / CONFIG.mouseRadius;
          n.x += (dx / dist) * force * 0.4;
          n.y += (dy / dist) * force * 0.4;
          n.radius = n.baseRadius + force * 2.5;
        } else {
          n.radius += (n.baseRadius - n.radius) * 0.05;
        }
      } else {
        n.radius += (n.baseRadius - n.radius) * 0.05;
      }
    }

    function drawPhysical(c: CanvasRenderingContext2D, n: NodeObj) {
      c.beginPath();
      c.arc(n.x, n.y, n.radius + 2.5, 0, Math.PI * 2);
      c.fillStyle = CONFIG.haloColor;
      c.fill();

      c.beginPath();
      c.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      c.fillStyle = `rgb(${n.color.r}, ${n.color.g}, ${n.color.b})`;
      c.fill();

      c.beginPath();
      c.arc(n.x - n.radius * 0.2, n.y - n.radius * 0.2, n.radius * 0.3, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255, 255, 255, 0.4)';
      c.fill();
    }

    function drawGlow(c: CanvasRenderingContext2D, n: NodeObj) {
      const intensity = CONFIG.glowIntensity * n.glowIntensity;
      const r = n.radius * 6;

      c.globalAlpha = 0.3 * intensity;
      c.beginPath();
      c.arc(n.x, n.y, r, 0, Math.PI * 2);
      c.fillStyle = CONFIG.glowColor;
      c.fill();
      c.globalAlpha = 1;

      c.beginPath();
      c.arc(n.x, n.y, n.radius * 0.8, 0, Math.PI * 2);
      c.fillStyle = `rgba(255, 255, 240, ${0.95 * intensity})`;
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
            const alpha = factor * 0.5;

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineWidth = CONFIG.lineWidth * factor;
            ctx.strokeStyle = `rgba(${CONFIG.lineColor}, ${alpha})`;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            ctx.shadowBlur = 4;
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;

            glCtx.beginPath();
            glCtx.moveTo(a.x, a.y);
            glCtx.lineTo(b.x, b.y);
            glCtx.lineWidth = CONFIG.lineWidth * factor * 2.5;
            glCtx.strokeStyle = `rgba(${CONFIG.glowColor}, ${factor * 0.6})`;
            glCtx.stroke();
          }
        }

        const mouse = mouseRef;
        if (mouse.active && mouse.x !== null && mouse.y !== null) {
          const dx = a.x - mouse.x;
          const dy = a.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < CONFIG.mouseRadius) {
            const factor = 1 - dist / CONFIG.mouseRadius;
            glCtx.beginPath();
            glCtx.moveTo(a.x, a.y);
            glCtx.lineTo(mouse.x, mouse.y);
            glCtx.lineWidth = factor * 3;
            glCtx.strokeStyle = `rgba(${CONFIG.interactiveGlow}, ${factor * 0.8})`;
            glCtx.stroke();
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

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.x = e.clientX;
      mouseRef.y = e.clientY;
      mouseRef.active = true;
    };
    const onMouseLeave = () => { mouseRef.active = false; };
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

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('resize', onResizeDebounced);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', onResizeDebounced);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      <div className="depth-wave depth-wave-1 absolute rounded-full" />
      <div className="depth-wave depth-wave-2 absolute rounded-full" />
      <div className="depth-wave depth-wave-3 absolute rounded-full" />

      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full block z-[2]" />
      <canvas ref={glareRef} className="absolute top-0 left-0 w-full h-full block z-[3] pointer-events-none" style={{ mixBlendMode: 'screen' }} />

      <style>{`
        .depth-wave { filter: blur(8px); }
        .depth-wave-1 {
          width: 120%; height: 70%; top: -10%; left: -10%;
          background: radial-gradient(ellipse at 30% 40%, rgba(148,163,184,0.55) 0%, rgba(180,195,215,0.4) 60%, rgba(200,210,222,0.1) 100%);
          clip-path: ellipse(80% 45% at 35% 50%);
        }
        .depth-wave-2 {
          width: 110%; height: 60%; bottom: -10%; right: -10%;
          background: radial-gradient(ellipse at 70% 60%, rgba(130,145,170,0.5) 0%, rgba(160,175,195,0.35) 60%, rgba(180,195,210,0.1) 100%);
          clip-path: ellipse(75% 38% at 65% 55%);
        }
        .depth-wave-3 {
          width: 80%; height: 40%; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: radial-gradient(ellipse at 50% 50%, rgba(160,175,195,0.6) 0%, rgba(190,200,215,0.4) 70%, rgba(215,223,232,0.1) 100%);
          clip-path: ellipse(50% 25% at 50% 50%);
        }
      `}</style>
    </div>
  );
}
