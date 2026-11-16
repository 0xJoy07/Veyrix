"use client"

// Neon Hello by Louis Studios.
// 140+ more hand-made React components at https://studios.lou15.com/?ref=21st-code

import * as React from "react"

export interface NeonHelloProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The word the tube writes. "hello" uses a hand-drawn path traced from the reference; any other
   * word is joined from a built-in single-stroke cursive alphabet (a to z; capitals are written
   * as lowercase, a space lifts the pen, other characters are skipped).
   */
  word?: string
  /**
   * Colours along the tube, any CSS colour. They are spread evenly along the stroke and wrap
   * around, so the colour flowing past the end comes back in at the start. Bright, saturated
   * colours read best: where the tube crosses itself the colours add toward white.
   */
  colors?: string[]
  /**
   * The glowing edge frame. `true` uses the reference colours, `false` leaves a black stage, and
   * a list of CSS colours sets its own, clockwise from the top left corner.
   */
  frame?: boolean | string[]
  /** Playback speed. 1 = one write, hold and erase every 10 s for "hello". 0 holds the still frame. */
  speed?: number
  /** Erase and write again forever. Off, the word is written once and then stays, still glowing. */
  loop?: boolean
  /** The frame glow gathers toward the pointer while it is over the component. */
  interactive?: boolean
  /** How much of the width the word may take, 0 to 1. The height limits it too, so it always fits. */
  scale?: number
  /** Content laid over the stage, centred near the bottom edge under the word. */
  children?: React.ReactNode
  /** Accessible name. Defaults to the word. */
  label?: string
}

// ---------------------------------------------------------------------------------------------
// Geometry. Word units are reference pixels of the 1200 x 675 "hello" image: the baseline at
// y 0, the x-height at y -88, ascenders at y -172, descenders at y 82 (y down). The tube is
// RADIUS units thick from its centre line.
// ---------------------------------------------------------------------------------------------

const RADIUS = 15.5

// Points of one stroke: [x, y], [x, y, 1] where the pen turns sharply (a cusp: the tube doubles
// back on itself), or [x, y, 2] for a cusp where the tube turns toward the viewer and shows its
// open end, like the foot of the h in the reference.
type Ctrl = number[]

// "hello", traced over the reference and fitted to its edges: lead-in tail, h loop, the foot of the
// stem where the tube shows its open end (marked 1 here), the arch, e, two l loops, a doubled o
// and the lifted tail. Reference px with the baseline at 410.
// prettier-ignore
const HELLO: Ctrl[] = [[318,396],[340,386],[362,373],[385,353],[404,330],[416,305],[425,278],[429,254],[422,239],[405,234],[392,243],[386,262],[381,290],[378,320],[375,350],[371,380],[368,404,1],[378,384],[393,355],[403,335],[409.6,328.2],[417.9,326],[424,326],[432.2,328.2],[438.3,334.2],[440.5,342.5],[440,355],[438,380],[442,402],[455,412],[472,413],[490,404],[512,390],[533,372],[544,350],[540,330],[522,318],[502,322],[490,342],[489,370],[498,397],[514,412],[535,414],[557,406],[578,392],[599,370],[623,337],[639,305],[650,272],[651,248],[641,237],[626,236],[610,248],[602,275],[598,310],[596,350],[598,385],[607,406],[625,411],[650,407],[669,401],[684,387],[704,347],[725,300],[739,265],[739,247],[730,237],[714,236],[699,248],[691,272],[687,310],[685,350],[688,385],[698,408],[718,412],[739,403],[755,389],[767,363],[777,337],[795,323],[815,322],[835,333],[845,355],[843,383],[830,402],[808,407],[786,400],[772,382],[768,360],[774,338],[790,325],[812,320],[838,324],[857,331],[873,326],[888,317]].map(([x, y, c]) => (c ? [x - 300, y - 410, 2] : [x - 300, y - 410]))

// Single-stroke cursive alphabet. Each glyph starts at its entry on the baseline (0, 0) and ends
// at its exit; `w` is the pen advance. Letters marked `hi` leave from the x-height, and the next
// letter then starts from there. `extra` strokes (dots, crossbars) are written after the word.
type Glyph = { p: string; w: number; hi?: boolean; extra?: string[] }
// prettier-ignore
const GLYPHS: Record<string, Glyph> = {
  a: { p: "0 0,22 -42,50 -80,72 -88!,50 -94,28 -86,14 -60,14 -28,28 -4,50 -6,66 -36,74 -88!,72 -40,74 -12,86 0,104 -4", w: 104 },
  b: { p: "0 0,19 -13,39 -60,59 -103,72 -140,74 -162,64 -173,47 -174,28 -162,19 -135,17 -100,17 -60,20 -22,34 0,56 -6,70 -36,66 -70,50 -88,38 -76!,58 -80,78 -84,96 -82", w: 96, hi: true },
  c: { p: "0 0,22 -46,50 -82,68 -80,60 -92,40 -92,22 -74,14 -42,22 -12,42 2,64 0,84 -4", w: 84 },
  d: { p: "0 0,22 -42,50 -80,72 -88!,50 -94,28 -86,14 -60,14 -28,28 -4,50 -6,66 -36,74 -110,78 -172!,76 -110,74 -40,76 -12,86 0,104 -4", w: 104 },
  e: { p: "0 0,20 -10,44 -30,62 -55,64 -76,50 -88,30 -84,17 -62,14 -34,22 -10,40 2,62 2,84 -4", w: 84 },
  f: { p: "0 0,19 -13,39 -60,59 -103,72 -140,74 -162,64 -173,47 -174,30 -162,22 -130,20 -80,20 -10,20 40,22 80!,34 46,48 16,64 0,84 -4", w: 84 },
  g: { p: "0 0,22 -42,50 -80,72 -88!,50 -94,28 -86,14 -60,14 -28,28 -4,50 -6,66 -36,74 -88!,72 -20,66 40,50 76,30 82,18 64,36 30,66 6,94 -4", w: 94 },
  h: { p: "0 0,19 -13,39 -60,59 -103,72 -140,74 -162,64 -173,47 -174,28 -162,19 -135,17 -100,17 -60,17 -22,18 2!,28 -42,42 -74,60 -88,76 -78,80 -50,78 -20,86 0,104 0,120 -4", w: 120 },
  i: { p: "0 0,16 -30,28 -66,32 -88!,28 -50,28 -14,38 0,58 -4", w: 58, extra: ["30 -136,33 -139"] },
  j: { p: "0 0,16 -30,28 -66,32 -88!,30 -40,28 20,20 66,2 80,-12 64,2 30,26 6,50 -4", w: 50, extra: ["30 -136,33 -139"] },
  k: { p: "0 0,19 -13,39 -60,59 -103,72 -140,74 -162,64 -173,47 -174,28 -162,19 -135,17 -100,17 -60,17 -22,18 2!,28 -44,48 -80,70 -80,68 -56,42 -44!,60 -36,70 -14,82 0,104 -4", w: 104 },
  l: { p: "0 0,19 -13,39 -60,59 -103,72 -140,74 -162,64 -173,47 -174,28 -162,19 -135,17 -100,17 -60,20 -25,29 -3,47 3,72 0,92 -5", w: 92 },
  m: { p: "0 0,16 -50,30 -86,42 -72,40 -30,38 0!,46 -46,62 -84,78 -82,84 -52,82 0!,90 -46,106 -84,122 -82,128 -52,126 -16,134 0,152 -4", w: 152 },
  n: { p: "0 0,18 -50,32 -86,44 -72,42 -30,40 0!,48 -46,66 -84,84 -82,92 -52,90 -16,98 0,118 -4", w: 118 },
  o: { p: "0 0,16 -20,26 -56,44 -84,66 -86,80 -62,78 -28,60 -4,40 -2,26 -24,28 -62,46 -86,70 -90,96 -84", w: 96, hi: true },
  p: { p: "0 0,18 -46,32 -90!,28 -40,26 20,24 84!,30 20,40 -40,56 -82,76 -84,86 -60,80 -24,60 -2,40 -4!,62 0,80 0,96 -4", w: 96 },
  q: { p: "0 0,22 -42,50 -80,72 -88!,50 -94,28 -86,14 -60,14 -28,28 -4,50 -6,66 -36,74 -88!,72 -20,72 40,74 82!,84 40,96 6,112 -4", w: 112 },
  r: { p: "0 0,18 -50,32 -92!,46 -78,62 -82!,60 -40,62 -10,74 0,92 -4", w: 92 },
  s: { p: "0 0,22 -46,40 -92!,54 -62,62 -32,54 -8,34 0,20 -8!,40 0,62 0,80 -4", w: 80 },
  t: { p: "0 0,16 -40,30 -100,36 -140!,30 -90,28 -40,30 -10,42 2,64 -4", w: 64, extra: ["8 -92,58 -96"] },
  u: { p: "0 0,14 -30,24 -70,26 -88!,22 -50,24 -14,38 2,56 -6,70 -40,76 -88!,74 -40,76 -10,86 0,104 -4", w: 104 },
  v: { p: "0 0,18 -40,30 -88!,34 -50,44 -12,56 0,68 -30,76 -70,78 -88,84 -80,100 -84", w: 100, hi: true },
  w: { p: "0 0,16 -40,26 -88!,28 -50,38 -10,50 0,62 -30,66 -70!,70 -30,82 -4,96 -20,106 -60,108 -88,114 -80,130 -84", w: 130, hi: true },
  x: { p: "0 0,22 -50,40 -84,58 -84,64 -50,70 -16,84 0,104 -4", w: 104, extra: ["26 -2,52 -44,80 -88"] },
  y: { p: "0 0,14 -30,24 -70,26 -88!,22 -50,24 -14,38 2,56 -6,70 -40,76 -88!,74 -20,68 40,52 76,32 82,20 64,38 30,68 6,94 -4", w: 94 },
  z: { p: "0 0,22 -50,44 -86,66 -86,70 -66,52 -40,36 -30!,60 -26,70 -6,66 30,50 70,34 76,30 58,48 30,74 6,94 -4", w: 94 },
}

