import {ThreeCanvas} from '@remotion/three';
import {useLoader, useThree} from '@react-three/fiber';
import React, {useEffect, useMemo} from 'react';
import {interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {ThreeElement, ThemeTokens} from '../types';

type Props = {element: ThreeElement; tokens: ThemeTokens};

const resolveAsset = (src: string) =>
  /^https?:\/\//i.test(src) || /^data:/i.test(src)
    ? src
    : staticFile(src.replaceAll('\\', '/').replace(/^\//, ''));

const Model: React.FC<{src: string; color: string}> = ({src, color}) => {
  const gltf = useLoader(GLTFLoader, resolveAsset(src)) as {scene: THREE.Group};
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const cloned = materials.map((material) => {
        const next = material.clone();
        if ('color' in next && next.color instanceof THREE.Color) next.color.set(color);
        return next;
      });
      child.material = Array.isArray(child.material) ? cloned : cloned[0];
    });
    return clone;
  }, [color, gltf.scene]);
  return <primitive object={model} />;
};

const Geometry: React.FC<{element: ThreeElement}> = ({element}) => {
  switch (element.primitive ?? 'box') {
    case 'sphere':
      return <sphereGeometry args={[1.2, 64, 64]} />;
    case 'torus':
      return <torusGeometry args={[1.05, 0.38, 48, 96]} />;
    case 'cylinder':
      return <cylinderGeometry args={[0.92, 0.92, 2.1, 64]} />;
    case 'cone':
      return <coneGeometry args={[1.05, 2.2, 64]} />;
    default:
      return <boxGeometry args={[1.85, 1.85, 1.85, 6, 6, 6]} />;
  }
};

const Material: React.FC<{element: ThreeElement; color: string}> = ({element, color}) => {
  if (element.material === 'toon' || element.style === 'toy-3d') {
    return <meshToonMaterial color={color} />;
  }
  if (element.material === 'physical') {
    return <meshPhysicalMaterial color={color} roughness={0.24} metalness={0.18} clearcoat={0.8} clearcoatRoughness={0.2} />;
  }
  return <meshStandardMaterial color={color} roughness={0.42} metalness={element.style === 'technical' ? 0.48 : 0.08} />;
};

const AnimatedObject: React.FC<Props> = ({element, tokens}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const speed = element.rotationSpeed ?? [0.35, 0.6, 0.18];
  const seconds = frame / fps;
  const entrance = spring({frame, fps, config: {damping: 18, stiffness: 105, mass: 0.8}});
  const breathe = interpolate(Math.sin(seconds * Math.PI * 1.2), [-1, 1], [0.96, 1.04]);
  const baseScale = (element.objectScale ?? 1) * entrance * breathe;
  const color = element.color ?? tokens.primary;
  return (
    <group scale={baseScale} rotation={[seconds * speed[0], seconds * speed[1], seconds * speed[2]]}>
      {element.modelSrc ? (
        <Model src={element.modelSrc} color={color} />
      ) : (
        <mesh castShadow receiveShadow>
          <Geometry element={element} />
          <Material element={element} color={color} />
        </mesh>
      )}
      {element.style === 'technical' && !element.modelSrc ? (
        <mesh scale={1.18}>
          <Geometry element={{...element, modelSrc: undefined}} />
          <meshBasicMaterial color={element.accentColor ?? tokens.accent} wireframe transparent opacity={0.34} />
        </mesh>
      ) : null}
    </group>
  );
};

const CameraLookAt: React.FC<{target: [number, number, number]; frame: number}> = ({target, frame}) => {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, frame, target]);
  return null;
};

export const ThreeScene: React.FC<Props> = ({element, tokens}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const camera = element.camera ?? {};
  const basePosition = camera.position ?? [0, 0.5, 5.2];
  const orbitRadius = camera.orbitRadius ?? 0.55;
  const angle = (frame / fps) * (camera.orbitSpeed ?? 0.22);
  const position: [number, number, number] = [
    basePosition[0] + Math.sin(angle) * orbitRadius,
    basePosition[1] + Math.sin(angle * 0.7) * orbitRadius * 0.28,
    basePosition[2] + Math.cos(angle) * orbitRadius,
  ];
  const lighting = element.lighting ?? {};
  const shadows = lighting.shadows ?? true;
  const canvasWidth = Math.max(2, Math.round(width * element.width));
  const canvasHeight = Math.max(2, Math.round(height * element.height));

  return (
    <ThreeCanvas
      width={canvasWidth}
      height={canvasHeight}
      shadows={shadows}
      camera={{position, fov: camera.fov ?? 45, near: 0.1, far: 100}}
      style={{width: '100%', height: '100%', backgroundColor: 'transparent'}}
    >
      <ambientLight intensity={lighting.ambient ?? 1.2} />
      <directionalLight castShadow={shadows} position={[4, 6, 5]} intensity={lighting.key ?? 4.4} color="#fff4df" />
      <pointLight position={[-4, 2, 3]} intensity={lighting.fill ?? 2.2} color={element.accentColor ?? tokens.secondary} />
      <CameraLookAt target={camera.target ?? [0, 0, 0]} frame={frame} />
      <AnimatedObject element={element} tokens={tokens} />
      {shadows ? (
        <mesh receiveShadow position={[0, -1.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, 12]} />
          <shadowMaterial transparent opacity={0.22} />
        </mesh>
      ) : null}
    </ThreeCanvas>
  );
};
