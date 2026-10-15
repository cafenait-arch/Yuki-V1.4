import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import chars from "@/data/characters.json";
import { Battle, W, H, type CharDef } from "@/lib/engine";
import { Button } from "@/components/ui/button";

const CHARS = chars as CharDef[];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Square Jujutsu — Simulador de Luta" },
      { name: "description", content: "Simulador minimalista de lutas de Jujutsu Kaisen com quadrados e IA estratégica." },
      { property: "og:title", content: "Square Jujutsu — Simulador de Luta" },
      { property: "og:description", content: "Lutas de Jujutsu Kaisen com quadrados e IA estratégica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Bar({ v, max, kind }: { v: number; max: number; kind: "hp" | "en" }) {
  return (
    <div className="h-1.5 w-full bg-muted">
      <div className={kind === "hp" ? "h-full bg-primary transition-all" : "h-full bg-accent-foreground transition-all"} style={{ width: `${(v / max) * 100}%` }} />
    </div>
  );
}

function Index() {
  const [a, setA] = useState("choso");
  const [b, setB] = useState("yuji");
  const [battle, setBattle] = useState<Battle | null>(null);
  const [, tick] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);

  const start = () => {
    const first = CHARS.find((c) => c.id === a), second = CHARS.find((c) => c.id === b);
    if (first && second) setBattle(new Battle(first, second));
  };

  useEffect(() => {
    if (!battle) return;
    let raf = 0, last = performance.now(), ui = 0;
    const loop = (t: number) => {
      const dt = Math.min(50, t - last); last = t;
      battle.step(dt);
      const c = canvas.current?.getContext("2d"); if (c) battle.draw(c);
      if ((ui += dt) > 100) { ui = 0; tick((n) => n + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [battle]);

  return (
    <main className="min-h-screen bg-background px-3 py-5 font-mono text-foreground sm:px-4 sm:py-8">
      <div className="mx-auto max-w-[940px] space-y-4 sm:space-y-5">
        <header className="space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl">⬛ SQUARE JUJUTSU</h1>
            <p className="text-xs text-muted-foreground">simulador de combate · IA estratégica</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 text-sm">
            {[[a, setA], [b, setB]].map(([v, set], i) => (
              <select key={i} aria-label={`Lutador ${i + 1}`} value={v as string} onChange={(e) => (set as (s: string) => void)(e.target.value)} className="w-full min-w-0 truncate border border-border bg-card px-2 py-2">
                {CHARS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ))}
            <Button onClick={start} className="shrink-0">
              {battle ? "Reiniciar" : "Lutar"}
            </Button>
          </div>
        </header>

        {battle && (
          <div className="grid grid-cols-2 gap-3 text-xs sm:gap-6">
            {battle.f.map((f, i) => (
              <div key={i} className="min-w-0 space-y-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={`fighter-swatch fighter-${f.def.id}`} />
                  <span className="truncate">{f.def.name}</span>
                </div>
                <p className="text-muted-foreground">Vida {Math.ceil(f.hp)} · EA {Math.floor(f.en)}</p>
                <Bar v={f.hp} max={f.def.hp} kind="hp" />
                <Bar v={f.en} max={f.def.energy} kind="en" />
                {f.garuda && <>
                  <p className="text-muted-foreground">Garuda · {Math.ceil(f.garuda.hp)} / 500</p>
                  <Bar v={f.garuda.hp} max={500} kind="hp" />
                  <p className="text-muted-foreground">Soco · {f.starForce}</p>
                </>}
              </div>
            ))}
          </div>
        )}

        <div className="relative border border-border bg-card">
          <canvas aria-label="Arena de combate" ref={canvas} width={W} height={H} className="block h-auto w-full" />
          {!battle && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">selecione os lutadores e aperte Lutar</div>}
          {battle?.winner && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70">
              <p className="px-3 text-center text-xl">{battle.winner === "Empate" ? "Empate · destruição mútua" : `${battle.winner} venceu`}</p>
              <Button onClick={start} size="sm">Revanche</Button>
            </div>
          )}
        </div>

        {battle && (
          <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-muted-foreground sm:max-h-none">
            {battle.log.map((l, i) => <li key={i} className={i === 0 ? "text-foreground" : ""}>{l}</li>)}
          </ul>
        )}
      </div>
    </main>
  );
}
