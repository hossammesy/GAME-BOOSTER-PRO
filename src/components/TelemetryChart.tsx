import React from 'react';

interface TelemetryChartProps {
  titleAr: string;
  unit: string;
  currentValueLabel: string;
  values: number[];
  maxValue: number;
  strokeColor: string;
  fillColor: string;
  subtitleAr?: string;
  isAvailable?: boolean;
  isStaticBaseline?: boolean;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  titleAr,
  unit,
  currentValueLabel,
  values,
  maxValue,
  strokeColor,
  fillColor,
  subtitleAr,
  isAvailable = true,
  isStaticBaseline = false,
}) => {
  const width = 420;
  const height = 130;
  const padX = 8;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const safeValues = values.length > 0 ? values : [0];
  const divisor = Math.max(1, safeValues.length - 1);

  const points = safeValues.map((val, idx) => {
    const clamped = Math.max(0, Math.min(maxValue, val));
    const x = padX + (idx / divisor) * innerW;
    const y = padY + innerH - (clamped / maxValue) * innerH;
    return { x, y };
  });

  const linePath =
    points.length === 1
      ? `M ${padX} ${points[0].y} L ${width - padX} ${points[0].y}`
      : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const areaPath =
    points.length === 1
      ? `M ${padX} ${points[0].y} L ${width - padX} ${points[0].y} L ${width - padX} ${height - padY} L ${padX} ${height - padY} Z`
      : `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padY} L ${points[0].x.toFixed(1)} ${height - padY} Z`;

  return (
    <div className="rounded-xl bg-white dark:bg-[#1E3E62]/30 border border-slate-200 dark:border-[#1E3E62] p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {titleAr}
          </h3>
          {subtitleAr && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitleAr}
            </p>
          )}
        </div>
        <div className="text-left" dir="ltr">
          {isAvailable ? (
            <>
              <span className="text-lg font-bold font-mono-tabular text-slate-900 dark:text-white">
                {currentValueLabel}
              </span>
              {unit && (
                <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 ml-1">
                  {unit}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400" dir="rtl">
              غير متاح
            </span>
          )}
        </div>
      </div>

      {!isAvailable ? (
        <div className="h-32 rounded-lg border border-dashed border-slate-200 dark:border-[#2E5077]/60 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
          المقياس غير متاح بدون اتصال مستشعرات الوكيل المحلي
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="w-full overflow-hidden" dir="ltr">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-32 block"
              role="img"
              aria-label={titleAr}
            >
              {[0.25, 0.5, 0.75].map((ratio) => {
                const y = padY + innerH * ratio;
                return (
                  <line
                    key={ratio}
                    x1={padX}
                    y1={y}
                    x2={width - padX}
                    y2={y}
                    stroke="currentColor"
                    className="text-slate-200 dark:text-[#2E5077]/50"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                );
              })}
              <path d={areaPath} fill={fillColor} />
              <path
                d={linePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={isStaticBaseline ? '5 4' : undefined}
              />
            </svg>
          </div>
          {isStaticBaseline && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              قيمة مرجعية ثابتة للعرض التجريبي (خط متقطع — ليست قراءة حية).
            </div>
          )}
        </div>
      )}
    </div>
  );
};
