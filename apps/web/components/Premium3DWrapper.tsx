"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type Premium3DWrapperProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  disabled?: boolean;
  glare?: boolean;
  glareClassName?: string;
  maxRotation?: number;
  perspective?: number;
  scale?: number;
};

type Premium3DStyle = CSSProperties & {
  "--premium-glare-x": string;
  "--premium-glare-y": string;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const Premium3DWrapper = forwardRef<HTMLDivElement, Premium3DWrapperProps>(
  function Premium3DWrapper(
    {
      children,
      className,
      disabled = false,
      glare = true,
      glareClassName,
      maxRotation = 12,
      perspective = 1000,
      scale = 1.02,
      style,
      onMouseLeave,
      onMouseMove,
      ...props
    },
    forwardedRef,
  ) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const glareRef = useRef<HTMLDivElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const reducedMotionRef = useRef(false);
    const safePerspective =
      Number.isFinite(perspective) && perspective > 0 ? perspective : 1000;
    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1.02;
    const rotationLimit = Number.isFinite(maxRotation)
      ? clamp(Math.abs(maxRotation), 0, 15)
      : 12;
    const restingTransform = `perspective(${safePerspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        wrapperRef.current = node;

        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const resetTransform = useCallback(() => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (wrapperRef.current) {
        wrapperRef.current.style.transform = restingTransform;
        wrapperRef.current.style.setProperty("--premium-glare-x", "50%");
        wrapperRef.current.style.setProperty("--premium-glare-y", "50%");
      }

      if (glareRef.current) {
        glareRef.current.style.opacity = "0";
      }
    }, [restingTransform]);

    useEffect(() => {
      const motionPreference = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );
      const updateMotionPreference = () => {
        reducedMotionRef.current = motionPreference.matches;

        if (motionPreference.matches) {
          resetTransform();
        }
      };

      updateMotionPreference();
      motionPreference.addEventListener("change", updateMotionPreference);

      return () => {
        motionPreference.removeEventListener("change", updateMotionPreference);

        if (animationFrameRef.current !== null) {
          window.cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [resetTransform]);

    useEffect(() => {
      if (disabled) resetTransform();
    }, [disabled, resetTransform]);

    const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
      onMouseMove?.(event);

      if (disabled || reducedMotionRef.current) {
        resetTransform();
        return;
      }

      const element = event.currentTarget;
      const bounds = element.getBoundingClientRect();

      if (bounds.width === 0 || bounds.height === 0) {
        return;
      }

      const cursorX = clamp(event.clientX - bounds.left, 0, bounds.width);
      const cursorY = clamp(event.clientY - bounds.top, 0, bounds.height);
      const normalizedX = cursorX / bounds.width - 0.5;
      const normalizedY = cursorY / bounds.height - 0.5;
      const rotateX = clamp(
        normalizedY * rotationLimit * -2,
        -rotationLimit,
        rotationLimit,
      );
      const rotateY = clamp(
        normalizedX * rotationLimit * 2,
        -rotationLimit,
        rotationLimit,
      );
      const glareX = `${(cursorX / bounds.width) * 100}%`;
      const glareY = `${(cursorY / bounds.height) * 100}%`;

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = window.requestAnimationFrame(() => {
        element.style.transform = `perspective(${safePerspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${safeScale}, ${safeScale}, ${safeScale})`;
        element.style.setProperty("--premium-glare-x", glareX);
        element.style.setProperty("--premium-glare-y", glareY);

        if (glareRef.current) {
          glareRef.current.style.opacity = "1";
        }

        animationFrameRef.current = null;
      });
    };

    const handleMouseLeave = (event: MouseEvent<HTMLDivElement>) => {
      resetTransform();
      onMouseLeave?.(event);
    };

    const wrapperStyle: Premium3DStyle = {
      "--premium-glare-x": "50%",
      "--premium-glare-y": "50%",
      ...style,
      transform: restingTransform,
      transformStyle: "preserve-3d",
    };

    return (
      <div
        ref={setRefs}
        data-premium-3d-wrapper
        className={cn(
          "relative transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none",
          className,
        )}
        style={wrapperStyle}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}

        {glare && (
          <div
            ref={glareRef}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 ease-out",
              glareClassName,
            )}
            style={{
              background:
                "radial-gradient(circle at var(--premium-glare-x) var(--premium-glare-y), rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0.13) 18%, transparent 54%)",
              mixBlendMode: "screen",
              transform: "translateZ(60px)",
            }}
          />
        )}
      </div>
    );
  },
);

export { Premium3DWrapper };
export type { Premium3DWrapperProps };
export default Premium3DWrapper;
