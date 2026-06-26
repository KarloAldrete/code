import { cn } from "@posthog/quill";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  type CSSProperties,
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  className?: string;
  itemClassName?: string;
  itemStyle?: CSSProperties;
  footer?: ReactNode;
  onScrollStateChange?: (isAtBottom: boolean) => void;
  /**
   * Called when the user scrolls near the top and `hasMoreAbove` is set, so the
   * caller can load older items (scrollback). New items prepended after this
   * fires are anchored: the viewport keeps the same content, no jump.
   */
  onReachTop?: () => void;
  hasMoreAbove?: boolean;
  keepMounted?: readonly number[];
  /**
   * Allow horizontal scrolling of the list viewport. Defaults to true. Narrow
   * surfaces (e.g. the Agent Builder dock) pass false so off-edge content like
   * a message's hover action can't produce a horizontal scrollbar; nested
   * scrollers (code blocks) keep their own overflow.
   */
  scrollX?: boolean;
}

export interface VirtualizedListHandle {
  scrollToBottom: () => void;
  scrollToIndex: (index: number) => void;
}

const AT_BOTTOM_THRESHOLD = 50;
const ESTIMATED_ROW_SIZE = 80;
const OVERSCAN = 6;
// A real upward drift, not a 1-frame measure transient: the DOM bottom sits
// this far below the viewport. Well above any single append's measure gap.
const FAR_DRIFT_THRESHOLD = 400;
// Start loading older items this far before the very top, so scrollback feels
// seamless rather than snagging at the edge.
const LOAD_OLDER_THRESHOLD = 600;

