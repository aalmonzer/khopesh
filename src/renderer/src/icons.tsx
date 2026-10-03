export const WrenchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

// A khopesh: the curved bronze blade of ancient Egypt.
export const KhopeshMark = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="khopesh-bronze" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#9a6b2f" />
        <stop offset="0.55" stopColor="#e2b867" />
        <stop offset="1" stopColor="#f6dfa3" />
      </linearGradient>
    </defs>
    <path d="M8 58 L19 47" stroke="#6b5132" strokeWidth="6" strokeLinecap="round" />
    <path d="M15 41 L25 51" stroke="#b08a50" strokeWidth="3.5" strokeLinecap="round" />
    <path
      fill="url(#khopesh-bronze)"
      d="M18 45 L30 33 C37 24 50 12 57 21 C63 30 56 44 41 46 C49 41 53 34 50 28 C47 22 40 27 34 36 L22 49 Z"
    />
  </svg>
);

// A waveform cut in two by a blade stroke.
export const SplitWaveIcon = () => (
  <svg className="split-wave" width="56" height="40" viewBox="0 0 56 40" aria-hidden="true">
    {[10, 22, 30, 16, 36, 24, 12, 28, 34, 18, 26, 14].map((h, i) => (
      <rect
        key={i}
        x={2 + i * 4.5}
        y={20 - h / 2}
        width="2.5"
        height={h}
        rx="1.25"
        fill={i < 6 ? "#d9ad5f" : "#8b8376"}
      />
    ))}
    <path d="M30 2 L26 38" stroke="#f2ede4" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
  </svg>
);