function parseGlyph(s: string, dx: number): Ctrl[] {
  return s.split(",").map((t) => {
    const cusp = t.endsWith("!")
    const [x, y] = t.replace("!", "").trim().split(/\s+/).map(Number)
    return cusp ? [x + dx, y, 1] : [x + dx, y]
  })
}

// The word as strokes of control points: one joined stroke per run of letters, then the dots
// and crossbars.
function wordStrokes(word: string): Ctrl[][] {
  const clean = word.trim().toLowerCase()
  if (clean === "hello") return [HELLO]
  const strokes: Ctrl[][] = []
  const extras: Ctrl[][] = []
  let x = 0
  let cur: Ctrl[] = []
  let hi = false
  const flush = () => {
    if (cur.length > 1) {
      // A lead-in from below left and a lifted tail, like the reference.
      const a = cur[0], z = cur[cur.length - 1]
      cur.unshift([a[0] - 34, a[1] + 10])
      cur.push([z[0] + 26, z[1] - 18])
      strokes.push(cur)
    }
    cur = []
    hi = false
  }
  for (const ch of clean) {
    if (ch === " ") {
      flush()
      x += 70
      continue
    }
    const g = GLYPHS[ch]
    if (!g) continue
    let pts = parseGlyph(g.p, x)
    if (hi) {
      // After a letter that leaves from the x-height, the joining stroke starts up there.
      pts = [[x, -84], ...pts.slice(1)]
    }
    // Joining letters share the exit and entry point.
    if (cur.length) pts = pts.slice(1)
    cur.push(...pts)
    for (const e of g.extra || []) extras.push(parseGlyph(e, x))
    hi = !!g.hi
    x += g.w
  }
  flush()
  return [...strokes, ...extras]
}

// One sample of the centre line: position, arc length, writing time, curvature and whether the
// pen turns sharply here.
type Vtx = { x: number; y: number; s: number; t: number; k: number; kr: number; brk: number }

/**
 * Samples the strokes as centripetal Catmull-Rom splines, split at cusps, every 2.5 units or so.
 * Arc length runs on across pen lifts (with a gap) so one clock writes the whole word, and the
 * writing time slows in tight curves and pauses at cusps like a hand does.
 */
function buildPath(strokes: Ctrl[][]) {
  const lines: Vtx[][] = []
  let s = 0
  let t = 0
  let last: Vtx | null = null
  for (const ctrl of strokes) {
    // Pieces between cusps.
    const pieces: number[][][] = []
    const kinds: number[] = []
    let piece: number[][] = []
    for (const c of ctrl) {
      piece.push([c[0], c[1]])
      if (c[2] && piece.length > 1) {
        pieces.push(piece)
        kinds.push(c[2])
        piece = [[c[0], c[1]]]
      }
    }
    if (piece.length > 1) pieces.push(piece)
    if (!pieces.length) continue
    const line: Vtx[] = []
    if (last) {
      const jump = Math.hypot(pieces[0][0][0] - last.x, pieces[0][0][1] - last.y)
      s += 3 * RADIUS
      t += 4 * RADIUS + jump * 0.35
    }
    pieces.forEach((P, pi) => {
      const n = P.length
      const at = (i: number) =>
        i < 0 ? [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]] : i >= n ? [2 * P[n - 1][0] - P[n - 2][0], 2 * P[n - 1][1] - P[n - 2][1]] : P[i]
      for (let i = 0; i < n - 1; i++) {
        const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2)
        const kt = (a: number[], b: number[]) => Math.sqrt(Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), 1e-3))
        const t1 = kt(p0, p1), t2 = t1 + kt(p1, p2), t3 = t2 + kt(p2, p3)
        const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2.5))
        for (let j = i === 0 && pi === 0 ? 0 : 1; j <= steps; j++) {
          if (j === 0 && i === 0 && pi > 0) continue
          const u = t1 + ((t2 - t1) * j) / steps
          const L = (a: number[], b: number[], ta: number, tb: number) => {
            const f = (u - ta) / (tb - ta)
            return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
          }
          const A1 = L(p0, p1, 0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3)
          const B1 = L(A1, A2, 0, t2), B2 = L(A2, A3, t1, t3)
          const q = L(B1, B2, t1, t2)
          line.push({ x: q[0], y: q[1], s: 0, t: 0, k: 0, kr: 0, brk: j === steps && i === n - 2 && pi < pieces.length - 1 ? kinds[pi] : 0 })
        }
      }
    })
    // A light smoothing pass evens out the curvature jumps a Catmull-Rom spline leaves at its
    // control points (ends and cusps stay put), so no turn is tighter than it looks.
    for (let it = 0; it < 6; it++) {
      const px = line.map((v) => v.x), py = line.map((v) => v.y)
      for (let i = 1; i < line.length - 1; i++) {
        if (line[i].brk) continue
        line[i].x = px[i] * 0.5 + (px[i - 1] + px[i + 1]) * 0.25
        line[i].y = py[i] * 0.5 + (py[i - 1] + py[i + 1]) * 0.25
      }
    }
    // Curvature: the turn of the tangent over about two tube radii, so it stays smooth.
    const span = Math.max(2, Math.round((1.2 * RADIUS) / 2.5))
    for (let i = 0; i < line.length; i++) {
      // Stay on this side of a cusp.
      let a = i, c = i
      while (a > 0 && i - a < span && !line[a - 1].brk) a--
      while (c < line.length - 1 && c - i < span && !line[c].brk) c++
      if (c - a < 2) continue
      const p = line[a], q = line[Math.min(a + 1, c)], r = line[Math.max(c - 1, a)], w = line[c]
      const ux = q.x - p.x, uy = q.y - p.y, vx = w.x - r.x, vy = w.y - r.y
      let len = 0
      for (let j = a; j < c; j++) len += Math.hypot(line[j + 1].x - line[j].x, line[j + 1].y - line[j].y)
      if (len < 1e-6) continue
      line[i].k = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy) / len
    }
    // Local curvature from the neighbours, which keeps the peaks the smoothed value hides.
    for (let i = 1; i < line.length - 1; i++) {
      const a = line[i - 1], b = line[i], c = line[i + 1]
      if (b.brk) continue
      const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y
      const len = (Math.hypot(ux, uy) + Math.hypot(vx, vy)) / 2
      if (len > 1e-6) b.kr = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy) / len
    }
    // Turns tighter than the tube itself become soft cusps (the tube doubles back with round
    // ends), where a single bent tube would fold through itself. Sharp corners between samples
    // count too.
    for (let i = 1; i < line.length - 1; i++) {
      const a = line[i - 1], b = line[i], c = line[i + 1]
      const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y
      const corner = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy))
      const tight = Math.abs(b.k) * RADIUS > 0.95 && Math.abs(b.k) >= Math.abs(a.k) && Math.abs(b.k) >= Math.abs(c.k)
      if (!b.brk && !a.brk && (corner > 0.6 || tight)) b.brk = 1
    }
    for (let i = 0; i < line.length; i++) {
      if (i > 0) {
        const ds = Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y)
        s += ds
        t += ds * (1 + 1.1 * Math.min(Math.abs(line[i].k) * RADIUS, 1.5))
        if (line[i - 1].brk) t += 1.4 * RADIUS
      }
      line[i].s = s
      line[i].t = t
    }
    lines.push(line)
    last = line[line.length - 1]
  }
  // An empty word still gets a box, the size of "o", so the layout never divides by zero.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const l of lines) for (const v of l) {
    x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y)
  }
  if (!lines.length) [x0, y0, x1, y1] = [0, -88, 96, 0]
  return { lines, length: s, time: t, box: [x0 - RADIUS, y0 - RADIUS, x1 + RADIUS, y1 + RADIUS] }
}

