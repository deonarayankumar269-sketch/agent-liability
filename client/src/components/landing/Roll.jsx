const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// every digit is a column 0-9 inside a one-em window, the page tweens the column up to the digit
export default function Roll({ value, className = '' }) {
  return (
    <span className={`roll inline-flex ${className}`} role="img" aria-label={String(value)}>
      {String(value).split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} aria-hidden="true" className="relative inline-block h-[1em] overflow-hidden leading-none">
            <span className="roll-col flex flex-col will-change-transform" data-digit={ch}>
              {DIGITS.map((n) => (
                <span key={n} className="block h-[1em] leading-none">{n}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">{ch}</span>
        )
      )}
    </span>
  );
}
