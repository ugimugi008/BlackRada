type BrandLogoProps = {
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Black Rada brand lockup: crest (Ukrainian-flag shield with crossed revolvers)
 * plus the "BLACK RADA" wordmark.
 */
export default function BrandLogo({ size = 'md', className = '' }: BrandLogoProps) {
  const mark = size === 'sm' ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-7 w-7 min-[381px]:h-8 min-[381px]:w-8 sm:h-10 sm:w-10';
  const text = size === 'sm' ? 'text-[15px] sm:text-[17px]' : 'text-[14px] min-[381px]:text-[16px] sm:text-[21px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 sm:gap-2 select-none whitespace-nowrap shrink-0 ${className}`}
      aria-label="Black Rada"
      role="img"
    >
      <img
        src="/black-rada-mark.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        className={`${mark} shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]`}
      />
      <span
        aria-hidden="true"
        className={`${text} font-brand font-bold uppercase leading-none tracking-[0.05em] min-[381px]:tracking-[0.08em] sm:tracking-[0.14em]`}
      >
        <span className="text-white">Black</span>
        <span className="ml-[0.32em] bg-gradient-to-b from-[#FFE27A] to-[#E0A92B] bg-clip-text text-transparent">
          Rada
        </span>
      </span>
    </span>
  );
}