type Path = ReturnType<typeof buildPath>

// Per segment: A, B, the points before A and after B (the bisectors at the joints), arc length at
// A and B, flags (1 = round cap at A, 2 = round cap at B, 4 = that cap is a plain cusp) and the
// smoothed curvature; then the run of tube it belongs to (between cusps): arc length and position
// of its start and end and what each end shows; and the sharpest local curvature at its ends.
const SEG_FLOATS = 24
function segmentData(path: Path) {
  const out: number[] = []
  for (const l of path.lines) {
    // Dots and other tiny strokes stay solid blobs.
    const open = l[l.length - 1].s - l[0].s > 2.5 * RADIUS ? 1 : 0
    let r0 = 0
    for (let i = 0; i < l.length - 1; i++) {
      if (i > 0 && l[i].brk) r0 = i
      let r1 = i + 1
      while (r1 < l.length - 1 && !l[r1].brk) r1++
      const a = l[i], b = l[i + 1]
      // At a plain cusp (brk 1) the tube doubles back: both sides end in round caps that add up
      // like the two arms beside them, with no rim inside the turn. At an open-end cusp (brk 2)
      // the tube going out restarts with a flat cut out of the open end.
      const capA = i === 0 || a.brk === 1
      const capB = i + 1 === l.length - 1 || b.brk > 0
      const p = capA ? a : a.brk ? { x: 2 * a.x - b.x, y: 2 * a.y - b.y } : l[i - 1]
      const n = capB ? b : l[i + 2]
      const s0 = l[r0], s1 = l[r1]
      // Start: 1 = open end, 2 = restart out of an open end (fades in), 3 = after a plain cusp.
      const f0 = r0 === 0 ? open : s0.brk === 2 ? 2 : 3
      // End: 1 = open end, 2 = open-end cusp, 3 = plain cusp, 0 = none.
      const f1 = r1 === l.length - 1 ? open : s1.brk === 2 ? 2 : 3
      const flags = (capA ? 1 : 0) + (capB ? 2 : 0) + (b.brk === 1 ? 4 : 0)
      out.push(a.x, a.y, b.x, b.y, p.x, p.y, n.x, n.y, a.s, b.s, flags, (a.k + b.k) / 2)
      out.push(s0.s, s1.s, f0, f1, s0.x, s0.y, s1.x, s1.y)
      out.push(Math.abs(a.kr) > Math.abs(b.kr) ? a.kr : b.kr, 0, 0, 0)
    }
  }
  return new Float32Array(out)
}

// Arc length reached at writing time t (0..path.time).
function arcAt(path: Path, t: number) {
  if (t <= 0) return 0
  if (t >= path.time) return path.length
  let prev: Vtx | null = null
  for (const l of path.lines) {
    if (prev && t < l[0].t) return prev.s
    let lo = 0, hi = l.length - 1
    if (t > l[hi].t) {
      prev = l[hi]
      continue
    }
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (l[m].t < t) lo = m
      else hi = m
    }
    const a = l[lo], b = l[hi]
    return a.s + ((b.s - a.s) * (t - a.t)) / Math.max(b.t - a.t, 1e-6)
  }
  return path.length
}

// Point on the centre line at arc length s.
function pointAt(path: Path, s: number): [number, number] {
  for (const l of path.lines) {
    if (s > l[l.length - 1].s) continue
    let lo = 0, hi = l.length - 1
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (l[m].s < s) lo = m
      else hi = m
    }
    const a = l[lo], b = l[hi]
    const f = Math.min(1, Math.max(0, (s - a.s) / Math.max(b.s - a.s, 1e-6)))
    return [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f]
  }
  const l = path.lines[path.lines.length - 1]
  return [l[l.length - 1].x, l[l.length - 1].y]
}

// ---------------------------------------------------------------------------------------------
// Light. Everything adds up as light (each channel 0..inf) and is mapped to the screen with
// 1 - exp(-light), so overlapping tube and glow saturate toward white like the reference.
// ---------------------------------------------------------------------------------------------

/** The reference tube colours, sampled along the stroke from the lead-in tail to the end tail. */
// prettier-ignore
export const NEON_HELLO_COLORS = ["#009dee", "#0084e5", "#4e3af6", "#b63aee", "#6c1d44", "#af4a2d", "#af1200", "#f37100", "#fb8f17", "#b25a30", "#ca4e76", "#cf489d", "#b237c3", "#a338e4", "#185ccd", "#0097f5", "#00b7fb", "#008eee", "#0778ee", "#7e2bb5", "#996579", "#992a46", "#ed5f2d", "#e36d1b", "#e97d07", "#fa8f23", "#df6400", "#ba4baf", "#a13ab1", "#b93efb", "#202aee", "#005ff2"]

// Frame fitted to the reference: per perimeter stop (clockwise from the top left corner, 16 stops)
// the light of the bright inner edge and of the wide falloff, plus the falloff itself in
// reference px (736 x 414): edge gain, edge decay, falloff gain, decay, wash gain, decay.
// prettier-ignore
const FRAME_NEAR = [[0.258,0.071,1.701],[0.376,0.343,1.939],[0.241,0.847,1.322],[0.373,1.388,2.261],[0.32,0.848,1.213],[0.372,1.192,1.557],[0.223,0.909,1.847],[0.353,0.3,2.404],[0.496,0.172,1.566],[1.198,0.305,0.463],[1.073,0.968,0.174],[1.354,1.019,0.291],[0.785,0.586,0.096],[1.285,1.079,0.231],[1.212,0.433,0.642],[0.722,0.151,1.718]]
// prettier-ignore
const FRAME_FAR = [[0.61,0.242,1.219],[0.246,0.279,1.033],[0.155,0.503,1.166],[0.257,1.041,1.446],[0.284,0.949,1.3],[0.166,0.304,0.828],[0.133,0.289,0.87],[0.2,0.202,0.986],[0.453,0.166,1.063],[0.649,0.21,0.29],[0.931,0.304,0.113],[1.476,0.533,0.126],[1.217,0.456,0.14],[0.974,0.189,0.256],[0.989,0.303,0.53],[0.713,0.23,0.645]]
const FRAME_PROFILE = [3.3614, 5.07, 1.3328, 24.0, 0.1, 63.0]
const FRAME_REF_AREA = 736 * 414
/** Frame colours for the CSS fallback and as a starting point for custom frames. */
// prettier-ignore
export const NEON_HELLO_FRAME = ["#8e42e9", "#6769e8", "#47abe1", "#68def3", "#67cae3", "#59aeda", "#419be2", "#5d57ee", "#8e41e3", "#c75976", "#d1a036", "#eab748", "#d59531", "#d99c59", "#d875a1", "#b64ad7"]

// Bloom: gains of the tight halo, the wide halo and the faint haze around the whole word.
const GLOW = [0.18, 0.2, 0.11]

// Loop at speed 1 for "hello", in seconds: lead, write, hold, erase, rest. Other words stretch
// the write with their length.
const LEAD = 0.4
const WRITE = 3.6
const HOLD = 4.3
const ERASE = 1.4
const REST = 0.3
// Where in the hold the still frame sits (matches both references).
const STILL = 0.55
// Colour flow along the stroke, in colour cycles per second.
const FLOW = 0.045

function timeline(path: Path, hello: Path) {
  const write = WRITE * Math.min(2.6, Math.max(0.45, Math.pow(path.time / hello.time, 0.75)))
  const loop = LEAD + write + HOLD + ERASE + REST
  return { write, loop, still: LEAD + write + HOLD * STILL }
}

const QUAD_VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

