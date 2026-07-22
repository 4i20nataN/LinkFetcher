import React, { useEffect, useState } from 'react';

const IS_CAPACITOR = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

export function ParticleBackground() {
  const [particles, setParticles] = useState<{ id: number, sizeClass: string, left: string, bottom: string }[]>([]);

  useEffect(() => {
    const numParticles = IS_CAPACITOR ? 12 : 35;
    const sizes = ['p-tiny', 'p-small', 'p-medium', 'p-large', 'p-xlarge'];
    const newParticles = [];

    for (let i = 0; i < numParticles; i++) {
      const randomSize = sizes[Math.floor(Math.random() * sizes.length)];

      newParticles.push({
        id: i,
        sizeClass: randomSize,
        left: `${Math.random() * 100}%`,
        bottom: `${Math.random() * 100}%`,
      });
    }
    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map(p => (
        <div
          key={p.id}
          className={`particle ${p.sizeClass}`}
          style={IS_CAPACITOR
            ? { left: p.left, bottom: p.bottom }
            : { left: p.left, bottom: '-10px', animation: `riseOrganic 20s linear infinite, colorShift 30s ease-in-out infinite` }
          }
        />
      ))}
    </div>
  );
}