function VirtualizedListInner<T>(
  {
    items,
    renderItem,
    getItemKey,
    className,
    itemClassName,
    itemStyle,
    footer,
    onScrollStateChange,
    onReachTop,
    hasMoreAbove,
    keepMounted,
    scrollX = true,
  }: VirtualizedListProps<T>,
  ref: React.ForwardedRef<VirtualizedListHandle>,
) {
  const parentRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const isAtBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const settlingRef = useRef(false);
  const settleRafRef = useRef<number | null>(null);
  const onScrollStateChangeRef = useRef(onScrollStateChange);
  onScrollStateChangeRef.current = onScrollStateChange;
  // Scrollback: keep the latest callback/flag in refs so handleScroll stays
  // stable. `loadingOlder` gates re-entrancy; `scrollHeightBeforeLoad` anchors
  // the viewport when the prepended items land.
  const onReachTopRef = useRef(onReachTop);
  onReachTopRef.current = onReachTop;
  const hasMoreAboveRef = useRef(hasMoreAbove);
  hasMoreAboveRef.current = hasMoreAbove;
  const loadingOlderRef = useRef(false);
  const scrollHeightBeforeLoadRef = useRef(0);

  const hasFooter = footer != null;

  // The footer is real trailing content, NOT a fake virtual row. As a virtual
  // row it would have a constant key and always be last, which permanently
  // kills tanstack's followOnAppend (it only fires when the last virtual key
  // changes on append). Instead we reserve its height as `paddingEnd` so the
  // virtual coordinate space includes it: anchorTo='end' then pins to BELOW the
  // footer, and isAtEnd lines up with the real DOM bottom. With the footer out
  // of the count, the last virtual item is the real last message, so
  // followOnAppend handles appends and anchorTo handles in-place growth (tokens)
  // natively — no hand-rolled scroll-following.
  const [footerHeight, setFooterHeight] = useState(0);

  useLayoutEffect(() => {
    const el = footerRef.current;
    if (!hasFooter || !el) {
      setFooterHeight(0);
      return;
    }
    setFooterHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      setFooterHeight((prev) => (prev === h ? prev : h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasFooter]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_SIZE,
    overscan: OVERSCAN,
    anchorTo: "end",
    followOnAppend: true,
    scrollEndThreshold: AT_BOTTOM_THRESHOLD,
    paddingEnd: footerHeight,
    getItemKey: (index) => {
      const item = items[index];
      return getItemKey ? getItemKey(item, index) : index;
    },
  });

  const settleAtEnd = useCallback(() => {
    if (settleRafRef.current !== null) {
      cancelAnimationFrame(settleRafRef.current);
      settleRafRef.current = null;
    }
    settlingRef.current = true;
    isAtBottomRef.current = true;
    let attempts = 0;
    const step = () => {
      virtualizer.scrollToEnd();
      if (virtualizer.isAtEnd(AT_BOTTOM_THRESHOLD)) {
        settlingRef.current = false;
        settleRafRef.current = null;
        if (initializedRef.current) {
          onScrollStateChangeRef.current?.(true);
        }
        return;
      }
      if (++attempts > 12) {
        settlingRef.current = false;
        settleRafRef.current = null;
        return;
      }
      settleRafRef.current = requestAnimationFrame(step);
    };
    step();
  }, [virtualizer]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToBottom: settleAtEnd,
      scrollToIndex: (index: number) => {
        if (settleRafRef.current !== null) {
          cancelAnimationFrame(settleRafRef.current);
          settleRafRef.current = null;
          settlingRef.current = false;
        }
        isAtBottomRef.current = false;
        virtualizer.scrollToIndex(index, { align: "center" });
      },
    }),
    [virtualizer, settleAtEnd],
  );

  useEffect(() => {
    return () => {
      if (settleRafRef.current !== null) {
        cancelAnimationFrame(settleRafRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (initializedRef.current || items.length === 0) return;
    // settleAtEnd retries across frames so the initial scroll survives rows
    // measuring taller than the 80px estimate.
    settleAtEnd();
    requestAnimationFrame(() => {
      initializedRef.current = true;
    });
  }, [items.length, settleAtEnd]);

  const totalSize = virtualizer.getTotalSize();

  // Anything that changes the virtual height while we're following has to re-pin
  // to the new bottom: rows remeasuring past the 80px estimate, late async
  // content (syntax highlighting, diffs) growing rows, and the footer's own
  // resize (which feeds paddingEnd). tanstack's anchor logic only watches item
  // count/keys, so none of these trigger it — totalSize is the one value that
  // moves for all of them, so key the re-pin off it.
  //
  // Gate on isAtBottomRef (true until the user scrolls up), NOT initializedRef.
  // footerHeight starts at 0, so the initial settle pins to a bottom that
  // excludes the footer; the footer then measures and grows paddingEnd before
  // initializedRef flips, stranding us above the real bottom. Running pre-init
  // closes that gap. This is a layout effect so the re-pin lands synchronously,
  // before paint — no visible drift, no transient isAtEnd=false flicker.
  // biome-ignore lint/correctness/useExhaustiveDependencies: totalSize is the trigger, not a body dependency
  useLayoutEffect(() => {
    if (!isAtBottomRef.current) return;
    virtualizer.scrollToEnd();
  }, [totalSize, virtualizer]);

  // Scrollback anchor: when a load prepends older items, the virtual height
  // grows above the viewport. Shift scrollTop by that growth so the content the
  // user was reading stays exactly where it was — no jump. Synchronous,
  // pre-paint. Gated on loadingOlderRef so streaming appends never trip it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: items.length is the trigger
  useLayoutEffect(() => {
    if (!loadingOlderRef.current) return;
    const el = parentRef.current;
    if (!el) return;
    const delta = el.scrollHeight - scrollHeightBeforeLoadRef.current;
    if (delta > 0) {
      el.scrollTop += delta;
      isAtBottomRef.current = false;
      loadingOlderRef.current = false;
    }
  }, [items.length]);

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    const scrollTop = el?.scrollTop ?? 0;
    // Tolerate sub-pixel jitter; only a real upward move counts as leaving end.
    const scrolledUp = scrollTop < lastScrollTopRef.current - 1;
    lastScrollTopRef.current = scrollTop;

    // Scrollback: as the user nears the top, ask the caller for older items.
    // Record the pre-load scroll height so the anchor effect can keep the
    // viewport on the same content once they prepend. Gate on `initialized` so
    // the initial scroll-to-end settle (which can leave scrollTop near 0 for a
    // short tail) doesn't spuriously pull the whole history in.
    if (
      el &&
      initializedRef.current &&
      hasMoreAboveRef.current &&
      !loadingOlderRef.current &&
      scrollTop < LOAD_OLDER_THRESHOLD
    ) {
      loadingOlderRef.current = true;
      scrollHeightBeforeLoadRef.current = el.scrollHeight;
      onReachTopRef.current?.();
    }

    const atEnd = virtualizer.isAtEnd(AT_BOTTOM_THRESHOLD);
    // Genuine far drift (not a 1-frame measure transient): the DOM bottom sits
    // well below the viewport.
    const farFromEnd = el
      ? el.scrollHeight - el.clientHeight - scrollTop > FAR_DRIFT_THRESHOLD
      : false;
    // Hysteresis for the scroll-to-bottom button (pure UI state — tanstack still
    // drives the actual scrolling). Each append measures taller than the 80px
    // estimate, so for one frame isAtEnd reads false before followOnAppend /
    // anchorTo re-pin. Reporting that transient flickers the button. Re-arm
    // "at bottom" whenever we reach the end; only clear it when the user
    // actually scrolls up. Growth pins down (scrollTop holds or rises), so it
    // never trips the scrolledUp branch.
    // Surface the button on a real upward scroll, or on a genuine far drift so
    // follow can't get silently stuck mid-thread.
    if (atEnd) {
      isAtBottomRef.current = true;
    } else if (scrolledUp || farFromEnd) {
      isAtBottomRef.current = false;
    }

    if (!initializedRef.current) return;
    // Suppress intermediate "not at bottom" pings while a programmatic
    // scrollToEnd is still settling after row remeasure.
    if (settlingRef.current && !isAtBottomRef.current) return;
    onScrollStateChangeRef.current?.(isAtBottomRef.current);
  }, [virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  const renderedIndices = useMemo(() => {
    const set = new Set<number>();
    for (const v of virtualItems) set.add(v.index);
    return set;
  }, [virtualItems]);

  const orphanKeepIndices = useMemo(() => {
    if (!keepMounted || keepMounted.length === 0) return [];
    return keepMounted.filter(
      (i) => i >= 0 && i < items.length && !renderedIndices.has(i),
    );
  }, [keepMounted, renderedIndices, items.length]);

  return (
    <div className={`flex h-full flex-col ${className ?? ""}`}>
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className={`scroll-mask-8 flex-1 overflow-y-auto ${scrollX ? "overflow-x-auto" : "overflow-x-hidden"}`}
        style={{ scrollbarGutter: "stable" }}
      >
        <div
          style={{
            height: totalSize,
            position: "relative",
            width: "100%",
          }}
        >
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index];
            const itemKey = getItemKey
              ? getItemKey(item, virtualItem.index)
              : virtualItem.index;
            return (
              <div
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div
                  className={cn(itemClassName, "[&_p:last-of-type]:mb-0")}
                  style={itemStyle}
                  data-conversation-item-id={itemKey}
                >
                  {renderItem(item, virtualItem.index)}
                </div>
              </div>
            );
          })}
          {orphanKeepIndices.map((index) => {
            const item = items[index];
            const k = getItemKey ? getItemKey(item, index) : index;
            return (
              <div
                key={`keep-${k}`}
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: "translateY(-99999px)",
                  pointerEvents: "none",
                  visibility: "hidden",
                }}
              >
                <div
                  className={itemClassName}
                  style={itemStyle}
                  data-conversation-item-id={k}
                >
                  {renderItem(item, index)}
                </div>
              </div>
            );
          })}
          {/* Footer occupies the reserved paddingEnd region at the very bottom
              of the virtual space, so the DOM bottom == the virtual end. */}
          {hasFooter && (
            <div
              ref={footerRef}
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: "100%",
              }}
            >
              <div className={itemClassName} style={itemStyle}>
                {footer}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const VirtualizedList = forwardRef(VirtualizedListInner) as <T>(
  props: VirtualizedListProps<T> & {
    ref?: React.ForwardedRef<VirtualizedListHandle>;
  },
) => ReturnType<typeof VirtualizedListInner>;
