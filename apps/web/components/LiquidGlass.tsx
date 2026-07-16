"use client";

import React, { useState } from "react";

interface LiquidGlassProps {
  children: React.ReactNode;
  className?: string;
  refraction?: number;      // 0-20, edge distortion depth
  blur?: number;            // 0-30, background blur amount
  chromaticAberration?: number; // 0-5, RGB split intensity
  saturation?: number;       // 0-200, color saturation boost
  brightness?: number;       // 0-2, brightness multiplier
  tint?: "black" | "white" | "auto";
  intensity?: "subtle" | "medium" | "strong";
  animate?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const intensityMap = {
  subtle: { refraction: 4, blur: 12, chromaticAberration: 1, saturation: 110, brightness: 1 },
  medium: { refraction: 8, blur: 18, chromaticAberration: 2, saturation: 130, brightness: 1.05 },
  strong: { refraction: 14, blur: 24, chromaticAberration: 3, saturation: 150, brightness: 1.1 },
};

export default function LiquidGlass({
  children,
  className = "",
  refraction: propRefraction,
  blur: propBlur,
  chromaticAberration: propCA,
  saturation: propSat,
  brightness: propBright,
  tint = "auto",
  intensity = "medium",
  animate = true,
  style,
  onClick,
}: LiquidGlassProps) {
  const settings = intensityMap[intensity];
  const refraction = propRefraction ?? settings.refraction;
  const blur = propBlur ?? settings.blur;
  const chromaticAberration = propCA ?? settings.chromaticAberration;
  const saturation = propSat ?? settings.saturation;
  const brightness = propBright ?? settings.brightness;
  const refractionOpacity = Math.min(0.18, Math.max(0.04, refraction / 100));
  const prismOffset = `${Math.min(10, Math.max(2, chromaticAberration * 2))}px`;

  // Dynamic tint based on background luminance estimation
  const glassTint = tint === "auto"
    ? "rgba(255,255,255,0.06)"
    : tint === "white"
      ? "rgba(255,255,255,0.08)"
      : "rgba(0,0,0,0.15)";

  const borderTint = tint === "auto"
    ? "rgba(255,255,255,0.12)"
    : tint === "white"
      ? "rgba(255,255,255,0.18)"
      : "rgba(255,255,255,0.08)";

  const highlightTint = tint === "auto"
    ? "rgba(255,255,255,0.15)"
    : tint === "white"
      ? "rgba(255,255,255,0.25)"
      : "rgba(255,255,255,0.05)";

  return (
    <div
      className={`liquid-glass relative isolate overflow-hidden ${className}`}
      data-animate={animate ? "true" : "false"}
      data-intensity={intensity}
      style={{ ...style, isolation: "isolate" }}
      onClick={onClick}
    >
      {/* Layer 1: Background blur + refraction layer */}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none overflow-hidden"
        style={{
          backdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
          WebkitBackdropFilter: `blur(${blur}px) saturate(${saturation}%)`,
          background: glassTint,
        }}
      />

      {/* Layer 2: Edge refraction using SVG filter */}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,${refractionOpacity}), transparent 34%, rgba(255,255,255,0.04) 72%)`,
          boxShadow: `inset ${prismOffset} 0 18px rgba(255,218,120,0.06), inset -${prismOffset} 0 18px rgba(34,197,94,0.045)`,
          opacity: brightness,
        }}
      />

      {/* Layer 3: Top highlight (specular) */}
      <div
        className="absolute inset-x-0 top-0 h-[1px] rounded-[inherit] pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${highlightTint} 20%, ${highlightTint} 80%, transparent 100%)`,
        }}
      />

      {/* Layer 4: Inner glow / ambient reflection */}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          boxShadow: `inset 0 1px 1px ${highlightTint}, inset 0 -1px 1px rgba(0,0,0,0.1)`,
        }}
      />

      {/* Layer 5: Border */}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          border: `1px solid ${borderTint}`,
        }}
      />

      {/* Layer 6: Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// Simpler variant for buttons and small elements
export function LiquidGlassButton({
  children,
  className = "",
  onClick,
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}) {
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };
    setRipples((prev) => [...prev, newRipple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
    onClick?.();
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      className={`relative isolate overflow-hidden transition-all duration-200 ease-out active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none ${className}`}
      style={{
        transform: pressed ? "scale(0.96)" : "scale(1)",
        transition: "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {/* Glass layers */}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          backdropFilter: "blur(20px) saturate(140%)",
          WebkitBackdropFilter: "blur(20px) saturate(140%)",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.2), 0 4px 24px rgba(0,0,0,0.2)",
        }}
      />

      {/* Top highlight */}
      <div
        className="absolute inset-x-3 top-0 h-[1px] rounded-full pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
        }}
      />

      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none animate-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 4,
            height: 4,
            marginLeft: -2,
            marginTop: -2,
            background: "rgba(255,255,255,0.4)",
            animation: "ripple-effect 0.6s ease-out forwards",
          }}
        />
      ))}

      {/* Content */}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
