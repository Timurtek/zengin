// The showreel's score, synthesized from scratch and locked to reel.html's timeline (120 BPM, cuts on beats).
// node score.mjs -> out/score.wav (48 kHz, 16-bit stereo)
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 48000, DUR = 45.5, N = Math.floor(SR * DUR), BEAT = 0.5, BAR = 2;
const L = new Float32Array(N), R = new Float32Array(N);
const busRev = new Float32Array(N); // mono send to the reverb
const TAU = Math.PI * 2;
let seed = 7; const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const add = (i, l, r, rev = 0) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; busRev[i] += (l + r) * 0.5 * rev; } };
const pan = (x, p) => [x * Math.cos((p + 1) * Math.PI / 4), x * Math.sin((p + 1) * Math.PI / 4)];

// ---------- instruments ----------
function kick(t, g = 1) {
  const n = Math.floor(0.45 * SR), s0 = Math.floor(t * SR); let ph = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR, f = 45 + 110 * Math.exp(-x * 28);
    ph += TAU * f / SR;
    const v = (Math.sin(ph) * Math.exp(-x * 7) + (x < .004 ? noise() * .4 : 0)) * g * .9;
    add(s0 + i, v, v);
  }
}
function snare(t, g = 1) {
  const n = Math.floor(0.3 * SR), s0 = Math.floor(t * SR); let lp = 0, ph = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR; ph += TAU * 190 / SR;
    const nz = noise(); lp += (nz - lp) * .5; const hp = nz - lp;
    const v = (hp * Math.exp(-x * 16) * .5 + Math.sin(ph) * Math.exp(-x * 30) * .35) * g;
    add(s0 + i, v, v, .35);
  }
}
function hat(t, g = 1, open = false, p = .2) {
  const n = Math.floor((open ? .22 : .05) * SR), s0 = Math.floor(t * SR); let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR, nz = noise(); a += (nz - a) * .7; const hp = nz - a; b += (hp - b) * .9;
    const v = b * Math.exp(-x * (open ? 14 : 70)) * .22 * g; const [l, r] = pan(v, p);
    add(s0 + i, l, r, .1);
  }
}
function clap(t, g = 1) {
  const n = Math.floor(.35 * SR), s0 = Math.floor(t * SR); let bp1 = 0, bp2 = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR, nz = noise();
    bp1 += (nz - bp1) * .35; bp2 += (bp1 - bp2) * .35; const band = bp1 - bp2;
    const env = (x < .03 ? (Math.exp(-((x % .01) * 300))) : Math.exp(-(x - .03) * 13));
    const v = band * env * 1.3 * g; add(s0 + i, v * .9, v, .5);
  }
}
// bass: filtered saw, sidechained by the caller
function bass(t, dur, midi, g = 1) {
  const n = Math.floor(dur * SR), s0 = Math.floor(t * SR), f = mtof(midi); let ph = 0, lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR; ph = (ph + f / SR) % 1;
    const saw = 2 * ph - 1, sub = Math.sin(TAU * ph);
    const cut = .04 + .12 * Math.exp(-x * 8);
    lp += (saw - lp) * cut; lp2 += (lp - lp2) * cut;
    const env = Math.min(1, x * 200) * Math.min(1, (dur - x) * 60);
    const v = (lp2 * .55 + sub * .5) * env * .42 * g; add(s0 + i, v, v);
  }
}
// pad: detuned saws through a slow low-pass, wide
function pad(t, dur, notes, g = 1, bright = .02) {
  const n = Math.floor(dur * SR), s0 = Math.floor(t * SR);
  const vs = notes.flatMap((m, k) => [-.09, .0, .08].map((d, j) => ({ f: mtof(m + d * .12), ph: (k * .31 + j * .17) % 1, p: (j - 1) * .7 })));
  let lpl = 0, lpr = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR; let l = 0, r = 0;
    for (const v of vs) { v.ph = (v.ph + v.f / SR) % 1; const s = 2 * v.ph - 1; const [a, b] = pan(s, v.p); l += a; r += b; }
    const cut = bright + .015 * Math.sin(x * 1.3) ** 2;
    lpl += (l - lpl) * cut; lpr += (r - lpr) * cut;
    const env = Math.min(1, x / .35) * Math.min(1, (dur - x) / .5);
    add(s0 + i, lpl * env * .05 * g, lpr * env * .05 * g, .4);
  }
}
// pluck: bright FM bell, for landings and fixes
function pluck(t, midi, g = 1, p = 0, decay = 5) {
  const n = Math.floor(1.2 * SR), s0 = Math.floor(t * SR), f = mtof(midi);
  for (let i = 0; i < n; i++) {
    const x = i / SR, mod = Math.sin(TAU * f * 2 * x) * 2.2 * Math.exp(-x * 9);
    const v = Math.sin(TAU * f * x + mod) * Math.exp(-x * decay) * .22 * g; const [l, r] = pan(v, p);
    add(s0 + i, l, r, .6);
  }
}
// impact: sub drop + noise crash
function impact(t, g = 1, len = 2.2) {
  const n = Math.floor(len * SR), s0 = Math.floor(t * SR); let ph = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR; const f = 30 + 70 * Math.exp(-x * 6); ph += TAU * f / SR;
    const nz = noise(); lp += (nz - lp) * (.25 * Math.exp(-x * 2) + .02);
    const v = (Math.sin(ph) * Math.exp(-x * 2.2) * .9 + lp * Math.exp(-x * 3.5) * .6) * g;
    add(s0 + i, v, v * .97, .5);
  }
}
// riser: noise through a rising band + pitched sweep
function riser(t0, t1, g = 1) {
  const n = Math.floor((t1 - t0) * SR), s0 = Math.floor(t0 * SR); let a = 0, b = 0, ph = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n, cut = .01 + .5 * k * k; const nz = noise();
    a += (nz - a) * cut; b += (a - b) * cut; const band = a - b;
    ph += TAU * (200 + 1400 * k * k) / SR;
    const v = (band * 1.2 + Math.sin(ph) * .08) * k * k * g * .6; const [l, r] = pan(v, Math.sin(k * 20) * .5);
    add(s0 + i, l, r, .3);
  }
}
// whoosh: short filtered noise swell, for wipes and theme swaps
function whoosh(tc, g = 1, len = .5) {
  const t0 = tc - len * .6, n = Math.floor(len * SR), s0 = Math.floor(t0 * SR); let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n, env = Math.sin(Math.PI * k) ** 2, cut = .03 + .35 * env; const nz = noise();
    a += (nz - a) * cut; b += (a - b) * cut;
    const [l, r] = pan((a - b) * env * .55 * g, -1 + 2 * k);
    add(s0 + i, l, r, .2);
  }
}
function tick(t, g = 1, f = 2400, p = 0) {
  const n = Math.floor(.03 * SR), s0 = Math.floor(t * SR);
  for (let i = 0; i < n; i++) { const x = i / SR; const v = (Math.sin(TAU * f * x) * .5 + noise() * .5) * Math.exp(-x * 160) * .16 * g; const [l, r] = pan(v, p); add(s0 + i, l, r); }
}
function blip(t, midi, g = 1, p = 0) {
  const n = Math.floor(.12 * SR), s0 = Math.floor(t * SR), f = mtof(midi);
  for (let i = 0; i < n; i++) { const x = i / SR; const v = (4 * Math.abs((f * x) % 1 - .5) - 1) * Math.exp(-x * 30) * .14 * g; const [l, r] = pan(v, p); add(s0 + i, l, r, .3); }
}

