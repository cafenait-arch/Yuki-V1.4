export type Ability = {
  id: string; name: string; type: string;
  damage?: number; cost?: number; cooldown?: number; once?: boolean;
  damagePerUnit?: number; costPerUnit?: number; maxUnits?: number;
  costPerTick?: number; tickMs?: number; durationMs?: number;
  count?: number; stunMs?: number; knockback?: number; castMs?: number; overloadMs?: number;
  mult?: { damage: number; speed: number; reflex: number };
};
export type CharDef = {
  id: string; name: string; color: string; range: string; preferredDistance: number;
  hp: number; energy: number; energyRegen: number; speed: number; reflex: number;
  taijutsu: { damage: number; cooldown: number; style: string };
  blackFlashChance?: number; costMult?: number;
  companion?: { name: string; hp: number };
  abilities: Ability[];
};

export const W = 900, H = 520, SIZE = 30, TIME_SCALE = 0.55, DOMAIN_R = 240;

export type Garuda = { hp: number; x: number; y: number; mode: "follow" | "guard" | "whip" | "ball" | "return"; cd: number; t: number; vx: number; vy: number };

type Fighter = {
  garuda: Garuda | null; starForce: number; anger: number;
  def: CharDef; x: number; y: number; vx: number; vy: number;
  hp: number; en: number; stun: number; cd: Record<string, number>; used: Set<string>;
  buff: { damage: number; speed: number; reflex: number } | null;
  beam: { t: number; tick: number; ab: Ability; ang: number } | null;
  simple: number; casting: { ab: Ability; t: number } | null;
  inf: number; think: number; strafe: number; meleeCd: number; flash: number; aggr: number; strafeCd: number; modeT: number; want: number; wallHit: boolean; dodgeT: number; dodgeX: number; dodgeY: number;
};
type Proj = { x: number; y: number; vx: number; vy: number; dmg: number; owner: number; kind: "blood" | "slash" | "red" | "purple"; life: number };
type Blue = { x: number; y: number; owner: number; dmg: number; life: number };
type Orb = { x: number; y: number; owner: number; dmg: number; stun: number; life: number };
type Fx = { kind: "ring" | "slash" | "boom" | "hit" | "domain" | "bf" | "txt" | "divergentFist"; text?: string; x: number; y: number; r: number; color: string; life: number; max: number; ang?: number; seed?: number };

export class Battle {
  f: [Fighter, Fighter]; projs: Proj[] = []; orbs: Orb[] = []; blues: Blue[] = []; fx: Fx[] = []; voidT = 0; voidX = 0; voidY = 0;
  blackHole: { x: number; y: number; t: number; owner: number } | null = null;
  static grid: HTMLCanvasElement | null = null;
  log: string[] = []; winner: string | null = null; time = 0;
  constructor(a: CharDef, b: CharDef) {
    this.f = [this.mk(a, 140, H / 2), this.mk(b, W - 140, H / 2)];
  }
  mk(def: CharDef, x: number, y: number): Fighter {
    return { garuda: def.companion ? { hp: def.companion.hp, x: x + 40, y: y - 35, mode: "follow", cd: 600, t: 0, vx: 0, vy: 0 } : null, starForce: def.taijutsu.damage, anger: 0, def, x, y, vx: 0, vy: 0, hp: def.hp, en: def.energy, stun: 0, cd: {}, used: new Set(), buff: null, beam: null, simple: 0, casting: null, inf: 0, think: 0, strafe: Math.random() < 0.5 ? 1 : -1, meleeCd: 0, flash: 0, aggr: 0.6 + Math.random() * 0.8, strafeCd: 0, modeT: 0, want: def.preferredDistance, wallHit: false, dodgeT: 0, dodgeX: 0, dodgeY: 0 };
  }
  say(s: string) { this.log.unshift(`${(this.time / 1000).toFixed(1)}s · ${s}`); this.log = this.log.slice(0, 14); }
  dm(f: Fighter) { return f.buff?.damage ?? 1; }
  // bloqueio com energia amaldiçoada: custa 75% do dano do golpe
  tryBlock(t: Fighter, d: number, src: string) {
    if (t.stun > 0 || t.casting || t.beam) return false;
    const cost = d * 0.75; if (t.en < cost) return false;
    const hpR = t.hp / t.def.hp, enR = (t.en - cost) / t.def.energy;
    const lethal = d >= t.hp;
    // decide com estratégia: sempre bloqueia golpe letal; poupa energia em golpes fracos
    const worth = lethal || d >= 60 || (hpR < 0.5 && enR > 0.15) || (enR > 0.5 && d >= 20);
    if (!worth || Math.random() > Math.min(0.95, t.def.reflex * (t.buff?.reflex ?? 1) * 0.85)) return false;
    t.en -= cost;
    this.fx.push({ kind: "ring", x: t.x, y: t.y, r: 24, color: "#38bdf8", life: 260, max: 260 });
    this.say(`${t.def.name.split(" ")[0]} bloqueou ${src} com energia (-${Math.round(cost)} EA)`);
    return true;
  }
  damage(t: Fighter, d: number, src: string, blockable = true) {
    if (this.winner || this.blackHole) return;
    if (blockable && this.garudaGuard(t, d, src)) return;
    if (blockable && t.inf > 0 && src !== "VAZIO ROXO") { this.fx.push({ kind: "ring", x: t.x, y: t.y, r: 22, color: "#bfdbfe", life: 300, max: 300 }); this.say(`Ilimitado parou ${src}`); return; }
    if (blockable && t.simple > 0) { t.simple = 0; this.fx.push({ kind: "ring", x: t.x, y: t.y, r: 30, color: "#a5f3fc", life: 350, max: 350 }); this.say(`Domínio Simples de ${t.def.name.split(" ")[0]} anulou ${src}`); return; }
    if (blockable && this.tryBlock(t, d, src)) return;
    if (t.casting) { t.casting = null; this.blues = this.blues.filter((b) => this.f[b.owner] !== t || t.def.id !== "gojo"); this.say(`${t.def.name.split(" ")[0]} foi interrompido`); }
    d = Math.round(d); const lostHp = Math.min(t.hp, Math.max(0, d)); t.hp = Math.max(0, t.hp - d); t.flash = 120;
    if (t.def.abilities.some((a) => a.type === "blackHole")) t.anger = Math.min(1, t.anger + lostHp / (t.def.hp * 0.25));
    this.fx.push({ kind: "hit", x: t.x, y: t.y, r: 6, color: "#fff", life: 200, max: 200 });
    this.say(`${src} → ${t.def.name.split(" ")[0]} -${d}`);
    if (t.hp <= 0) { const w = this.f.find((x) => x !== t); if (!w) return; this.winner = w.def.name; this.say(`🏆 ${w.def.name} venceu`); }
  }
  // todo soco tem chance de Kokusen (Black Flash): dano ×2.5, impossível de bloquear
  punch(me: Fighter, op: Fighter, d: number, src: string) {
    if (Math.random() < (me.def.blackFlashChance ?? 0.03)) {
      this.fx.push({ kind: "boom", x: op.x, y: op.y, r: 40, color: "rgba(0,0,0,0.85)", life: 500, max: 500 });
      this.fx.push({ kind: "bf", x: op.x, y: op.y, r: 70, color: "#ff1130", life: 550, max: 550 });
      this.say(`⚡ BLACK FLASH de ${me.def.name.split(" ")[0]}!`);
      this.damage(op, d * 2.5, `Black Flash (${src})`, false);
      me.en = Math.min(me.def.energy, me.en + me.def.energy * 0.15); // estado de zona
    } else this.damage(op, d, src);
  }
  ready(f: Fighter, a: Ability, cost = a.cost ?? 0) {
    return (f.cd[a.id] ?? 0) <= 0 && f.en >= cost * (f.def.costMult ?? 1) && !(a.once && f.used.has(a.id));
  }
  use(f: Fighter, a: Ability, cost: number) { this.fx.push({ kind: "txt", x: f.x, y: f.y - SIZE, r: 0, color: "#e5e7eb", life: 1100, max: 1100, text: a.name }); f.en -= cost * (f.def.costMult ?? 1); f.cd[a.id] = a.cooldown ?? 0; f.used.add(a.id); }

