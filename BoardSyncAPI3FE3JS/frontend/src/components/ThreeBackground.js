import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ThreeBackground = ({ currentView, analysisData, selectedColumn, isLoading }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const backgroundElementsRef = useRef([]);
  const animationIdRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, normalizedX: 0, normalizedY: 0 });

  useEffect(() => {
    // Initialize Three.js scene
    initThreeJS();
    
    // Start animation loop
    animate();
    
    // Add mouse movement listener
    const handleMouseMove = (event) => {
      mouseRef.current = {
        x: event.clientX,
        y: event.clientY,
        normalizedX: (event.clientX / window.innerWidth) * 2 - 1,
        normalizedY: -(event.clientY / window.innerHeight) * 2 + 1
      };
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    // Update background based on current view
    updateBackgroundForView();
  }, [currentView, analysisData, selectedColumn, isLoading]);

  const initThreeJS = () => {
    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup - positioned for background view
    const camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    camera.position.set(0, 0, 10);
    cameraRef.current = camera;

    // Renderer setup with transparency for overlay
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      premultipliedAlpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Add to DOM
    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    // Lighting setup
    setupLighting();

    // Create initial background elements
    createInitialBackground();

    // Handle window resize
    window.addEventListener('resize', handleResize);
  };

  const setupLighting = () => {
    const scene = sceneRef.current;
    
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    // Directional light for depth
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Accent lights for tech atmosphere
    const blueLight = new THREE.PointLight(0x3b82f6, 0.3, 50);
    blueLight.position.set(-20, 5, 0);
    scene.add(blueLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 0.3, 50);
    cyanLight.position.set(20, 5, 0);
    scene.add(cyanLight);
  };

  const createInitialBackground = () => {
    const elements = [];

    // 1. Floating Binary Code Streams
    elements.push(...createBinaryStreams());

    // 2. Data Flow Pipes/Tubes
    elements.push(...createDataFlowTubes());

    // 3. Holographic Grids
    elements.push(...createHolographicGrids());

    // 4. Hologram-style Wireframes (non-geometric)
    elements.push(...createHologramWireframes());

    // 5. Floating Tech Panels/Screens
    elements.push(...createFloatingTechPanels());

    // 6. Flowing Wave-like Structures
    elements.push(...createFlowingWaves());

    backgroundElementsRef.current = elements;
    
    // Add all elements to scene
    elements.forEach(element => {
      sceneRef.current.add(element);
    });
  };

  const createBinaryStreams = () => {
    const streams = [];
    
    for (let i = 0; i < 8; i++) {
      // Create particle system for binary code
      const particleCount = 100;
      const particles = new THREE.BufferGeometry();
      const positions = [];
      const colors = [];
      
      for (let j = 0; j < particleCount; j++) {
        positions.push(
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 30
        );
        // Light blue/cyan for binary streams
        colors.push(0.2, 0.6, 1.0);
      }
      
      particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      particles.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      
      const material = new THREE.PointsMaterial({
        size: 0.5,
        transparent: true,
        opacity: 0.6,
        vertexColors: true,
        blending: THREE.AdditiveBlending
      });
      
      const stream = new THREE.Points(particles, material);
      stream.userData = { 
        type: 'binary_stream', 
        speed: 0.005 + Math.random() * 0.01,
        originalPositions: [...positions]
      };
      
      streams.push(stream);
    }
    
    return streams;
  };

  const createDataFlowTubes = () => {
    const tubes = [];
    
    for (let i = 0; i < 6; i++) {
      // Create curved path for data flow
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-30 + Math.random() * 60, -20 + Math.random() * 40, -15),
        new THREE.Vector3(-30 + Math.random() * 60, -20 + Math.random() * 40, -5),
        new THREE.Vector3(-30 + Math.random() * 60, -20 + Math.random() * 40, 5),
        new THREE.Vector3(-30 + Math.random() * 60, -20 + Math.random() * 40, 15)
      ]);
      
      const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.2, 8, false);
      const tubeMaterial = new THREE.MeshPhongMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.3,
        emissive: 0x002244
      });
      
      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      tube.userData = { type: 'data_tube', curve: curve };
      
      // Add flowing particles inside tube
      const flowParticles = createTubeFlow(curve);
      tube.add(flowParticles);
      
      tubes.push(tube);
    }
    
    return tubes;
  };

  const createTubeFlow = (curve) => {
    const particleCount = 30;
    const particles = new THREE.BufferGeometry();
    const positions = [];
    
    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const point = curve.getPoint(t);
      positions.push(point.x, point.y, point.z);
    }
    
    particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0x00ffff,
      size: 0.3,
      transparent: true,
      opacity: 0.8
    });
    
    const flow = new THREE.Points(particles, material);
    flow.userData = { type: 'tube_flow', curve: curve, progress: 0 };
    
    return flow;
  };

  const createHolographicGrids = () => {
    const grids = [];
    
    for (let i = 0; i < 4; i++) {
      const gridGeometry = new THREE.PlaneGeometry(25, 25, 12, 12);
      const gridMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
      });
      
      const grid = new THREE.Mesh(gridGeometry, gridMaterial);
      grid.position.set(
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 30,
        -10 + Math.random() * 20
      );
      grid.rotation.x = Math.random() * Math.PI;
      grid.rotation.y = Math.random() * Math.PI;
      
      grid.userData = { 
        type: 'holo_grid', 
        rotationSpeed: 0.002 + Math.random() * 0.005 
      };
      
      grids.push(grid);
    }
    
    return grids;
  };

  const createHologramWireframes = () => {
    const wireframes = [];
    
    // Create tech-themed wireframe shapes (avoiding basic geometric shapes)
    for (let i = 0; i < 6; i++) {
      // Create custom tech shapes using lines
      const points = [];
      
      // Create a tech pattern (like circuit traces)
      const centerX = (Math.random() - 0.5) * 40;
      const centerY = (Math.random() - 0.5) * 30;
      const centerZ = -5 + Math.random() * 10;
      
      // Create interconnected lines forming tech patterns
      for (let j = 0; j < 8; j++) {
        const angle = (j / 8) * Math.PI * 2;
        const radius = 3 + Math.random() * 2;
        points.push(new THREE.Vector3(
          centerX + Math.cos(angle) * radius,
          centerY + Math.sin(angle) * radius,
          centerZ
        ));
      }
      
      // Close the shape
      points.push(points[0]);
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x44ff88,
        transparent: true,
        opacity: 0.4
      });
      
      const wireframe = new THREE.Line(geometry, material);
      wireframe.userData = { 
        type: 'holo_wireframe',
        rotationSpeed: 0.01 + Math.random() * 0.02
      };
      
      wireframes.push(wireframe);
    }
    
    return wireframes;
  };

  const createFloatingTechPanels = () => {
    const panels = [];
    
    for (let i = 0; i < 5; i++) {
      const panelGeometry = new THREE.PlaneGeometry(6, 4);
      const panelMaterial = new THREE.MeshPhongMaterial({
        color: 0x0088ff,
        transparent: true,
        opacity: 0.1,
        emissive: 0x001144,
        side: THREE.DoubleSide
      });
      
      const panel = new THREE.Mesh(panelGeometry, panelMaterial);
      panel.position.set(
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 30,
        -8 + Math.random() * 16
      );
      panel.rotation.x = Math.random() * Math.PI * 0.3;
      panel.rotation.y = Math.random() * Math.PI;
      
      panel.userData = { 
        type: 'tech_panel',
        pulseSpeed: 0.02 + Math.random() * 0.03,
        originalOpacity: 0.1
      };
      
      panels.push(panel);
    }
    
    return panels;
  };

  const createFlowingWaves = () => {
    const waves = [];
    
    for (let i = 0; i < 3; i++) {
      const waveGeometry = new THREE.PlaneGeometry(30, 15, 15, 8);
      const waveMaterial = new THREE.MeshBasicMaterial({
        color: 0x0066cc,
        transparent: true,
        opacity: 0.08,
        wireframe: true,
        side: THREE.DoubleSide
      });
      
      const wave = new THREE.Mesh(waveGeometry, waveMaterial);
      wave.position.set(
        (Math.random() - 0.5) * 60,
        -15 + Math.random() * 10,
        -10 + Math.random() * 20
      );
      wave.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      
      wave.userData = { 
        type: 'flowing_wave',
        waveSpeed: 0.01 + Math.random() * 0.02,
        originalPositions: [...wave.geometry.attributes.position.array]
      };
      
      waves.push(wave);
    }
    
    return waves;
  };

  const updateBackgroundForView = () => {
    if (!backgroundElementsRef.current.length) return;

    switch (currentView) {
      case 'results':
        if (selectedColumn === 'analyze' || window.location.hash === '#analyze') {
          transformToAnalyzeLogo();
        } else {
          transformToTicketVisualization();
        }
        break;
      case 'dashboard':
      default:
        transformToDefaultState();
        break;
    }

    // Handle loading states
    if (isLoading) {
      addLoadingEffects();
    }
  };

  const transformToAnalyzeLogo = () => {
    // Transform background elements into ANALYZE logo formation
    backgroundElementsRef.current.forEach((element, index) => {
      if (element.userData.type === 'binary_stream') {
        // Form "ANALYZE" text shape
        animateToPosition(element, {
          x: -15 + (index % 7) * 5,
          y: 0,
          z: 0
        }, 2000);
      }
      
      if (element.userData.type === 'holo_grid') {
        // Create analytical chart-like formations
        animateToPosition(element, {
          x: (index - 2) * 8,
          y: -5,
          z: -3
        }, 2000);
        element.rotation.x = 0;
        element.rotation.y = 0;
      }
    });
  };

  const transformToSyncLogo = () => {
    // Transform background elements into SYNC logo/symbol
    backgroundElementsRef.current.forEach((element, index) => {
      if (element.userData.type === 'data_tube') {
        // Create circular sync symbol
        const angle = (index / 6) * Math.PI * 2;
        animateToPosition(element, {
          x: Math.cos(angle) * 10,
          y: Math.sin(angle) * 10,
          z: 0
        }, 1500);
      }
      
      if (element.userData.type === 'holo_wireframe') {
        // Create rotating sync indicators
        animateToPosition(element, {
          x: 0,
          y: 0,
          z: 0
        }, 1500);
      }
    });
  };

  const transformToTicketVisualization = () => {
    // Show ticket status representations
    if (analysisData) {
      const { summary } = analysisData;
      
      backgroundElementsRef.current.forEach((element, index) => {
        if (element.userData.type === 'tech_panel') {
          // Position panels to represent different ticket statuses
          if (index === 0) {
            // Matched tickets - green area
            animateToPosition(element, { x: -15, y: 5, z: -2 }, 1500);
            element.material.color.setHex(0x10b981);
          } else if (index === 1) {
            // Mismatched tickets - yellow area  
            animateToPosition(element, { x: 0, y: 5, z: -2 }, 1500);
            element.material.color.setHex(0xf59e0b);
          } else if (index === 2) {
            // Missing tickets - blue area
            animateToPosition(element, { x: 15, y: 5, z: -2 }, 1500);
            element.material.color.setHex(0x3b82f6);
          }
        }
      });
    }
  };

  const transformToDefaultState = () => {
    // Return all elements to their original positions
    backgroundElementsRef.current.forEach(element => {
      if (element.userData.originalPosition) {
        animateToPosition(element, element.userData.originalPosition, 2000);
      }
    });
  };

  const addLoadingEffects = () => {
    // Increase animation speeds and opacity during loading
    backgroundElementsRef.current.forEach(element => {
      if (element.material && element.material.transparent) {
        element.material.opacity = Math.min(element.material.opacity * 1.5, 0.8);
      }
    });
  };

  const animateToPosition = (element, targetPosition, duration = 1000) => {
    // Store original position if not already stored
    if (!element.userData.originalPosition) {
      element.userData.originalPosition = {
        x: element.position.x,
        y: element.position.y,
        z: element.position.z
      };
    }

    // Simple animation using requestAnimationFrame
    const startPosition = {
      x: element.position.x,
      y: element.position.y,
      z: element.position.z
    };
    
    const startTime = Date.now();
    
    const animateStep = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth easing function
      const easeInOut = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      element.position.x = startPosition.x + (targetPosition.x - startPosition.x) * easeInOut;
      element.position.y = startPosition.y + (targetPosition.y - startPosition.y) * easeInOut;
      element.position.z = startPosition.z + (targetPosition.z - startPosition.z) * easeInOut;
      
      if (progress < 1) {
        requestAnimationFrame(animateStep);
      }
    };
    
    animateStep();
  };

  const animate = () => {
    animationIdRef.current = requestAnimationFrame(animate);
    
    const time = Date.now() * 0.001;
    const mouse = mouseRef.current;
    
    // Mouse-responsive background elements
    backgroundElementsRef.current.forEach(element => {
      switch (element.userData.type) {
        case 'binary_stream':
          element.rotation.y += element.userData.speed;
          if (element.material.opacity) {
            element.material.opacity = 0.4 + Math.sin(time * 2) * 0.2;
          }
          // Mouse responsiveness
          element.position.x += mouse.normalizedX * 0.5;
          element.position.y += mouse.normalizedY * 0.3;
          break;
          
        case 'data_tube':
          // Animate flowing particles
          const flow = element.children[0];
          if (flow && flow.userData.type === 'tube_flow') {
            flow.userData.progress += 0.02;
            if (flow.userData.progress > 1) flow.userData.progress = 0;
            
            // Update particle positions along curve
            const positions = flow.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
              const t = ((i / 3) / (positions.length / 3) + flow.userData.progress) % 1;
              const point = flow.userData.curve.getPoint(t);
              positions[i] = point.x;
              positions[i + 1] = point.y;
              positions[i + 2] = point.z;
            }
            flow.geometry.attributes.position.needsUpdate = true;
          }
          // Mouse responsiveness
          element.rotation.z += mouse.normalizedX * 0.001;
          break;
          
        case 'holo_grid':
          element.rotation.x += element.userData.rotationSpeed;
          element.rotation.y += element.userData.rotationSpeed * 0.7;
          if (element.material.opacity) {
            element.material.opacity = 0.1 + Math.sin(time + element.id) * 0.05;
          }
          // Mouse responsiveness - grids follow mouse subtly
          element.rotation.x += mouse.normalizedY * 0.002;
          element.rotation.y += mouse.normalizedX * 0.002;
          break;
          
        case 'holo_wireframe':
          element.rotation.x += element.userData.rotationSpeed;
          element.rotation.z += element.userData.rotationSpeed * 0.5;
          // Mouse responsiveness
          element.position.x += Math.sin(mouse.normalizedX * Math.PI) * 0.5;
          element.position.y += Math.sin(mouse.normalizedY * Math.PI) * 0.3;
          break;
          
        case 'tech_panel':
          if (element.material.opacity && element.userData.originalOpacity) {
            element.material.opacity = element.userData.originalOpacity + 
              Math.sin(time * element.userData.pulseSpeed) * 0.05;
          }
          element.rotation.y += 0.003;
          // Mouse responsiveness - panels tilt toward mouse
          element.rotation.x = mouse.normalizedY * 0.1;
          element.rotation.y += mouse.normalizedX * 0.05;
          break;
          
        case 'flowing_wave':
          // Animate wave vertices
          if (element.userData.originalPositions) {
            const positions = element.geometry.attributes.position.array;
            const originalPositions = element.userData.originalPositions;
            
            for (let i = 0; i < positions.length; i += 3) {
              const x = originalPositions[i];
              const z = originalPositions[i + 2];
              positions[i + 1] = originalPositions[i + 1] + 
                Math.sin(x * 0.1 + time * element.userData.waveSpeed + mouse.normalizedX) * 
                Math.cos(z * 0.1 + time * element.userData.waveSpeed + mouse.normalizedY) * 2;
            }
            element.geometry.attributes.position.needsUpdate = true;
          }
          break;
      }
    });
    
    // Camera slight movement based on mouse
    if (cameraRef.current) {
      cameraRef.current.position.x += (mouse.normalizedX * 2 - cameraRef.current.position.x) * 0.02;
      cameraRef.current.position.y += (-mouse.normalizedY * 2 - cameraRef.current.position.y) * 0.02;
      cameraRef.current.lookAt(0, 0, 0);
    }
    
    // Render the scene
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
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
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none'
      }}
    />
  );
};

export default ThreeBackground;