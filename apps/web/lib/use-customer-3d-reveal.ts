"use client";

import { useEffect } from "react";

export function useCustomer3DReveal(dependencyKey: number | string = 0) {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delayTimers: number[] = [];
    let observer: IntersectionObserver | null = null;

    if (!reducedMotion && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            const element = entry.target as HTMLElement;
            element.classList.add("is-visible");
            delayTimers.push(window.setTimeout(() => {
              element.style.transitionDelay = "0ms";
            }, 800));
            observer?.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
      );
    }

    const revealOrObserve = (element: HTMLElement) => {
      if (element.classList.contains("is-visible")) return;

      if (observer) {
        observer.observe(element);
      } else {
        element.classList.add("is-visible");
      }
    };

    const observeRevealElements = (root: ParentNode) => {
      root
        .querySelectorAll<HTMLElement>("[data-customer-reveal]")
        .forEach(revealOrObserve);
    };

    observeRevealElements(document);

    const mutationObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;

          if (node.matches("[data-customer-reveal]")) {
            revealOrObserve(node);
          }

          observeRevealElements(node);
        });
      });
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      mutationObserver.disconnect();
      delayTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dependencyKey]);
}
