'use client';

interface WalletLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

export function WalletLogo({
  size = 'md',
  showWordmark = true,
  className = '',
}: WalletLogoProps) {
  const boxSizes = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-9 h-9 rounded-xl',
    lg: 'w-12 h-12 rounded-2xl',
  };
  const svgSizes = {
    sm: 18,
    md: 20,
    lg: 28,
  };
  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div
        className={`${boxSizes[size]} flex items-center justify-center shrink-0 shadow-sm`}
        style={{
          background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
        }}
        aria-hidden="true"
      >
        <svg
          width={svgSizes[size]}
          height={svgSizes[size]}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Back wallet flap */}
          <path
            d="M4.5 7.5C4.5 6.12 5.62 5 7 5H16.5C17.6 5 18.5 5.9 18.5 7V8.5H4.5V7.5Z"
            fill="#A7F3D0"
          />
          {/* Main wallet body */}
          <rect x="3" y="8" width="18" height="11.5" rx="3" fill="#FFFFFF" />
          {/* Clasp */}
          <path
            d="M15.5 12H21V15.5H15.5C14.53 15.5 13.75 14.72 13.75 13.75C13.75 12.78 14.53 12 15.5 12Z"
            fill="#0F1B22"
            fillOpacity="0.12"
          />
          <circle cx="15.8" cy="13.75" r="1.15" fill="#059669" />
        </svg>
      </div>
      {showWordmark && (
        <span className={`${textSizes[size]} font-bold tracking-tight text-[var(--mw-text)]`}>
          My Wallet
        </span>
      )}
    </div>
  );
}
