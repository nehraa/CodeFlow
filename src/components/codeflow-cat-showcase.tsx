"use client";

import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type Transition
} from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, Suspense, lazy } from "react";

import styles from "@/components/codeflow-cat-showcase.module.css";

// Lazy load the 3D cat component
const CuteCat3D = lazy(() => import("@/components/CuteCat3D").then(mod => ({ default: mod.CuteCat3D })));

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
            <div style={{ position: "absolute", inset: 0, zIndex: 5 }}>
              <Suspense fallback={<div style={{ width: "100%", height: "100%" }} />}>
                <CuteCat3D sceneId={scene.id} reducedMotion={reducedMotion} />
              </Suspense>
            </div>
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
  // Interactive: Mouse tracking for pupils
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const springConfig = { stiffness: 300, damping: 30 };
  const pupilOffsetX = useSpring(mouseX, springConfig);
  const pupilOffsetY = useSpring(mouseY, springConfig);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current || reducedMotion) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const relativeY = (e.clientY - rect.top) / rect.height;
    mouseX.set((relativeX - 0.5) * 8);
    mouseY.set((relativeY - 0.5) * 8);
  }, [mouseX, mouseY, reducedMotion]);

  // Interactive: Random blinks with variable timing (2-8 seconds)
  const [blinkKey, setBlinkKey] = useState(0);
  useEffect(() => {
    if (reducedMotion) return;
    const scheduleBlink = () => {
      const delay = Math.random() * 6000 + 2000;
      return window.setTimeout(() => {
        setBlinkKey((k) => k + 1);
      }, delay);
    };
    const timer = scheduleBlink();
    return () => window.clearTimeout(timer);
  }, [blinkKey, reducedMotion]);

  const blinkTransition: Transition = reducedMotion
    ? { duration: 0.18 }
    : { duration: 0.1, ease: "easeInOut" };

  // Interactive: Click to boop (nose)
  const [isBooping, setIsBooping] = useState(false);
  const boopScale = useSpring(1, { stiffness: 400, damping: 15 });

  const handleNoseClick = useCallback(() => {
    if (reducedMotion || isBooping) return;
    setIsBooping(true);
    boopScale.set(1.2);
    setTimeout(() => boopScale.set(1), 150);
    setTimeout(() => setIsBooping(false), 300);
  }, [reducedMotion, isBooping, boopScale]);

  // Interactive: Space to jump
  const [isJumping, setIsJumping] = useState(false);
  const jumpY = useSpring(0, { stiffness: 200, damping: 15 });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only trigger jump if not inside an input/textarea and not already jumping
    if (
      e.code === "Space" &&
      !reducedMotion &&
      !isJumping &&
      !(e.target instanceof HTMLInputElement) &&
      !(e.target instanceof HTMLTextAreaElement)
    ) {
      e.preventDefault();
      e.stopPropagation();
      setIsJumping(true);
      jumpY.set(-30);
      setTimeout(() => jumpY.set(0), 150);
      setTimeout(() => setIsJumping(false), 300);
    }
  }, [reducedMotion, isJumping, jumpY]);

  useEffect(() => {
    if (reducedMotion) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, reducedMotion]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reducedMotion) return;
    container.addEventListener("mousemove", handleMouseMove);
    return () => container.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove, reducedMotion]);

  const bodyTransition = loopTransition(reducedMotion, 2.8);
  const tailTransition = loopTransition(reducedMotion, 1.7);
  const headTransition = loopTransition(reducedMotion, scene.id === "implementation" ? 1.2 : 2.4);
  const pawTransition = loopTransition(reducedMotion, scene.id === "implementation" ? 0.74 : 1.5, 0.18);

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

  // Cute Pixar-style cat - rounded body, big head, chibi proportions
  const catBodyPath = "M 195 195 C 185 175 195 155 225 150 C 275 145 315 160 325 185 C 335 210 320 235 285 245 C 250 255 205 250 195 225 C 190 215 190 205 195 195 Z";
  const catBellyPath = "M 220 185 C 240 180 270 188 278 205 C 285 222 275 238 255 242 C 235 246 215 238 210 220 C 208 205 215 192 220 185 Z";
  const catHeadPath = "M 175 105 C 155 115 148 145 155 175 C 162 205 195 220 235 218 C 275 216 310 195 320 160 C 330 125 315 95 285 85 C 255 75 225 80 205 88 C 185 95 185 95 175 105 Z";

  // Cute fluffy tail
  const catTailPath = "M 310 210 C 340 200 370 180 385 150 C 395 125 390 100 375 85 C 365 75 355 80 350 95 C 345 115 350 140 340 165 C 335 178 325 195 310 210 Z";

  // Round cute ears like the reference image
  const leftEarOuter = "M 170 95 C 160 75 155 55 165 40 C 175 28 195 32 205 48 C 212 60 210 78 200 92 C 190 100 178 102 170 95 Z";
  const leftEarInner = "M 178 58 C 185 48 192 45 195 55 C 198 68 192 82 185 88 C 180 92 175 72 178 58 Z";
  const rightEarOuter = "M 270 92 C 285 68 300 45 320 42 C 335 40 342 58 338 78 C 334 98 318 115 298 120 C 285 124 275 118 270 112 C 265 105 268 98 270 92 Z";
  const rightEarInner = "M 315 55 C 322 48 328 48 330 58 C 332 70 325 88 315 95 C 308 100 308 68 315 55 Z";

  // Cute stubby legs
  const backLegLeft = "M 210 220 C 208 235 208 250 215 258 C 222 265 235 265 242 258 C 248 250 246 232 244 218 C 242 208 235 202 228 204 C 218 206 212 212 210 220 Z";
  const backLegRight = "M 305 222 C 308 238 310 252 305 260 C 300 266 288 266 282 260 C 275 252 278 235 280 220 C 282 210 290 205 298 208 C 304 210 305 216 305 222 Z";
  const frontLegLeft = "M 188 188 C 185 208 182 228 188 242 C 192 250 202 250 208 244 C 215 236 215 218 212 195 C 210 182 200 176 192 178 C 186 180 186 182 188 188 Z";

  // Cute small muzzle and tiny nose
  const muzzlePath = "M 215 158 C 225 152 248 154 255 162 C 262 170 252 182 238 185 C 224 188 210 180 212 168 C 214 162 214 160 215 158 Z";
  const nosePath = "M 228 165 C 232 162 238 162 242 165 C 246 168 245 174 242 178 C 238 182 232 182 228 178 C 224 174 224 168 228 165 Z";
  const mouthLeft = "M 235 180 Q 230 188 222 190";
  const mouthRight = "M 237 180 Q 244 188 252 190";

  // Shorter, cuter whiskers
  const whiskerL1 = "M 205 165 Q 185 162 172 158";
  const whiskerL2 = "M 208 172 Q 188 174 176 180";
  const whiskerL3 = "M 206 178 Q 188 185 178 192";
  const whiskerR1 = "M 265 165 Q 285 162 298 158";
  const whiskerR2 = "M 262 172 Q 282 174 294 180";
  const whiskerR3 = "M 264 178 Q 282 185 292 192";

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", cursor: reducedMotion ? "default" : "pointer" }}>
      <m.svg
        aria-label={`${scene.title} mascot`}
        className={styles.cat}
        role="img"
        viewBox="0 0 420 300"
        style={{ y: isJumping ? jumpY : 0 }}
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
          cx="260"
          cy="250"
          rx="85"
          ry="16"
          transition={bodyTransition}
        />

        <m.g
          animate={reducedMotion ? { x: 0, y: 0, rotate: 0 } : bodyAnimation}
          className={styles.catFrame}
          transition={bodyTransition}
        >
          {/* Tail - animated with organic curves */}
          <m.path
            animate={reducedMotion ? { rotate: 0 } : tailAnimation}
            className={styles.tail}
            d={catTailPath}
            style={{ transformOrigin: "326px 206px" }}
            transition={tailTransition}
          />

          {/* Body with organic curves */}
          <path className={styles.body} d={catBodyPath} />

          {/* Belly patch */}
          <path className={styles.belly} d={catBellyPath} />

          {/* Back legs */}
          <path className={styles.leg} d={backLegLeft} />
          <path className={styles.leg} d={backLegRight} />

          {/* Back paws */}
          <ellipse className={styles.paw} cx="228" cy="258" rx="16" ry="9" />
          <ellipse className={styles.paw} cx="294" cy="260" rx="16" ry="9" />

          {/* Head group with animation */}
          <m.g
            animate={reducedMotion ? { x: 0, y: 0, rotate: 0 } : headAnimation}
            transition={headTransition}
          >
            {/* Ears */}
            <path className={styles.ear} d={leftEarOuter} />
            <path className={styles.ear} d={rightEarOuter} />
            <path className={styles.earInner} d={leftEarInner} />
            <path className={styles.earInner} d={rightEarInner} />

            {/* Head */}
            <path className={styles.head} d={catHeadPath} />

            {/* Muzzle */}
            <path className={styles.muzzle} d={muzzlePath} />

            {/* Cheeks - repositioned for new head shape */}
            <ellipse className={styles.cheek} cx="185" cy="155" rx="14" ry="12" />
            <ellipse className={styles.cheek} cx="290" cy="153" rx="14" ry="12" />

            {/* Eyes with blinking animation - bigger cute eyes */}
            <m.ellipse
              key={`eye-l-${blinkKey}`}
              animate={reducedMotion ? { scaleY: 1 } : { scaleY: [1, 1, 0.12, 1, 1] }}
              className={styles.eye}
              cx="200"
              cy="135"
              rx="16"
              ry="18"
              style={{ transformOrigin: "200px 135px" }}
              transition={blinkTransition}
            />
            <m.ellipse
              key={`eye-r-${blinkKey}`}
              animate={reducedMotion ? { scaleY: 1 } : { scaleY: [1, 1, 0.12, 1, 1] }}
              className={styles.eye}
              cx="262"
              cy="133"
              rx="16"
              ry="18"
              style={{ transformOrigin: "262px 133px" }}
              transition={blinkTransition}
            />

            {/* Pupils with mouse tracking - bigger for cuteness */}
            <m.ellipse
              animate={reducedMotion ? { x: 0, y: 0 } : pupilAnimation}
              className={styles.pupil}
              cx="200"
              cy="137"
              rx="6"
              ry="8"
              style={{
                x: reducedMotion ? 0 : pupilOffsetX,
                y: reducedMotion ? 0 : pupilOffsetY,
                transformOrigin: "200px 137px"
              }}
              transition={loopTransition(reducedMotion, 3.2)}
            />
            <m.ellipse
              animate={reducedMotion ? { x: 0, y: 0 } : pupilAnimation}
              className={styles.pupil}
              cx="262"
              cy="135"
              rx="6"
              ry="8"
              style={{
                x: reducedMotion ? 0 : pupilOffsetX,
                y: reducedMotion ? 0 : pupilOffsetY,
                transformOrigin: "262px 135px"
              }}
              transition={loopTransition(reducedMotion, 3.2, 0.12)}
            />

            {/* Eye glints - bigger for cuteness */}
            <circle className={styles.eyeGlint} cx="204" cy="130" r="3.5" />
            <circle className={styles.eyeGlint} cx="266" cy="128" r="3.5" />

            {/* Nose with boop interaction - repositioned */}
            <m.path
              animate={reducedMotion ? { scale: 1 } : { scale: isBooping ? 1.2 : 1 }}
              className={styles.nose}
              d={nosePath}
              onClick={handleNoseClick}
              style={{ cursor: reducedMotion ? "default" : "pointer", transformOrigin: "235px 168px" }}
              transition={{ duration: 0.15 }}
            />

            {/* Mouth */}
            <path className={styles.mouth} d={mouthLeft} />
            <path className={styles.mouth} d={mouthRight} />

            {/* Whiskers with organic curves */}
            <path className={styles.whisker} d={whiskerL1} />
            <path className={styles.whisker} d={whiskerL2} />
            <path className={styles.whisker} d={whiskerL3} />
            <path className={styles.whisker} d={whiskerR1} />
            <path className={styles.whisker} d={whiskerR2} />
            <path className={styles.whisker} d={whiskerR3} />

            <SceneAccessory reducedMotion={reducedMotion} sceneId={scene.id} />
          </m.g>

          {/* Front leg */}
          <m.path
            animate={reducedMotion ? { x: 0, y: 0 } : pawAnimation}
            className={styles.frontPaw}
            d={frontLegLeft}
            transition={pawTransition}
          />

          {/* Front paw */}
          <ellipse className={styles.paw} cx="188" cy="242" rx="14" ry="8" />
        </m.g>
      </m.svg>
    </div>
  );
}

