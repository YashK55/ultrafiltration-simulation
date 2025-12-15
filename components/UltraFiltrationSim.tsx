"use client";

import { useEffect, useRef, useState } from "react";
import {
  VESSEL_WIDTH,
  VESSEL_HEIGHT,
  VESSEL_X,
  VESSEL_Y,
  VESSEL_W,
  VESSEL_H,
  MEMBRANE_X,
} from "@/lib/constants";

import { StatCard } from "./StatCard";
import { ControllerSlider } from "./ControllerSlider";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

type ParticleRegion = "feed" | "retentate" | "permeate";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  region: ParticleRegion;
}

function createParticles(
  concentrationValue: number,
  meanSize: number
): Particle[] {
  // Map conceptual feed concentration (100–1500) to a reasonable number of particles
  const normalized = clamp((concentrationValue - 100) / (1500 - 100), 0, 1);
  const particleNumber = Math.round(20 + normalized * 130); // 20–150 particles

  const particles: Particle[] = [];
  for (let i = 0; i < particleNumber; i++) {
    const sizeSpread = meanSize * 0.6;
    let size = meanSize + (Math.random() - 0.5) * sizeSpread;
    size = clamp(size, 4, 20); // pixel radius

    particles.push({
      id: i,
      x: VESSEL_X + 20 + Math.random() * (MEMBRANE_X - VESSEL_X - 80),
      y: VESSEL_Y + 30 + Math.random() * (VESSEL_H - 80),
      size,
      vx: 0,
      vy: 0,
      region: "feed",
    });
  }
  return particles;
}

