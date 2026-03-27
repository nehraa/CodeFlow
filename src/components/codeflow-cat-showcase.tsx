"use client";

import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
  useReducedMotion,
  type Transition
} from "framer-motion";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import styles from "@/components/codeflow-cat-showcase.module.css";

type SceneId =
  | "spec"
  | "ghost"
  | "implementation"
  | "heal"
  | "digitalTwin"
  | "vcr"
  | "heatmap"
  | "genetic"
  | "error"
  | "polish";

type ShowcaseProps = {
  activeScene?: SceneId;
  graphPhase?: "spec" | "implementation" | "integration" | null;
  ghostCount: number;
  unhealthy: boolean;
  verifiedAll: boolean;
};

type SceneDefinition = {
  id: SceneId;
  title: string;
  kicker: string;
  summary: string;
  accent: string;
  status: string;
  cue: string;
  telemetry: Array<{ label: string; value: string }>;
};

const SCENES: SceneDefinition[] = [
  {
    id: "spec",
    title: "Blueprint Sweep",
    kicker: "Phase 1 · Blueprinting",
    summary: "The cat maps nodes onto a planning board while the graph settles into clean lanes.",
    accent: "#67e8f9",
    status: "Spec choreography online",
    cue: "Scope stays readable before implementation begins.",
    telemetry: [
      { label: "Board", value: "Snapping nodes" },
      { label: "Mode", value: "Spec-first" },
      { label: "Signal", value: "Zero drift" }
    ]
  },
  {
    id: "ghost",
    title: "Ghost Intercept",
    kicker: "Ghost Nodes",
    summary: "A suggested node pulses into view and the cat locks focus before solidifying it.",
    accent: "#a78bfa",
    status: "Suggestions active",
    cue: "Unowned architecture gaps are surfaced before they break delivery.",
    telemetry: [
      { label: "Gap", value: "Unowned edge" },
      { label: "Action", value: "Suggest + review" },
      { label: "Risk", value: "Contained" }
    ]
  },
  {
    id: "implementation",
    title: "Implementation Burst",
    kicker: "Phase 2 · Implementation",
    summary: "The cat drops to the keyboard and pushes the graph from contract to executable code.",
    accent: "#f59e0b",
    status: "Implementation unlocked",
    cue: "Execution only opens once the blueprint is coherent enough to carry code.",
    telemetry: [
      { label: "Phase", value: "2 active" },
      { label: "Output", value: "Drafting code" },
      { label: "Guard", value: "Spec-gated" }
    ]
  },
  {
    id: "heal",
    title: "Heal Sweep",
    kicker: "Auto-Refactoring",
    summary: "Neural links re-route around hot spots while the cat smooths the graph back to health.",
    accent: "#34d399",
    status: "Refactor pathing ready",
    cue: "Repair work is explicit, visual, and tied to structural health.",
    telemetry: [
      { label: "Health", value: "Recovering" },
      { label: "Links", value: "Rewiring" },
      { label: "Mode", value: "Assistive" }
    ]
  },
  {
    id: "digitalTwin",
    title: "Twin Watch",
    kicker: "Digital Twin",
    summary: "Mirrored UI telemetry floats past the cat while production posture stays under watch.",
    accent: "#60a5fa",
    status: "Twin monitor synced",
    cue: "Runtime state belongs in the same workspace as design intent.",
    telemetry: [
      { label: "Mirror", value: "Live trace" },
      { label: "Watch", value: "App posture" },
      { label: "Latency", value: "< 1 loop" }
    ]
  },
  {
    id: "vcr",
    title: "Replay Deck",
    kicker: "VCR Time-Travel",
    summary: "A scrub dial replays graph state frame by frame while the cat tracks the exact transition.",
    accent: "#fb7185",
    status: "Replay loaded",
    cue: "Historical state is inspectable instead of trapped in logs.",
    telemetry: [
      { label: "Frames", value: "Seekable" },
      { label: "Cause", value: "Replayable" },
      { label: "Debug", value: "Time-travel" }
    ]
  },
  {
    id: "heatmap",
    title: "Heat Sweep",
    kicker: "Observability",
    summary: "The stage glows hot, server bars flare, and the cat cools the system while watching hotspots.",
    accent: "#f97316",
    status: "Telemetry hot",
    cue: "Operational pain is visible at the same layer as the node map.",
    telemetry: [
      { label: "Runtime", value: "Hot path" },
      { label: "Signal", value: "Heatmap" },
      { label: "SLO", value: "Watching" }
    ]
  },
  {
    id: "genetic",
    title: "Variant Sprint",
    kicker: "Evolution",
    summary: "Competing architecture variants run in parallel while the cat judges which one survives.",
    accent: "#22c55e",
    status: "Tournament running",
    cue: "Exploration is deliberate instead of ad hoc branching chaos.",
    telemetry: [
      { label: "Variants", value: "3 running" },
      { label: "Selection", value: "Ranked" },
      { label: "Outcome", value: "Best fit" }
    ]
  },
  {
    id: "error",
    title: "Hard Refusal",
    kicker: "Non-Compliant",
    summary: "An angry node trips the alarm and the cat holds the line until the graph is repaired.",
    accent: "#ef4444",
    status: "Violation surfaced",
    cue: "Broken contracts should stop the line clearly and early.",
    telemetry: [
      { label: "State", value: "Blocked" },
      { label: "Node", value: "Non-compliant" },
      { label: "Next", value: "Heal first" }
    ]
  },
  {
    id: "polish",
    title: "Release Polish",
    kicker: "Final Polish",
    summary: "The cat buffs the final surface while clean signal rings confirm the graph is ready to ship.",
    accent: "#facc15",
    status: "Release pass active",
    cue: "The last pass is about confidence, not just decoration.",
    telemetry: [
      { label: "Status", value: "Verified" },
      { label: "Surface", value: "Clean" },
      { label: "Ready", value: "Ship it" }
    ]
  }
];

