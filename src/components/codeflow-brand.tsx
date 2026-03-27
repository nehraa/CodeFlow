"use client";

type CodeflowCatLogoProps = {
  size?: number;
  className?: string;
};

export function CodeflowCatLogo({ size = 40, className }: CodeflowCatLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      height={size}
      viewBox="0 0 128 128"
      width={size}
    >
      <g transform="translate(64 68)">
        <path
          d="M -24 14 C -32 6 -31 -13 -20 -24 C -9 -35 9 -35 20 -24 C 31 -13 32 6 24 14 C 17 22 7 26 0 26 C -7 26 -17 22 -24 14 Z"
          fill="#f59e0b"
          stroke="#132238"
          strokeWidth="4"
        />
        <path
          d="M -17 -20 L -26 -40 L -7 -29 Z"
          fill="#f59e0b"
          stroke="#132238"
          strokeWidth="4"
        />
        <path
          d="M 17 -20 L 26 -40 L 7 -29 Z"
          fill="#f59e0b"
          stroke="#132238"
          strokeWidth="4"
        />
        <circle cx="-9" cy="-2" fill="#132238" r="4.5" />
        <circle cx="9" cy="-2" fill="#132238" r="4.5" />
        <path d="M -5 9 Q 0 14 5 9" fill="none" stroke="#132238" strokeLinecap="round" strokeWidth="4" />
        <path d="M -4 4 L 0 7 L 4 4 Z" fill="#fb7185" />
        <path d="M -9 9 L -24 6" fill="none" stroke="#132238" strokeLinecap="round" strokeWidth="3" />
        <path d="M -9 12 L -24 14" fill="none" stroke="#132238" strokeLinecap="round" strokeWidth="3" />
        <path d="M 9 9 L 24 6" fill="none" stroke="#132238" strokeLinecap="round" strokeWidth="3" />
        <path d="M 9 12 L 24 14" fill="none" stroke="#132238" strokeLinecap="round" strokeWidth="3" />
        <circle cx="28" cy="-26" fill="#14b8a6" r="8" />
        <path d="M 28 -32 V -20 M 22 -26 H 34" fill="none" stroke="#ecfeff" strokeLinecap="round" strokeWidth="3" />
      </g>
    </svg>
  );
}