// The tube body, one instanced quad per segment. Each pixel belongs to exactly one segment of
// a pass (split along the bisectors at the joints), so a single pass of the tube is drawn once
// and every crossing adds: that is the translucency.
const SEG_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aAB;
layout(location = 2) in vec4 aPN;
layout(location = 3) in vec4 aS;
layout(location = 4) in vec4 aRun;   // run start and end arc length, open end at start, at end
layout(location = 5) in vec4 aRunP;  // run start and end position
layout(location = 6) in vec4 aKr;    // sharpest local curvature at A or B
uniform vec2 uRes;      // device px
uniform vec3 uMap;      // word unit -> device px: scale, offset x, offset y (y down)
uniform vec2 uWin;      // visible arc length: tail, head
uniform float uR;       // radius, word units
uniform float uPx;      // one device px in word units
uniform vec3 uStops[32];
uniform float uNStops;
uniform vec2 uGrad;     // cycles per unit of arc length, flow offset
uniform vec4 uEnds;     // tail and head positions (word units)
flat out vec4 vAB;
flat out vec4 vE;       // the open tube ends near this segment
flat out vec2 vF;       // whether each is shown
flat out vec3 vRun;     // arc length at A and B, start of a restart after a cusp (or -1)
flat out float vSoftA;  // the cap at A is a plain cusp
flat out float vSoftB;  // the cap at B is a plain cusp
flat out float vKr;
flat out vec4 vN;
flat out vec2 vCap;
flat out vec3 vColA;
flat out vec3 vColB;
flat out float vK;

vec3 stop(float i) { return uStops[int(mod(i, uNStops))]; }
// Cyclic Catmull-Rom through the colour stops.
vec3 grad(float s) {
  float f = fract(s * uGrad.x - uGrad.y) * uNStops;
  float i = floor(f), u = f - i;
  vec3 a = stop(i - 1.0 + uNStops), b = stop(i), c = stop(i + 1.0), d = stop(i + 2.0);
  vec3 col = b + 0.5 * u * (c - a + u * (2.0 * a - 5.0 * b + 4.0 * c - d + u * (3.0 * (b - c) + d - a)));
  return max(col, 0.0);
}

void main() {
  vec2 A = aAB.xy, B = aAB.zw;
  float sA = aS.x, sB = aS.y;
  float capA = mod(aS.z, 2.0), capB = mod(floor(aS.z / 2.0 + 0.01), 2.0);
  vSoftB = floor(aS.z / 4.0 + 0.01);
  if (sB <= uWin.x || sA >= uWin.y || uWin.y <= uWin.x) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 d0 = aAB.zw - aAB.xy;
  if (sA < uWin.x) { A = aAB.xy + d0 * (uWin.x - aS.x) / (aS.y - aS.x); sA = uWin.x; capA = 1.0; }
  if (sB > uWin.y) { B = aAB.xy + d0 * (uWin.y - aS.x) / (aS.y - aS.x); sB = uWin.y; capB = 1.0; vSoftB = 0.0; }
  vec2 t = normalize(d0);
  vec2 tp = capA > 0.5 ? t : normalize(aAB.xy - aPN.xy);
  vec2 tn = capB > 0.5 ? t : normalize(aPN.zw - aAB.zw);
  vec2 nA = normalize(tp + t), nB = normalize(t + tn);
  float m = uR + 2.0 * uPx;
  // Reach past the ends far enough to cover the wedge up to the bisector, or the round cap.
  float eA = capA > 0.5 ? m : min(m, m * abs(tp.x * t.y - tp.y * t.x) / max(1.0 + dot(tp, t), 0.05) + uPx);
  float eB = capB > 0.5 ? m : min(m, m * abs(t.x * tn.y - t.y * tn.x) / max(1.0 + dot(t, tn), 0.05) + uPx);
  vec2 n = vec2(-t.y, t.x);
  vec2 P = (aCorner.x < 0.0 ? A - t * eA : B + t * eB) + n * aCorner.y * m;
  vAB = vec4(A, B);
  vN = vec4(nA, nB);
  vCap = vec2(capA, capB);
  vColA = grad(sA);
  vColB = grad(sB);
  // Open ends: the run's own, or the pen and the tail while they move along it.
  vec2 E0 = aRunP.xy, E1 = aRunP.zw;
  float f0 = aRun.z > 1.5 ? 0.0 : aRun.z, f1 = aRun.w > 2.5 ? 0.0 : min(aRun.w, 1.0), s0 = aRun.x, s1 = aRun.y;
  // No glint right beside a cusp, where the curvature is one-sided.
  float cusp = (aRun.z > 1.5 && sA - aRun.x < 2.0 * uR) || (aRun.w > 1.5 && aRun.y - sB < 2.0 * uR) ? 1.0 : 0.0;
  vK = aS.w * (1.0 - cusp);
  vRun = vec3(sA, sB, aRun.z > 1.5 && aRun.z < 2.5 && uWin.x <= aRun.x ? aRun.x : -1.0);
  vSoftA = aRun.z > 2.5 && uWin.x <= aRun.x && sA - aRun.x < 0.5 ? 1.0 : 0.0;
  if (uWin.x > s0) { E0 = uEnds.xy; f0 = 1.0; s0 = uWin.x; }
  if (uWin.y < s1) { E1 = uEnds.zw; f1 = 1.0; s1 = uWin.y; }
  vE = vec4(E0, E1);
  vKr = aKr.x;
  vF = vec2(f0 * step(sA - s0, 2.5 * uR), f1 * step(s1 - sB, 2.5 * uR));
  vec2 dev = P * uMap.x + uMap.yz;
  gl_Position = vec4(dev.x / uRes.x * 2.0 - 1.0, 1.0 - dev.y / uRes.y * 2.0, 0.0, 1.0);
}
`

const SEG_FRAG = `#version 300 es
precision highp float;
flat in vec4 vAB;
flat in vec4 vN;
flat in vec2 vCap;
flat in vec3 vColA;
flat in vec3 vColB;
flat in float vK;
flat in vec4 vE;
flat in vec2 vF;
flat in vec3 vRun;
flat in float vSoftA;
flat in float vSoftB;
flat in float vKr;
uniform float uR;
uniform float uPx;
uniform vec2 uRes;
uniform vec3 uMap;
uniform vec4 uShade;    // body gain, limb brightening, rim gain, highlight gain
out vec4 o;
void main() {
  // The pixel in word units, from the pixel itself, so neighbouring segments agree exactly on
  // which side of their shared bisector it lies.
  vec2 p = (vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uMap.yz) / uMap.x;
  vec2 A = vAB.xy, B = vAB.zw;
  if (vCap.x < 0.5 && dot(p - A, vN.xy) < 0.0) discard;
  if (vCap.y < 0.5 && dot(p - B, vN.zw) >= 0.0) discard;
  vec2 ab = B - A;
  float l2 = dot(ab, ab);
  float u = l2 > 1e-8 ? clamp(dot(p - A, ab) / l2, 0.0, 1.0) : 0.0;
  vec2 q = A + ab * u;
  float d = length(p - q);
  float cov = clamp((uR - d) / uPx + 0.5, 0.0, 1.0);
  // Inside a bend tighter than the tube, pixels past the centre of the bend are claimed by
  // several segments at once; they fade out instead of stacking up into a bright sliver.
  float inner = (ab.x * (p.y - A.y) - ab.y * (p.x - A.x)) * vKr;
  if (inner > 0.0 && abs(vKr) * uR > 1.05) cov *= 1.0 - smoothstep(0.8, 1.0, d * abs(vKr));
  if (cov <= 0.0) discard;
  float r = min(d / uR, 1.0);
  vec3 C = mix(vColA, vColB, u);
  // A glass tube full of light: the body, a little brighter toward its edges where the light
  // runs through more glass, and a thin bright rim.
  float limb = 1.0 + uShade.y * r * r;
  // The caps of a plain cusp are the inside of the bend: barely any rim of their own.
  float bend = (vSoftB > 0.5 && dot(p - B, ab) > 0.0) || (vSoftA > 0.5 && dot(p - A, ab) < 0.0) ? 0.25 : 1.0;
  float rim = exp(-pow((r - 0.9) / 0.085, 2.0)) * bend;
  vec3 L = C * (uShade.x * limb) + (C * 0.6 + 0.25) * rim * uShade.z;
  // Tight curves catch a hot glint along their inner edge.
  float side = (ab.x * (p.y - A.y) - ab.y * (p.x - A.x)) / max(sqrt(l2), 1e-6) / uR * sign(vK);
  float curl = smoothstep(0.03, 0.065, abs(vK));
  float hot = curl * smoothstep(0.4, 0.85, side) * exp(-pow((r - 0.86) / 0.13, 2.0)) * (1.0 - smoothstep(0.95, 1.05, abs(vKr) * uR));
  L += (C * 0.5 + 0.6) * hot * uShade.w;
  // Open tube ends: a disc a shade darker inside, ringed by the lit edge of the glass.
  float de = 1e9;
  if (vF.x > 0.5) de = length(p - vE.xy);
  if (vF.y > 0.5) de = min(de, length(p - vE.zw));
  float face = clamp((uR - de) / uPx + 0.5, 0.0, 1.0);
  if (face > 0.0) {
    float rr = min(de / uR, 1.0);
    vec3 F = C * uShade.x * (0.5 + 0.62 * smoothstep(0.4, 0.97, rr)) + (C * 0.6 + 0.3) * exp(-pow((rr - 0.91) / 0.07, 2.0)) * uShade.z * 1.3;
    L = mix(L, F, face);
  }
  // After a cusp the tube comes back out of the open end it just made.
  if (vRun.z >= 0.0) L *= smoothstep(0.0, 1.4 * uR, mix(vRun.x, vRun.y, u) - vRun.z);
  // Alpha counts the passes covering the pixel, so the bloom can stay off the glass itself.
  o = vec4(L * cov, cov);
}
`

// A soft hot spot at the pen while it writes.
const SPARK_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
uniform vec2 uRes;
uniform vec3 uMap;
uniform vec3 uSpark;    // centre (word units), radius
out vec2 vQ;
void main() {
  vQ = aCorner;
  vec2 dev = (uSpark.xy + aCorner * uSpark.z) * uMap.x + uMap.yz;
  gl_Position = vec4(dev.x / uRes.x * 2.0 - 1.0, 1.0 - dev.y / uRes.y * 2.0, 0.0, 1.0);
}
`
const SPARK_FRAG = `#version 300 es
precision highp float;
in vec2 vQ;
uniform vec4 uSparkCol; // colour, strength
out vec4 o;
void main() {
  float r2 = dot(vQ, vQ) * 6.0;
  o = vec4((uSparkCol.rgb * 0.7 + 0.8) * uSparkCol.a * exp(-r2), 0.0);
}
`