const AUTO_ROTATE_MS = 5400;

function inferFallbackScene({
  graphPhase,
  ghostCount,
  unhealthy,
  verifiedAll
}: Pick<ShowcaseProps, "graphPhase" | "ghostCount" | "unhealthy" | "verifiedAll">): SceneId {
  if (unhealthy) return "error";
  if (ghostCount > 0) return "ghost";
  if (verifiedAll) return "polish";
  if (graphPhase === "implementation") return "implementation";
  if (graphPhase === "integration") return "vcr";
  return "spec";
}

function sceneIndexFor(id: SceneId) {
  return Math.max(0, SCENES.findIndex((scene) => scene.id === id));
}

function loopTransition(reducedMotion: boolean, duration: number, delay = 0): Transition {
  if (reducedMotion) {
    return { duration: 0.18 };
  }

  return {
    duration,
    delay,
    ease: "easeInOut",
    repeat: Number.POSITIVE_INFINITY,
    repeatType: "mirror" as const
  };
}

function entranceTransition(reducedMotion: boolean): Transition {
  return reducedMotion
    ? { duration: 0.16 }
    : {
        type: "spring" as const,
        stiffness: 180,
        damping: 22,
        mass: 0.8
      };
}

export function CodeflowCatShowcase({
  activeScene,
  graphPhase,
  ghostCount,
  unhealthy,
  verifiedAll
}: ShowcaseProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const fallbackScene = useMemo(
    () => inferFallbackScene({ graphPhase, ghostCount, unhealthy, verifiedAll }),
    [ghostCount, graphPhase, unhealthy, verifiedAll]
  );
  const [sceneIndex, setSceneIndex] = useState(() => sceneIndexFor(fallbackScene));

  useEffect(() => {
    if (reducedMotion || activeScene) {
      return;
    }

    const timer = window.setInterval(() => {
      setSceneIndex((current) => {
        const next = current + 1;
        if (next >= SCENES.length) {
          return sceneIndexFor(fallbackScene);
        }

        return next;
      });
    }, AUTO_ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [activeScene, fallbackScene, reducedMotion]);

  const scene = activeScene
    ? SCENES[sceneIndexFor(activeScene)] ?? SCENES[0]
    : SCENES[sceneIndex] ?? SCENES[sceneIndexFor(fallbackScene)] ?? SCENES[0];
  const stageStyle = { "--scene-accent": scene.accent } as CSSProperties;

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <aside className={styles.mascot} aria-label="CodeFlow Cat animation panel">
          <div className={styles.header}>
            <div className={styles.headerCopy}>
              <p className={styles.kicker}>CodeFlow Cat</p>
              <h2>{scene.title}</h2>
              <p>{scene.summary}</p>
            </div>

            <div className={styles.statusPill}>
              <span className={styles.statusDot} style={{ backgroundColor: scene.accent }} />
              {scene.status}
            </div>
          </div>

          <div className={styles.stage} style={stageStyle}>
            <div className={styles.badge}>{scene.kicker}</div>
            <AnimatePresence initial={false} mode="wait">
              <m.div
                key={scene.id}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={styles.sceneFrame}
                exit={{ opacity: 0, y: reducedMotion ? 0 : -18, scale: 0.98 }}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 18, scale: 0.98 }}
                transition={entranceTransition(reducedMotion)}
              >
                <m.div
                  animate={
                    reducedMotion
                      ? { opacity: 0.72, scale: 1 }
                      : { opacity: [0.58, 0.92, 0.58], scale: [0.96, 1.05, 0.98], rotate: [-3, 5, -3] }
                  }
                  className={styles.stageGlow}
                  transition={loopTransition(reducedMotion, 4.8)}
                />
                <SceneBackdrop reducedMotion={reducedMotion} scene={scene} />
                <SceneTelemetry reducedMotion={reducedMotion} scene={scene} />
                <CatRig reducedMotion={reducedMotion} scene={scene} />
              </m.div>
            </AnimatePresence>
          </div>

          <div className={styles.footer}>
            <div aria-label="Showcase scenes" className={styles.progress} role="tablist">
              {SCENES.map((item, index) => {
                const active = index === sceneIndex;
                return (
                  <button
                    aria-label={`Show ${item.title}`}
                    aria-selected={active}
                    className={`${styles.progressButton}${active ? ` ${styles.progressButtonActive}` : ""}`}
                    disabled={Boolean(activeScene)}
                    key={item.id}
                    onClick={() => setSceneIndex(index)}
                    role="tab"
                    style={{ "--dot-accent": item.accent } as CSSProperties}
                    type="button"
                  >
                    <span className={styles.progressDot} />
                  </button>
                );
              })}
            </div>
            <p className={styles.caption}>{scene.cue}</p>
          </div>
        </aside>
      </MotionConfig>
    </LazyMotion>
  );
}

