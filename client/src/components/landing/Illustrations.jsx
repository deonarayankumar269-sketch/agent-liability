const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Mandate() {
  return (
    <>
      <rect x="64" y="26" width="196" height="188" {...common} />
      <path d="M88 62h120M88 82h148M88 102h96M88 122h130" {...common} />
      <path d="M86 176c14-30 22 18 36-8s22-14 34-2 18 2 34-14" {...common} stroke="#E24B26" strokeWidth="2" />
      <circle cx="300" cy="150" r="40" {...common} />
      <circle cx="300" cy="150" r="28" {...common} />
      <path d="M284 150l11 11 21-24" {...common} />
      <path d="M282 186l-10 38 28-14 28 14-10-38" {...common} />
    </>
  );
}

function Hold() {
  return (
    <>
      <circle cx="96" cy="150" r="44" {...common} />
      <circle cx="96" cy="150" r="30" {...common} />
      <path d="M96 128v44M86 138h14a8 8 0 0 1 0 16H86h16a8 8 0 0 1 0 16H86" {...common} />
      <rect x="196" y="112" width="124" height="96" {...common} />
      <path d="M220 112V84a38 38 0 0 1 76 0v28" {...common} />
      <circle cx="258" cy="156" r="9" {...common} stroke="#E24B26" strokeWidth="2" />
      <path d="M258 165v18" {...common} stroke="#E24B26" strokeWidth="2" />
      <path d="M148 150h36M176 140l10 10-10 10" {...common} />
    </>
  );
}

function Check() {
  const rows = [58, 112, 166];
  return (
    <>
      {rows.map((y, i) => (
        <g key={y}>
          <rect x="60" y={y} width="34" height="34" {...common} />
          <path d={`M68 ${y + 18}l8 8 12-16`} {...common} />
          <path d={`M122 ${y + 17}h${150 - i * 24}`} {...common} />
        </g>
      ))}
      <path d="M44 139h316" {...common} stroke="#E24B26" strokeWidth="1.5" strokeDasharray="4 7" />
      <circle cx="372" cy="139" r="5" fill="#E24B26" stroke="none" />
    </>
  );
}

function Stop() {
  return (
    <>
      <rect x="48" y="62" width="130" height="130" {...common} />
      <path d="M78 128l24 24 52-56" {...common} />
      <path d="M196 127h36M222 116l12 11-12 11" {...common} />
      <rect x="250" y="62" width="130" height="130" {...common} />
      <path d="M262 180l106-106" {...common} stroke="#E24B26" strokeWidth="2.5" />
      <path d="M64 218h300" {...common} />
    </>
  );
}

function Dispute() {
  return (
    <>
      <rect x="60" y="30" width="150" height="124" {...common} />
      <path d="M80 62h90M80 84h110M80 106h70" {...common} />
      <rect x="120" y="58" width="150" height="124" {...common} />
      <path d="M140 90h90M140 112h110M140 134h70" {...common} />
      <rect x="240" y="170" width="76" height="40" rx="20" {...common} />
      <rect x="296" y="170" width="76" height="40" rx="20" {...common} stroke="#E24B26" strokeWidth="2" />
      <path d="M84 196h120" {...common} />
    </>
  );
}

const kinds = { mandate: Mandate, hold: Hold, check: Check, stop: Stop, dispute: Dispute };

export function PathIllustration({ kind }) {
  const Art = kinds[kind] || Mandate;
  return (
    <svg viewBox="0 0 420 240" className="h-full w-full" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <Art />
    </svg>
  );
}