  step(dt: number) {
    dt *= TIME_SCALE;
    if (this.winner) { this.fx = this.fx.filter((e) => (e.life -= dt) > 0); return; }
    this.time += dt; this.voidT -= dt;
    if (this.blackHole) {
      const hole = this.blackHole; hole.t -= dt;
      for (const f of this.f) {
        f.x += (hole.x - f.x) * Math.min(1, dt / 320);
        f.y += (hole.y - f.y) * Math.min(1, dt / 320);
        if (f.garuda) { f.garuda.x += (hole.x - f.garuda.x) * Math.min(1, dt / 250); f.garuda.y += (hole.y - f.garuda.y) * Math.min(1, dt / 250); }
      }
      for (const p of this.projs) { p.x += (hole.x - p.x) * Math.min(1, dt / 220); p.y += (hole.y - p.y) * Math.min(1, dt / 220); }
      this.orbs = []; this.blues = [];
      if (hole.t <= 0) {
        for (const f of this.f) { f.hp = 0; if (f.garuda) f.garuda.hp = 0; }
        this.projs = []; this.winner = "Empate";
        this.say("BURACO NEGRO: Yuki e o oponente foram destruídos · Empate");
      }
      return;
    }
    this.f.forEach((me, i) => { const op = this.f[i === 0 ? 1 : 0]; if (!this.winner && !this.blackHole) this.updateFighter(me, op, i, dt); });
    if (this.winner || this.blackHole) return;
    this.f.forEach((me, i) => this.updateGaruda(me, this.f[i === 0 ? 1 : 0], dt));
    // projectiles
    for (const p of this.projs) {
      p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.life -= dt;
      const t = this.f[1 - p.owner];
      if (!t) continue;
      const hr = p.kind === "purple" ? 34 : p.kind === "red" ? 12 : 5;
      if (t.inf > 0 && p.kind !== "purple" && Math.hypot(p.x - t.x, p.y - t.y) < 46) { p.vx *= 0.75; p.vy *= 0.75; if (Math.hypot(p.vx, p.vy) < 0.3) p.life = 0; continue; }
      if (Math.abs(p.x - t.x) < SIZE / 2 + hr && Math.abs(p.y - t.y) < SIZE / 2 + hr) {
        const nm = { blood: "Sangue", slash: "Santuário", red: "Vermelho", purple: "VAZIO ROXO" }[p.kind];
        if (p.kind === "red") { this.fx.push({ kind: "boom", x: t.x, y: t.y, r: 110, color: "rgba(239,68,68,0.55)", life: 600, max: 600 }); const a = Math.atan2(p.vy, p.vx); t.vx += Math.cos(a) * 14; t.vy += Math.sin(a) * 14; t.stun = Math.max(t.stun, 450); }
        if (p.kind === "purple") this.fx.push({ kind: "boom", x: t.x, y: t.y, r: 140, color: "rgba(168,85,247,0.6)", life: 800, max: 800 });
        this.damage(t, p.dmg, nm); p.life = 0;
        if (p.kind === "slash") this.fx.push({ kind: "slash", x: t.x, y: t.y, r: 26, color: "#fff", life: 220, max: 220, ang: Math.atan2(p.vy, p.vx) + 1.2 });
      }
    }
    this.projs = this.projs.filter((p) => p.life > 0 && p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20);
    for (const o of this.orbs) {
      o.life -= dt; const t = this.f[1 - o.owner];
      if (!t) continue;
      if (Math.hypot(o.x - t.x, o.y - t.y) < 32) {
        o.life = 0; t.stun = Math.max(t.stun, o.stun); t.beam = null;
        this.fx.push({ kind: "boom", x: o.x, y: o.y, r: 40, color: "#e11d2e", life: 350, max: 350 });
        this.damage(t, o.dmg, "Supernova (atordoado)");
      }
    }
    this.orbs = this.orbs.filter((o) => o.life > 0);
    // Azul: atração manipulada pelo Gojo
    for (const b of this.blues) {
      b.life -= dt; const t = this.f[1 - b.owner], g = this.f[b.owner];
      if (!t || !g) continue;
      if (g.casting?.ab.type === "purple") { b.x += (g.x + 30 - b.x) * 0.06; b.y += (g.y - b.y) * 0.06; continue; }
      const rx = t.x - b.x, ry = t.y - b.y, r = Math.hypot(rx, ry) || 1;
      b.x += (rx / r) * 1.6 * dt / 16; b.y += (ry / r) * 1.6 * dt / 16;
      if (r < 200) { t.vx -= (rx / r) * 0.22; t.vy -= (ry / r) * 0.22; }
      if (r < 26) { b.life = 0; this.fx.push({ kind: "boom", x: b.x, y: b.y, r: 50, color: "rgba(59,130,246,0.6)", life: 450, max: 450 }); t.stun = Math.max(t.stun, 500); this.damage(t, b.dmg, "Azul (compressão)"); }
    }
    this.blues = this.blues.filter((b) => b.life > 0);
    this.fx = this.fx.filter((e) => (e.life -= dt) > 0);
  }

  updateFighter(me: Fighter, op: Fighter, idx: number, dt: number) {
    const d = me.def;
    if (this.shouldUseBlackHole(me, op) && this.activateBlackHole(idx)) return;
    me.en = Math.min(d.energy, me.en + d.energyRegen * dt / 1000);
    for (const k in me.cd) me.cd[k] = (me.cd[k] ?? 0) - dt;
    me.meleeCd -= dt; me.inf -= dt; me.simple -= dt; me.flash -= dt; me.strafeCd -= dt;
    if (me.stun > 0) { me.stun -= dt; me.casting = null; me.beam = null; this.move(me, dt); return; }
    const dx = op.x - me.x, dy = op.y - me.y, dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);