function SceneTelemetry({ scene, reducedMotion }: { scene: SceneDefinition; reducedMotion: boolean }) {
  return (
    <m.div
      animate="visible"
      className={styles.telemetryDeck}
      initial="hidden"
      variants={{
        hidden: { opacity: 0, x: reducedMotion ? 0 : -10 },
        visible: {
          opacity: 1,
          x: 0,
          transition: { staggerChildren: reducedMotion ? 0 : 0.08, delayChildren: reducedMotion ? 0 : 0.06 }
        }
      }}
    >
      {scene.telemetry.map((item, index) => (
        <m.div
          className={styles.telemetryCard}
          key={`${scene.id}:${item.label}`}
          layout
          transition={entranceTransition(reducedMotion)}
          variants={{
            hidden: { opacity: 0, y: reducedMotion ? 0 : 10 },
            visible: { opacity: 1, y: 0 }
          }}
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <m.div
            animate={reducedMotion ? { scaleX: 1, opacity: 0.75 } : { scaleX: [0.58, 1, 0.7], opacity: [0.45, 1, 0.55] }}
            className={styles.telemetryBar}
            style={{ transformOrigin: "left center" }}
            transition={loopTransition(reducedMotion, 2.2 + index * 0.28, index * 0.08)}
          />
        </m.div>
      ))}
    </m.div>
  );
}