// Bloom: a dual filter pyramid (down by halves, then back up), each level weighted.
const DOWN_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexel;    // source texel
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * 2.0 * uTexel;
  vec2 h = uTexel;
  vec4 s = texture(uTex, uv) * 4.0;
  s += texture(uTex, uv - h) + texture(uTex, uv + h);
  s += texture(uTex, uv + vec2(h.x, -h.y)) + texture(uTex, uv - vec2(h.x, -h.y));
  o = s / 8.0;
}
`
const UP_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;   // the coarser level, already summed
uniform sampler2D uSelf;  // this level of the down pass
uniform vec2 uTexel;      // texel of uTex
uniform vec2 uOut;        // size of this level
uniform float uW;         // weight of this level
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uOut;
  vec2 h = uTexel * 0.5;
  vec4 s = texture(uTex, uv + vec2(-h.x * 2.0, 0.0)) + texture(uTex, uv + vec2(h.x * 2.0, 0.0));
  s += texture(uTex, uv + vec2(0.0, -h.y * 2.0)) + texture(uTex, uv + vec2(0.0, h.y * 2.0));
  s += (texture(uTex, uv + vec2(-h.x, h.y)) + texture(uTex, uv + vec2(h.x, h.y))) * 2.0;
  s += (texture(uTex, uv + vec2(-h.x, -h.y)) + texture(uTex, uv + vec2(h.x, -h.y))) * 2.0;
  o = s / 12.0 + texture(uSelf, uv) * uW;
}
`

const COMP_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uBody;
uniform sampler2D uGlow;
uniform vec2 uRes;        // device px
uniform vec2 uGlowTexel;
uniform vec4 uBox;        // css width, height, dpr, frame on
uniform vec3 uNear[16];
uniform vec3 uFar[16];
uniform vec4 uProf;       // edge gain, edge decay, falloff gain, falloff decay (css px)
uniform vec2 uProf2;      // wash gain, wash decay
uniform float uRot;       // perimeter turn, 0..4
uniform vec3 uGain;       // frame, glow, word
uniform vec4 uPointer;    // css x, y, hover, reach (css px)
uniform float uSeed;
out vec4 o;
const float GLOW_ON_GLASS = 0.7;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 nearAt(float i) { return uNear[int(mod(i, 16.0))]; }
vec3 farAt(float i) { return uFar[int(mod(i, 16.0))]; }
// Perimeter position p (0..4, clockwise from the top left corner) to the cyclic Catmull-Rom
// weights of its four stops.
vec4 crw(float u) {
  float u2 = u * u, u3 = u2 * u;
  return vec4(-0.5 * u3 + u2 - 0.5 * u, 1.5 * u3 - 2.5 * u2 + 1.0, -1.5 * u3 + 2.0 * u2 + 0.5 * u, 0.5 * u3 - 0.5 * u2);
}
vec3 edge(float p, float d) {
  float f = mod(p, 4.0) * 4.0;
  float i = floor(f);
  vec4 w = crw(f - i);
  vec3 nr = nearAt(i + 15.0) * w.x + nearAt(i) * w.y + nearAt(i + 1.0) * w.z + nearAt(i + 2.0) * w.w;
  vec3 fr = farAt(i + 15.0) * w.x + farAt(i) * w.y + farAt(i + 1.0) * w.z + farAt(i + 2.0) * w.w;
  return nr * uProf.x * exp(-d / uProf.y) + fr * (uProf.z * exp(-d / uProf.w) + uProf2.x * exp(-d / uProf2.y));
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / uRes;
  vec4 body = texture(uBody, uv);
  vec3 light = body.rgb * uGain.z;
  // The last step up of the bloom, straight to full resolution.
  vec2 h = uGlowTexel * 0.5;
  vec3 g = texture(uGlow, uv + vec2(-h.x * 2.0, 0.0)).rgb + texture(uGlow, uv + vec2(h.x * 2.0, 0.0)).rgb;
  g += texture(uGlow, uv + vec2(0.0, -h.y * 2.0)).rgb + texture(uGlow, uv + vec2(0.0, h.y * 2.0)).rgb;
  g += (texture(uGlow, uv + vec2(-h.x, h.y)).rgb + texture(uGlow, uv + vec2(h.x, h.y)).rgb) * 2.0;
  g += (texture(uGlow, uv + vec2(-h.x, -h.y)).rgb + texture(uGlow, uv + vec2(h.x, -h.y)).rgb) * 2.0;
  // The bloom hangs around the glass; on the tube itself only a little of it shows.
  light += g / 12.0 * uGain.y * uGain.z * (1.0 - GLOW_ON_GLASS * min(body.a, 1.0));

  if (uBox.w > 0.5) {
    float W = uBox.x, H = uBox.y;
    float x = fc.x / uBox.z, y = (uRes.y - fc.y) / uBox.z;
    vec3 f = edge(x / W + uRot, y) + edge(1.0 + y / H + uRot, W - x)
           + edge(3.0 - x / W + uRot, H - y) + edge(4.0 - y / H + uRot, x);
    // The glow gathers toward the pointer.
    vec2 dp = vec2(x, y) - uPointer.xy;
    float near = exp(-dot(dp, dp) / (uPointer.w * uPointer.w));
    light += f * uGain.x * (1.0 + 1.1 * uPointer.z * near);
  }
  vec3 col = 1.0 - exp(-max(light, 0.0));
  // Fine grain against banding in the long falloff.
  col += (hash(fc + uSeed) - 0.5) * (2.0 / 255.0);
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s))
  }
  return s
}

function program(gl: WebGL2RenderingContext, vert: string, frag: string) {
  const prog = gl.createProgram()!
  const vs = compile(gl, gl.VERTEX_SHADER, vert)
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag)
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog)
    return null
  }
  const cache: Record<string, WebGLUniformLocation | null> = {}
  return { prog, u: (n: string) => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(prog, n))) }
}

// Resolve any CSS colour (hex, rgb, oklch, color-mix…) to RGB in 0..1.
function readColor(css: string, ctx: CanvasRenderingContext2D | null): [number, number, number] {
  const hex = css.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, "$&$&") : hex[1]
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
  }
  if (!ctx) return [1, 1, 1]
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = "#000"
  ctx.fillStyle = css
  ctx.fillRect(0, 0, 1, 1)
  const p = ctx.getImageData(0, 0, 1, 1).data
  return [p[0] / 255, p[1] / 255, p[2] / 255]
}