function SceneAccessory({ sceneId, reducedMotion }: { sceneId: SceneId; reducedMotion: boolean }) {
  if (sceneId === "spec") {
    return <rect className={styles.visor} height="22" rx="11" width="66" x="193" y="112" />;
  }

  if (sceneId === "ghost") {
    return (
      <m.circle
        animate={reducedMotion ? { scale: 1, opacity: 0.9 } : { scale: [0.92, 1.1, 0.92], opacity: [0.5, 1, 0.5] }}
        className={styles.focusRing}
        cx="226"
        cy="130"
        r="48"
        transition={loopTransition(reducedMotion, 1.8)}
      />
    );
  }

  if (sceneId === "digitalTwin") {
    return (
      <>
        <circle className={styles.glasses} cx="196" cy="128" r="20" />
        <circle className={styles.glasses} cx="256" cy="126" r="20" />
        <line className={styles.glassesBridge} x1="216" x2="236" y1="128" y2="128" />
      </>
    );
  }

  if (sceneId === "heatmap") {
    return (
      <>
        <m.g animate={reducedMotion ? { rotate: 0 } : { rotate: [0, 18, 0] }} style={{ transformOrigin: "324px 186px" }} transition={loopTransition(reducedMotion, 0.9)}>
          <rect className={styles.fanSheet} height="50" rx="12" width="36" x="306" y="160" />
          <line className={styles.fanLine} x1="310" x2="338" y1="172" y2="172" />
          <line className={styles.fanLine} x1="310" x2="338" y1="182" y2="182" />
          <line className={styles.fanLine} x1="310" x2="334" y1="192" y2="192" />
        </m.g>
        <path className={styles.tongue} d="M 222 160 Q 228 172 234 160" />
      </>
    );
  }

  if (sceneId === "error") {
    return (
      <m.path
        animate={reducedMotion ? { opacity: 0.95 } : { opacity: [0.35, 1, 0.35] }}
        className={styles.alertBolt}
        d="M 224 76 L 210 106 H 226 L 214 134 L 244 100 H 228 Z"
        transition={loopTransition(reducedMotion, 1.2)}
      />
    );
  }

  if (sceneId === "polish") {
    return (
      <m.path
        animate={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: [0.25, 1, 0.25], scale: [0.82, 1.18, 0.82] }}
        className={styles.polishStar}
        d="M 284 88 L 292 70 L 298 88 L 316 96 L 298 104 L 292 122 L 284 104 L 266 96 Z"
        style={{ transformOrigin: "292px 96px" }}
        transition={loopTransition(reducedMotion, 1.4)}
      />
    );
  }

  return null;
}