function SceneBackdrop({ scene, reducedMotion }: { scene: SceneDefinition; reducedMotion: boolean }) {
  const drift = loopTransition(reducedMotion, 3.4);
  const fastPulse = loopTransition(reducedMotion, 1.9);
  const reel: Transition = reducedMotion
    ? { duration: 0.18 }
    : {
        duration: 1.6,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY
      };

  return (
    <m.svg aria-hidden="true" className={styles.backdrop} viewBox="0 0 420 300">
      <rect className={styles.backdropShell} height="212" rx="28" width="174" x="188" y="46" />
      <rect className={styles.backdropPanel} height="54" rx="16" width="118" x="218" y="74" />
      <rect className={styles.backdropPanel} height="54" rx="16" width="118" x="218" y="142" />

      {scene.id === "spec" ? (
        <>
          <m.path
            animate={reducedMotion ? { pathLength: 1 } : { pathLength: [0.45, 1, 0.7] }}
            className={styles.backdropLine}
            d="M 82 84 C 132 84 146 116 206 116"
            transition={drift}
          />
          <m.path
            animate={reducedMotion ? { pathLength: 1 } : { pathLength: [0.35, 1, 0.58] }}
            className={styles.backdropLine}
            d="M 120 170 C 158 170 172 142 218 142"
            transition={loopTransition(reducedMotion, 2.8, 0.16)}
          />
          <m.rect animate={reducedMotion ? { y: 0 } : { y: [-3, 5, -3] }} className={styles.backdropNode} height="44" rx="14" width="90" x="36" y="62" transition={drift} />
          <m.rect animate={reducedMotion ? { y: 0 } : { y: [4, -4, 4] }} className={styles.backdropNode} height="44" rx="14" width="96" x="78" y="148" transition={loopTransition(reducedMotion, 3, 0.12)} />
          <m.circle animate={reducedMotion ? { scale: 1 } : { scale: [0.88, 1.18, 0.88] }} className={styles.backdropAccent} cx="148" cy="92" r="10" transition={fastPulse} />
        </>
      ) : null}

      {scene.id === "ghost" ? (
        <>
          <m.rect
            animate={reducedMotion ? { opacity: 0.9 } : { opacity: [0.3, 1, 0.3], y: [-6, 6, -6] }}
            className={styles.backdropGhost}
            height="94"
            rx="24"
            width="126"
            x="48"
            y="94"
            transition={loopTransition(reducedMotion, 2.4)}
          />
          <m.circle animate={reducedMotion ? { scale: 1 } : { scale: [0.74, 1.22], opacity: [0.8, 0] }} className={styles.backdropRing} cx="112" cy="142" r="32" transition={loopTransition(reducedMotion, 2.2)} />
          <m.circle animate={reducedMotion ? { scale: 1 } : { scale: [0.92, 1.38], opacity: [0.7, 0] }} className={styles.backdropRing} cx="112" cy="142" r="52" transition={loopTransition(reducedMotion, 2.2, 0.42)} />
        </>
      ) : null}

      {scene.id === "implementation" ? (
        <>
          <rect className={styles.keyboardDeck} height="44" rx="16" width="170" x="40" y="210" />
          <m.path animate={reducedMotion ? { opacity: 1 } : { opacity: [0.2, 1, 0.2], y: [-4, 6, -4] }} className={styles.spark} d="M 108 156 L 118 138 L 128 156 L 116 154 L 124 170 Z" transition={fastPulse} />
          <m.path animate={reducedMotion ? { opacity: 1 } : { opacity: [0.2, 1, 0.2], y: [6, -5, 6] }} className={styles.spark} d="M 146 138 L 154 124 L 162 138 L 153 136 L 158 150 Z" transition={loopTransition(reducedMotion, 1.6, 0.24)} />
          <m.path animate={reducedMotion ? { opacity: 1 } : { opacity: [0.2, 1, 0.2], y: [-3, 7, -3] }} className={styles.spark} d="M 70 142 L 78 126 L 88 142 L 78 140 L 84 154 Z" transition={loopTransition(reducedMotion, 1.8, 0.36)} />
        </>
      ) : null}

      {scene.id === "heal" ? (
        <>
          <m.path animate={reducedMotion ? { pathLength: 1 } : { pathLength: [0.25, 1, 0.6] }} className={styles.backdropLine} d="M 62 88 C 106 110 126 124 172 150" transition={drift} />
          <m.path animate={reducedMotion ? { pathLength: 1 } : { pathLength: [0.3, 1, 0.7] }} className={styles.backdropLine} d="M 58 188 C 104 170 134 152 180 116" transition={loopTransition(reducedMotion, 2.8, 0.16)} />
          <m.circle animate={reducedMotion ? { scale: 1 } : { scale: [0.88, 1.16, 0.88] }} className={styles.backdropAccent} cx="56" cy="84" r="12" transition={fastPulse} />
          <m.circle animate={reducedMotion ? { scale: 1 } : { scale: [0.88, 1.2, 0.88] }} className={styles.backdropAccent} cx="58" cy="188" r="12" transition={loopTransition(reducedMotion, 2.1, 0.24)} />
          <m.circle animate={reducedMotion ? { scale: 1 } : { scale: [0.92, 1.14, 0.92] }} className={styles.backdropAccentSoft} cx="174" cy="150" r="10" transition={loopTransition(reducedMotion, 2.2, 0.1)} />
        </>
      ) : null}

      {scene.id === "digitalTwin" ? (
        <>
          <rect className={styles.previewFrame} height="118" rx="22" width="132" x="42" y="76" />
          <rect className={styles.previewLine} height="10" rx="5" width="78" x="68" y="108" />
          <rect className={styles.previewLine} height="10" rx="5" width="56" x="68" y="132" />
          <m.circle animate={reducedMotion ? { scale: 1 } : { scale: [0.9, 1.08, 0.9] }} className={styles.lens} cx="108" cy="166" r="28" transition={drift} />
          <m.circle animate={reducedMotion ? { scale: 1 } : { scale: [0.76, 1.18], opacity: [0.78, 0] }} className={styles.backdropRing} cx="108" cy="166" r="42" transition={loopTransition(reducedMotion, 2)} />
        </>
      ) : null}

      {scene.id === "vcr" ? (
        <>
          <rect className={styles.vcrDeck} height="102" rx="26" width="142" x="42" y="90" />
          <m.circle animate={reducedMotion ? { rotate: 0 } : { rotate: 360 }} className={styles.reel} cx="88" cy="141" r="24" transition={reel} />
          <m.circle animate={reducedMotion ? { rotate: 0 } : { rotate: -360 }} className={styles.reel} cx="138" cy="141" r="24" transition={reel} />
          <m.rect animate={reducedMotion ? { x: 0 } : { x: [0, 34, 0] }} className={styles.scrubHead} height="12" rx="6" width="48" x="70" y="205" transition={loopTransition(reducedMotion, 2.4)} />
          <line className={styles.scrubTrack} x1="58" x2="170" y1="211" y2="211" />
        </>
      ) : null}

      {scene.id === "heatmap" ? (
        <>
          <rect className={styles.serverFrame} height="118" rx="20" width="130" x="42" y="82" />
          <rect className={styles.serverBar} height="14" rx="7" width="84" x="66" y="110" />
          <rect className={styles.serverBar} height="14" rx="7" width="72" x="66" y="138" />
          <rect className={styles.serverBar} height="14" rx="7" width="88" x="66" y="166" />
          <m.path animate={reducedMotion ? { y: 0, opacity: 0.75 } : { y: [0, -18, 0], opacity: [0.45, 0.95, 0.45] }} className={styles.heatWave} d="M 70 88 C 78 72 92 72 100 88" transition={fastPulse} />
          <m.path animate={reducedMotion ? { y: 0, opacity: 0.75 } : { y: [0, -16, 0], opacity: [0.4, 0.9, 0.4] }} className={styles.heatWave} d="M 108 84 C 116 66 130 66 138 84" transition={loopTransition(reducedMotion, 1.6, 0.24)} />
        </>
      ) : null}

      {scene.id === "genetic" ? (
        <>
          {[44, 94, 144].map((x, index) => (
            <m.g animate={reducedMotion ? { y: 0 } : { y: [0, -10, 0] }} key={x} transition={loopTransition(reducedMotion, 2.6 + index * 0.2, index * 0.18)}>
              <rect className={styles.cloneFrame} height="92" rx="18" width="40" x={x} y="112" />
              <rect className={styles.cloneBar} height="8" rx="4" width="24" x={x + 8} y="136" />
              <rect className={styles.cloneBar} height="8" rx="4" width="18" x={x + 8} y="156" />
              <rect className={styles.cloneBar} height="8" rx="4" width="28" x={x + 8} y="176" />
            </m.g>
          ))}
        </>
      ) : null}

      {scene.id === "error" ? (
        <>
          <m.rect animate={reducedMotion ? { rotate: 0 } : { rotate: [-4, 4, -4] }} className={styles.errorNode} height="96" rx="22" width="126" x="46" y="94" transition={loopTransition(reducedMotion, 0.9)} />
          <m.path animate={reducedMotion ? { opacity: 1 } : { opacity: [0.35, 1, 0.35] }} className={styles.errorZap} d="M 108 84 L 92 126 H 110 L 98 164 L 136 114 H 116 Z" transition={fastPulse} />
        </>
      ) : null}

      {scene.id === "polish" ? (
        <>
          <rect className={styles.previewFrame} height="126" rx="24" width="142" x="40" y="76" />
          <rect className={styles.previewLine} height="12" rx="6" width="88" x="66" y="108" />
          <rect className={styles.previewLine} height="12" rx="6" width="72" x="66" y="134" />
          <rect className={styles.previewLine} height="12" rx="6" width="96" x="66" y="160" />
          <m.path animate={reducedMotion ? { opacity: 1 } : { opacity: [0.2, 1, 0.2], scale: [0.8, 1.18, 0.8] }} className={styles.spark} d="M 152 84 L 158 68 L 164 84 L 180 90 L 164 96 L 158 112 L 152 96 L 136 90 Z" transition={fastPulse} />
        </>
      ) : null}
    </m.svg>
  );
}