// ---------- the arrangement ----------
// progression per bar: Am  F  C  G  (roots A1 F1 C2 G1)
const PROG = [[45, [57, 60, 64, 69]], [41, [57, 60, 65, 69]], [48, [55, 60, 64, 67]], [43, [55, 59, 62, 67]]];
const chordAt = (t) => PROG[Math.floor(t / BAR) % 4];
const duck = []; // kick times, for sidechain

// 0-4: the mark. drone, a pluck per module, the lock-in hit
pad(0, 4.2, [45, 52, 57], 1.2, .008);
impact(0.02, .5, 2.5);
[0.25, 0.75, 1.25].forEach((t, i) => { pluck(t + .25, [69, 72, 76][i], 1.1, [-.6, 0, .6][i]); tick(t + .25, 1.2, 3200); });
impact(1.75, .9); kick(1.75, 1); duck.push(1.75);
pluck(2.25, 81, .7, .3, 3); pluck(2.25, 76, .6, -.3, 3);
for (let i = 0; i < 6; i++) tick(2.25 + i * .06, .8, 1800 + i * 200, -.5 + i * .2);
riser(2.9, 4.0, .7);

// 4-8: the problem. beat starts
for (let b = 8; b < 16; b++) { const t = b * BEAT; kick(t, 1); duck.push(t); hat(t + .25, .9, b % 2 === 1); }
[4.0, 4.5, 5.0].forEach((t, i) => pluck(t, [69, 72, 76][i], .7, 0, 6));
clap(5.0, .8); clap(7.0, .7);
for (let b = 12; b < 16; b++) { hat(b * BEAT + .125, .45, false, -.4); hat(b * BEAT + .375, .45, false, .4); }
riser(6.4, 8.0, 1);
whoosh(4.0, .9); whoosh(8.0, 1);

