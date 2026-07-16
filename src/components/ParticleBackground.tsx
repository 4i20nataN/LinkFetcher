import React, { useEffect, useState } from 'react';

export function ParticleBackground() {
  const [particles, setParticles] = useState<{ id: number, sizeClass: string, left: string, riseDuration: number, colorDuration: number, riseDelay: number, colorDelay: number }[]>([]);

  useEffect(() => {
    const numParticles = 35;
    const sizes = ['p-tiny', 'p-small', 'p-medium', 'p-large', 'p-xlarge'];
    const newParticles = [];

    for (let i = 0; i < numParticles; i++) {
      const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
      const riseDuration = 14 + Math.random() * 12;
      const colorDuration = 25 + Math.random() * 15;
      const riseDelay = -(Math.random() * riseDuration);
      const colorDelay = -(Math.random() * colorDuration);

      newParticles.push({
        id: i,
        sizeClass: randomSize,
        left: `${Math.random() * 100}%`,
        riseDuration,
        colorDuration,
        riseDelay,
        colorDelay
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
          style={{
            left: p.left,
            bottom: '-10px',
            animation: `riseOrganic ${p.riseDuration}s linear infinite ${p.riseDelay}s, colorShift ${p.colorDuration}s ease-in-out infinite ${p.colorDelay}s`
          }}
        />
      ))}
    </div>
  );
}