function CatRig({ scene, reducedMotion }: { scene: SceneDefinition; reducedMotion: boolean }) {
  const bodyTransition = loopTransition(reducedMotion, 2.8);
  const tailTransition = loopTransition(reducedMotion, 1.7);
  const headTransition = loopTransition(reducedMotion, scene.id === "implementation" ? 1.2 : 2.4);
  const pawTransition = loopTransition(reducedMotion, scene.id === "implementation" ? 0.74 : 1.5, 0.18);
  const blinkTransition: Transition = reducedMotion
    ? { duration: 0.18 }
    : {
        duration: 5.2,
        ease: "easeInOut",
        repeat: Number.POSITIVE_INFINITY
      };

  const bodyAnimation =
    scene.id === "error"
      ? { y: [0, -4, 0], scaleX: [1, 1.04, 1] }
      : scene.id === "implementation"
        ? { y: [0, -8, 0], rotate: [0, -3, 0] }
        : scene.id === "heatmap"
          ? { y: [0, -3, 0], rotate: [0, 1.6, 0] }
          : { y: [0, -5, 0], rotate: [0, 1.4, 0] };

  const headAnimation =
    scene.id === "implementation"
      ? { x: [0, -7, 0], y: [0, 6, 0], rotate: [0, -10, 0] }
      : scene.id === "ghost"
        ? { x: [0, -8, 5, 0], y: [0, 2, -2, 0], rotate: [0, -4, 3, 0] }
        : scene.id === "digitalTwin"
          ? { rotate: [-4, 4, -4] }
          : scene.id === "heatmap"
            ? { y: [0, 6, 0] }
            : { rotate: [0, 3, 0], y: [0, -3, 0] };

  const tailAnimation =
    scene.id === "error"
      ? { rotate: [16, -22, 16] }
      : scene.id === "implementation"
        ? { rotate: [10, -18, 10] }
        : { rotate: [8, -12, 8] };

  const pawAnimation =
    scene.id === "implementation"
      ? { y: [0, 12, 0] }
      : scene.id === "polish"
        ? { x: [0, 18, 0], y: [0, -10, 0] }
        : scene.id === "vcr"
          ? { x: [0, 9, 0], y: [0, 8, 0] }
          : { y: [0, 6, 0] };

  const pupilAnimation =
    scene.id === "ghost"
      ? { x: [-2, 4, -2], y: [0, -1, 0] }
      : scene.id === "digitalTwin"
        ? { x: [-2, 2, -2] }
        : { x: [-1, 2, -1], y: [0, 1, 0] };

  return (
    <m.svg
      aria-label={`${scene.title} mascot`}
      className={styles.cat}
      role="img"
      viewBox="0 0 420 300"
    >
      <defs>
        <linearGradient id="catBodyGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#9aa4ba" />
          <stop offset="54%" stopColor="#6b748d" />
          <stop offset="100%" stopColor="#3f475f" />
        </linearGradient>
        <linearGradient id="catCreamGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f6efe4" />
          <stop offset="100%" stopColor="#d3c6b5" />
        </linearGradient>
      </defs>

      <m.ellipse
        animate={reducedMotion ? { scaleX: 1, opacity: 0.26 } : { scaleX: [1, 0.92, 1], opacity: [0.26, 0.18, 0.26] }}
        className={styles.shadow}
        cx="272"
        cy="244"
        rx="94"
        ry="18"
        transition={bodyTransition}
      />

      <m.g
        animate={reducedMotion ? { x: 0, y: 0, rotate: 0 } : bodyAnimation}
        className={styles.catFrame}
        transition={bodyTransition}
      >
        <m.path
          animate={reducedMotion ? { rotate: 0 } : tailAnimation}
          className={styles.tail}
          d="M 308 182 C 356 144 366 232 318 230"
          style={{ transformOrigin: "308px 182px" }}
          transition={tailTransition}
        />
        <ellipse className={styles.body} cx="262" cy="184" rx="76" ry="56" />
        <ellipse className={styles.belly} cx="246" cy="196" rx="38" ry="32" />
        <rect className={styles.leg} height="66" rx="20" width="26" x="208" y="184" />
        <rect className={styles.leg} height="66" rx="20" width="26" x="236" y="188" />
        <rect className={styles.leg} height="68" rx="20" width="26" x="284" y="190" />
        <rect className={styles.paw} height="18" rx="9" width="30" x="206" y="236" />
        <rect className={styles.paw} height="18" rx="9" width="30" x="234" y="240" />
        <rect className={styles.paw} height="18" rx="9" width="30" x="282" y="242" />

        <m.g
          animate={reducedMotion ? { x: 0, y: 0, rotate: 0 } : headAnimation}
          transition={headTransition}
        >
          <path className={styles.ear} d="M 194 96 L 176 54 L 214 76 Z" />
          <path className={styles.ear} d="M 264 96 L 286 56 L 244 76 Z" />
          <path className={styles.earInner} d="M 194 88 L 186 66 L 206 78 Z" />
          <path className={styles.earInner} d="M 264 88 L 272 66 L 252 78 Z" />
          <circle className={styles.head} cx="230" cy="118" r="56" />
          <ellipse className={styles.muzzle} cx="230" cy="142" rx="32" ry="20" />
          <ellipse className={styles.cheek} cx="202" cy="138" rx="10" ry="8" />
          <ellipse className={styles.cheek} cx="258" cy="138" rx="10" ry="8" />
          <m.ellipse
            animate={reducedMotion ? { scaleY: 1 } : { scaleY: [1, 1, 0.12, 1, 1] }}
            className={styles.eye}
            cx="210"
            cy="116"
            rx="12"
            ry="14"
            style={{ transformOrigin: "210px 116px" }}
            transition={blinkTransition}
          />
          <m.ellipse
            animate={reducedMotion ? { scaleY: 1 } : { scaleY: [1, 1, 0.12, 1, 1] }}
            className={styles.eye}
            cx="248"
            cy="116"
            rx="12"
            ry="14"
            style={{ transformOrigin: "248px 116px" }}
            transition={blinkTransition}
          />
          <m.circle
            animate={reducedMotion ? { x: 0, y: 0 } : pupilAnimation}
            className={styles.pupil}
            cx="210"
            cy="118"
            r="5"
            transition={loopTransition(reducedMotion, 3.2)}
          />
          <m.circle
            animate={reducedMotion ? { x: 0, y: 0 } : pupilAnimation}
            className={styles.pupil}
            cx="248"
            cy="118"
            r="5"
            transition={loopTransition(reducedMotion, 3.2, 0.12)}
          />
          <circle className={styles.eyeGlint} cx="213" cy="114" r="2" />
          <circle className={styles.eyeGlint} cx="251" cy="114" r="2" />
          <path className={styles.nose} d="M 224 132 L 230 138 L 236 132 Z" />
          <path className={styles.mouth} d="M 230 138 Q 224 146 216 146" />
          <path className={styles.mouth} d="M 230 138 Q 236 146 244 146" />
          <path className={styles.whisker} d="M 198 142 L 168 136" />
          <path className={styles.whisker} d="M 198 148 L 166 150" />
          <path className={styles.whisker} d="M 262 142 L 292 136" />
          <path className={styles.whisker} d="M 262 148 L 294 150" />
          <SceneAccessory reducedMotion={reducedMotion} sceneId={scene.id} />
        </m.g>

        <m.rect
          animate={reducedMotion ? { x: 0, y: 0 } : pawAnimation}
          className={styles.frontPaw}
          height="74"
          rx="20"
          width="30"
          x="186"
          y="182"
          transition={pawTransition}
        />
        <rect className={styles.paw} height="18" rx="9" width="34" x="184" y="238" />
      </m.g>
    </m.svg>
  );
}