// 8-20: the catch and the fix
impact(8.0, 1);
for (let b = 16; b < 40; b++) {
  const t = b * BEAT;
  if (t >= 14.0 && t < 15.0) continue; // the stamp owns this beat
  kick(t, t < 10.8 ? .8 : 1); duck.push(t);
  hat(t + .25, .8, b % 4 === 3);
  if (b % 2 === 1 && t > 11) clap(t, .6);
  hat(t + .125, .35, false, -.5); hat(t + .375, .35, false, .5);
}
// typing ticks
for (let t = 8.25; t < 10.6; t += 0.045 + (Math.sin(t * 91) + 1) * .02) tick(t, .5, 2600 + Math.sin(t * 13) * 800, Math.sin(t * 3) * .5);
// scan beam
(() => { const s0 = Math.floor(10.8 * SR), n = Math.floor(.9 * SR); let ph = 0; for (let i = 0; i < n; i++) { const k = i / n; ph += TAU * (300 + 900 * k) / SR; const v = Math.sin(ph) * Math.sin(Math.PI * k) * .12; add(s0 + i, v, v, .4); } })();
// each violation found: a dissonant ping; each card: a blip
[5, 6, 9, 10, 11, 15].forEach((ln, i) => pluck(10.85 + (ln / 18) * .8, [82, 83, 81, 84, 82, 83][i], .5, (i - 2.5) / 3, 9));
for (let i = 0; i < 6; i++) blip(11.75 + i * .25, 76 + i, .8, .6);
// BLOCKED
impact(14.0, 1.4, 2.5); snare(14.0, 1.2); clap(14.0, 1); kick(14.0, 1.2); duck.push(14.0);
// the fixes: a rising major line
for (let i = 0; i < 6; i++) { const t = 15.1 + i * .38 + .35; pluck(t, [72, 74, 76, 79, 81, 84][i], .8, (i - 2.5) / 3, 6); tick(t, .5, 3000); }
// resolve: 0 violations
riser(16.8, 17.85, .8); whoosh(17.9, .8);
impact(17.9, .9); pluck(17.9, 72, .6, -.4, 2); pluck(17.9, 76, .6, 0, 2); pluck(17.9, 79, .6, .4, 2); pluck(17.9, 84, .5, 0, 2);
riser(19.0, 20.0, .8); whoosh(20.0, 1);

// 20-26: surfaces. full groove
impact(20.0, .9);
for (let b = 40; b < 52; b++) { const t = b * BEAT; kick(t, 1); duck.push(t); hat(t + .25, .9, b % 2 === 1); if (b % 2 === 1) clap(t, .75); hat(t + .125, .35, false, -.5); hat(t + .375, .35, false, .5); }
for (let i = 0; i < 4; i++) { pluck(21.0 + i * .5, [69, 72, 76, 79][i], .7, [-.7, -.7, .7, .7][i], 6); }
for (let t = 21.3; t < 25.9; t += .275) blip(t, 88 + (Math.round(t * 7) % 3) * 2, .35, Math.sin(t * 5) * .8);
whoosh(26.0, 1);

// 26-30: rules. a tick per row, then the "Deterministic" hit
impact(26.0, .7);
for (let b = 52; b < 60; b++) { const t = b * BEAT; kick(t, 1); duck.push(t); hat(t + .25, .9); if (b % 2 === 1) clap(t, .7); }
for (let i = 0; i < 7; i++) { blip(26.05 + i * .25, 69 + [0, 3, 5, 7, 10, 12, 15][i], 1, (i - 3) / 3); tick(26.05 + i * .25, .8, 1500); }
whoosh(28.25, 1.1, .4); impact(28.25, 1.1); clap(28.25, 1);
riser(29.0, 30.0, .8); whoosh(30.0, 1);

// 30-36: themes. a snap on each swap
impact(30.0, .7);
for (let b = 60; b < 72; b++) { const t = b * BEAT; kick(t, 1); duck.push(t); hat(t + .25, .9, b % 2 === 1); if (b % 2 === 1) clap(t, .7); hat(t + .125, .4, false, -.5); hat(t + .375, .4, false, .5); }
[31.5, 32.0, 32.5, 33.0, 33.5, 34.5].forEach((t, i) => { whoosh(t, .5, .25); tick(t, 1.2, 1200 + i * 300); pluck(t, [76, 79, 81, 84, 88, 76][i], .45, (i % 2 ? .5 : -.5), 8); });
whoosh(36.0, 1);