    // domain cast
    if (me.casting) {
      me.casting.t -= dt;
      if (me.casting.t <= 0) {
        const a = me.casting.ab; me.casting = null;
        if (a.type === "purple") {
          this.blues = this.blues.filter((b) => b.owner !== idx);
          const pa = Math.atan2(op.y - me.y, op.x - me.x);
          this.projs.push({ x: me.x, y: me.y, vx: Math.cos(pa) * 7, vy: Math.sin(pa) * 7, dmg: (a.damage ?? 0) * this.dm(me), owner: idx, kind: "purple", life: 2500 });
          this.say(`${me.def.name.split(" ")[0]}: VAZIO ROXO`); return;
        }
        if (!a.overloadMs) this.fx.push({ kind: "domain", x: me.x, y: me.y, r: DOMAIN_R, color: "#fff", life: 900, max: 900 });
        if (Math.hypot(op.x - me.x, op.y - me.y) > DOMAIN_R) this.say(`${op.def.name.split(" ")[0]} escapou do alcance do domínio`);
        else if (a.overloadMs) { this.voidT = a.overloadMs; this.voidX = me.x; this.voidY = me.y; op.stun = a.overloadMs; op.vx = 0; op.vy = 0; op.beam = null; op.casting = null; op.simple = 0; op.inf = 0; this.say(`${op.def.name.split(" ")[0]} sobrecarregado no Vazio Ilimitado`); }
        else { this.fx.push({ kind: "slash", x: op.x, y: op.y, r: 60, color: "#fff", life: 600, max: 600, ang: -0.8 }); this.damage(op, (a.damage ?? 0) * this.dm(me), "Golpe na Alma", false); }
      }
      return;
    }
    // beam channel (must stand still)
    if (me.beam) {
      const b = me.beam; b.t -= dt; b.tick -= dt;
      const target = Math.atan2(dy, dx); let diff = target - b.ang;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); b.ang += Math.max(-0.006, Math.min(0.006, diff)) * dt / 16;
      me.vx *= 0.7; me.vy *= 0.7;
      if (b.tick <= 0) {
        b.tick = (b.ab.tickMs ?? 1);
        if (me.en < (b.ab.costPerTick ?? 0)) { me.beam = null; return; }
        me.en -= (b.ab.costPerTick ?? 0);
        const perp = Math.abs(Math.sin(target - b.ang) * dist);
        if (perp < SIZE / 2 + 4 && Math.cos(target - b.ang) > 0) {
          const ticks = (b.ab.durationMs ?? 1) / (b.ab.tickMs ?? 1);
          this.damage(op, ((b.ab.damage ?? 0) / ticks) * this.dm(me), "Sangue Perfurante");
        }
      }
      if (b.t <= 0) me.beam = null;
      this.move(me, dt); return;
    }

    // leitura de ameaças: projéteis, orbes e feixes
    const reflex = d.reflex * (me.buff?.reflex ?? 1);
    const spd = d.speed * (me.buff?.speed ?? 1);
    let dodge = false; let threat = 0;
    for (const p of this.projs) if (p.owner !== idx) {
      const pv = Math.hypot(p.vx, p.vy) || 1;
      const rx = me.x - p.x, ry = me.y - p.y; const along = (rx * p.vx + ry * p.vy) / pv;
      if (along > -10 && along < 300) {
        const cross = (rx * p.vy - ry * p.vx) / pv;
        const hr = p.kind === "purple" ? 34 : p.kind === "red" ? 12 : 5;
        if (Math.abs(cross) < SIZE / 2 + hr + 14) {
          threat++;
          const nx = -p.vy / pv, ny = p.vx / pv;
          if (me.dodgeT > 0) { me.dodgeT = Math.max(me.dodgeT, 140); } // continua no mesmo lado até sair da linha
          else if (Math.random() < Math.min(1, reflex * (along < 200 ? 1.2 : 0.6))) {
            // sai pelo lado em que já está (afasta da linha), troca só se for bater na parede
            let s = cross >= 0 ? -1 : 1;
            if (Math.abs(cross) < 2) s = Math.random() < 0.5 ? 1 : -1;
            const ex = me.x + nx * s * 70, ey = me.y + ny * s * 70;
            if (ex < 30 || ex > W - 30 || ey < 30 || ey > H - 30) s = -s;
            const v = Math.max(3.4, spd * 1.5);
            me.dodgeX = nx * s * v; me.dodgeY = ny * s * v; me.dodgeT = 300;
          }
        }
      }
    }
    // esquiva comprometida: escolhe um lado e vai até o fim (sem tremer)
    if (me.dodgeT > 0) { me.dodgeT -= dt; me.vx += (me.dodgeX - me.vx) * 0.35; me.vy += (me.dodgeY - me.vy) * 0.35; dodge = true; }
    // orbes: repulsão (nunca anda para dentro de uma armadilha)
    let ox = 0, oy = 0;
    for (const o of this.orbs) if (o.owner !== idx) {
      const rx = me.x - o.x, ry = me.y - o.y, r = Math.hypot(rx, ry) || 1;
      if (r < 110) { const k = (110 - r) / 110; ox += (rx / r) * k * 2.4; oy += (ry / r) * k * 2.4; }
    }
    for (const b of this.blues) if (b.owner !== idx) {
      const rx = me.x - b.x, ry = me.y - b.y, r = Math.hypot(rx, ry) || 1;
      if (r < 150) { const k = (150 - r) / 150; ox += (rx / r) * k * 2.8; oy += (ry / r) * k * 2.8; if (r < 80) threat++; }
    }
    if (op.beam) { // sai da linha do feixe (inclusive durante a carga)
      const toMe = Math.atan2(me.y - op.y, me.x - op.x); const diff = Math.atan2(Math.sin(toMe - op.beam.ang), Math.cos(toMe - op.beam.ang));
      if (Math.abs(diff) < 0.6) {
        threat++;
        const side = diff >= 0 ? 1 : -1; const pa = op.beam.ang + Math.PI / 2 * side;
        if (me.dodgeT <= 0 && Math.random() < Math.min(1, reflex * 0.85)) { me.dodgeX = Math.cos(pa) * 2.6; me.dodgeY = Math.sin(pa) * 2.6; me.dodgeT = 380; }
      }
    }
    // brecha: oponente comprometido (canalizando, conjurando, atordoado, em recarga de golpe)
    const opening = op.stun > 200 || !!op.casting || (!!op.beam && op.beam.t < 400) || op.meleeCd > 300;

    // movement: keep preferred distance + strafe
    const hpR = me.hp / d.hp, enR = me.en / d.energy, opHpR = op.hp / op.def.hp;
    let want = d.preferredDistance;
    if (d.range === "variada") { // Gojo: alterna curta, média e longa
      me.modeT -= dt;
      if (me.modeT <= 0) { me.modeT = 2500 + Math.random() * 3000; const r = Math.random(); me.want = r < 0.35 ? 22 : r < 0.7 ? 200 : 360; }
      want = op.stun > 300 ? 22 : me.want;
      if (hpR < 0.3 && want < 100) want = 200;
    } else if (d.range !== "curta") {
      if (hpR < 0.4) want += 80; // ferido: mais cauteloso
      if (opHpR < 0.25 && enR > 0.3) want -= 60; // fareja a vitória
    } else {
      if (enR < 0.15 && hpR < 0.35) want = 160; // recua para recuperar
      if (op.beam) want = op.beam.t < 400 ? 30 : 140; // espera o fim do feixe para punir
      if (threat > 0) want += 60;
      else if (dist < 140 && !op.beam && !op.casting) want = 20; // já colado: entra no corpo a corpo
    }
    want /= me.aggr > 1 ? me.aggr : 1;
    if (op.casting) want = DOMAIN_R + 80; // foge do domínio
    const dz = want < 80 ? 6 : 30;
    let radial = dist > want + dz ? 1 : dist < want - dz ? -1 : 0;
    if (threat > 0 && radial > 0) radial = 0; // nunca avança contra um ataque
    // evita cantos: força em direção ao centro perto das paredes
    const M = 90;
    const wx = me.x < M ? (M - me.x) / M : me.x > W - M ? -(me.x - (W - M)) / M : 0;
    const wy = me.y < M ? (M - me.y) / M : me.y > H - M ? -(me.y - (H - M)) / M : 0;
    const cornered = Math.abs(wx) > 0.4 && Math.abs(wy) > 0.4;
    if (cornered && radial < 0) radial = 0; // não recua mais para o canto
    const sf = cornered ? 1.2 : d.range === "curta" ? (dist > 120 ? 0.9 : 0.35) : 0.8;
    if (d.range === "curta" && dist > 120 && me.strafeCd <= 0 && Math.random() < 0.04) { me.strafe *= -1; me.strafeCd = 500; }
    // escolhe o lado do strafe que leva ao centro
    if ((Math.abs(wx) > 0.3 || Math.abs(wy) > 0.3) && me.strafeCd <= 0) {
      const px = Math.cos(ang + Math.PI / 2), py = Math.sin(ang + Math.PI / 2);
      me.strafe = px * (W / 2 - me.x) + py * (H / 2 - me.y) >= 0 ? 1 : -1; me.strafeCd = 900;
    }
    const tx = Math.cos(ang) * radial + Math.cos(ang + Math.PI / 2) * me.strafe * sf + wx * 1.6 + ox;
    const ty = Math.sin(ang) * radial + Math.sin(ang + Math.PI / 2) * me.strafe * sf + wy * 1.6 + oy;
    if (!dodge) { me.vx += (tx * spd - me.vx) * 0.15; me.vy += (ty * spd - me.vy) * 0.15; }
    if (me.strafeCd <= 0 && Math.random() < 0.01) { me.strafe *= -1; me.strafeCd = 700; }

    // investida (taijutsu de curta distância): fecha a distância em explosões
    const pathBlocked = this.orbs.some((o) => o.owner !== idx && Math.hypot(o.x - (me.x + op.x) / 2, o.y - (me.y + op.y) / 2) < 70);
    if ((d.range === "curta" || want < 60) && dist > 90 && dist < 420 && (me.cd['dash'] ?? 0) <= 0 && !op.beam && threat === 0 && !pathBlocked && (opening || Math.random() < 0.02)) {
      const zig = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4); // entra em ângulo, nunca reto
      me.vx = Math.cos(ang + zig) * spd * 3.2; me.vy = Math.sin(ang + zig) * spd * 3.2; me.cd['dash'] = 1100 + Math.random() * 900;
    }
    // think
    me.think -= dt;
    if (me.think <= 0) { me.think = 260 / reflex; this.decide(me, op, idx, dist, ang); }
    if (this.winner || this.blackHole) return;
    // taijutsu
    if (dist < SIZE + 14 && me.meleeCd <= 0) {
      me.meleeCd = d.taijutsu.cooldown / (me.buff?.speed ?? 1);
      const hpBefore = op.hp;
      if (d.abilities.some((a) => a.type === "starRage")) this.stellarPunch(me, op);
      else this.punch(me, op, d.taijutsu.damage * this.dm(me), "Taijutsu");
      if (op.hp < hpBefore) { op.vx += Math.cos(ang) * 2.5; op.vy += Math.sin(ang) * 2.5; op.beam = null; } else { op.vx += Math.cos(ang) * 3; op.vy += Math.sin(ang) * 3; }
    }
    this.move(me, dt);
  }

  decide(me: Fighter, op: Fighter, idx: number, dist: number, ang: number) {
    const ab = (t: string) => me.def.abilities.find((a) => a.type === t);
    if (this.shouldUseBlackHole(me, op)) {
      if (this.activateBlackHole(idx)) return;
    }
    const inf0 = ab("infinity");
    const simple = ab("simpleDomain");
    const danger = this.projs.some((p) => p.owner !== idx && p.dmg >= 40 && Math.hypot(p.x - me.x, p.y - me.y) < 130) || (dist < 50 && op.meleeCd <= 0 && op.def.range !== "media-longa") || op.casting?.ab.type === "purple";
    if (simple && me.simple <= 0 && me.inf <= 0 && danger && this.ready(me, simple) && !(inf0 && this.ready(me, inf0) && op.casting?.ab.type !== "purple") && Math.random() < 0.5) {
      this.use(me, simple, (simple.cost ?? 0)); me.simple = (simple.durationMs ?? 1);
      this.fx.push({ kind: "ring", x: me.x, y: me.y, r: 34, color: "#22d3ee", life: (simple.durationMs ?? 1), max: (simple.durationMs ?? 1) });
      this.say(`${me.def.name.split(" ")[0]}: Domínio Simples`); return;
    }
    const buff = ab("buff");
    if (buff && this.ready(me, buff) && (me.hp < me.def.hp * 0.75 || this.time > 6000)) {
      this.use(me, buff, (buff.cost ?? 0)); me.buff = buff.mult ?? null;
      this.fx.push({ kind: "ring", x: me.x, y: me.y, r: 40, color: "#e11d2e", life: 500, max: 500 });
      this.say(`${me.def.name.split(" ")[0]}: Escama Vermelha`); return;
    }
    const inf = ab("infinity");
    const incoming = this.projs.some((p) => p.owner !== idx && Math.hypot(p.x - me.x, p.y - me.y) < 220) || dist < 70 || !!op.beam;
    if (inf && me.inf <= 0 && incoming && this.ready(me, inf)) {
      this.use(me, inf, (inf.cost ?? 0)); me.inf = (inf.durationMs ?? 1); this.say(`${me.def.name.split(" ")[0]}: Ilimitado`); return;
    }
    const dom = ab("domain");
    const domainFinisher = dom?.overloadMs ? (op.hp / op.def.hp < 0.6 || Math.random() < 0.15) : op.hp <= (dom?.damage ?? 0) * this.dm(me) * 1.05;
    if (dom && this.ready(me, dom) && dist < DOMAIN_R * 0.6 && (domainFinisher || (me.hp / me.def.hp < 0.45 && Math.random() < 0.4))) {
      this.use(me, dom, (dom.cost ?? 0)); me.casting = { ab: dom, t: (dom.castMs ?? 0) };
      this.say(`${me.def.name.split(" ")[0]}: EXPANSÃO DE DOMÍNIO`); return;
    }
    const blue = ab("blue"), red = ab("red"), purple = ab("purple");
    const myBlue = this.blues.find((b) => b.owner === idx);
    if (purple && myBlue && dist > 160 && this.ready(me, purple) && (op.stun > 300 || Math.random() < 0.3)) {
      this.use(me, purple, (purple.cost ?? 0)); me.casting = { ab: purple, t: (purple.castMs ?? 0) };
      this.say(`${me.def.name.split(" ")[0]} junta Azul e Vermelho...`); return;
    }
    if (red && !this.projs.some((p) => p.owner === idx && p.kind === "red") && dist < 520 && this.ready(me, red) && (op.stun > 0 || !!myBlue || Math.random() < 0.3)) {
      this.use(me, red, (red.cost ?? 0));
      const t = dist / 7, a = Math.atan2(op.y + op.vy * t - me.y, op.x + op.vx * t - me.x);
      this.projs.push({ x: me.x, y: me.y, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, dmg: (red.damage ?? 0) * this.dm(me), owner: idx, kind: "red", life: 2200 });
      this.say(`${me.def.name.split(" ")[0]}: Vermelho`); return;
    }
    if (blue && !myBlue && this.ready(me, blue) && dist > 80) {
      this.use(me, blue, (blue.cost ?? 0));
      this.blues.push({ x: me.x + Math.cos(ang) * 40, y: me.y + Math.sin(ang) * 40, owner: idx, dmg: (blue.damage ?? 0) * this.dm(me), life: 6000 });
      this.say(`${me.def.name.split(" ")[0]}: Azul`); return;
    }
    const fist = ab("fist");
    if (fist && dist < SIZE + 14 && this.ready(me, fist) && (op.beam || Math.random() < 0.45 * me.aggr)) {
      this.use(me, fist, (fist.cost ?? 0));
      this.fx.push({ kind: "divergentFist", x: me.x + Math.cos(ang) * 24, y: me.y + Math.sin(ang) * 24, r: 50, color: "", life: 850, max: 850, ang });
      this.punch(me, op, (fist.damage ?? 0) * this.dm(me), "Punho Divergente");
      op.stun = (fist.stunMs ?? 0); op.vx += Math.cos(ang) * (fist.knockback ?? 0); op.vy += Math.sin(ang) * (fist.knockback ?? 0); return;
    }
    const beam = ab("beam");
    const beamFree = op.stun > 300 || (this.time > 3000 && me.def.range !== "curta" && dist > 200 && Math.random() < 0.25);
    if (beam && this.ready(me, beam, (beam.costPerTick ?? 0) * 3) && dist > 90 && beamFree) {
      this.use(me, beam, 0); me.beam = { t: (beam.durationMs ?? 1) + 450, tick: 450, ab: beam, ang };
      this.say(`${me.def.name.split(" ")[0]}: Sangue Perfurante`); return;
    }
    const orbs = ab("orbs");
    if (orbs && this.ready(me, orbs) && (dist > 120 || me.def.range !== "curta")) {
      this.use(me, orbs, (orbs.cost ?? 0));
      for (let i = 0; i < (orbs.count ?? 0); i++) {
        const a = ang + Math.PI + (i - 2) * 0.7, r = 70 + Math.random() * 40; // around enemy, cutting off approach
        const x = Math.max(20, Math.min(W - 20, op.x + Math.cos(a) * r * (i % 2 ? 1 : -1)));
        const y = Math.max(20, Math.min(H - 20, op.y + Math.sin(a) * r));
        this.orbs.push({ x, y, owner: idx, dmg: (orbs.damage ?? 0) * this.dm(me), stun: (orbs.stunMs ?? 0), life: 9000 });
      }
      this.say(`${me.def.name.split(" ")[0]}: Supernova`); return;
    }
    const slash = ab("slash");
    if (slash && dist > 70 && dist < 380 && this.ready(me, slash, (slash.costPerUnit ?? 0)) && (op.stun > 0 || op.beam || Math.random() < 0.35)) {
      const reserve = dom && !me.used.has(dom.id) ? (dom.cost ?? 0) : 0;
      const want = op.stun > 0 || op.beam ? (slash.maxUnits ?? 1) : 1 + Math.floor(Math.random() * 2);
      const units = Math.min(want, Math.floor((me.en - reserve) / (slash.costPerUnit ?? 0)));
      if (units >= 1) {
        this.use(me, slash, units * (slash.costPerUnit ?? 0));
        for (let i = 0; i < units; i++) {
          const a = ang + (i - (units - 1) / 2) * 0.12;
          this.projs.push({ x: me.x, y: me.y, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, dmg: (slash.damagePerUnit ?? 0) * this.dm(me), owner: idx, kind: "slash", life: 1500 });
        }
        this.say(`${me.def.name.split(" ")[0]}: Santuário x${units}`); return;
      }
    }
    const blood = ab("bloodShot");
    const keep = me.def.abilities.reduce((m, a) => (a.type === "domain" && !me.used.has(a.id) ? (a.cost ?? 0) : a.type === "orbs" ? Math.max(m, (a.cost ?? 0)) : m), 0);
    if (blood && dist > 40 && this.ready(me, blood, (blood.costPerUnit ?? 0)) && (me.en - (blood.costPerUnit ?? 0) >= keep || op.hp / op.def.hp < 0.2) && Math.random() < 0.5 + me.aggr * 0.3) {
      const units = Math.min((blood.maxUnits ?? 1), Math.floor(me.en / (blood.costPerUnit ?? 0)));
      this.use(me, blood, units * (blood.costPerUnit ?? 0));
      // lead the target
      const t = dist / 8; const px = op.x + op.vx * t, py = op.y + op.vy * t; const a = Math.atan2(py - me.y, px - me.x);
      for (let i = 0; i < units; i++) this.projs.push({ x: me.x, y: me.y, vx: Math.cos(a + i * 0.08) * 8, vy: Math.sin(a + i * 0.08) * 8, dmg: (blood.damagePerUnit ?? 0) * this.dm(me), owner: idx, kind: "blood", life: 1800 });
    }
  }

  stellarPunch(me: Fighter, op: Fighter, requestedUnits?: number) {
    const a = me.def.abilities.find((a) => a.type === "starRage");
    if (!a || this.winner || this.blackHole) return;
    const unitCost = a.costPerUnit ?? 20, bonus = a.damagePerUnit ?? 5;
    const affordable = Math.floor(me.en / unitCost);
    const desired = requestedUnits ?? Math.max(1, Math.ceil((Math.min(op.hp, 160) - me.def.taijutsu.damage) / bonus));
    const units = Math.min(affordable, Math.max(0, Math.floor(desired)));
    me.en -= units * unitCost;
    me.starForce = me.def.taijutsu.damage + units * bonus;
    this.say(`Fúria Estelar: soco ${me.starForce} · -${units * unitCost} EA`);
    this.punch(me, op, me.starForce * this.dm(me), "Fúria Estelar");
  }

  shouldUseBlackHole(me: Fighter, op: Fighter) {
    // Rage builds from actual damage; sacrifice only when defeat is close, not in an even fight.
    return me.def.abilities.some((a) => a.type === "blackHole") && me.hp > 0 &&
      me.anger >= 1 && me.hp / me.def.hp <= 0.2 && op.hp / op.def.hp > (me.hp / me.def.hp) * 2;
  }

  activateBlackHole(idx: number) {
    const me = this.f[idx];
    if (!me || this.winner || this.blackHole || me.hp <= 0) return false;
    const a = me.def.abilities.find((a) => a.type === "blackHole");
    if (!a || me.en <= 0 || !this.ready(me, a)) return false;
    const spent = me.en;
    this.use(me, a, spent / (me.def.costMult ?? 1)); me.en = 0;
    this.blackHole = { x: me.x, y: me.y, t: 1500, owner: idx };
    for (const f of this.f) { f.casting = null; f.beam = null; }
    this.say(`Yuki enfurecida: BURACO NEGRO! Sacrifício · -${Math.round(spent)} EA · toda a arena`);
    return true;
  }

  garudaGuard(me: Fighter, damage: number, src: string) {
    const g = me.garuda;
    if (!g || g.hp <= 0 || g.mode !== "guard") return false;
    const absorbed = Math.min(g.hp, Math.round(damage));
    g.hp = Math.max(0, g.hp - absorbed);
    this.say(`Garuda protegeu Yuki de ${src} · -${absorbed} vida`);
    this.fx.push({ kind: "ring", x: g.x, y: g.y, r: 28, color: me.def.color, life: 300, max: 300 });
    if (g.hp <= 0) { this.say("Garuda foi destruído"); if (damage > absorbed) this.damage(me, damage - absorbed, src, false); }
    return true;
  }

  updateGaruda(me: Fighter, op: Fighter, dt: number) {
    const g = me.garuda;
    if (!g || !op || g.hp <= 0 || me.hp <= 0 || this.winner) return;
    g.cd -= dt; g.t -= dt;
    const dist = Math.hypot(op.x - me.x, op.y - me.y);
    if (g.mode === "ball") {
      g.x += g.vx * dt / 16; g.y += g.vy * dt / 16;
      if (Math.hypot(g.x - op.x, g.y - op.y) < 28) {
        this.damage(op, 65, "Garuda (projétil)"); g.mode = "return";
      } else if (g.t <= 0 || g.x < 0 || g.x > W || g.y < 0 || g.y > H) g.mode = "return";
      return;
    }
    const danger = !!op.beam || this.projs.some((p) => this.f[p.owner] !== me && Math.hypot(p.x - me.x, p.y - me.y) < 180) || (dist < 65 && op.meleeCd <= 0);
    if (g.mode === "return") {
      g.x += (me.x + 38 - g.x) * Math.min(1, dt / 140); g.y += (me.y - 25 - g.y) * Math.min(1, dt / 140);
      if (Math.hypot(g.x - me.x - 38, g.y - me.y + 25) < 10) g.mode = "follow";
      return;
    }
    if (g.mode === "whip" && g.t > 0) return;
    g.mode = danger ? "guard" : "follow";
    const ang = Math.atan2(op.y - me.y, op.x - me.x);
    g.x = Math.max(15, Math.min(W - 15, me.x + (danger ? Math.cos(ang) * 30 : 38)));
    g.y = Math.max(15, Math.min(H - 15, me.y + (danger ? Math.sin(ang) * 30 : -25)));
    if (danger || g.cd > 0 || me.stun > 0) return;
    g.cd = 1800;
    if (dist < 65) this.damage(op, 30, "Garuda (ataque)");
    else if (dist < 180) {
      g.mode = "whip"; g.t = 350; g.x = op.x; g.y = op.y;
      this.damage(op, 45, "Garuda (chicote)");
    } else {
      g.mode = "ball"; g.t = 1400; g.vx = Math.cos(ang) * 8; g.vy = Math.sin(ang) * 8;
      this.say("Garuda: projétil em forma de bola");
    }
  }

  move(f: Fighter, dt: number) {
    f.x += f.vx * dt / 16; f.y += f.vy * dt / 16; f.vx *= 0.92; f.vy *= 0.92;
    const m = SIZE / 2;
    const hit = f.x < m || f.x > W - m || f.y < m || f.y > H - m;
    if (hit && f.stun > 0 && !f.wallHit && Math.hypot(f.vx, f.vy) > 5) { f.wallHit = true; this.damage(f, 25, "Impacto na parede", false); }
    if (!hit) f.wallHit = false;
    if (f.x < m || f.x > W - m) { f.x = Math.max(m, Math.min(W - m, f.x)); f.vx *= -0.4; }
    if (f.y < m || f.y > H - m) { f.y = Math.max(m, Math.min(H - m, f.y)); f.vy *= -0.4; }
  }

  // Vazio Ilimitado: barreira desenhada em código (esfera cósmica infinita)
  drawVoid(c: CanvasRenderingContext2D) {
    const a = Math.min(1, this.voidT / 350), R = DOMAIN_R, x = this.voidX, y = this.voidY, t = this.time;
    c.save(); c.globalAlpha = a;
    c.fillStyle = "rgba(2,4,14,0.55)"; c.fillRect(0, 0, W, H);
    c.beginPath(); c.arc(x, y, R, 0, 7); c.fillStyle = "#03040c"; c.fill(); c.clip();
    for (let i = 0; i < 6; i++) { c.strokeStyle = `rgba(147,197,253,${0.07 + i * 0.02})`; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, R * (0.25 + i * 0.13), R * (0.08 + i * 0.05), t / 3000 + i * 0.5, 0, 7); c.stroke(); }
    c.fillStyle = "#e0f2fe";
    for (let i = 0; i < 90; i++) { const s = Math.sin(i * 12.9898) * 43758.5453, fr = s - Math.floor(s); const ang = i * 2.399 + t / (4000 + i * 40), dd = Math.sqrt(fr) * R; const sz = i % 9 === 0 ? 2 : 1; c.fillRect(x + Math.cos(ang) * dd, y + Math.sin(ang) * dd, sz, sz); }
    const pulse = 18 + Math.sin(t / 150) * 4;
    c.fillStyle = "rgba(255,255,255,0.12)"; c.beginPath(); c.arc(x, y, pulse * 2.2, 0, 7); c.fill();
    c.fillStyle = "rgba(255,255,255,0.85)"; c.beginPath(); c.arc(x, y, pulse * 0.5, 0, 7); c.fill();
    c.restore(); c.save(); c.globalAlpha = a;
    c.strokeStyle = "rgba(125,211,252,0.3)"; c.lineWidth = 8; c.beginPath(); c.arc(x, y, R, 0, 7); c.stroke();
    c.strokeStyle = "#fff"; c.lineWidth = 2; c.stroke();
    c.font = "9px monospace"; c.textAlign = "center"; c.fillStyle = "rgba(255,255,255,0.7)"; c.fillText("Vazio Ilimitado", x, y - R - 6);
    c.restore();
  }

  drawDivergentFist(c: CanvasRenderingContext2D, e: Fx) {
    const tokens = getComputedStyle(document.documentElement);
    const blue = tokens.getPropertyValue("--divergent-blue").trim();
    const cyan = tokens.getPropertyValue("--divergent-cyan").trim();
    const light = tokens.getPropertyValue("--divergent-light").trim();
    const edge = tokens.getPropertyValue("--divergent-edge").trim();
    const progress = 1 - e.life / e.max;
    c.save(); c.translate(e.x, e.y); c.rotate(e.ang ?? 0);
    c.lineJoin = "round"; c.lineCap = "round";
    // Layered, irregular flame tongues rise from a closed fist, like the reference.
    for (let layer = 0; layer < 3; layer++) {
      c.save(); c.scale(1 - layer * 0.14, 1 - layer * 0.11);
      c.globalAlpha *= layer === 0 ? 0.55 : 0.85;
      c.fillStyle = layer === 1 ? blue : cyan;
      c.beginPath(); c.moveTo(-17, 16);
      c.bezierCurveTo(-40, 4, -31, -25, -23, -43);
      c.lineTo(-28, -35); c.bezierCurveTo(-22, -62, -34, -81, -16, -111);
      c.bezierCurveTo(-24, -82, -9, -71, -10, -60);
      c.lineTo(-1, -83); c.bezierCurveTo(5, -57, -4, -44, 7, -32);
      c.lineTo(15, -52); c.bezierCurveTo(11, -24, 35, -11, 27, 12);
      c.bezierCurveTo(18, 28, -4, 30, -17, 16); c.closePath(); c.fill();
      c.restore();
    }
    c.strokeStyle = light; c.lineWidth = 2; c.globalAlpha *= 0.85;
    for (let i = 0; i < 4; i++) {
      const sway = Math.sin(progress * 16 + i * 2) * 4;
      c.beginPath(); c.moveTo(-22 + i * 12, 7);
      c.bezierCurveTo(-30 + i * 11, -18, -15 + i * 7 + sway, -34, -15 + i * 6, -57 - i * 9); c.stroke();
    }
    c.globalAlpha = Math.min(1, e.life / e.max * 2);
    // Forearm and four folded knuckles; dark creases keep the fist legible at arena scale.
    c.fillStyle = blue; c.strokeStyle = edge; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(-24, 17); c.lineTo(-10, 2); c.lineTo(13, 7); c.lineTo(-9, 29); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = cyan; c.beginPath(); c.moveTo(-9, 5); c.lineTo(-13, -7); c.lineTo(-6, -17);
    c.lineTo(11, -20); c.lineTo(21, -12); c.lineTo(24, 1); c.lineTo(13, 14); c.lineTo(1, 15); c.closePath(); c.fill(); c.stroke();
    for (let i = 0; i < 4; i++) {
      const x = -6 + i * 6;
      c.fillStyle = light; c.beginPath(); c.moveTo(x, -14); c.lineTo(x + 4, -16);
      c.lineTo(x + 7, -8); c.lineTo(x + 2, -5); c.closePath(); c.fill(); c.stroke();
    }
    c.fillStyle = blue; c.beginPath(); c.moveTo(-10, -2); c.lineTo(2, -7); c.lineTo(11, -1);
    c.lineTo(7, 6); c.lineTo(-3, 5); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, 10); c.lineTo(10, 10); c.lineTo(18, 3); c.stroke();
    c.restore();
  }

  draw(c: CanvasRenderingContext2D) {
    c.clearRect(0, 0, W, H);
    if (!Battle.grid) {
      const g = document.createElement("canvas"); g.width = W; g.height = H; const gc = g.getContext("2d"); if (!gc) return;
      gc.strokeStyle = "rgba(255,255,255,0.05)"; gc.beginPath();
      for (let x = 0; x < W; x += 40) { gc.moveTo(x + 0.5, 0); gc.lineTo(x + 0.5, H); }
      for (let y = 0; y < H; y += 40) { gc.moveTo(0, y + 0.5); gc.lineTo(W, y + 0.5); }
      gc.stroke(); Battle.grid = g;
    }
    c.drawImage(Battle.grid, 0, 0);
    if (this.voidT > 0) this.drawVoid(c);
    if (this.blackHole) {
      const h = this.blackHole, r = 24 + (1500 - Math.max(0, h.t)) / 18;
      c.save(); c.strokeStyle = this.f[h.owner === 0 ? 0 : 1].def.color;
      for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(h.x, h.y, r + i * 38, (r + i * 38) * 0.45, this.time / 300 + i * 0.45, 0, Math.PI * 2); c.stroke(); }
      c.fillStyle = "#000"; c.beginPath(); c.arc(h.x, h.y, r, 0, Math.PI * 2); c.fill(); c.restore();
    }
    for (const f of this.f) {
      const g = f.garuda; if (!g || g.hp <= 0) continue;
      const tokens = getComputedStyle(document.documentElement);
      const bone = tokens.getPropertyValue("--garuda-bone").trim(), shade = tokens.getPropertyValue("--garuda-shade").trim();
      const edge = tokens.getPropertyValue("--garuda-edge").trim(), spike = tokens.getPropertyValue("--garuda-spike").trim();
      const eye = tokens.getPropertyValue("--garuda-eye").trim();
      c.save(); c.translate(g.x, g.y);
      c.rotate(g.mode === "ball" ? Math.atan2(g.vy, g.vx) : (f.x < W / 2 ? 0 : Math.PI));
      c.scale(0.5, 0.5);
      c.lineJoin = "round"; c.lineWidth = 1;
      // Articulated bone plates and paired blue-gray spines, following the supplied reference.
      const length = g.mode === "whip" ? Math.min(150, Math.hypot(g.x - f.x, g.y - f.y)) : 69;
      for (let i = 10; i >= 0; i--) {
        const t = i / 10, a = i * 0.57;
        const x = g.mode === "ball" ? Math.cos(a) * 13 : -t * length;
        const y = g.mode === "ball" ? Math.sin(a) * 13 : -Math.sin(t * Math.PI * 0.95) * 24 + Math.sin(this.time / 280 + t * 4) * t * 3;
        c.save(); c.translate(x, y);
        c.rotate(g.mode === "ball" ? a + Math.PI / 2 : Math.cos(t * Math.PI) * 0.6);
        c.scale(1 - t * 0.48, 1 - t * 0.48);
        for (const side of [-1, 1]) {
          c.fillStyle = spike; c.strokeStyle = edge;
          c.beginPath(); c.moveTo(-3, side * 3); c.lineTo(-12, side * (i % 2 ? 24 : 18));
          c.lineTo(3, side * 5); c.closePath(); c.fill(); c.stroke();
        }
        c.fillStyle = shade; c.strokeStyle = edge;
        c.beginPath(); c.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = bone; c.beginPath(); c.moveTo(-7, -3); c.lineTo(-2, -6);
        c.lineTo(5, -4); c.lineTo(8, 0); c.lineTo(3, 4); c.lineTo(-5, 3); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(-2, -4); c.lineTo(1, 0); c.lineTo(-3, 3); c.stroke(); c.restore();
      }
      // Skull with red eye socket and long, split mandibles.
      c.strokeStyle = edge; c.fillStyle = bone;
      for (const side of [-1, 1]) {
        c.beginPath(); c.moveTo(7, side * 3); c.lineTo(37, side * 7);
        c.lineTo(35, side * 3); c.lineTo(10, side); c.closePath(); c.fill(); c.stroke();
      }
      c.fillStyle = shade; c.beginPath(); c.ellipse(1, 0, 12, 8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = bone; c.beginPath(); c.moveTo(-11, -3); c.lineTo(-6, -9); c.lineTo(4, -8);
      c.lineTo(13, -2); c.lineTo(9, 5); c.lineTo(1, 8); c.lineTo(-8, 5); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-7, -4); c.lineTo(1, -6); c.lineTo(8, -2); c.stroke();
      c.fillStyle = edge; c.beginPath(); c.ellipse(2, 0, 4.5, 3.5, -0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = eye; c.beginPath(); c.arc(2.5, 0, 1.7, 0, Math.PI * 2); c.fill(); c.restore();
      c.save(); c.font = "10px monospace"; c.textAlign = "center";
      c.fillStyle = tokens.getPropertyValue("--foreground").trim();
      c.fillText(`Garuda ${Math.ceil(g.hp)}`, g.x, Math.max(12, g.y - 29)); c.restore();
    }
    for (const b of this.blues) { const r = 11 + Math.sin(this.time / 90) * 2; c.fillStyle = "rgba(59,130,246,0.25)"; c.beginPath(); c.arc(b.x, b.y, r + 9, 0, 7); c.fill(); c.fillStyle = "#60a5fa"; c.beginPath(); c.arc(b.x, b.y, r, 0, 7); c.fill(); c.strokeStyle = "rgba(96,165,250,0.35)"; c.beginPath(); c.arc(b.x, b.y, 30 + (this.time / 8) % 30, 0, 7); c.stroke(); c.font = "9px monospace"; c.textAlign = "center"; c.fillStyle = "rgba(191,219,254,0.7)"; c.fillText("Azul", b.x, b.y + 26); c.textAlign = "left"; }
    for (const f of this.f) if (f.casting?.ab.type === "purple") { c.fillStyle = "rgba(239,68,68,0.3)"; c.beginPath(); c.arc(f.x - 30, f.y, 18, 0, 7); c.fill(); c.fillStyle = "#ef4444"; c.beginPath(); c.arc(f.x - 30, f.y, 10, 0, 7); c.fill(); }
    for (const o of this.orbs) { c.fillStyle = "#e11d2e"; c.beginPath(); c.arc(o.x, o.y, 6 + Math.sin(this.time / 120) * 1.5, 0, 7); c.fill(); }
    for (const f of this.f) if (f.beam) {
      c.strokeStyle = "#ff2a3a"; c.lineWidth = 4; c.beginPath(); c.moveTo(f.x, f.y);
      c.lineTo(f.x + Math.cos(f.beam.ang) * 1200, f.y + Math.sin(f.beam.ang) * 1200); c.stroke(); c.lineWidth = 1;
    }
    for (const p of this.projs) {
      if (p.kind === "red" || p.kind === "purple") { const pr = p.kind === "red", r = pr ? 10 : 34; c.fillStyle = pr ? "rgba(239,68,68,0.3)" : "rgba(168,85,247,0.3)"; c.beginPath(); c.arc(p.x, p.y, r * 1.7, 0, 7); c.fill(); c.fillStyle = pr ? "#ef4444" : "#a855f7"; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill(); }
      else if (p.kind === "blood") { c.fillStyle = "#e11d2e"; c.beginPath(); c.arc(p.x, p.y, 4, 0, 7); c.fill(); }
      else { const a = Math.atan2(p.vy, p.vx) + Math.PI / 2; c.strokeStyle = "#fff"; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x - Math.cos(a) * 12, p.y - Math.sin(a) * 12); c.lineTo(p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12); c.stroke(); c.lineWidth = 1; }
    }
    for (const e of this.fx) {
      const k = e.life / e.max; c.globalAlpha = Math.min(1, k * 1.5);
      if (e.kind === "divergentFist") { c.globalAlpha = 1; continue; }
      else if (e.kind === "ring") { c.strokeStyle = e.color; c.lineWidth = 2; c.beginPath(); const f = this.f.find((q) => Math.hypot(q.x - e.x, q.y - e.y) < 200); c.arc(e.color === "#22d3ee" && f ? f.x : e.x, e.color === "#22d3ee" && f ? f.y : e.y, e.color === "#22d3ee" ? e.r : e.r * (1.2 - k), 0, 7); c.stroke(); }
      else if (e.kind === "boom") { c.fillStyle = e.color; c.beginPath(); c.arc(e.x, e.y, e.r * (1 - k) + 4, 0, 7); c.fill(); }
      else if (e.kind === "bf") {
        const R = e.r * (1.5 - k), bolts = 8, segs = 5;
        c.save();
        for (let i = 0; i < bolts; i++) {
          const a = (i / bolts) * Math.PI * 2 + (i % 2 ? 0.35 : -0.2);
          for (const [col, w] of [["rgba(255,17,48,0.3)", 11], ["#000", 7], ["#ff1130", 2.5]] as const) {
            c.strokeStyle = col; c.lineWidth = w; c.beginPath();
            let px = e.x, py = e.y; c.moveTo(px, py);
            for (let s = 1; s <= segs; s++) {
              const rr = (R / segs) * s, off = (Math.random() - 0.5) * 30;
              px = e.x + Math.cos(a) * rr - Math.sin(a) * off;
              py = e.y + Math.sin(a) * rr + Math.cos(a) * off;
              c.lineTo(px, py);
            }
            c.stroke();
          }
        }
        c.restore();
      }
      else if (e.kind === "txt") { c.font = "9px monospace"; c.textAlign = "center"; c.fillStyle = e.color; c.fillText(e.text ?? "", e.x, e.y - (1 - k) * 12); c.textAlign = "left"; }
      else if (e.kind === "domain") { c.strokeStyle = "#fff"; c.lineWidth = 1; c.beginPath(); c.arc(e.x, e.y, e.r * (1.05 - k * 0.3), 0, 7); c.stroke(); c.fillStyle = "rgba(255,255,255,0.04)"; c.fill(); }
      else if (e.kind === "slash") { c.strokeStyle = "#fff"; c.lineWidth = e.r > 40 ? 5 : 2; c.beginPath(); c.moveTo(e.x - Math.cos(e.ang ?? 0) * e.r, e.y - Math.sin(e.ang ?? 0) * e.r); c.lineTo(e.x + Math.cos(e.ang ?? 0) * e.r, e.y + Math.sin(e.ang ?? 0) * e.r); c.stroke(); }
      else { c.fillStyle = e.color; c.fillRect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2); }
      c.globalAlpha = 1; c.lineWidth = 1;
    }
    for (const f of this.f) {
      c.fillStyle = f.flash > 0 ? "#ffffff" : f.def.color;
      c.fillRect(f.x - SIZE / 2, f.y - SIZE / 2, SIZE, SIZE);
      c.strokeStyle = f.buff ? "#e11d2e" : "rgba(255,255,255,0.35)"; c.strokeRect(f.x - SIZE / 2, f.y - SIZE / 2, SIZE, SIZE);
      if (f.inf > 0) { c.strokeStyle = "rgba(191,219,254,0.5)"; c.setLineDash([3, 4]); c.strokeRect(f.x - SIZE / 2 - 8, f.y - SIZE / 2 - 8, SIZE + 16, SIZE + 16); c.setLineDash([]); }
      if (f.stun > 0) { c.fillStyle = "#facc15"; c.font = "11px monospace"; c.fillText("✶", f.x - 4, f.y - SIZE / 2 - 4); }
      if (f.casting) { c.strokeStyle = "#fff"; c.beginPath(); c.arc(f.x, f.y, 24 + (1 - f.casting.t / (f.casting.ab.castMs ?? 700)) * 30, 0, 7); c.stroke(); }
    }
    // Keep the actual fist visible above the square fighters at the point of contact.
    for (const e of this.fx) if (e.kind === "divergentFist") {
      c.globalAlpha = Math.min(1, e.life / e.max * 1.5);
      this.drawDivergentFist(c, e); c.globalAlpha = 1;
    }
  }
}
