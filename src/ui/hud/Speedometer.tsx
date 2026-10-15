const CX = 150;
const CY = 150;
const START = 135; // degrees, SVG angle (0 = right, clockwise positive)
const SWEEP = 270;
export const SPEED_MAX = 260;
export const RPM_MAX = 8000;
export const REDLINE = 7000;

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (deg: number, r: number) => [CX + r * Math.cos(rad(deg)), CY + r * Math.sin(rad(deg))] as const;
function arc(r: number): string {
  const [x0, y0] = pt(START, r);
  const [x1, y1] = pt(START + SWEEP, r);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export interface SpeedoRefs {
  needle: SVGGElement | null;
  speed: SVGTextElement | null;
  gear: SVGTextElement | null;
  rpmArc: SVGPathElement | null;
  rpmText: SVGTextElement | null;
  surface: SVGTextElement | null;
}

/** Large analogue speedometer (SVG). Needle / arc / digits are updated imperatively by the HUD loop. */
export function Speedometer({ setRefs }: { setRefs: (r: SpeedoRefs) => void }) {
  const ticks: React.ReactNode[] = [];
  for (let v = 0; v <= SPEED_MAX; v += 10) {
    const major = v % 20 === 0;
    const a = START + (v / SPEED_MAX) * SWEEP;
    const [x0, y0] = pt(a, major ? 118 : 123);
    const [x1, y1] = pt(a, 130);
    ticks.push(<line key={v} x1={x0} y1={y0} x2={x1} y2={y1} stroke={v > 220 ? '#ff4d4d' : '#dfe6f3'} strokeWidth={major ? 2.4 : 1.2} />);
    if (v % 40 === 0) {
      const [tx, ty] = pt(a, 101);
      ticks.push(<text key={`t${v}`} x={tx} y={ty + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill="#cfd8e8">{v}</text>);
    }
  }
  const redStart = (REDLINE / RPM_MAX) * 100;
  const refs: SpeedoRefs = { needle: null, speed: null, gear: null, rpmArc: null, rpmText: null, surface: null };
  const commit = () => setRefs(refs);
  return (
    <svg className="speedo" viewBox="0 0 300 300" role="img" aria-label="Speedometer">
      <defs>
        <radialGradient id="dial" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#141a29" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#0a0e18" stopOpacity="0.96" />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r="146" fill="url(#dial)" stroke="#2c3550" strokeWidth="3" />
      <path d={arc(140)} fill="none" stroke="#1e2638" strokeWidth="3" />
      {ticks}
      {/* RPM arc with redline */}
      <path d={arc(80)} pathLength={100} fill="none" stroke="#222b40" strokeWidth="10" strokeLinecap="butt" />
      <path d={arc(80)} pathLength={100} fill="none" stroke="#7a1f27" strokeWidth="10" strokeDasharray={`${100 - redStart} 100`} strokeDashoffset={-redStart} />
      <path ref={(el) => { refs.rpmArc = el; commit(); }} d={arc(80)} pathLength={100} fill="none" stroke="#35d0ff" strokeWidth="10" strokeDasharray="0 100" />
      <text x={CX} y="68" textAnchor="middle" fontSize="10" fill="#8c98b3" letterSpacing="2">RPM x1000</text>
      <text ref={(el) => { refs.rpmText = el; commit(); }} x={CX} y="84" textAnchor="middle" fontSize="13" fontWeight="700" fill="#35d0ff">0.9</text>
      {/* digital speed */}
      <text ref={(el) => { refs.speed = el; commit(); }} x={CX} y="170" textAnchor="middle" fontSize="58" fontWeight="800" fill="#ffffff" style={{ fontVariantNumeric: 'tabular-nums' }}>0</text>
      <text x={CX} y="190" textAnchor="middle" fontSize="13" fill="#8c98b3" letterSpacing="3">KM/H</text>
      <rect x={CX - 24} y="200" width="48" height="44" rx="8" fill="#10162a" stroke="#2c3550" />
      <text ref={(el) => { refs.gear = el; commit(); }} x={CX} y="233" textAnchor="middle" fontSize="34" fontWeight="800" fill="#ffd166">1</text>
      <text ref={(el) => { refs.surface = el; commit(); }} x={CX} y="262" textAnchor="middle" fontSize="11" fill="#6fcf7a" letterSpacing="2">ASPHALT</text>
      <g ref={(el) => { refs.needle = el; commit(); }} style={{ transformOrigin: '150px 150px', transform: `rotate(${START}deg)` }}>
        <line x1={CX + 22} y1={CY} x2={CX + 128} y2={CY} stroke="#ff3b4a" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="7" fill="#ff3b4a" />
      </g>
    </svg>
  );
}

export { START as SPEEDO_START, SWEEP as SPEEDO_SWEEP };
