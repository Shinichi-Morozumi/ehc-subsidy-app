"use client";

import { useId } from "react";
import "./hero-ambient-scene.css";

// The real HTML poster supplies the complete scene. SVG contains motion only;
// Safari must never depend on <use> referencing an <image> for the building.
const FANS = [
  { x: 560, y: 633, phase: "a" },
  { x: 560, y: 701, phase: "b" },
  { x: 724, y: 659, phase: "c" },
  { x: 724, y: 736, phase: "d" },
] as const;

const OUTLETS = [
  ["M302 310C297 337 276 359 252 367", "M383 310C389 341 407 361 436 369"],
  ["M535 214C532 240 511 266 486 275", "M615 215C622 241 641 261 668 272"],
  ["M820 343C814 368 801 388 787 399", "M884 343C889 364 902 383 923 393"],
  ["M1015 272C1010 294 998 314 981 326", "M1082 272C1086 294 1101 314 1120 327"],
] as const;

export default function HeroAmbientScene() {
  const uid = `ehc-ambient-${useId().replace(/:/g, "")}`;
  const rotorClipId = `${uid}-rotor`;

  return (
    <svg
      className="ehc-film__ambient-scene"
      viewBox="0 0 1440 960"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={rotorClipId} clipPathUnits="userSpaceOnUse"><circle r="29" /></clipPath>
      </defs>

      {FANS.map((fan) => (
        <g key={fan.phase} transform={`translate(${fan.x} ${fan.y}) rotate(-17) scale(.72 1)`}>
          <circle r="29" fill="#dce4d7" opacity=".15" />
          <g clipPath={`url(#${rotorClipId})`}>
            <g className={`ehc-film__ambient-rotor ehc-film__ambient-rotor--${fan.phase}`}>
              {/* The invisible circle centers the CSS rotation exactly on the hub. */}
              <circle r="29" fill="transparent" />
              {[0, 120, 240].map((angle) => (
                <path
                  key={angle}
                  transform={`rotate(${angle})`}
                  d="M-3-2C-10-10-13-22-6-27C4-34 19-23 16-15C13-8 5-3-3-2Z"
                  fill="#304f43"
                  opacity=".34"
                />
              ))}
            </g>
          </g>
          {/* Fixed grille and hub establish that only the blades rotate. */}
          <g fill="none" stroke="#607969" strokeWidth=".8" opacity=".48">
            <circle r="27" /><circle r="22" /><circle r="16" />
            <path d="M0-28V28M-28 0H28M-20-20L20 20M-20 20L20-20" />
          </g>
          <circle r="5.3" fill="#e6eddf" stroke="#607969" strokeWidth="1" />
        </g>
      ))}

      {OUTLETS.map((paths, i) => (
        <g key={i} className={`ehc-film__ambient-air ehc-film__ambient-air--${i + 1}`}>
          {paths.map((path) => <path key={path} d={path} pathLength="100" />)}
        </g>
      ))}
    </svg>
  );
}
