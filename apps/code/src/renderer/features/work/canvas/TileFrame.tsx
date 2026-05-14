import {
  Check,
  DotsThree,
  type IconProps,
  TrashSimple,
  X,
} from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import type { Tile, TileSize } from "@shared/types/work-projects";
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

export const SIZE_TO_COLSPAN: Record<TileSize, string> = {
  sm: "col-span-12 md:col-span-6 lg:col-span-3",
  md: "col-span-12 md:col-span-6",
  lg: "col-span-12 lg:col-span-8",
  full: "col-span-12",
};

const SIZE_LABEL: Record<TileSize, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
  full: "Full width",
};

const SIZE_ORDER: TileSize[] = ["sm", "md", "lg", "full"];

interface TileFrameProps {
  tile: Tile;
  icon?: ComponentType<IconProps>;
  label?: string;
  /** Header right-side content (e.g. an "Open in PostHog" link). */
  headerAction?: ReactNode;
  children: ReactNode;
  onRemove?: () => void;
  onResize?: (size: TileSize) => void;
  onApplyPending?: () => void;
  onRejectPending?: () => void;
  /** When true the frame omits its chrome (border, header, padding). Use for
   *  title tiles that own their own presentation. */
  bare?: boolean;
}

export function TileFrame({
  tile,
  icon: Icon,
  label,
  headerAction,
  children,
  onRemove,
  onResize,
  onApplyPending,
  onRejectPending,
  bare,
}: TileFrameProps) {
  const isPending = tile.state !== "live";
  const pendingLabel =
    tile.state === "pending_add"
      ? "Suggested by chat"
      : tile.state === "pending_remove"
        ? "Remove suggested"
        : tile.state === "pending_edit"
          ? "Edit suggested"
          : null;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  if (bare) {
    return (
      <Box
        className={`group relative ${isPending ? "rounded-(--radius-3) p-1 outline outline-dashed outline-(--accent-7) outline-2" : ""}`}
      >
        {pendingLabel && (
          <PendingBanner
            label={pendingLabel}
            onApply={onApplyPending}
            onReject={onRejectPending}
          />
        )}
        {children}
      </Box>
    );
  }

  return (
    <Box
      className={`group relative flex h-full min-w-0 flex-col overflow-hidden rounded-(--radius-3) border bg-(--gray-1) ${
        isPending ? "border-(--accent-7) border-dashed" : "border-(--gray-5)"
      }`}
    >
      {pendingLabel && (
        <PendingBanner
          label={pendingLabel}
          onApply={onApplyPending}
          onReject={onRejectPending}
        />
      )}
      {(label || headerAction || onRemove || onResize) && (
        <Flex
          align="center"
          justify="between"
          gap="2"
          className="shrink-0 border-(--gray-4) border-b px-3 py-2"
        >
          <Flex align="center" gap="2" className="min-w-0 text-(--gray-11)">
            {Icon && <Icon size={13} weight="duotone" />}
            {label && (
              <Text
                as="span"
                weight="medium"
                className="truncate text-(--gray-12) text-[12px]"
              >
                {label}
              </Text>
            )}
          </Flex>
          <Flex align="center" gap="2" className="shrink-0">
            {headerAction}
            {(onResize || onRemove) && (
              <Box className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((v) => !v);
                  }}
                  aria-label="Tile options"
                  className="flex h-6 w-6 items-center justify-center rounded-(--radius-2) text-(--gray-10) opacity-0 transition-opacity hover:bg-(--gray-3) hover:text-(--gray-12) group-hover:opacity-100"
                >
                  <DotsThree size={14} weight="bold" />
                </button>
                {menuOpen && (
                  <Box className="absolute top-7 right-0 z-10 w-44 overflow-hidden rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1) shadow-lg">
                    {onResize &&
                      SIZE_ORDER.map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => {
                            onResize(s);
                            setMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] hover:bg-(--gray-3) ${
                            tile.size === s
                              ? "text-(--gray-12)"
                              : "text-(--gray-11)"
                          }`}
                        >
                          {SIZE_LABEL[s]}
                          {tile.size === s && <Check size={12} weight="bold" />}
                        </button>
                      ))}
                    {onRemove && onResize && (
                      <Box className="border-(--gray-4) border-t" />
                    )}
                    {onRemove && (
                      <button
                        type="button"
                        onClick={() => {
                          onRemove();
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-(--red-11) text-[12px] hover:bg-(--red-3)"
                      >
                        <TrashSimple size={12} weight="bold" />
                        Remove tile
                      </button>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Flex>
        </Flex>
      )}
      <Box className="min-h-0 flex-1 overflow-auto">{children}</Box>
    </Box>
  );
}

function PendingBanner({
  label,
  onApply,
  onReject,
}: {
  label: string;
  onApply?: () => void;
  onReject?: () => void;
}) {
  return (
    <Flex
      align="center"
      justify="between"
      gap="2"
      className="shrink-0 border-(--accent-6) border-b bg-(--accent-2) px-3 py-1.5"
    >
      <Text
        as="span"
        weight="medium"
        className="text-(--accent-11) text-[11px] uppercase tracking-wide"
      >
        {label}
      </Text>
      <Flex gap="1">
        {onReject && (
          <button
            type="button"
            onClick={onReject}
            aria-label="Reject"
            className="flex h-5 w-5 items-center justify-center rounded-(--radius-2) text-(--gray-11) hover:bg-(--gray-4) hover:text-(--gray-12)"
          >
            <X size={11} weight="bold" />
          </button>
        )}
        {onApply && (
          <button
            type="button"
            onClick={onApply}
            aria-label="Accept"
            className="flex h-5 items-center gap-1 rounded-(--radius-2) bg-(--accent-9) px-2 text-(--accent-1) text-[11px] hover:bg-(--accent-10)"
          >
            <Check size={11} weight="bold" />
            Accept
          </button>
        )}
      </Flex>
    </Flex>
  );
}
