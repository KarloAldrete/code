import { useEffect, useRef } from "react";

const DRAG_THRESHOLD_PX = 4;

/**
 * Mouse drag-to-scroll for a horizontally scrollable container.
 * Returns a ref to attach to the scroll container, plus a helper to
 * decide whether a click inside the container should be suppressed
 * (so the drag doesn't fire a click on a card).
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let startScrollLeft = 0;
    let moved = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDown = true;
      moved = 0;
      draggedRef.current = false;
      startX = e.pageX;
      startScrollLeft = el.scrollLeft;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      const dx = e.pageX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > DRAG_THRESHOLD_PX) {
        draggedRef.current = true;
        el.style.cursor = "grabbing";
        el.style.userSelect = "none";
      }
      el.scrollLeft = startScrollLeft - dx;
    };

    const stop = () => {
      isDown = false;
      el.style.cursor = "";
      el.style.userSelect = "";
    };

    const onClickCapture = (e: MouseEvent) => {
      if (draggedRef.current) {
        e.stopPropagation();
        e.preventDefault();
        draggedRef.current = false;
      }
    };

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stop);
    el.addEventListener("mouseleave", stop);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stop);
      el.removeEventListener("mouseleave", stop);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  return ref;
}