export default function UltraFiltrationSim() {
  const [pressure, setPressure] = useState(40); // 0–100
  const [poreSize, setPoreSize] = useState(10); // visual + conceptual cut-off
  const [feedConcentration, setFeedConcentration] = useState(300); // 100–1500 (conceptual)
  const [meanSoluteSize, setMeanSoluteSize] = useState(10); // nm (sim.)
  const [stirRate, setStirRate] = useState(40);
  const [isRunning, setIsRunning] = useState(true);
  const [particles, setParticles] = useState(() => createParticles(300, 10));
  const [time, setTime] = useState(0);
  const [membraneHealth, setMembraneHealth] = useState(100); // 100 → new, 0 → heavily fouled

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const controlRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [activeControlIndex, setActiveControlIndex] = useState(0);

  // Reset particles whenever concentration / mean size / pore size changes
  useEffect(() => {
    setParticles(createParticles(feedConcentration, meanSoluteSize));
    setTime(0);
  }, [feedConcentration, meanSoluteSize, poreSize]);

  // Simulation loop (continuous process)
  useEffect(() => {
    function step(timestamp: number) {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = timestamp;

      // Fouling / ageing model: high pressure + high concentration → decay
      // Coefficients are chosen to make the process slower so you have time to explain.
      setMembraneHealth((h) => {
        const foulingFromPressure = pressure / 2200; // slower contribution from TMP
        const foulingFromConc = feedConcentration / 9000; // slower contribution from concentration
        const decay = (foulingFromPressure + foulingFromConc) * dt;
        const next = clamp(h - decay, 0, 100);
        return next;
      });

      setParticles((prev) => {
        return prev.map((p) => {
          let { x, y, vx, vy, size, region } = p;

          // Random vertical mixing from stirring / cross-flow
          const mixStrength = stirRate / 140; // 0–~0.7
          y += (Math.random() - 0.5) * mixStrength * 12;

          // Keep inside vertical limits of vessel
          const topLimit = VESSEL_Y + 20;
          const bottomLimit = VESSEL_Y + VESSEL_H - 20;
          if (y < topLimit) y = topLimit;
          if (y > bottomLimit) y = bottomLimit;

          if (region === "feed") {
            // Pressure-driven flow towards membrane (to the right)
            const pressureForce = pressure / 70; // scale factor
            vx += (0.5 + pressureForce) * dt;
            x += vx;

            // Slow horizontal Brownian-type jitter
            x += (Math.random() - 0.5) * dt * 8;

            // If particle reaches membrane region
            if (x >= MEMBRANE_X - 8) {
              // Decide if it passes or is retained based on size vs cut-off
              if (size < poreSize) {
                region = "permeate";
                x = MEMBRANE_X + 16;
                vx = 20 * pressureForce;
              } else {
                // Retained at the membrane surface
                region = "retentate";
                x = MEMBRANE_X - 10;
                vx = -vx * 0.3; // bounce back a bit
              }
            }
          } else if (region === "retentate") {
            // Particles skim along the membrane on feed side (left)
            x += (Math.random() - 0.3) * dt * 25; // gentle left drift
            y += (Math.random() - 0.5) * dt * 16;
            x = clamp(x, VESSEL_X + 20, MEMBRANE_X - 12);
          } else if (region === "permeate") {
            // Permeate moves to the right and slightly downwards
            const pressureForce = pressure / 80;
            vx += (0.4 + pressureForce) * dt;
            vy += 0.15 * dt;
            x += vx * dt * 12;
            y += vy * dt * 10;

            const rightLimit = VESSEL_X + VESSEL_W - 20;
            if (x > rightLimit) {
              // Instead of "finishing" and stopping here, recycle the particle back to the feed side
              x = VESSEL_X + 20 + Math.random() * 40;
              y = VESSEL_Y + 30 + Math.random() * (VESSEL_H - 80);
              vx = 0;
              vy = 0;
              region = "feed";
            }
          }

          // Hard bounds inside vessel
          const leftLimit = VESSEL_X + 10;
          const rightLimit = VESSEL_X + VESSEL_W - 10;
          if (x < leftLimit) x = leftLimit;
          if (x > rightLimit) x = rightLimit;

          return { ...p, x, y, vx, vy, region };
        });
      });

      setTime((t) => t + dt);

      if (isRunning) {
        animationRef.current = requestAnimationFrame(step);
      }
    }

    if (isRunning) {
      animationRef.current = requestAnimationFrame(step);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      lastTimeRef.current = null;
    };
  }, [isRunning, pressure, stirRate, feedConcentration]);

  const permeateCount = particles.filter((p) => p.region === "permeate").length;

  // Simple conceptual flux that drops as membrane fouls
  const baseFlux = (permeateCount * (pressure / 50)) / (1 + time);
  const flux = Number((baseFlux * (0.4 + membraneHealth / 100)).toFixed(2));

  const handleResetSystem = () => {
    setParticles(createParticles(feedConcentration, meanSoluteSize));
    setTime(0);
    setMembraneHealth(100);
  };

  const handleBackwash = () => {
    // Backwash / cleaning: partially restore health and push retentate particles back into feed
    setMembraneHealth((h) => clamp(h + 25, 0, 100));
    setParticles((prev) =>
      prev.map((p) => {
        if (p.region === "retentate") {
          return {
            ...p,
            x: p.x - 40,
            region: "feed",
          };
        }
        return p;
      })
    );
  };

  // Keyboard controls: Space = play/pause, Tab = switch controller slider focus
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Avoid interfering with form inputs outside the simulation if any
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";
      if (isTyping) return;

      if (e.code === "Space") {
        e.preventDefault();
        setIsRunning((v) => !v);
      } else if (e.key === "Tab") {
        e.preventDefault();
        setActiveControlIndex((prev) => {
          const total = controlRefs.current.length;
          if (!total) return prev;
          const next = (prev + 1) % total;
          const el = controlRefs.current[next];
          if (el && typeof el.focus === "function") {
            el.focus();
          }
          return next;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-50 p-6 space-y-4 font-sans">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
        <div className="text-xs sm:text-sm text-slate-400">
          Created by:{" "}
          <span className="text-slate-200">
            Yash, Shilpak, Sujit, Shahwez, Aditya
          </span>
        </div>
        <div className="px-3 py-1 rounded-md bg-slate-800/70 text-xs border border-slate-700">
          Advanced Analytical Techniques · Ultrafiltration
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl px-6 py-4 flex items-center justify-between shadow-lg shadow-black/40">
        <div className="text-xl sm:text-2xl font-semibold">
          <span className="text-fuchsia-400">ULTRA</span>
          <span className="text-sky-300 ml-1">FILTRATION</span>
        </div>
        <button
          className="px-3 py-1 rounded-full bg-slate-800 text-xs border border-slate-700 hover:border-sky-400 transition"
          onClick={handleResetSystem}
        >
          Reset System
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="Transmembrane Pressure"
          value={pressure.toFixed(0)}
          unit="a.u."
          description="Driving force pushing solvent through the membrane."
        />
        <StatCard
          label="Pore Size Cut-off"
          value={poreSize.toFixed(1)}
          unit="nm (sim.)"
          description="Particles smaller than this cut-off can permeate."
        />
        <StatCard
          label="Average Solute Size"
          value={meanSoluteSize.toFixed(1)}
          unit="nm (sim.)"
          description="Tunable solute / macromolecule size in the feed."
        />
        <StatCard
          label="Permeate Flux"
          value={flux}
          unit="rel. units"
          description="Conceptual solvent flux adjusted for fouling."
        />
        <StatCard
          label="Membrane Health"
          value={membraneHealth.toFixed(0)}
          unit="%"
          description="Drops with high pressure & concentration (fouling)."
        />
      </div>

      {/* Main content: Simulation + Controller */}
      <div className="grid grid-cols-4 gap-4 mt-2">
        {/* Simulation Panel */}
        <div className="col-span-4 lg:col-span-3 bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl border border-slate-800 p-5 shadow-xl shadow-black/40 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="px-3 py-1 text-xs rounded-full bg-slate-900 border border-slate-700/70">
              Simulation Story
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-300" />
                Feed / Solute
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-300" />
                Permeate
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-300" />
                Retentate layer
              </span>
            </div>
          </div>

          <div className="relative flex-1 flex items-center justify-center overflow-hidden rounded-2xl bg-slate-950/90 border border-slate-800">
            <svg
              viewBox={`0 0 ${VESSEL_WIDTH} ${VESSEL_HEIGHT}`}
              className="w-full max-h-[460px]"
            >
              {/* Background gradient */}
              <defs>
                <linearGradient id="feedGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#020617" stopOpacity="1" />
                  <stop offset="100%" stopColor="#020617" stopOpacity="1" />
                </linearGradient>
              </defs>

              {/* Inlet pipe from left */}
              <rect
                x={40}
                y={VESSEL_Y + VESSEL_H * 0.35}
                width={60}
                height={30}
                rx={8}
                fill="#020617"
                stroke="#1f2937"
                strokeWidth={3}
              />
              <rect
                x={80}
                y={VESSEL_Y + VESSEL_H * 0.35 + 6}
                width={40}
                height={18}
                rx={4}
                fill="#020617"
                stroke="#1f2937"
                strokeWidth={3}
              />

              {/* Flow arrows in pipe */}
              {Array.from({ length: 3 }).map((_, i) => {
                const baseX = 52 + i * 18;
                const y = VESSEL_Y + VESSEL_H * 0.35 + 15;
                return (
                  <g key={i}>
                    <line
                      x1={baseX}
                      y1={y}
                      x2={baseX + 10}
                      y2={y}
                      stroke="#38bdf8"
                      strokeWidth={2}
                    />
                    <polygon
                      points={`${baseX + 10},${y} ${baseX + 5},${y - 4} ${
                        baseX + 5
                      },${y + 4}`}
                      fill="#38bdf8"
                    />
                  </g>
                );
              })}

              {/* Vessel outline (pressurised chamber) */}
              <rect
                x={VESSEL_X}
                y={VESSEL_Y}
                width={VESSEL_W}
                height={VESSEL_H}
                rx={32}
                ry={32}
                fill="url(#feedGradient)"
                stroke="#1f2937"
                strokeWidth={3}
              />

              {/* Pressure arrows from left wall (same direction as flow) */}
              {Array.from({ length: 5 }).map((_, i) => {
                const y = VESSEL_Y + 40 + i * ((VESSEL_H - 80) / 4);
                const arrowLength = 28 + (pressure / 100) * 28;
                const xStart = VESSEL_X + 8;
                return (
                  <g key={i}>
                    <line
                      x1={xStart}
                      y1={y}
                      x2={xStart + arrowLength}
                      y2={y}
                      stroke="#38bdf8"
                      strokeWidth={2}
                    />
                    <polygon
                      points={`${xStart + arrowLength},${y} ${
                        xStart + arrowLength - 6
                      },${y - 4} ${xStart + arrowLength - 6},${y + 4}`}
                      fill="#38bdf8"
                    />
                  </g>
                );
              })}

              {/* Pressure label */}
              <text
                x={VESSEL_X + 18}
                y={VESSEL_Y + VESSEL_H - 18}
                textAnchor="start"
                fontSize={11}
                fill="#9ca3af"
              >
                Flow & pressure ➝
              </text>

              {/* Vertical membrane */}
              {(() => {
                const healthColor =
                  membraneHealth > 65
                    ? "#e5e7eb"
                    : membraneHealth > 35
                    ? "#facc15"
                    : "#f97316";

                // Visual pore radius reacts to slider
                const minPoreR = 3;
                const maxPoreR = 9;
                const poreR =
                  minPoreR +
                  ((poreSize - 6) / (18 - 6)) * (maxPoreR - minPoreR);

                const foulingLevel = 1 - membraneHealth / 100; // 0 (clean) → 1 (heavily fouled)

                // Number of debris clusters based on fouling level
                const debrisClusters = Math.round(8 * foulingLevel);

                return (
                  <g>
                    {/* Thin fouling film on feed side when health is lower */}
                    {foulingLevel > 0.15 && (
                      <rect
                        x={MEMBRANE_X - 10}
                        y={VESSEL_Y + 20}
                        width={8}
                        height={VESSEL_H - 40}
                        rx={4}
                        fill={healthColor}
                        fillOpacity={0.04 + 0.22 * foulingLevel}
                      />
                    )}

                    {/* Membrane backbone */}
                    <rect
                      x={MEMBRANE_X - 3}
                      y={VESSEL_Y + 18}
                      width={6}
                      height={VESSEL_H - 36}
                      rx={3}
                      fill={healthColor}
                      fillOpacity={0.18}
                      stroke={healthColor}
                      strokeWidth={2}
                    />

                    {/* Pores as circular openings */}
                    {Array.from({ length: 8 }).map((_, i) => {
                      const y = VESSEL_Y + 40 + i * ((VESSEL_H - 80) / 7);
                      return (
                        <circle
                          key={i}
                          cx={MEMBRANE_X}
                          cy={y}
                          r={poreR}
                          fill="#020617"
                          stroke={healthColor}
                          strokeWidth={1.2}
                        />
                      );
                    })}

                    {/* Debris deposits on membrane surface to visualise fouling */}
                    {foulingLevel > 0.05 &&
                      Array.from({ length: Math.max(debrisClusters, 2) }).map(
                        (_, i) => {
                          const y =
                            VESSEL_Y +
                            40 +
                            i *
                              ((VESSEL_H - 80) /
                                Math.max(debrisClusters - 1, 1));
                          const r = 3 + foulingLevel * 4;
                          const xOffset = 6 + foulingLevel * 6;
                          return (
                            <circle
                              key={`debris-${i}`}
                              cx={MEMBRANE_X - xOffset}
                              cy={y + (i % 2 === 0 ? -3 : 3)}
                              r={r}
                              fill="#0f172a"
                              fillOpacity={0.8 * foulingLevel}
                              stroke="#f97316"
                              strokeWidth={1}
                              strokeOpacity={0.7 * foulingLevel}
                            />
                          );
                        }
                      )}

                    {/* Membrane labels */}
                    <text
                      x={MEMBRANE_X - 12}
                      y={VESSEL_Y + 18}
                      textAnchor="end"
                      fontSize={10}
                      fill="#9ca3af"
                    >
                      Feed / Retentate side
                    </text>
                    <text
                      x={MEMBRANE_X + 12}
                      y={VESSEL_Y + 18}
                      textAnchor="start"
                      fontSize={10}
                      fill="#9ca3af"
                    >
                      Permeate side
                    </text>
                  </g>
                );
              })()}

              {/* Permeate outlet pipe (right) */}
              <rect
                x={VESSEL_X + VESSEL_W - 20}
                y={VESSEL_Y + VESSEL_H * 0.6}
                width={40}
                height={26}
                rx={8}
                fill="#020617"
                stroke="#1f2937"
                strokeWidth={3}
              />
              <rect
                x={VESSEL_X + VESSEL_W + 20}
                y={VESSEL_Y + VESSEL_H * 0.6 + 4}
                width={35}
                height={18}
                rx={5}
                fill="#020617"
                stroke="#1f2937"
                strokeWidth={3}
              />

              {Array.from({ length: 3 }).map((_, i) => {
                const baseX = VESSEL_X + VESSEL_W + 26 + i * 12;
                const y = VESSEL_Y + VESSEL_H * 0.6 + 13;
                return (
                  <g key={i}>
                    <line
                      x1={baseX}
                      y1={y}
                      x2={baseX + 8}
                      y2={y}
                      stroke="#4ade80"
                      strokeWidth={2}
                    />
                    <polygon
                      points={`${baseX + 8},${y} ${baseX + 3},${y - 4} ${
                        baseX + 3
                      },${y + 4}`}
                      fill="#4ade80"
                    />
                  </g>
                );
              })}

              {/* Particles */}
              {particles.map((p) => {
                let fill = "#38bdf8"; // feed
                if (p.region === "permeate") fill = "#4ade80"; // green
                if (p.region === "retentate") fill = "#f97316"; // orange

                const opacity = p.region === "feed" ? 0.9 : 0.95;

                return (
                  <circle
                    key={p.id}
                    cx={p.x}
                    cy={p.y}
                    r={p.size}
                    fill={fill}
                    fillOpacity={opacity}
                  />
                );
              })}
            </svg>
          </div>
        </div>

        {/* Controller Panel */}
        <div className="col-span-4 lg:col-span-1 bg-slate-900/80 border border-slate-800 rounded-3xl p-4 flex flex-col gap-4 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-slate-950 border border-slate-700 text-xs">
              Controller
            </span>
            <button
              className="text-xs px-3 py-1 rounded-full border border-slate-700/80 bg-slate-900/80 hover:border-emerald-400 transition flex items-center gap-1"
              onClick={() => setIsRunning((v) => !v)}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  isRunning ? "bg-emerald-400" : "bg-slate-500"
                }`}
              />
              {isRunning ? "Pause" : "Run"}
            </button>
          </div>

          <ControllerSlider
            label="Transmembrane Pressure"
            value={pressure}
            min={0}
            max={100}
            step={1}
            unit="a.u."
            precision={0}
            onChange={setPressure}
            description="Increase to push solvent harder against the membrane."
            inputRef={(el) => (controlRefs.current[0] = el)}
          />

          <ControllerSlider
            label="Membrane Pore Size"
            value={poreSize}
            min={6}
            max={18}
            step={0.5}
            unit="nm (sim.)"
            precision={1}
            onChange={setPoreSize}
            description="Visual pores get wider or narrower as you slide."
            inputRef={(el) => (controlRefs.current[1] = el)}
          />

          <ControllerSlider
            label="Average Solute Size"
            value={meanSoluteSize}
            min={6}
            max={18}
            step={0.5}
            unit="nm (sim.)"
            precision={1}
            onChange={setMeanSoluteSize}
            description="Mimic different biomolecules (peptides vs proteins)."
            inputRef={(el) => (controlRefs.current[2] = el)}
          />

          <ControllerSlider
            label="Feed Concentration"
            value={feedConcentration}
            min={100}
            max={1500}
            step={50}
            unit="a.u."
            precision={0}
            onChange={setFeedConcentration}
            description="Higher values mean more solute per unit volume (100–1500)."
            inputRef={(el) => (controlRefs.current[3] = el)}
          />

          <ControllerSlider
            label="Stirring / Cross-flow"
            value={stirRate}
            min={0}
            max={100}
            step={1}
            unit="a.u."
            precision={0}
            onChange={setStirRate}
            description="Reduces build-up on the membrane surface."
            inputRef={(el) => (controlRefs.current[4] = el)}
          />

          <div className="flex gap-2 mt-1">
            <button
              className="flex-1 text-xs px-3 py-1.5 rounded-full border border-emerald-500/70 bg-emerald-500/10 hover:bg-emerald-500/20 transition"
              onClick={handleBackwash}
            >
              Backwash / Clean Membrane
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
