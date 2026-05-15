import type { MouseEvent, ReactNode } from "react";

type MapToolbarProps = {
  pinMode: boolean;
  pinBusy?: boolean;
  onPinModeChange: (enabled: boolean) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll: () => void;
  areaCount: number;
};

export function MapToolbar({
  pinMode,
  pinBusy = false,
  onPinModeChange,
  onZoomIn,
  onZoomOut,
  onFitAll,
  areaCount,
}: MapToolbarProps) {
  const togglePin = (e: MouseEvent<HTMLButtonElement>) => {
    onPinModeChange(!pinMode);
    e.currentTarget.blur();
  };

  return (
    <div
      className="absolute left-4 top-4 z-[1000] flex items-start gap-2"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="map-toolbar glass flex flex-col gap-1 rounded-lg p-1.5 shadow-lg">
        <ToolbarBtn title="Zoom in" onClick={onZoomIn}>
          +
        </ToolbarBtn>
        <ToolbarBtn title="Zoom out" onClick={onZoomOut}>
          −
        </ToolbarBtn>
        <div className="my-0.5 h-px bg-white/10" />
        <ToolbarBtn title="Fit all areas" onClick={onFitAll} disabled={areaCount === 0}>
          ⊞
        </ToolbarBtn>
        <div className="my-0.5 h-px bg-white/10" />
        <ToolbarBtn
          title={pinMode ? "Exit pin mode" : "Pin mode — click map to add an area"}
          active={pinMode}
          onClick={togglePin}
        >
          ⊕
        </ToolbarBtn>
      </div>

      {pinMode ? (
        <div className="map-pin-hint data-font max-w-[11rem] rounded border border-cyan-500/40 bg-black/85 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-cyan-300/95 shadow-lg backdrop-blur-sm">
          {pinBusy ? "Resolving location…" : "Click map to drop a pin"}
        </div>
      ) : null}
    </div>
  );
}

function ToolbarBtn({
  children,
  title,
  onClick,
  active,
  disabled,
}: {
  children: ReactNode;
  title: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-pressed={active ?? false}
      onClick={(e) => {
        onClick(e);
        e.currentTarget.blur();
      }}
      className={`map-toolbar-btn data-font flex h-9 w-9 items-center justify-center rounded text-sm font-black transition-all ${
        active
          ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,243,255,0.5)]"
          : "text-cyan-300/90"
      } ${disabled ? "cursor-not-allowed opacity-30" : ""}`}
    >
      {children}
    </button>
  );
}