// Screen colour to light: the inverse of 1 - exp(-light).
const toLight = (c: number) => -Math.log(1 - Math.min(c, 0.985))

// Critically damped spring, integrated implicitly so any frame time is stable.
type Spring = { x: number; v: number }
function step(s: Spring, target: number, dt: number, omega: number) {
  const f = 1 + 2 * dt * omega
  const oo = omega * omega
  const det = 1 / (f + dt * dt * oo)
  const x = (f * s.x + dt * s.v + dt * dt * oo * target) * det
  s.v = (s.v + dt * oo * (target - s.x)) * det
  s.x = x
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Where the word sits in a box of w x h css px: its scale (css px per word unit) and offset.
function placeWord(path: Path, w: number, h: number, scale: number) {
  const [x0, y0, x1, y1] = path.box
  const bw = x1 - x0, bh = y1 - y0
  const k = Math.min((scale * w) / bw, (0.6 * h) / bh)
  return { k, ox: w / 2 - ((x0 + x1) / 2) * k, oy: 0.478 * h - ((y0 + y1) / 2) * k }
}

type Render = {
  /** Draws the frame at loop time t (seconds at speed 1). */
  draw: (t: number, hover: number, px: number, py: number) => void
}

/** A neon tube that writes a word in light inside a glowing rainbow edge frame. */
export function NeonHello({
  word = "hello",
  colors = NEON_HELLO_COLORS,
  frame = true,
  speed = 1,
  loop = true,
  interactive = true,
  scale = 0.76,
  children,
  label,
  className,
  style,
  onPointerMove,
  onPointerLeave,
  ...props
}: NeonHelloProps) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [fallback, setFallback] = React.useState(false)
  // Pointer in css px plus hover flag, read by the render loop.
  const pointer = React.useRef({ x: 0, y: 0, on: 0 })
  const kick = React.useRef<() => void>(() => {})
  const colorKey = colors.join(",")
  const frameKey = Array.isArray(frame) ? frame.join(",") : String(frame)
  const path = React.useMemo(() => buildPath(wordStrokes(word)), [word])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, alpha: false, antialias: false })
    if (!gl || !(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"))) {
      setFallback(true)
      return
    }
    const seg = program(gl, SEG_VERT, SEG_FRAG)
    const spark = program(gl, SPARK_VERT, SPARK_FRAG)
    const down = program(gl, QUAD_VERT, DOWN_FRAG)
    const up = program(gl, QUAD_VERT, UP_FRAG)
    const comp = program(gl, QUAD_VERT, COMP_FRAG)
    if (!seg || !spark || !down || !up || !comp) {
      setFallback(true)
      return
    }

    // Geometry: a full screen triangle, the unit quad and the segments.
    const tri = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, tri)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const triVao = gl.createVertexArray()
    gl.bindVertexArray(triVao)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    const quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const segs = segmentData(path)
    const nSeg = segs.length / SEG_FLOATS
    const inst = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, inst)
    gl.bufferData(gl.ARRAY_BUFFER, segs, gl.STATIC_DRAW)
    const segVao = gl.createVertexArray()
    gl.bindVertexArray(segVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, inst)
    for (let i = 0; i < 6; i++) {
      gl.enableVertexAttribArray(1 + i)
      gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, SEG_FLOATS * 4, i * 16)
      gl.vertexAttribDivisor(1 + i, 1)
    }
    const sparkVao = gl.createVertexArray()
    gl.bindVertexArray(sparkVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    // Colours as light.
    const probe = document.createElement("canvas")
    probe.width = probe.height = 1
    const ctx = probe.getContext("2d", { willReadFrequently: true })
    const list = (colors.length ? colors : NEON_HELLO_COLORS).slice(0, 32)
    const stops = new Float32Array(96)
    list.forEach((c, i) => readColor(c, ctx).forEach((v, k) => (stops[i * 3 + k] = toLight(v))))
    const nStops = list.length
    const stopAt = (f: number) => {
      // Same cyclic Catmull-Rom as the shader, for the spark.
      const x = (((f % 1) + 1) % 1) * nStops
      const i = Math.floor(x), u = x - i
      const g = (j: number, k: number) => stops[(((i + j) % nStops) + nStops) % nStops * 3 + k]
      return [0, 1, 2].map((k) => {
        const a = g(-1, k), b = g(0, k), c = g(1, k), d = g(2, k)
        return Math.max(0, b + 0.5 * u * (c - a + u * (2 * a - 5 * b + 4 * c - d + u * (3 * (b - c) + d - a))))
      })
    }
    const near = new Float32Array(48)
    const far = new Float32Array(48)
    if (Array.isArray(frame)) {
      const fl = frame.length ? frame : NEON_HELLO_FRAME
      for (let i = 0; i < 16; i++) {
        // A custom list is spread evenly around the perimeter.
        const f = (i / 16) * fl.length
        const a = readColor(fl[Math.floor(f) % fl.length], ctx), b = readColor(fl[(Math.floor(f) + 1) % fl.length], ctx)
        for (let k = 0; k < 3; k++) {
          const v = toLight(a[k] + (b[k] - a[k]) * (f - Math.floor(f)))
          near[i * 3 + k] = v * 0.72
          far[i * 3 + k] = v * 0.48
        }
      }
    } else {
      FRAME_NEAR.forEach((c, i) => near.set(c, i * 3))
      FRAME_FAR.forEach((c, i) => far.set(c, i * 3))
    }

    const hello = word.trim().toLowerCase() === "hello" ? path : buildPath([HELLO])
    const tl = timeline(path, hello)
    // The colours run through once along "hello"; longer words repeat them.
    const cycles = Math.max(1, Math.round(path.length / hello.length)) / Math.max(path.length, 1)

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const moving = !reduce && speed > 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    // Render targets: the body at full resolution, then the bloom pyramid.
    type Target = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number }
    const halfFloat = gl.RGBA16F
    const makeTarget = (w: number, h: number): Target => {
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, halfFloat, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      const fb = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      return { tex, fb, w, h }
    }
    const freeTarget = (t: Target) => {
      gl.deleteTexture(t.tex)
      gl.deleteFramebuffer(t.fb)
    }
    let body: Target | null = null
    let downs: Target[] = []
    let ups: Target[] = []
    let cw = 0, ch = 0, W = 1, H = 1

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      W = Math.max(1, r.width)
      H = Math.max(1, r.height)
      const nw = Math.max(1, Math.round(W * dpr))
      const nh = Math.max(1, Math.round(H * dpr))
      if (nw !== cw || nh !== ch || !body) {
        cw = nw
        ch = nh
        canvas.width = cw
        canvas.height = ch
        if (body) freeTarget(body)
        downs.forEach(freeTarget)
        ups.forEach(freeTarget)
        body = makeTarget(cw, ch)
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          setFallback(true)
          return
        }
        downs = []
        ups = []
        let w = cw, h = ch
        while (downs.length < 8 && (downs.length === 0 || Math.min(w, h) > 12)) {
          w = Math.max(1, Math.ceil(w / 2))
          h = Math.max(1, Math.ceil(h / 2))
          downs.push(makeTarget(w, h))
          ups.push(makeTarget(w, h))
        }
      }
      kick.current()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    // Bloom weight of a pyramid level whose texels are `texel` device px, by its size relative to
    // the tube radius: a tight halo hugging the tube and a wide, faint one.
    const levelWeight = (texel: number, rDev: number) => {
      const x = Math.log2(texel / rDev)
      return GLOW[0] * Math.exp(-((x + 1.2) ** 2) / 1.2) + GLOW[1] * Math.exp(-((x - 1.4) ** 2) / 1.6) + GLOW[2] * Math.exp(-((x - 3.4) ** 2) / 1.5)
    }

    const render: Render = {
      draw(t, hover, px, py) {
        if (!body) return
        const place = placeWord(path, W, H, scale)
        const k = place.k * dpr
        const rDev = RADIUS * k

        // Where the pen is: the visible stretch of the stroke [tail, head].
        const lt = loop ? ((t % tl.loop) + tl.loop) % tl.loop : Math.min(t, tl.still + 1e6)
        const w0 = LEAD, w1 = LEAD + tl.write, e0 = w1 + HOLD, e1 = e0 + ERASE
        const pace = (x: number) => x * 0.65 + 0.35 * x * x * (3 - 2 * x)
        const wu = Math.min(1, Math.max(0, (lt - w0) / tl.write))
        const eu = loop ? Math.min(1, Math.max(0, (lt - e0) / ERASE)) : 0
        const head = arcAt(path, pace(wu) * path.time)
        const tail = arcAt(path, (eu * eu * (3 - 2 * eu)) * path.time)
        // A just-started or nearly erased stroke fades in and out instead of popping.
        const amount = smooth(0, 2.5 * RADIUS, head - tail)

        // Colours flow along the stroke; the still frame is the reference.
        const flow = FLOW * (t - tl.still)
        const writing = wu > 0 && wu < 1
        const erasing = eu > 0 && eu < 1

        gl!.bindFramebuffer(gl!.FRAMEBUFFER, body.fb)
        gl!.viewport(0, 0, cw, ch)
        gl!.clearColor(0, 0, 0, 0)
        gl!.clear(gl!.COLOR_BUFFER_BIT)
        gl!.enable(gl!.BLEND)
        gl!.blendFunc(gl!.ONE, gl!.ONE)
        if (head > tail && nSeg > 0) {
          gl!.useProgram(seg!.prog)
          gl!.uniform2f(seg!.u("uRes"), cw, ch)
          gl!.uniform3f(seg!.u("uMap"), k, place.ox * dpr, place.oy * dpr)
          gl!.uniform2f(seg!.u("uWin"), tail, head)
          gl!.uniform1f(seg!.u("uR"), RADIUS)
          gl!.uniform1f(seg!.u("uPx"), 1 / k)
          gl!.uniform3fv(seg!.u("uStops"), stops)
          gl!.uniform1f(seg!.u("uNStops"), nStops)
          gl!.uniform2f(seg!.u("uGrad"), cycles, flow)
          const tp = pointAt(path, tail), hp = pointAt(path, head)
          gl!.uniform4f(seg!.u("uEnds"), tp[0], tp[1], hp[0], hp[1])
          gl!.uniform4f(seg!.u("uShade"), 0.82, 0.32, 0.55, 1.3)
          gl!.bindVertexArray(segVao)
          gl!.drawArraysInstanced(gl!.TRIANGLE_STRIP, 0, 4, nSeg)
          // The pen glows as it writes, and as it pulls the tube away.
          const sp = writing ? smooth(0, 0.08, wu) * smooth(1, 0.94, wu) : erasing ? 0.6 * smooth(0, 0.1, eu) * smooth(1, 0.85, eu) : 0
          if (sp > 0.001) {
            const at = writing ? head : tail
            const [sx, sy] = pointAt(path, at)
            const c = stopAt(at * cycles - flow)
            gl!.useProgram(spark!.prog)
            gl!.uniform2f(spark!.u("uRes"), cw, ch)
            gl!.uniform3f(spark!.u("uMap"), k, place.ox * dpr, place.oy * dpr)
            gl!.uniform3f(spark!.u("uSpark"), sx, sy, RADIUS * 2.2)
            gl!.uniform4f(spark!.u("uSparkCol"), c[0], c[1], c[2], 1.1 * sp)
            gl!.bindVertexArray(sparkVao)
            gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
          }
        }
        gl!.disable(gl!.BLEND)

        // Bloom pyramid.
        gl!.bindVertexArray(triVao)
        gl!.useProgram(down!.prog)
        let src: Target = body
        for (const d of downs) {
          gl!.bindFramebuffer(gl!.FRAMEBUFFER, d.fb)
          gl!.viewport(0, 0, d.w, d.h)
          gl!.activeTexture(gl!.TEXTURE0)
          gl!.bindTexture(gl!.TEXTURE_2D, src.tex)
          gl!.uniform1i(down!.u("uTex"), 0)
          gl!.uniform2f(down!.u("uTexel"), 1 / src.w, 1 / src.h)
          gl!.drawArrays(gl!.TRIANGLES, 0, 3)
          src = d
        }
        gl!.useProgram(up!.prog)
        const n = downs.length
        // The coarsest level starts the sum on its own; every level is weighted relative to it
        // and the total is scaled back in the composite.
        let acc: Target = downs[n - 1]
        const top = Math.max(levelWeight(2 ** n, rDev), 1e-4)
        for (let i = n - 2; i >= 0; i--) {
          const d = downs[i], o = ups[i]
          gl!.bindFramebuffer(gl!.FRAMEBUFFER, o.fb)
          gl!.viewport(0, 0, o.w, o.h)
          gl!.activeTexture(gl!.TEXTURE0)
          gl!.bindTexture(gl!.TEXTURE_2D, acc.tex)
          gl!.activeTexture(gl!.TEXTURE1)
          gl!.bindTexture(gl!.TEXTURE_2D, d.tex)
          gl!.uniform1i(up!.u("uTex"), 0)
          gl!.uniform1i(up!.u("uSelf"), 1)
          gl!.uniform2f(up!.u("uTexel"), 1 / acc.w, 1 / acc.h)
          gl!.uniform2f(up!.u("uOut"), o.w, o.h)
          gl!.uniform1f(up!.u("uW"), levelWeight(2 ** (i + 1), rDev) / top)
          gl!.drawArrays(gl!.TRIANGLES, 0, 3)
          acc = o
        }

        // Composite with the frame.
        const pulse0 = w1 + 0.05
        const pt = loop ? (((lt - pulse0) % tl.loop) + tl.loop) % tl.loop : lt - pulse0
        const pulse = pt > 0 ? 0.55 * (1 - Math.exp(-pt / 0.07)) * Math.exp(-pt / 0.75) : 0
        const ph = (2 * Math.PI * (t - tl.still)) / tl.loop
        const breathe = 1 + 0.12 * Math.sin(2 * ph) + pulse
        const bloom = 1 + 0.18 * Math.sin(3 * ph + 0.6) - 0.18 * Math.sin(0.6)
        const fk = Math.sqrt((W * H) / FRAME_REF_AREA)
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, null)
        gl!.viewport(0, 0, cw, ch)
        gl!.useProgram(comp!.prog)
        gl!.activeTexture(gl!.TEXTURE0)
        gl!.bindTexture(gl!.TEXTURE_2D, body.tex)
        gl!.activeTexture(gl!.TEXTURE1)
        gl!.bindTexture(gl!.TEXTURE_2D, acc.tex)
        gl!.uniform1i(comp!.u("uBody"), 0)
        gl!.uniform1i(comp!.u("uGlow"), 1)
        gl!.uniform2f(comp!.u("uRes"), cw, ch)
        gl!.uniform2f(comp!.u("uGlowTexel"), 1 / acc.w, 1 / acc.h)
        gl!.uniform4f(comp!.u("uBox"), W, H, dpr, frame === false ? 0 : 1)
        gl!.uniform3fv(comp!.u("uNear"), near)
        gl!.uniform3fv(comp!.u("uFar"), far)
        const P = FRAME_PROFILE
        gl!.uniform4f(comp!.u("uProf"), P[0], P[1] * fk, P[2], P[3] * fk)
        gl!.uniform2f(comp!.u("uProf2"), P[4], P[5] * fk)
        gl!.uniform1f(comp!.u("uRot"), (4 * (t - tl.still)) / tl.loop)
        gl!.uniform3f(comp!.u("uGain"), breathe, bloom * top, amount)
        gl!.uniform4f(comp!.u("uPointer"), px, py, hover, 0.28 * Math.min(W, H))
        gl!.uniform1f(comp!.u("uSeed"), moving ? Math.floor(t * 30) % 97 : 0)
        gl!.drawArrays(gl!.TRIANGLES, 0, 3)
        gl!.bindVertexArray(null)
      },
    }

    const hoverS: Spring = { x: 0, v: 0 }
    const pxS: Spring = { x: 0, v: 0 }
    const pyS: Spring = { x: 0, v: 0 }
    let raf = 0
    let visible = true
    let last = -1
    let clock = moving ? 0 : tl.still
    const start = performance.now()
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !raf) raf = requestAnimationFrame(frameFn)
    })
    io.observe(canvas)

    function frameFn(now: number) {
      raf = 0
      const dt = last < 0 ? 0 : Math.min(Math.max(now - last, 0) / 1000, 1 / 20)
      last = now
      // The stroke follows wall time, so a dropped frame never slows the hand down.
      if (moving) clock = ((now - start) / 1000) * speed
      const p = pointer.current
      const on = interactive ? p.on : 0
      if (hoverS.x < 0.01 && on) {
        pxS.x = p.x
        pyS.x = p.y
      }
      step(hoverS, on, dt, 5)
      step(pxS, p.x, dt, 9)
      step(pyS, p.y, dt, 9)
      render.draw(clock, Math.max(hoverS.x, 0), pxS.x, pyS.x)
      const settled = Math.abs(hoverS.x - on) + Math.abs(hoverS.v) + Math.abs(pxS.v) + Math.abs(pyS.v) < 1e-4
      if (visible && (moving || !settled)) raf = requestAnimationFrame(frameFn)
    }
    kick.current = () => {
      if (visible && !raf) raf = requestAnimationFrame(frameFn)
    }
    raf = requestAnimationFrame(frameFn)

    const lost = (e: Event) => {
      e.preventDefault()
      setFallback(true)
    }
    canvas.addEventListener("webglcontextlost", lost)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      kick.current = () => {}
      canvas.removeEventListener("webglcontextlost", lost)
      if (body) freeTarget(body)
      downs.forEach(freeTarget)
      ups.forEach(freeTarget)
      for (const p of [seg, spark, down, up, comp]) gl.deleteProgram(p.prog)
      for (const b of [tri, quad, inst]) gl.deleteBuffer(b)
      for (const v of [triVao, segVao, sparkVao]) gl.deleteVertexArray(v)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, colorKey, frameKey, speed, loop, interactive, scale, fallback])

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = rootRef.current?.getBoundingClientRect()
    if (!r) return
    pointer.current.x = e.clientX - r.left
    pointer.current.y = e.clientY - r.top
    pointer.current.on = 1
    kick.current()
  }

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={label ?? word}
      className={className ? `neon-hello-root ${className}` : "neon-hello-root"}
      style={{ position: "relative", overflow: "hidden", background: "#000", ...style }}
      onPointerMove={(e) => {
        if (interactive) track(e)
        onPointerMove?.(e)
      }}
      onPointerLeave={(e) => {
        pointer.current.on = 0
        kick.current()
        onPointerLeave?.(e)
      }}
      {...props}
    >
      {/* Fills its parent by default; zero specificity, so any sizing class (h-screen, h-[600px]) wins. */}
      <style>{`:where(.neon-hello-root){width:100%;height:100%}`}</style>
      {fallback ? (
        <Fallback path={path} colors={colors} frame={frame} loop={loop} speed={speed} />
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
        />
      )}
      {children ? (
        <div
          className="neon-hello-caption"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "12%",
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ pointerEvents: "auto" }}>{children}</div>
        </div>
      ) : null}
    </div>
  )
}

