type PokemonBallBackgroundProps = {
  opacity?: number
  saturation?: number
  showConstruction?: boolean
}

const INK = '#2c2823'
const SHELL = '#f3ece0'
const LINE = '#8a7f6d'

type Ball = {
  id: string
  cx: number
  cy: number
  r: number
  rotate: number
  hue: string
  band: number
  stroke: number
  halo: number[]
}

const BALLS: Ball[] = [
  { id: 'a', cx: 52, cy: 318, r: 158, rotate: -14, hue: '#b8483c', band: 36, stroke: 2.5, halo: [188, 212] },
  { id: 'b', cx: 628, cy: 46, r: 118, rotate: 24, hue: '#3f6f9c', band: 28, stroke: 2, halo: [142, 162] },
  { id: 'c', cx: 352, cy: 352, r: 74, rotate: -38, hue: '#c9a13a', band: 18, stroke: 1.6, halo: [94] },
  { id: 'd', cx: 512, cy: 222, r: 42, rotate: 52, hue: '#6b5192', band: 11, stroke: 1.3, halo: [58] },
  { id: 'e', cx: 176, cy: 72, r: 58, rotate: 8, hue: '#4a4640', band: 14, stroke: 1.4, halo: [76] },
]

const AXES = 'M0 318H680M52 0V383M628 130V0M0 46H680'

const LINKS =
  'M52 318L628 46M52 318L352 352M628 46L512 222M176 72L52 318M512 222L352 352M176 72L628 46'

function PokeBall({ cx, cy, r, rotate, hue, band, stroke, id }: Ball) {
  const clip = `gk-ball-${id}`
  const core = r * 0.29
  return (
    <>
      <clipPath id={clip}>
        <circle cx={cx} cy={cy} r={r} />
      </clipPath>
      <g clipPath={`url(#${clip})`} transform={`rotate(${rotate} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill={SHELL} />
        <path d={`M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}Z`} fill={hue} />
        <rect x={cx - r} y={cy - band / 2} width={r * 2} height={band} fill={INK} />
        <circle cx={cx} cy={cy} r={core} fill={INK} />
        <circle cx={cx} cy={cy} r={core * 0.73} fill={SHELL} />
        <circle cx={cx} cy={cy} r={core * 0.43} fill={INK} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={INK} strokeWidth={stroke} opacity="0.52" />
    </>
  )
}

export function PokemonBallBackground({
  opacity = 0.3,
  saturation = 0.55,
  showConstruction = true,
}: PokemonBallBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 680 383"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g opacity={opacity} style={{ filter: `saturate(${saturation})` }}>
          {BALLS.map((b) => (
            <PokeBall key={b.id} {...b} />
          ))}

          {showConstruction && (
            <>
              <g stroke={LINE} strokeWidth="0.5" fill="none" opacity="0.5">
                {BALLS.flatMap((b) =>
                  b.halo.map((hr) => (
                    <circle key={`${b.id}-${hr}`} cx={b.cx} cy={b.cy} r={hr} />
                  )),
                )}
                <path d={AXES} />
              </g>

              <g stroke={LINE} strokeWidth="0.5" fill="none" opacity="0.35">
                <path d={LINKS} />
              </g>

              <g fill={LINE} opacity="0.45">
                {BALLS.map((b) => (
                  <circle key={`n-${b.id}`} cx={b.cx} cy={b.cy} r={b.r > 100 ? 2.5 : 2} />
                ))}
              </g>
            </>
          )}
        </g>
      </svg>
    </div>
  )
}