function SceneAccessory({ sceneId, reducedMotion }: { sceneId: SceneId; reducedMotion: boolean }) {
  if (sceneId === "spec") {
    return <rect className={styles.visor} height="22" rx="11" width="66" x="197" y="102" />;
  }

  if (sceneId === "ghost") {
    return (
      <m.circle
        animate={reducedMotion ? { scale: 1, opacity: 0.9 } : { scale: [0.92, 1.1, 0.92], opacity: [0.5, 1, 0.5] }}
        className={styles.focusRing}
        cx="230"
        cy="118"
        r="44"
        transition={loopTransition(reducedMotion, 1.8)}
      />
    );
  }

  if (sceneId === "digitalTwin") {
    return (
      <>
        <circle className={styles.glasses} cx="210" cy="116" r="18" />
        <circle className={styles.glasses} cx="248" cy="116" r="18" />
        <line className={styles.glassesBridge} x1="228" x2="230" y1="116" y2="116" />
      </>
    );
  }

  if (sceneId === "heatmap") {
    return (
      <>
        <m.g animate={reducedMotion ? { rotate: 0 } : { rotate: [0, 18, 0] }} style={{ transformOrigin: "306px 174px" }} transition={loopTransition(reducedMotion, 0.9)}>
          <rect className={styles.fanSheet} height="46" rx="12" width="34" x="288" y="150" />
          <line className={styles.fanLine} x1="294" x2="314" y1="160" y2="160" />
          <line className={styles.fanLine} x1="294" x2="314" y1="170" y2="170" />
          <line className={styles.fanLine} x1="294" x2="310" y1="180" y2="180" />
        </m.g>
        <path className={styles.tongue} d="M 226 150 Q 230 158 234 150" />
      </>
    );
  }

  if (sceneId === "error") {
    return (
      <m.path
        animate={reducedMotion ? { opacity: 0.95 } : { opacity: [0.35, 1, 0.35] }}
        className={styles.alertBolt}
        d="M 228 66 L 216 92 H 230 L 220 114 L 246 84 H 234 Z"
        transition={loopTransition(reducedMotion, 1.2)}
      />
    );
  }

  if (sceneId === "polish") {
    return (
      <m.path
        animate={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: [0.25, 1, 0.25], scale: [0.82, 1.18, 0.82] }}
        className={styles.polishStar}
        d="M 286 78 L 292 64 L 298 78 L 312 84 L 298 90 L 292 104 L 286 90 L 272 84 Z"
        style={{ transformOrigin: "292px 84px" }}
        transition={loopTransition(reducedMotion, 1.4)}
      />
    );
  }

  return null;
}