// No WebGL: the frame as four blurred colour strips that breathe, and the word as an SVG tube in
// short coloured pieces, written one after another with stroke dashes, a blurred copy for the glow.
function Fallback({
  path,
  colors,
  frame,
  loop,
  speed,
}: {
  path: Path
  colors: string[]
  frame: boolean | string[]
  loop: boolean
  speed: number
}) {
  const hello = React.useMemo(() => buildPath([HELLO]), [])
  const tl = timeline(path, hello)
  const dur = tl.loop / Math.max(speed, 0.01)
  const list = colors.length ? colors : NEON_HELLO_COLORS
  const fl = Array.isArray(frame) ? (frame.length ? frame : NEON_HELLO_FRAME) : NEON_HELLO_FRAME
  const [x0, y0, x1, y1] = path.box
  const pad = RADIUS * 2.5
  // Pieces of about 3 radii, each a solid colour from the gradient at its middle.
  const pieces: { d: string; len: number; s0: number; s1: number; c: string }[] = []
  for (const l of path.lines) {
    let i = 0
    while (i < l.length - 1) {
      let j = i + 1
      while (j < l.length - 1 && l[j].s - l[i].s < RADIUS * 3 && !l[j].brk) j++
      const pts = l.slice(i, j + 1)
      const mid = (pts[0].s + pts[pts.length - 1].s) / 2
      const c = list[Math.floor((mid / path.length) * list.length) % list.length]
      pieces.push({
        d: "M" + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("L"),
        len: pts[pts.length - 1].s - pts[0].s + 1,
        s0: pts[0].t,
        s1: pts[pts.length - 1].t,
        c,
      })
      i = j
    }
  }
  const pct = (sec: number) => ((sec / tl.loop) * 100).toFixed(2)
  const css = pieces
    .map((p, i) => {
      const a = LEAD + (p.s0 / path.time) * tl.write
      const b = LEAD + (p.s1 / path.time) * tl.write
      const e = LEAD + tl.write + HOLD
      return loop
        ? `@keyframes neon-hello-w${i}{0%,${pct(a)}%{stroke-dashoffset:${p.len.toFixed(1)};opacity:1}` +
            `${pct(Math.max(b, a + 0.01))}%,${pct(e)}%{stroke-dashoffset:0;opacity:1}` +
            `${pct(e + ERASE)}%,100%{stroke-dashoffset:0;opacity:0}}`
        : `@keyframes neon-hello-w${i}{0%,${pct(a)}%{stroke-dashoffset:${p.len.toFixed(1)}}${pct(Math.max(b, a + 0.01))}%,100%{stroke-dashoffset:0}}`
    })
    .join("")
  // Each edge: its colours along the edge, fading inward with a white-hot line at the rim.
  const strip = (side: "top" | "right" | "bottom" | "left", cols: string[]): React.CSSProperties => {
    const along = side === "top" || side === "bottom" ? "90deg" : "180deg"
    const inward = { top: "180deg", bottom: "0deg", left: "90deg", right: "270deg" }[side]
    const fade = `linear-gradient(${inward}, #000 0%, rgba(0,0,0,0.7) 3%, rgba(0,0,0,0.34) 12%, rgba(0,0,0,0.13) 28%, transparent 60%)`
    const base: React.CSSProperties = {
      position: "absolute",
      backgroundImage: `linear-gradient(${along}, ${cols.join(", ")})`,
      WebkitMaskImage: fade,
      maskImage: fade,
      mixBlendMode: "screen",
    }
    if (side === "top") return { ...base, left: 0, right: 0, top: 0, height: "60%" }
    if (side === "bottom") return { ...base, left: 0, right: 0, bottom: 0, height: "60%" }
    if (side === "left") return { ...base, top: 0, bottom: 0, left: 0, width: "60%" }
    return { ...base, top: 0, bottom: 0, right: 0, width: "60%" }
  }
  const q = Math.floor(fl.length / 4)
  const seq = (a: number, b: number, rev = false) => {
    const out: string[] = []
    for (let i = a; i <= b; i++) out.push(fl[i % fl.length])
    return rev ? out.reverse() : out
  }
  const pieceEls = pieces.map((p, i) => (
    <path
      key={i}
      d={p.d}
      stroke={p.c}
      strokeDasharray={`${p.len.toFixed(1)} ${(p.len + 999).toFixed(0)}`}
      className="neon-hello-piece"
      style={{ animation: speed > 0 ? `neon-hello-w${i} ${dur}s linear ${loop ? "infinite" : "1 forwards"}` : undefined }}
    />
  ))
  return (
    <>
      {frame !== false ? (
        <div aria-hidden="true" className="neon-hello-frame" style={{ position: "absolute", inset: 0 }}>
          <div style={strip("top", seq(0, q))} />
          <div style={strip("right", seq(q, 2 * q))} />
          <div style={strip("bottom", seq(2 * q, 3 * q, true))} />
          <div style={strip("left", seq(3 * q, 4 * q, true))} />
          <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 3px 1px rgba(255,255,255,0.75), inset 0 0 14px 2px rgba(255,255,255,0.18)" }} />
        </div>
      ) : null}
      <svg
        aria-hidden="true"
        viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`}
        style={{ position: "absolute", left: "14%", width: "72%", top: "18%", height: "60%", overflow: "visible" }}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <filter id="neon-hello-glow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation={RADIUS * 0.9} />
          </filter>
        </defs>
        <g strokeWidth={RADIUS * 2.6} filter="url(#neon-hello-glow)" opacity={0.85}>
          {pieceEls}
        </g>
        <g strokeWidth={RADIUS * 2} opacity={0.92} style={{ mixBlendMode: "screen" }}>
          {pieceEls}
        </g>
      </svg>
      <style>
        {css +
          "@keyframes neon-hello-breathe{from{opacity:.82}to{opacity:1}}" +
          `.neon-hello-frame{animation:neon-hello-breathe ${(dur / 2).toFixed(2)}s ease-in-out infinite alternate}` +
          "@media (prefers-reduced-motion:reduce){.neon-hello-frame,.neon-hello-piece{animation:none!important;stroke-dashoffset:0!important;opacity:1!important}}"}
      </style>
    </>
  )
}

export default NeonHello
