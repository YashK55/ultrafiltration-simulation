import { ForwardedRef, forwardRef } from "react";

interface ControllerSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  description: string;
  precision?: number;
  onChange: (value: number) => void;
  inputRef?: (el: HTMLInputElement | null) => void;
}

export function ControllerSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  description,
  precision = 0,
  onChange,
  inputRef,
}: ControllerSliderProps) {
  const displayValue =
    typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(precision)
      : value;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-200">{label}</span>
        <span className="text-slate-400">
          {displayValue} {unit}
        </span>
      </div>

      <input
        ref={inputRef}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-400 cursor-pointer"
      />

      <div className="text-[11px] text-slate-500 leading-snug">
        {description}
      </div>
    </div>
  );
}
