"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Color, type Group, type MeshStandardMaterial } from "three";
import type { CoreMode } from "./saathi-core";

const copper = new Color("#d2a66e");
const emerald = new Color("#8fc4a2");
const ivory = new Color("#eee8d8");

function CoreObject({ mode, onReady }: { mode: CoreMode; onReady: () => void }) {
  const body = useRef<Group>(null);
  const shell = useRef<MeshStandardMaterial>(null);
  const elapsed = useRef(0);
  const paintedFrames = useRef(0);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);

  useFrame(({ pointer }, delta) => {
    if (paintedFrames.current < 2 && ++paintedFrames.current === 2) {
      revealTimer.current = setTimeout(onReady, 1200);
    }
    if (!body.current || !shell.current) return;
    elapsed.current += Math.min(delta, 0.05);
    const speed = mode === "thinking" ? 0.28 : mode === "listening" ? 0.11 : mode === "action" ? 0.08 : 0;
    body.current.rotation.y += Math.min(delta, 0.05) * speed;
    body.current.rotation.x += (pointer.y * 0.12 - body.current.rotation.x) * Math.min(delta * 2, 1);
    body.current.rotation.z += (pointer.x * 0.1 - body.current.rotation.z) * Math.min(delta * 2, 1);
    body.current.position.y = mode === "idle" ? 0 : Math.sin(elapsed.current * 0.65) * 0.035;
    shell.current.color.lerp(mode === "action" ? emerald : mode === "listening" ? ivory : copper, Math.min(delta * 2, 1));
  });

  return (
    <group ref={body}>
      <mesh>
        <icosahedronGeometry args={[1.18, 0]} />
        <meshStandardMaterial ref={shell} color="#d2a66e" metalness={0.24} roughness={0.62} flatShading />
      </mesh>
      <mesh scale={1.025}>
        <icosahedronGeometry args={[1.18, 0]} />
        <meshBasicMaterial color="#fff4dc" wireframe transparent opacity={0.34} />
      </mesh>
      <mesh rotation={[0.55, 0.12, 0.1]}>
        <torusGeometry args={[1.62, 0.012, 5, 90]} />
        <meshBasicMaterial color="#d2a66e" transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[1.6, -0.35, 0.5]}>
        <torusGeometry args={[1.48, 0.01, 5, 90]} />
        <meshBasicMaterial color="#dfcfb0" transparent opacity={0.42} />
      </mesh>
      {[
        [-1.49, 0.52, 0.15],
        [1.56, -0.48, 0.1],
        [0.18, 1.49, -0.38],
        [-0.2, -1.5, 0.35],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]}>
          <sphereGeometry args={[0.058, 8, 8]} />
          <meshBasicMaterial color={mode === "action" ? "#8fc4a2" : "#f3d8a4"} />
        </mesh>
      ))}
    </group>
  );
}

export default function CoreScene({ mode, onReady }: { mode: CoreMode; onReady: () => void }) {
  return (
    <Canvas
      aria-hidden="true"
      camera={{ position: [0, 0, 5.2], fov: 48 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      fallback={<span className="core-canvas-fallback" aria-hidden="true" />}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[2.5, 3.5, 5]} intensity={2.1} color="#fff4d8" />
      <directionalLight position={[-3, -1, -2]} intensity={1.1} color="#a56d36" />
      <CoreObject mode={mode} onReady={onReady} />
    </Canvas>
  );
}
