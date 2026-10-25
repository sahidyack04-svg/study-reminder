/**
 * Study Reminder mark: an open book (learning) beneath a tilted orbital ring (the
 * universe) with a small star (progress/achievement) riding the ring. One <svg> with
 * a shared gradient def, reused everywhere instead of the old flat "SR" badge.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sr-logo-gradient" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="55%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>

      <rect x="1" y="1" width="38" height="38" rx="10" fill="url(#sr-logo-gradient)" />

      {/* Open book */}
      <path
        d="M9 27.5V16.2c3-1.6 6.6-1.6 9 .4v11.3c-2.4-2-6-2-9 .3Z"
        fill="rgba(5,6,11,0.92)"
      />
      <path
        d="M31 27.5V16.2c-3-1.6-6.6-1.6-9 .4v11.3c2.4-2 6-2 9 .3Z"
        fill="rgba(5,6,11,0.92)"
      />

      {/* Orbital ring */}
      <ellipse
        cx="20"
        cy="16"
        rx="13.5"
        ry="5"
        transform="rotate(-18 20 16)"
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="1.4"
      />

      {/* Star riding the ring */}
      <path
        d="M29.2 9.4l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9.9-2Z"
        fill="#FDE68A"
      />
    </svg>
  );
}

export function Logo({
  size = 28,
  wordmark = true,
  className = "",
}: {
  size?: number;
  wordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      {wordmark && <span className="text-base font-semibold text-ink">Study Reminder</span>}
    </span>
  );
}
