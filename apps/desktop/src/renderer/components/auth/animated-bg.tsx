import { useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, useSpring, useReducedMotion } from 'motion/react';

// Forge Orange — matches --primary dark mode token.
// Read directly so canvas colors are consistent regardless of CSS load order.
const ACCENT_COLOR = '#E8622C';

/**
 * AnimatedBackground — cinematic canvas constellation for the auth right panel.
 *
 * Matches the Hero.tsx marketing site aesthetic:
 *   1. Noise texture + scanlines for surface depth
 *   2. Canvas: 55-node interactive constellation with mouse-repulsion physics
 *      Nodes glow orange, edges fade with distance (same draw loop as Hero)
 *   3. Mouse-tracking ambient glow blob — Forge Orange radial, blur-[130px]
 *   4. Edge gradient so canvas doesn't bleed into the form column
 *
 * Purely decorative — never intercepts pointer or keyboard focus.
 * Respects prefers-reduced-motion: static one-shot render only.
 */
export function AnimatedBackground() {
  const prefersReducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mouse position relative to viewport center
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Springy mouse followers for the glow blob (same params as Hero.tsx)
  const springX = useSpring(mouseX, { damping: 55, stiffness: 220 });
  const springY = useSpring(mouseY, { damping: 55, stiffness: 220 });

  // Glow follows at 45% of mouse displacement (matches Hero.tsx)
  const glowX = useTransform(springX, (val) => val * 0.45);
  const glowY = useTransform(springY, (val) => val * 0.45);

  // Track mouse globally so the glow responds even before the panel is hovered
  useEffect(() => {
    if (prefersReducedMotion) return;
    const onMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX - window.innerWidth / 2);
      mouseY.set(e.clientY - window.innerHeight / 2);
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [mouseX, mouseY, prefersReducedMotion]);

  // Canvas: particle network with mouse-repulsion physics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;

    interface Point { x: number; y: number; vx: number; vy: number; size: number }
    let points: Point[] = [];

    const initCanvas = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = canvas.width < 600 ? 30 : 55;
      points = Array.from({ length: count }, () => ({
        x:    Math.random() * canvas.width,
        y:    Math.random() * canvas.height,
        vx:   (Math.random() - 0.5) * 0.4,
        vy:   (Math.random() - 0.5) * 0.4,
        size: Math.random() * 1.5 + 0.8
      }));
    };

    /** Draw edges between nearby nodes — orange with distance-based alpha. */
    const drawEdges = () => {
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const pi   = points[i]!;
          const pj   = points[j]!;
          const dx   = pi.x - pj.x;
          const dy   = pi.y - pj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 170) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(pi.x, pi.y);
            ctx.lineTo(pj.x, pj.y);
            ctx.strokeStyle  = ACCENT_COLOR;
            ctx.globalAlpha  = (1 - dist / 170) * 0.28;
            ctx.lineWidth    = 0.8;
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    };

    /** Draw a single node — outer glow halo + bright core. */
    const drawNode = (p: Point) => {
      ctx.save();
      // Glow halo
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
      ctx.fillStyle   = ACCENT_COLOR;
      ctx.globalAlpha = 0.12;
      ctx.fill();
      // Bright core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.restore();
    };

    /** Full animation frame: clear → edges → update + draw nodes. */
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Mouse position mapped to canvas coordinates
      const mx = mouseX.get() + canvas.width  / 2;
      const my = mouseY.get() + canvas.height / 2;

      drawEdges();

      points.forEach((p) => {
        // Drift
        p.x += p.vx;
        p.y += p.vy;

        // Repel from mouse (matches Hero.tsx radius 220, force 4.5)
        const dx   = p.x - mx;
        const dy   = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 220 && dist > 0) {
          const force = (220 - dist) / 220;
          p.x += (dx / dist) * force * 4.5;
          p.y += (dy / dist) * force * 4.5;
        }

        // Bounce off walls
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        drawNode(p);
      });

      animFrame = requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(initCanvas);
    resizeObserver.observe(canvas);
    initCanvas();

    if (prefersReducedMotion) {
      // Single static frame — no animation
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawEdges();
      points.forEach(drawNode);
    } else {
      animate();
    }

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrame);
    };
  }, [prefersReducedMotion, mouseX, mouseY]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#000000]"
    >
      {/* 1. Noise texture — filmic grain for surface depth */}
      <div className="absolute inset-0 auth-noise-texture opacity-20 z-0" />

      {/* 2. Scanlines — subtle CRT depth effect */}
      <div className="absolute inset-0 auth-scanlines-overlay opacity-[0.18] z-0" />

      {/* 3. Interactive constellation canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-0"
      />

      {/* 4. Ambient mouse-tracking glow — Forge Orange, 130px blur */}
      {!prefersReducedMotion && (
        <motion.div
          style={{
            x:    glowX,
            y:    glowY,
            left: 'calc(50% - 250px)',
            top:  'calc(50% - 250px)'
          }}
          className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[rgba(232,98,44,0.18)] to-[rgba(251,146,60,0.04)] blur-[130px] pointer-events-none z-0"
        />
      )}

      {/* 5. Shifting ambient orbs — background depth layer */}
      <motion.div
        animate={
          prefersReducedMotion
            ? {}
            : { scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, -25, 0] }
        }
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[10%] left-[5%] h-[350px] w-[350px] rounded-full bg-gradient-to-br from-[rgba(232,98,44,0.12)] to-[rgba(251,146,60,0.03)] blur-[100px] pointer-events-none z-0"
      />

      {/* 6. Edge fade — prevents canvas bleeding into form column */}
      <div className="absolute inset-0 bg-gradient-to-l from-[#0A0A0B]/0 via-[#0A0A0B]/0 to-[#0A0A0B]/65 z-10" />
    </div>
  );
}
