type Props = {
  size?: number;
  className?: string;
  withText?: boolean;
};

export function Logo({ size = 28, className = "", withText = false }: Props) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Showdown"
      >
        <defs>
          <linearGradient id="sd-grad-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#0f3d2e" />
          </linearGradient>
          <linearGradient id="sd-grad-b" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#7c2d12" />
          </linearGradient>
        </defs>
        <g transform="translate(24 24)">
          <rect
            x="-11"
            y="-15"
            width="22"
            height="30"
            rx="3"
            transform="rotate(-18)"
            fill="url(#sd-grad-a)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1.2"
          />
          <rect
            x="-11"
            y="-15"
            width="22"
            height="30"
            rx="3"
            transform="rotate(18) translate(4 0)"
            fill="url(#sd-grad-b)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.2"
          />
          <text
            x="3"
            y="2"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="13"
            fontWeight="700"
            fill="#fff7ed"
            transform="rotate(18)"
            fontFamily="ui-sans-serif, system-ui"
          >
            A
          </text>
        </g>
      </svg>
      {withText ? (
        <span className="font-semibold tracking-tight text-zinc-100">
          Showdown
        </span>
      ) : null}
    </div>
  );
}