// 36-41: terminal + field tests
impact(36.0, .6);
for (let b = 72; b < 80; b++) { const t = b * BEAT; kick(t, .9); duck.push(t); hat(t + .25, .8); }
for (let t = 36.3; t < 37.5; t += .05 + (Math.sin(t * 77) + 1) * .015) tick(t, .5, 2600 + Math.sin(t * 11) * 700);
for (let i = 0; i < 5; i++) pluck(37.7 + i * .25, [72, 76, 79, 83, 84][i], .55, .2, 7);
[38.0, 38.35, 38.7].forEach((t, i) => blip(t, 64 + i * 5, .9, .6));
pluck(39.2, 84, .6, 0, 3); pluck(39.2, 91, .3, 0, 3);
riser(39.5, 41.0, 1.2);

// 41-45: the end card
impact(41.0, 1.5, 3.5); kick(41.0, 1.2); clap(41.0, 1); duck.push(41.0);
pad(41.0, 4.4, [45, 52, 57, 60, 64, 69], 1.6, .03);
[41.05, 41.19, 41.33].forEach((t, i) => pluck(t, [69, 72, 76][i], 1, [-.5, 0, .5][i], 2.5));
pluck(41.6, 81, .5, 0, 1.6);

// bass + pads under the grooves (with the stamp and the end left alone)
for (let bar = 2; bar < 20; bar++) {
  const t = bar * BAR; if (t >= 41) break;
  const [root, notes] = chordAt(t);
  pad(t, BAR + .1, notes, t < 8 ? .8 : 1);
  for (let e = 0; e < 8; e++) {
    const tt = t + e * .25; if (tt < 4 || (tt >= 14 && tt < 15)) continue;
    bass(tt, .22, root + (e % 4 === 3 ? 12 : 0), tt < 8 ? .7 : 1);
  }
}

// ---------- sidechain: duck everything but the kicks a little after each kick ----------
// (applied to the bus as a gain curve; the kick transient itself survives because it is the loudest thing)
const gain = new Float32Array(N).fill(1);
for (const t of duck) { const s0 = Math.floor(t * SR), n = Math.floor(.28 * SR); for (let i = 0; i < n && s0 + i < N; i++) { const k = i / n; gain[s0 + i] = Math.min(gain[s0 + i], .55 + .45 * Math.pow(k, .6)); } }

// ---------- reverb: Schroeder combs + allpasses over the send ----------
function reverb(inp, sizes, ap, fb = .8, damp = .35) {
  const out = new Float32Array(N);
  for (const d0 of sizes) { const d = Math.floor(d0 * SR / 44100); const buf = new Float32Array(d); let idx = 0, lp = 0; for (let i = 0; i < N; i++) { const y = buf[idx]; lp = y * (1 - damp) + lp * damp; buf[idx] = inp[i] + lp * fb; out[i] += y; idx = (idx + 1) % d; } }
  for (const d0 of ap) { const d = Math.floor(d0 * SR / 44100); const buf = new Float32Array(d); let idx = 0; for (let i = 0; i < N; i++) { const b = buf[idx]; const y = -out[i] + b; buf[idx] = out[i] + b * .5; out[i] = y; idx = (idx + 1) % d; } }
  return out;
}
const rvL = reverb(busRev, [1116, 1188, 1277, 1356, 1422, 1491], [556, 441, 341], .82);
const rvR = reverb(busRev, [1139, 1211, 1300, 1379, 1445, 1514], [579, 464, 364], .82);

// ---------- master ----------
let peak = 0;
const out = new Int16Array(N * 2);
const mix = new Float32Array(N * 2);
for (let i = 0; i < N; i++) {
  let l = L[i] * gain[i] + rvL[i] * .09, r = R[i] * gain[i] + rvR[i] * .09;
  mix[i * 2] = l; mix[i * 2 + 1] = r; peak = Math.max(peak, Math.abs(l), Math.abs(r));
}
const pre = 1.6 / peak; // drive into a soft clipper, then normalise to -1 dBFS
let peak2 = 0;
for (let i = 0; i < mix.length; i++) { mix[i] = Math.tanh(mix[i] * pre); peak2 = Math.max(peak2, Math.abs(mix[i])); }
const norm = 0.89 / peak2;
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = t > 44.2 ? Math.max(0, 1 - (t - 44.2) / 1.1) : 1, fin = Math.min(1, t / .01);
  out[i * 2] = Math.round(mix[i * 2] * norm * fade * fin * 32767);
  out[i * 2 + 1] = Math.round(mix[i * 2 + 1] * norm * fade * fin * 32767);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0); header.writeUInt32LE(36 + out.byteLength, 4); header.write("WAVE", 8);
header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
header.write("data", 36); header.writeUInt32LE(out.byteLength, 40);
const dir = join(dirname(fileURLToPath(import.meta.url)), "out"); mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "score.wav"), Buffer.concat([header, Buffer.from(out.buffer)]));
console.log(join(dir, "score.wav"));
