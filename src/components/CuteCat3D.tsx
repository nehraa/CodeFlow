"use client";

import * as React from "react";
import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, SoftShadows, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

// Cute Pixar-style 3D Cat Component
function CatBody({ sceneId, reducedMotion }: { sceneId: string; reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftEarRef = useRef<THREE.Mesh>(null);
  const rightEarRef = useRef<THREE.Mesh>(null);
  const blinkRef = useRef(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isBooping, setIsBooping] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Colors based on scene
  const getAccentColor = () => {
    switch (sceneId) {
      case "spec": return "#67e8f9";
      case "ghost": return "#a78bfa";
      case "implementation": return "#f59e0b";
      case "heal": return "#34d399";
      case "digitalTwin": return "#60a5fa";
      case "vcr": return "#fb7185";
      case "heatmap": return "#f97316";
      case "genetic": return "#22c55e";
      case "error": return "#ef4444";
      case "polish": return "#facc15";
      default: return "#67e8f9";
    }
  };

  // Mouse tracking
  useEffect(() => {
    if (reducedMotion) return;
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [reducedMotion]);

  // Random blinking
  useEffect(() => {
    if (reducedMotion) return;
    const scheduleBlink = () => {
      const delay = Math.random() * 4000 + 2000;
      return setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
        scheduleBlink();
      }, delay);
    };
    const timer = scheduleBlink();
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  // Spacebar jump
  useEffect(() => {
    if (reducedMotion) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" &&
          !isJumping &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setIsJumping(true);
        setTimeout(() => setIsJumping(false), 500);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reducedMotion, isJumping]);

  // Animation loop
  useFrame((state) => {
    if (!groupRef.current || reducedMotion) return;
    const t = state.clock.getElapsedTime();

    // Breathing animation
    groupRef.current.scale.y = 1 + Math.sin(t * 2) * 0.02;
    groupRef.current.scale.x = 1 + Math.cos(t * 2) * 0.01;

    // Tail wag
    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(t * 3) * 0.3;
      tailRef.current.rotation.x = Math.cos(t * 2) * 0.1;
    }

    // Head follows mouse slightly
    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, mousePosition.x * 0.3, 0.1);
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, -mousePosition.y * 0.2, 0.1);
    }

    // Jump animation
    if (isJumping) {
      const jumpProgress = (state.clock.getElapsedTime() % 0.5) / 0.5;
      const jumpHeight = Math.sin(jumpProgress * Math.PI) * 1.5;
      groupRef.current.position.y = Math.max(0, jumpHeight);
    } else {
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, 0.1);
    }

    // Scene-specific animations
    if (sceneId === "implementation" && headRef.current) {
      headRef.current.rotation.z = Math.sin(t * 8) * 0.1;
    }
    if (sceneId === "error" && groupRef.current) {
      groupRef.current.rotation.z = Math.sin(t * 15) * 0.05;
    }
  });

  const accentColor = getAccentColor();

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Shadow */}
      <mesh position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.8, 32]} />
        <meshBasicMaterial color="#0a1628" transparent opacity={0.4} />
      </mesh>

      {/* Body - Cute rounded pear shape */}
      <mesh position={[0, -0.2, 0]} castShadow receiveShadow>
        <sphereGeometry args={[1.3, 64, 64]} />
        <meshStandardMaterial
          color="#7a8bb5"
          metalness={0.1}
          roughness={0.6}
        />
      </mesh>

      {/* Belly patch - lighter cream color */}
      <mesh position={[0, -0.3, 0.9]} castShadow receiveShadow>
        <sphereGeometry args={[0.9, 48, 48]} />
        <meshStandardMaterial
          color="#e8ddd0"
          metalness={0}
          roughness={0.8}
        />
      </mesh>

      {/* Head group */}
      <group ref={headRef} position={[0, 1.2, 0.3]}>
        {/* Main head - large and round like Pixar style */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[1.1, 64, 64]} />
          <meshStandardMaterial
            color="#7a8bb5"
            metalness={0.1}
            roughness={0.6}
          />
        </mesh>

        {/* Muzzle area */}
        <mesh position={[0, -0.3, 0.95]} castShadow receiveShadow>
          <sphereGeometry args={[0.55, 32, 32]} />
          <meshStandardMaterial
            color="#f0e6d8"
            metalness={0}
            roughness={0.8}
          />
        </mesh>

        {/* Ears */}
        <mesh ref={leftEarRef} position={[-0.7, 0.8, 0]} rotation={[0, 0, 0.5]} castShadow receiveShadow>
          <sphereGeometry args={[0.4, 32, 32]} scale={[1, 1.4, 0.6]} />
          <meshStandardMaterial color="#7a8bb5" />
        </mesh>
        <mesh ref={rightEarRef} position={[0.7, 0.8, 0]} rotation={[0, 0, -0.5]} castShadow receiveShadow>
          <sphereGeometry args={[0.4, 32, 32]} scale={[1, 1.4, 0.6]} />
          <meshStandardMaterial color="#7a8bb5" />
        </mesh>

        {/* Inner ears */}
        <mesh position={[-0.7, 0.8, 0.15]} rotation={[0, 0, 0.5]}>
          <sphereGeometry args={[0.22, 24, 24]} scale={[1, 1.3, 0.5]} />
          <meshStandardMaterial color="#f5aeb8" />
        </mesh>
        <mesh position={[0.7, 0.8, 0.15]} rotation={[0, 0, -0.5]}>
          <sphereGeometry args={[0.22, 24, 24]} scale={[1, 1.3, 0.5]} />
          <meshStandardMaterial color="#f5aeb8" />
        </mesh>

        {/* Eyes */}
        <group>
          {/* Left eye */}
          <mesh position={[-0.35, 0.15, 0.95]}>
            <sphereGeometry args={[0.28, 32, 32]} scale={[1, 1.15, 0.3]} />
            <meshStandardMaterial color="#1a1a2e" />
          </mesh>
          {/* Right eye */}
          <mesh position={[0.35, 0.15, 0.95]}>
            <sphereGeometry args={[0.28, 32, 32]} scale={[1, 1.15, 0.3]} />
            <meshStandardMaterial color="#1a1a2e" />
          </mesh>

          {/* Pupils - follow mouse */}
          <mesh
            position={[-0.35 + mousePosition.x * 0.08, 0.15 - mousePosition.y * 0.06, 1.05]}
            scale={isBlinking ? [1, 0.1, 1] : [1, 1, 1]}
          >
            <sphereGeometry args={[0.14, 24, 24]} />
            <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.2} />
          </mesh>
          <mesh
            position={[0.35 + mousePosition.x * 0.08, 0.15 - mousePosition.y * 0.06, 1.05]}
            scale={isBlinking ? [1, 0.1, 1] : [1, 1, 1]}
          >
            <sphereGeometry args={[0.14, 24, 24]} />
            <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.2} />
          </mesh>

          {/* Eye highlights */}
          <mesh position={[-0.28, 0.28, 1.15]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.42, 0.28, 1.15]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>

        {/* Nose */}
        <mesh
          position={[0, -0.25, 1.15]}
          scale={isBooping ? 1.3 : 1}
          onClick={() => {
            setIsBooping(true);
            setTimeout(() => setIsBooping(false), 200);
          }}
        >
          <sphereGeometry args={[0.12, 24, 24]} scale={[1.3, 0.8, 0.6]} />
          <meshStandardMaterial color="#f5aeb8" />
        </mesh>

        {/* Cheeks */}
        <mesh position={[-0.7, -0.2, 0.9]} rotation={[0, 0.3, 0]}>
          <sphereGeometry args={[0.25, 24, 24]} scale={[1, 0.6, 0.5]} />
          <meshStandardMaterial color="#ffb4ba" transparent opacity={0.6} />
        </mesh>
        <mesh position={[0.7, -0.2, 0.9]} rotation={[0, -0.3, 0]}>
          <sphereGeometry args={[0.25, 24, 24]} scale={[1, 0.6, 0.5]} />
          <meshStandardMaterial color="#ffb4ba" transparent opacity={0.6} />
        </mesh>
      </group>

      {/* Tail */}
      <mesh
        ref={tailRef}
        position={[-1.2, -0.5, -0.5]}
        rotation={[0, 0, -0.5]}
        castShadow
      >
        <capsuleGeometry args={[0.25, 1.2, 8, 16]} />
        <meshStandardMaterial color="#7a8bb5" />
      </mesh>

      {/* Back legs */}
      <mesh position={[-0.8, -1.2, 0.2]} castShadow receiveShadow>
        <sphereGeometry args={[0.4, 32, 32]} scale={[0.9, 1.2, 0.9]} />
        <meshStandardMaterial color="#7a8bb5" />
      </mesh>
      <mesh position={[0.8, -1.2, 0.2]} castShadow receiveShadow>
        <sphereGeometry args={[0.4, 32, 32]} scale={[0.9, 1.2, 0.9]} />
        <meshStandardMaterial color="#7a8bb5" />
      </mesh>

      {/* Front legs */}
      <mesh position={[-0.4, -1.1, 1]} castShadow receiveShadow>
        <sphereGeometry args={[0.35, 32, 32]} scale={[0.8, 1.3, 0.8]} />
        <meshStandardMaterial color="#7a8bb5" />
      </mesh>
      <mesh position={[0.4, -1.1, 1]} castShadow receiveShadow>
        <sphereGeometry args={[0.35, 32, 32]} scale={[0.8, 1.3, 0.8]} />
        <meshStandardMaterial color="#7a8bb5" />
      </mesh>

      {/* Paws - lighter cream */}
      <mesh position={[-0.4, -1.65, 1]}>
        <sphereGeometry args={[0.32, 24, 24]} scale={[1, 0.4, 1.2]} />
        <meshStandardMaterial color="#e8ddd0" />
      </mesh>
      <mesh position={[0.4, -1.65, 1]}>
        <sphereGeometry args={[0.32, 24, 24]} scale={[1, 0.4, 1.2]} />
        <meshStandardMaterial color="#e8ddd0" />
      </mesh>
      <mesh position={[-0.8, -1.75, 0.2]}>
        <sphereGeometry args={[0.35, 24, 24]} scale={[1, 0.4, 1.3]} />
        <meshStandardMaterial color="#e8ddd0" />
      </mesh>
      <mesh position={[0.8, -1.75, 0.2]}>
        <sphereGeometry args={[0.35, 24, 24]} scale={[1, 0.4, 1.3]} />
        <meshStandardMaterial color="#e8ddd0" />
      </mesh>

      {/* Scene accessories */}
      {sceneId === "spec" && (
        <mesh position={[0, 1.9, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[1.2, 0.05, 8, 50]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.3} />
        </mesh>
      )}

      {sceneId === "ghost" && (
        <mesh position={[0, 0, -1]}>
          <ringGeometry args={[2, 2.3, 64]} />
          <meshStandardMaterial
            color={accentColor}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {sceneId === "digitalTwin" && (
        <>
          <mesh position={[-0.35, 1.35, 1]}>
            <torusGeometry args={[0.35, 0.04, 8, 32]} />
            <meshStandardMaterial color="#60a5fa" />
          </mesh>
          <mesh position={[0.35, 1.35, 1]}>
            <torusGeometry args={[0.35, 0.04, 8, 32]} />
            <meshStandardMaterial color="#60a5fa" />
          </mesh>
        </>
      )}

      {sceneId === "error" && (
        <>
          <mesh position={[1.5, 1, 0]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.1, 0.8, 0.1]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[1.5, 1, 0]} rotation={[0, 0, -0.5]}>
            <boxGeometry args={[0.1, 0.8, 0.1]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}

      {reducedMotion && (
        <mesh position={[0, 0, -2]}>
          <planeGeometry args={[10, 10]} />
          <meshBasicMaterial color="#000000" transparent opacity={0} />
        </mesh>
      )}
    </group>
  );
}

// Lighting setup
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.4} color="#a8c4e0" />
      <directionalLight
        position={[5, 10, 7]}
        intensity={1.2}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <pointLight position={[-5, 2, -5]} intensity={0.5} color="#67e8f9" />
      <pointLight position={[5, -2, -5]} intensity={0.3} color="#a78bfa" />
    </>
  );
}

// Camera controller
function CameraController({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera } = useThree();
  const cameraRef = useRef(camera);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useFrame(() => {
    if (!reducedMotion) {
      const activeCamera = cameraRef.current;
      activeCamera.position.x = THREE.MathUtils.lerp(activeCamera.position.x, 0, 0.05);
      activeCamera.position.y = THREE.MathUtils.lerp(activeCamera.position.y, 0.5, 0.05);
      activeCamera.lookAt(0, 0, 0);
    }
  });

  return null;
}

// Main export
export function CuteCat3D({
  sceneId,
  reducedMotion = false
}: {
  sceneId: string;
  reducedMotion?: boolean;
}) {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: "280px" }}>
      <Canvas
        shadows
        camera={{ position: [0, 0.5, 5], fov: 45 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        }}
      >
        <SoftShadows size={25} samples={10} focus={0.5} />
        <Lighting />
        <CameraController reducedMotion={reducedMotion} />
        <CatBody sceneId={sceneId} reducedMotion={reducedMotion} />
        {!reducedMotion && <OrbitControls enableZoom={false} enablePan={false} />}
      </Canvas>
    </div>
  );
}
