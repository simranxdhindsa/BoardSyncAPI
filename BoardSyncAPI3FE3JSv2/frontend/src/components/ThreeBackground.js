import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ThreeBackground = ({ currentView, analysisData, selectedColumn, isLoading }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const animationIdRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, normalizedX: 0, normalizedY: 0 });
  
  // Simple monument creation functions (inline to avoid import issues)
  const createSimplePhone = () => {
    const geometry = new THREE.BoxGeometry(3, 6, 0.5);
    const edges = new THREE.EdgesGeometry(geometry);
    return edges;
  };

  const createSimpleTower = () => {
    const geometry = new THREE.ConeGeometry(2, 10, 8);
    const edges = new THREE.EdgesGeometry(geometry);
    return edges;
  };

  const createSimpleBuilding = () => {
    const geometry = new THREE.BoxGeometry(4, 12, 4);
    const edges = new THREE.EdgesGeometry(geometry);
    return edges;
  };

  const createSimpleBridge = () => {
    const group = new THREE.Group();
    
    // Main deck
    const deckGeometry = new THREE.BoxGeometry(20, 0.5, 2);
    const deckEdges = new THREE.EdgesGeometry(deckGeometry);
    const deckMaterial = new THREE.LineBasicMaterial({ color: 0x00aaff });
    const deck = new THREE.LineSegments(deckEdges, deckMaterial);
    group.add(deck);
    
    // Support pillars
    for (let i = 0; i < 5; i++) {
      const pillarGeometry = new THREE.BoxGeometry(0.5, 8, 0.5);
      const pillarEdges = new THREE.EdgesGeometry(pillarGeometry);
      const pillar = new THREE.LineSegments(pillarEdges, deckMaterial);
      pillar.position.set(-10 + i * 5, -4, 0);
      group.add(pillar);
    }
    
    return group;
  };

  useEffect(() => {
    console.log('ThreeBackground: Starting initialization...');
    initScene();
    createTestElements();
    startAnimation();

    const handleMouseMove = (event) => {
      mouseRef.current = {
        normalizedX: (event.clientX / window.innerWidth) * 2 - 1,
        normalizedY: -(event.clientY / window.innerHeight) * 2 + 1
      };
    };

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cleanup();
    };
  }, []);

  const initScene = () => {
    console.log('ThreeBackground: Creating scene...');
    
    // Scene
    const scene = new THREE.Scene();
    scene.background = null; // Transparent background
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    camera.position.set(0, 5, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // Transparent
    rendererRef.current = renderer;

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
      console.log('ThreeBackground: Renderer added to DOM');
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    scene.add(directionalLight);
  };

  const createTestElements = () => {
    const scene = sceneRef.current;
    console.log('ThreeBackground: Creating test elements...');

    // Test cube to verify rendering works
    const testGeometry = new THREE.BoxGeometry(2, 2, 2);
    const testEdges = new THREE.EdgesGeometry(testGeometry);
    const testMaterial = new THREE.LineBasicMaterial({ 
      color: 0xff0000, 
      linewidth: 2 
    });
    const testCube = new THREE.LineSegments(testEdges, testMaterial);
    testCube.position.set(0, 0, 0);
    scene.add(testCube);
    console.log('ThreeBackground: Test cube added');

    // Create scattered phone models
    for (let i = 0; i < 20; i++) {
      const phoneGeometry = createSimplePhone();
      const phoneMaterial = new THREE.LineBasicMaterial({ 
        color: 0x3b82f6, 
        transparent: true, 
        opacity: 0.3 + Math.random() * 0.4 
      });
      const phone = new THREE.LineSegments(phoneGeometry, phoneMaterial);
      
      phone.position.set(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 60 - 20
      );
      
      phone.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      
      const scale = 0.5 + Math.random() * 0.8;
      phone.scale.setScalar(scale);
      
      scene.add(phone);
    }
    console.log('ThreeBackground: 20 phones added');

    // Create static monuments
    const monuments = [
      { create: createSimpleTower, pos: [15, 0, -25], color: 0x06b6d4 },
      { create: createSimpleBuilding, pos: [-15, -2, -30], color: 0x8b5cf6 },
      { create: createSimpleBridge, pos: [0, -8, -35], color: 0x10b981 }
    ];

    monuments.forEach((monument, index) => {
      const geo = monument.create();
      if (geo instanceof THREE.Group) {
        // It's already a group (like bridge)
        geo.position.set(...monument.pos);
        scene.add(geo);
      } else {
        // It's a geometry
        const material = new THREE.LineBasicMaterial({ 
          color: monument.color,
          transparent: true,
          opacity: 0.6
        });
        const mesh = new THREE.LineSegments(geo, material);
        mesh.position.set(...monument.pos);
        scene.add(mesh);
      }
    });
    console.log('ThreeBackground: 3 monuments added');

    // Create animated line for testing
    const linePoints = [];
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      linePoints.push(
        new THREE.Vector3(
          Math.sin(t * Math.PI * 2) * 10,
          Math.cos(t * Math.PI * 4) * 5,
          t * 20 - 10
        )
      );
    }
    
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00aaff,
      linewidth: 2
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(line);
    console.log('ThreeBackground: Animated line added');

    console.log('ThreeBackground: Total objects in scene:', scene.children.length);
  };

  const startAnimation = () => {
    animate();
  };

  const animate = () => {
    animationIdRef.current = requestAnimationFrame(animate);

    const time = Date.now() * 0.001;
    const scene = sceneRef.current;
    
    // Rotate all objects slightly
    scene.traverse((child) => {
      if (child.type === 'LineSegments' || child.type === 'Group') {
        child.rotation.y += 0.005;
      }
    });

    // Mouse-responsive camera
    if (cameraRef.current) {
      const mouse = mouseRef.current;
      cameraRef.current.position.x += (mouse.normalizedX * 5 - cameraRef.current.position.x) * 0.02;
      cameraRef.current.position.y += (-mouse.normalizedY * 3 + 5 - cameraRef.current.position.y) * 0.02;
      cameraRef.current.lookAt(0, 0, 0);
    }

    // Render
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  const cleanup = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    
    if (rendererRef.current && mountRef.current) {
      mountRef.current.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
    }

    console.log('ThreeBackground: Cleanup completed');
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
        pointerEvents: 'none',
        backgroundColor: 'transparent'
      }}
    />
  );
};

export default ThreeBackground;