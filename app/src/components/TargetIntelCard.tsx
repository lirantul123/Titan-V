import type { Target } from "../lib/types";

type TargetIntelCardProps = {
  visible: boolean;
  target: Target | null;
  index: number;
  temp: string;
  wind: string;
  onClose: () => void;
  onCenter: () => void;
  onRefreshWeather: () => void;
  onRemove: () => void;
  onCopyCoords: () => void;
};

export function TargetIntelCard({
  visible,
  target,
  index,
  temp,
  wind,
  onClose,
  onCenter,
  onRefreshWeather,
  onRemove,
  onCopyCoords,
}: TargetIntelCardProps) {
  if (!target) return null;

  return (
    <div
      className={`intel-card-inner glass absolute right-4 top-4 z-[1000] w-[min(18rem,calc(100vw-5.5rem))] min-w-0 max-w-[18rem] border-l-2 border-cyan-500 p-4 shadow-2xl sm:right-6 sm:top-6 sm:p-5 ${
        visible ? "visible" : ""
      }`}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <span className="data-font shrink-0 text-[8px] font-bold uppercase tracking-widest text-cyan-400">
          Area [{index + 1}]
        </span>
        <button
          type="button"
          onClick={onClose}
          className="data-font shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <h2
        className="mb-2 break-words text-base font-black uppercase leading-snug tracking-tight text-white sm:text-lg"
        title={target.name}
      >
        {target.name}
      </h2>

      <p className="data-font mb-4 break-all text-[10px] tracking-widest text-white/30">
        {Number(target.lat).toFixed(4)}, {Number(target.lon).toFixed(4)}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded border border-white/5 bg-black/40 p-3">
          <span className="mb-1 block text-[8px] uppercase text-white/20">Heat</span>
          <span className="data-font text-lg font-bold text-white">{temp}</span>
        </div>
        <div className="rounded border border-white/5 bg-black/40 p-3">
          <span className="mb-1 block text-[8px] uppercase text-white/20">Wind</span>
          <span className="data-font text-lg font-bold text-white">{wind}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <IntelAction label="Center" onClick={onCenter} />
        <IntelAction label="Weather" onClick={onRefreshWeather} />
        <IntelAction label="Copy" onClick={onCopyCoords} />
        <IntelAction label="Remove" variant="danger" onClick={onRemove} />
      </div>
    </div>
  );
}

function IntelAction({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`data-font rounded border px-2 py-2 text-[9px] font-black uppercase tracking-wider transition-all ${
        variant === "danger"
          ? "border-red-500/30 bg-red-500/5 text-red-300/90 hover:border-red-400/50 hover:bg-red-500/15 hover:text-red-100"
          : "border-cyan-500/25 bg-cyan-500/5 text-cyan-200/90 hover:border-cyan-400/45 hover:bg-cyan-500/12 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
