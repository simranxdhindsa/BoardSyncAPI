import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { 
  createBurjKhalifaGeometry, 
  createEiffelTowerGeometry, 
  createModernSkyscraperGeometry,
  createBridgeGeometry,
  createTajMahalGeometry,
  createiPhoneGeometry,
  createMonumentMaterial 
} from '../utils/monumentGeometries';

const ThreeBackground = ({ currentView, analysisData, selectedColumn, isLoading }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const animationIdRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, normalizedX: 0, normalizedY: 0 });
  
  // Animation state
  const animationStateRef = useRef({
    currentElementIndex: 0,
    currentMonumentIndex: 0,
    phase: 'writingText',
    progress: 0,
    startTime: 0,
    currentSide: 'left',
    textWritingSpeed: 3000,
    drawingSpeed: 2500,
    showDuration: 6000,
    erasingSpeed: 1500,
    dotMoveSpeed: 1000
  });
  
  const currentElementRef = useRef(null);
  const currentMonumentRef = useRef(null);
  const textMeshRef = useRef(null);
  const dotRef = useRef(null);

  // Simple positioning for extreme left and right
  const getPositionForSide = (side) => {
    return side === 'left' ? { x: -30, y: 0, z: -15 } : { x: 30, y: 0, z: -15 };
  };

  const getDotPosition = (side) => {
    if (side === 'left') return { x: -30, y: 0, z: -15 };
    if (side === 'right') return { x: 30, y: 0, z: -15 };
    return { x: 0, y: 0, z: -15 };
  };

  // Advanced 3D Elements
  const createDNAHelix = () => {
    const group = new THREE.Group();
    const helixHeight = 8;
    const radius = 1.5;
    const turns = 3;
    const points1 = [];
    const points2 = [];
    
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const y = helixHeight * t - helixHeight / 2;
      const angle = t * turns * Math.PI * 2;
      
      points1.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      ));
      
      points2.push(new THREE.Vector3(
        Math.cos(angle + Math.PI) * radius,
        y,
        Math.sin(angle + Math.PI) * radius
      ));
    }
    
    const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
    const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
    
    const material1 = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.8 });
    const material2 = new THREE.LineBasicMaterial({ color: 0xff4488, transparent: true, opacity: 0.8 });
    
    const helix1 = new THREE.Line(geometry1, material1);
    const helix2 = new THREE.Line(geometry2, material2);
    
    group.add(helix1);
    group.add(helix2);
    
    return group;
  };

  const createWaveInterference = () => {
    const group = new THREE.Group();
    const size = 10;
    const resolution = 30;
    
    for (let wave = 0; wave < 3; wave++) {
      const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
      const positions = geometry.attributes.position.array;
      
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2];
        const distance = Math.sqrt(x * x + z * z);
        positions[i + 1] = Math.sin(distance * 0.5 + wave * Math.PI / 1.5) * 0.5;
      }
      
      geometry.attributes.position.needsUpdate = true;
      const material = new THREE.MeshBasicMaterial({ 
        color: new THREE.Color().setHSL(wave * 0.3, 0.7, 0.5),
        wireframe: true,
        transparent: true,
        opacity: 0.4
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = wave * 2 - 2;
      group.add(mesh);
    }
    
    return group;
  };

  const createNeuralNetwork = () => {
    const group = new THREE.Group();
    const nodeCount = 15;
    const nodes = [];
    
    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
      const nodeGeometry = new THREE.SphereGeometry(0.2, 8, 6);
      const nodeMaterial = new THREE.MeshBasicMaterial({ 
        color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
        transparent: true,
        opacity: 0.8
      });
      
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
      node.position.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 4
      );
      
      group.add(node);
      nodes.push(node);
    }
    
    // Create connections
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (Math.random() < 0.2) {
          const points = [nodes[i].position, nodes[j].position];
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const material = new THREE.LineBasicMaterial({ 
            color: 0x4488ff,
            transparent: true,
            opacity: 0.3
          });
          
          const connection = new THREE.Line(geometry, material);
          group.add(connection);
        }
      }
    }
    
    return group;
  };

  const createSoundWaves = () => {
    const group = new THREE.Group();
    const waveCount = 5;
    
    for (let w = 0; w < waveCount; w++) {
      const points = [];
      const frequency = 2 + w * 0.5;
      const amplitude = 1 + w * 0.3;
      
      for (let i = 0; i <= 100; i++) {
        const x = (i - 50) * 0.2;
        const y = Math.sin(i * 0.1 * frequency) * amplitude;
        points.push(new THREE.Vector3(x, y, w * 0.5));
      }
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ 
        color: new THREE.Color().setHSL(w * 0.2, 0.8, 0.6),
        transparent: true,
        opacity: 0.7
      });
      
      const wave = new THREE.Line(geometry, material);
      group.add(wave);
    }
    
    return group;
  };

  useEffect(() => {
    initThreeJS();
    createDot();
    startAnimation();
    
    const handleMouseMove = (event) => {
      mouseRef.current = {
        x: event.clientX,
        y: event.clientY,
        normalizedX: (event.clientX / window.innerWidth) * 2 - 1,
        normalizedY: -(event.clientY / window.innerHeight) * 2 + 1
      };
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      cleanup();
    };
  }, []);

  const initThreeJS = () => {
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(110, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 25);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      premultipliedAlpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    setupLighting();
    window.addEventListener('resize', handleResize);
  };

  const setupLighting = () => {
    const scene = sceneRef.current;
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(0, 20, 15);
    scene.add(directionalLight);

    const leftLight = new THREE.PointLight(0x3b82f6, 0.8, 40);
    leftLight.position.set(-40, 10, -10);
    scene.add(leftLight);

    const rightLight = new THREE.PointLight(0x06b6d4, 0.8, 40);
    rightLight.position.set(40, 10, -10);
    scene.add(rightLight);
  };

  const createDot = () => {
    const dotGeometry = new THREE.SphereGeometry(0.2, 12, 8);
    const dotMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00aaff,
      transparent: true,
      opacity: 0.9
    });
    
    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    dot.position.set(0, 0, -15);
    dot.visible = true;
    sceneRef.current.add(dot);
    dotRef.current = dot;
  };

  const createTextBlocks = () => {
    const group = new THREE.Group();
    
    // Left text - "Simran Dhindsa"
    for (let i = 0; i < 14; i++) {
      const blockGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.1);
      const blockMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.9
      });
      
      const block = new THREE.Mesh(blockGeometry, blockMaterial);
      block.position.set(-15 + (i * 1), 3, -10);
      group.add(block);
    }
    
    // Right text - "Dhindsa"
    for (let i = 0; i < 7; i++) {
      const blockGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.1);
      const blockMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.9
      });
      
      const block = new THREE.Mesh(blockGeometry, blockMaterial);
      block.position.set(12 + (i * 1), 3, -10);
      group.add(block);
    }
    
    return group;
  };

  const startAnimation = () => {
    animationStateRef.current.startTime = Date.now();
    animate();
  };

  const animate = () => {
    animationIdRef.current = requestAnimationFrame(animate);
    
    const now = Date.now();
    const state = animationStateRef.current;
    const elapsed = now - state.startTime;
    
    // Simple cycling animation
    if (elapsed > 3000) { // 3 second cycles
      // Clear current elements
      if (currentElementRef.current) {
        sceneRef.current.remove(currentElementRef.current);
        currentElementRef.current = null;
      }
      
      // Create new element
      let newElement;
      const elementIndex = Math.floor((now / 3000) % 4);
      const side = Math.floor((now / 3000) % 2) === 0 ? 'left' : 'right';
      const position = getPositionForSide(side);
      
      switch (elementIndex) {
        case 0:
          newElement = createDNAHelix();
          break;
        case 1:
          newElement = createWaveInterference();
          break;
        case 2:
          newElement = createNeuralNetwork();
          break;
        case 3:
          newElement = createSoundWaves();
          break;
      }
      
      if (newElement) {
        newElement.position.copy(position);
        sceneRef.current.add(newElement);
        currentElementRef.current = newElement;
      }
      
      state.startTime = now;
    }
    
    // Mouse interaction
    const mouse = mouseRef.current;
    if (currentElementRef.current) {
      currentElementRef.current.rotation.y += mouse.normalizedX * 0.01;
      currentElementRef.current.rotation.x += mouse.normalizedY * 0.005;
    }
    
    // Camera movement
    if (cameraRef.current) {
      const targetX = mouse.normalizedX * 3;
      const targetY = -mouse.normalizedY * 2 + 5;
      
      cameraRef.current.position.x += (targetX - cameraRef.current.position.x) * 0.02;
      cameraRef.current.position.y += (targetY - cameraRef.current.position.y) * 0.02;
      cameraRef.current.lookAt(0, 0, 0);
    }
    
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  const cleanup = () => {
    if (currentElementRef.current) {
      sceneRef.current.remove(currentElementRef.current);
      currentElementRef.current = null;
    }
    if (dotRef.current) {
      sceneRef.current.remove(dotRef.current);
      dotRef.current = null;
    }
    if (rendererRef.current && mountRef.current) {
      mountRef.current.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
    }
  };

  const handleResize = () => {
    if (cameraRef.current && rendererRef.current) {
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    }
  };

  return (
    <div 
      ref={mountRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none'
      }}
    />
  );
};

export default ThreeBackground;