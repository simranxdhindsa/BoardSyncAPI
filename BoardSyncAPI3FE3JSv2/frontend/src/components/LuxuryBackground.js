import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const LuxuryBackground = ({ currentView, analysisData, selectedColumn, isLoading }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const animationIdRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, normalizedX: 0, normalizedY: 0 });
  const sculptureRef = useRef(null);
  const lightRef = useRef(null);
  const currentFormRef = useRef(0);
  const morphProgressRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const lastViewRef = useRef('');
  const lastColumnRef = useRef('');
  
  // State for CSS class interactions
  const [isMouseActive, setIsMouseActive] = useState(false);
  const [currentSculptureType, setCurrentSculptureType] = useState('mobius');

  // Expanded sculpture library with more variety
  const sculptureLibrary = [
    {
      name: 'mobius',
      material: { metalness: 0.1, roughness: 0.2, color: 0xe2e8f0 },
      animation: 'twist',
      displayName: 'Möbius Form'
    },
    {
      name: 'ribbon',
      material: { metalness: 0.05, roughness: 0.1, color: 0x3b82f6, transparent: true, opacity: 0.6 },
      animation: 'flow',
      displayName: 'Flowing Ribbon'
    },
    {
      name: 'crystal',
      material: { metalness: 0.0, roughness: 0.0, color: 0x06b6d4, transmission: 0.8, transparent: true, opacity: 0.7 },
      animation: 'pulse',
      displayName: 'Crystal Formation'
    },
    {
      name: 'helix',
      material: { metalness: 0.2, roughness: 0.3, color: 0x64748b },
      animation: 'spiral',
      displayName: 'DNA Helix'
    },
    {
      name: 'orb',
      material: { metalness: 0.1, roughness: 0.4, color: 0x94a3b8 },
      animation: 'breathe',
      displayName: 'Breathing Orb'
    },
    {
      name: 'torus',
      material: { metalness: 0.3, roughness: 0.2, color: 0x8b5cf6 },
      animation: 'spin',
      displayName: 'Cosmic Torus'
    },
    {
      name: 'knot',
      material: { metalness: 0.15, roughness: 0.25, color: 0x10b981 },
      animation: 'rotate',
      displayName: 'Trefoil Knot'
    },
    {
      name: 'wave',
      material: { metalness: 0.05, roughness: 0.1, color: 0xf59e0b, transparent: true, opacity: 0.8 },
      animation: 'wave',
      displayName: 'Wave Surface'
    },
    {
      name: 'spline',
      material: { metalness: 0.2, roughness: 0.15, color: 0xef4444 },
      animation: 'undulate',
      displayName: 'Spline Curve'
    },
    {
      name: 'polyhedron',
      material: { metalness: 0.4, roughness: 0.3, color: 0x06b6d4 },
      animation: 'morph',
      displayName: 'Morphing Polyhedron'
    }
  ];

  // Random sculpture selection logic
  const getRandomSculptureIndex = () => {
    return Math.floor(Math.random() * sculptureLibrary.length);
  };

  // Check if navigation has changed
  const hasNavigationChanged = () => {
    const viewChanged = currentView !== lastViewRef.current;
    const columnChanged = selectedColumn !== lastColumnRef.current;
    
    // Update refs
    lastViewRef.current = currentView;
    lastColumnRef.current = selectedColumn;
    
    return viewChanged || columnChanged;
  };

  // Enhanced geometry creation functions
  const createMobiusGeometry = () => {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const uvs = [];
    const normals = [];
    
    const uSegments = 48;
    const vSegments = 24;
    const radius = 2.5;
    const width = 1.5;
    
    for (let i = 0; i <= uSegments; i++) {
      for (let j = 0; j <= vSegments; j++) {
        const u = i / uSegments;
        const v = (j / vSegments) - 0.5;
        
        const angle = u * Math.PI * 2;
        
        const x = (radius + width * Math.cos(angle / 2) * v) * Math.cos(angle);
        const y = (radius + width * Math.cos(angle / 2) * v) * Math.sin(angle);
        const z = width * Math.sin(angle / 2) * v;
        
        vertices.push(x, y, z);
        uvs.push(u, v + 0.5);
        
        const normal = new THREE.Vector3(x, y, z).normalize();
        normals.push(normal.x, normal.y, normal.z);
      }
    }
    
    for (let i = 0; i < uSegments; i++) {
      for (let j = 0; j < vSegments; j++) {
        const a = i * (vSegments + 1) + j;
        const b = a + vSegments + 1;
        const c = a + 1;
        const d = b + 1;
        
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
  };

  const createRibbonGeometry = () => {
    const points = [];
    const segments = 80;
    const width = 0.6;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI * 3;
      const radius = 2.5 + Math.sin(t * Math.PI * 4) * 0.3;
      const height = Math.sin(t * Math.PI * 1.5) * 1.5;
      
      const x = Math.cos(angle) * radius;
      const y = height;
      const z = Math.sin(angle) * radius;
      
      points.push(new THREE.Vector3(x, y, z));
    }
    
    const curve = new THREE.CatmullRomCurve3(points);
    curve.closed = true;
    
    return new THREE.TubeGeometry(curve, 80, width, 6, true);
  };

  const createCrystalGeometry = () => {
    const geometry = new THREE.IcosahedronGeometry(2.5, 1);
    
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      const noise = (Math.random() - 0.5) * 0.1;
      vertices[i] *= 1 + noise;
      vertices[i + 1] *= 1 + noise;
      vertices[i + 2] *= 1 + noise;
    }
    
    geometry.computeVertexNormals();
    return geometry;
  };

  const createHelixGeometry = () => {
    const points = [];
    const segments = 150;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI * 6;
      const radius = 2 + Math.sin(t * Math.PI * 2) * 0.3;
      const height = (t - 0.5) * 6;
      
      const x = Math.cos(angle) * radius;
      const y = height;
      const z = Math.sin(angle) * radius;
      
      points.push(new THREE.Vector3(x, y, z));
    }
    
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 150, 0.25, 6, false);
  };

  const createOrbGeometry = () => {
    const geometry = new THREE.SphereGeometry(2.5, 48, 32);
    
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      const vertex = new THREE.Vector3(vertices[i], vertices[i + 1], vertices[i + 2]);
      const distance = vertex.length();
      
      const noise1 = Math.sin(vertex.x * 1.5) * Math.cos(vertex.y * 1.5) * 0.05;
      const noise2 = Math.sin(vertex.z * 2) * 0.025;
      const deformation = 1 + noise1 + noise2;
      
      vertex.normalize().multiplyScalar(distance * deformation);
      
      vertices[i] = vertex.x;
      vertices[i + 1] = vertex.y;
      vertices[i + 2] = vertex.z;
    }
    
    geometry.computeVertexNormals();
    return geometry;
  };

  // NEW: Additional geometry types
  const createTorusGeometry = () => {
    return new THREE.TorusGeometry(2, 0.8, 12, 24);
  };

  const createKnotGeometry = () => {
    return new THREE.TorusKnotGeometry(2, 0.6, 64, 12, 2, 3);
  };

  const createWaveGeometry = () => {
    const geometry = new THREE.PlaneGeometry(5, 5, 32, 32);
    const vertices = geometry.attributes.position.array;
    
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      vertices[i + 2] = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 0.8;
    }
    
    geometry.computeVertexNormals();
    return geometry;
  };

  const createSplineGeometry = () => {
    const points = [];
    const segments = 100;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = Math.sin(t * Math.PI * 4) * 3;
      const y = Math.cos(t * Math.PI * 3) * 2;
      const z = Math.sin(t * Math.PI * 2) * 1.5;
      
      points.push(new THREE.Vector3(x, y, z));
    }
    
    const curve = new THREE.CatmullRomCurve3(points);
    curve.closed = true;
    
    return new THREE.TubeGeometry(curve, 100, 0.3, 8, true);
  };

  const createPolyhedronGeometry = () => {
    // Randomly choose between different polyhedron types
    const types = [
      () => new THREE.DodecahedronGeometry(2.5),
      () => new THREE.OctahedronGeometry(2.8),
      () => new THREE.TetrahedronGeometry(3),
      () => new THREE.IcosahedronGeometry(2.5, 1)
    ];
    
    const randomType = types[Math.floor(Math.random() * types.length)];
    return randomType();
  };

  const createGeometry = (type) => {
    switch (type) {
      case 'mobius': return createMobiusGeometry();
      case 'ribbon': return createRibbonGeometry();
      case 'crystal': return createCrystalGeometry();
      case 'helix': return createHelixGeometry();
      case 'orb': return createOrbGeometry();
      case 'torus': return createTorusGeometry();
      case 'knot': return createKnotGeometry();
      case 'wave': return createWaveGeometry();
      case 'spline': return createSplineGeometry();
      case 'polyhedron': return createPolyhedronGeometry();
      default: return createMobiusGeometry();
    }
  };

  const createMaterial = (config) => {
    const physicalMaterial = new THREE.MeshPhysicalMaterial({
      color: config.color,
      metalness: config.metalness,
      roughness: config.roughness,
      transparent: config.transparent || false,
      opacity: config.opacity || 1.0,
      transmission: config.transmission || 0,
      thickness: 0.3,
      envMapIntensity: 1.0,
      clearcoat: 0.2,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide
    });
    
    return physicalMaterial;
  };

  const createSculpture = (formIndex) => {
    const form = sculptureLibrary[formIndex];
    const geometry = createGeometry(form.name);
    const material = createMaterial(form.material);
    
    const sculpture = new THREE.Mesh(geometry, material);
    sculpture.userData = {
      formType: form.name,
      animationType: form.animation,
      time: 0,
      baseRotation: { x: 0, y: 0, z: 0 }
    };
    
    return sculpture;
  };

  const morphToNewForm = (targetFormIndex) => {
    if (isTransitioningRef.current) return;
    
    isTransitioningRef.current = true;
    setCurrentSculptureType(sculptureLibrary[targetFormIndex].name);
    
    console.log(`🎨 Morphing to: ${sculptureLibrary[targetFormIndex].displayName}`);
    
    // Trigger morphing indicator
    const morphingIndicator = document.querySelector('.sculpture-morphing-indicator');
    if (morphingIndicator) {
      morphingIndicator.classList.add('active');
    }
    
    const currentSculpture = sculptureRef.current;
    const newSculpture = createSculpture(targetFormIndex);
    
    newSculpture.position.copy(currentSculpture.position);
    newSculpture.rotation.copy(currentSculpture.rotation);
    newSculpture.material.opacity = 0;
    
    sceneRef.current.add(newSculpture);
    
    const transitionDuration = 2000; // Faster transitions for more dynamic feel
    const startTime = Date.now();
    
    const animateTransition = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / transitionDuration, 1);
      
      const easeInOut = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      currentSculpture.material.opacity = 1 - easeInOut;
      
      if (newSculpture.material.transparent || sculptureLibrary[targetFormIndex].material.transparent) {
        newSculpture.material.opacity = easeInOut * (sculptureLibrary[targetFormIndex].material.opacity || 1);
      } else {
        newSculpture.material.opacity = easeInOut;
      }
      
      // Add dynamic rotation during transition
      currentSculpture.rotation.y += 0.008;
      newSculpture.rotation.y += 0.008;
      currentSculpture.rotation.x += 0.003;
      newSculpture.rotation.x += 0.003;
      
      if (progress < 1) {
        requestAnimationFrame(animateTransition);
      } else {
        sceneRef.current.remove(currentSculpture);
        currentSculpture.geometry.dispose();
        currentSculpture.material.dispose();
        
        sculptureRef.current = newSculpture;
        currentFormRef.current = targetFormIndex;
        isTransitioningRef.current = false;
        
        // Remove morphing indicator
        if (morphingIndicator) {
          morphingIndicator.classList.remove('active');
        }
      }
    };
    
    animateTransition();
  };

  const updateSculptureAnimation = (sculpture, time) => {
    if (!sculpture || !sculpture.userData) return;
    
    const { animationType } = sculpture.userData;
    sculpture.userData.time = time;
    
    sculpture.rotation.y += 0.002;
    
    switch (animationType) {
      case 'twist':
        sculpture.rotation.x = Math.sin(time * 0.0003) * 0.03;
        sculpture.rotation.z = Math.cos(time * 0.0004) * 0.02;
        break;
        
      case 'flow':
        sculpture.rotation.x = Math.sin(time * 0.0004) * 0.05;
        sculpture.position.y = Math.sin(time * 0.0006) * 0.15;
        break;
        
      case 'pulse':
        const pulse = 1 + Math.sin(time * 0.0015) * 0.03;
        sculpture.scale.setScalar(pulse);
        break;
        
      case 'spiral':
        sculpture.rotation.x += 0.0008;
        sculpture.rotation.z = Math.sin(time * 0.0005) * 0.03;
        break;
        
      case 'breathe':
        const breathe = 1 + Math.sin(time * 0.0012) * 0.025;
        sculpture.scale.setScalar(breathe);
        sculpture.rotation.x = Math.sin(time * 0.0003) * 0.02;
        break;
        
      // NEW: Additional animation types
      case 'spin':
        sculpture.rotation.x += 0.004;
        sculpture.rotation.z += 0.002;
        break;
        
      case 'rotate':
        sculpture.rotation.x += 0.003;
        sculpture.rotation.y += 0.005;
        sculpture.rotation.z += 0.001;
        break;
        
      case 'wave':
        sculpture.rotation.x = Math.sin(time * 0.0008) * 0.1;
        sculpture.position.z = Math.cos(time * 0.0006) * 0.2;
        break;
        
      case 'undulate':
        sculpture.rotation.z = Math.sin(time * 0.0007) * 0.05;
        sculpture.position.y = Math.cos(time * 0.0005) * 0.1;
        break;
        
      case 'morph':
        const morph = 1 + Math.sin(time * 0.001) * 0.05;
        sculpture.scale.x = morph;
        sculpture.scale.y = 1 / morph;
        sculpture.scale.z = morph;
        sculpture.rotation.y += 0.003;
        break;
    }
    
    const mouse = mouseRef.current;
    sculpture.rotation.x += mouse.normalizedY * 0.01;
    sculpture.rotation.y += mouse.normalizedX * 0.01;
  };

  const setupEnvironment = () => {
    const scene = sceneRef.current;
    
    // Light theme gradient background
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.3, '#f8fafc');
    gradient.addColorStop(0.6, '#e2e8f0');
    gradient.addColorStop(0.8, '#cbd5e1');
    gradient.addColorStop(1, '#94a3b8');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    
    const texture = new THREE.CanvasTexture(canvas);
    scene.background = texture;
    
    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(10, 10, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0xf0f8ff, 0.3);
    fillLight.position.set(-8, 5, -6);
    scene.add(fillLight);
    
    const rimLight = new THREE.DirectionalLight(0xe6f3ff, 0.2);
    rimLight.position.set(-10, -3, 8);
    scene.add(rimLight);
    
    const accentLight = new THREE.PointLight(0x3b82f6, 0.2, 30);
    accentLight.position.set(0, 5, 12);
    lightRef.current = accentLight;
    scene.add(accentLight);
    
    // Create floating particles
    const particleCount = 12;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];
    
    for (let i = 0; i < particleCount; i++) {
      positions.push(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 30
      );
      velocities.push(
        (Math.random() - 0.5) * 0.01,
        (Math.random() - 0.5) * 0.008,
        (Math.random() - 0.5) * 0.01
      );
    }
    
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    particleGeometry.userData.velocities = velocities;
    
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x64748b,
      size: 0.02,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
    scene.userData.particles = particles;
  };

  // Update sculpture type indicator
  useEffect(() => {
    const indicator = document.querySelector('.sculpture-type-indicator');
    if (indicator && sculptureLibrary[currentFormRef.current]) {
      indicator.textContent = sculptureLibrary[currentFormRef.current].displayName;
    }
  }, [currentFormRef.current]);

  // MAIN EFFECT: Check for navigation changes and trigger random sculptures
  useEffect(() => {
    if (hasNavigationChanged() && sculptureRef.current) {
      const randomIndex = getRandomSculptureIndex();
      console.log(`🌟 Navigation changed! View: ${currentView}, Column: ${selectedColumn}`);
      console.log(`🎲 Random sculpture selected: ${sculptureLibrary[randomIndex].displayName} (${randomIndex})`);
      morphToNewForm(randomIndex);
    }
  }, [currentView, selectedColumn]);

  useEffect(() => {
    initScene();
    setupEnvironment();
    
    // Start with random sculpture
    const initialIndex = getRandomSculptureIndex();
    const initialSculpture = createSculpture(initialIndex);
    sceneRef.current.add(initialSculpture);
    sculptureRef.current = initialSculpture;
    currentFormRef.current = initialIndex;
    
    console.log(`🎨 Initial sculpture: ${sculptureLibrary[initialIndex].displayName}`);
    
    startAnimation();

    const handleMouseMove = (event) => {
      mouseRef.current = {
        normalizedX: (event.clientX / window.innerWidth) * 2 - 1,
        normalizedY: -(event.clientY / window.innerHeight) * 2 + 1
      };
      
      setIsMouseActive(true);
      clearTimeout(window.mouseInactiveTimeout);
      window.mouseInactiveTimeout = setTimeout(() => {
        setIsMouseActive(false);
      }, 2000);
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
      clearTimeout(window.mouseInactiveTimeout);
      cleanup();
    };
  }, []);

  const initScene = () => {
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xffffff, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    rendererRef.current = renderer;

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
      renderer.domElement.classList.add('luxury-high-performance', 'gpu-accelerated');
    }
  };

  const startAnimation = () => {
    animate();
  };

  const animate = () => {
    animationIdRef.current = requestAnimationFrame(animate);

    const time = Date.now();
    
    if (sculptureRef.current) {
      updateSculptureAnimation(sculptureRef.current, time);
    }
    
    if (lightRef.current) {
      lightRef.current.position.x = Math.sin(time * 0.0003) * 4;
      lightRef.current.position.z = Math.cos(time * 0.0004) * 6;
      lightRef.current.intensity = 0.2 + Math.sin(time * 0.0008) * 0.05;
    }
    
    if (sceneRef.current.userData.particles) {
      const particles = sceneRef.current.userData.particles;
      const positions = particles.geometry.attributes.position.array;
      const velocities = particles.geometry.userData.velocities;
      
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += velocities[i];
        positions[i + 1] += velocities[i + 1];
        positions[i + 2] += velocities[i + 2];
        
        if (Math.abs(positions[i]) > 15) velocities[i] *= -1;
        if (Math.abs(positions[i + 1]) > 10) velocities[i + 1] *= -1;
        if (Math.abs(positions[i + 2]) > 15) velocities[i + 2] *= -1;
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
    }
    
    if (cameraRef.current) {
      const mouse = mouseRef.current;
      const targetX = mouse.normalizedX * 0.5;
      const targetY = mouse.normalizedY * 0.3;
      
      cameraRef.current.position.x += (targetX - cameraRef.current.position.x) * 0.003;
      cameraRef.current.position.y += (targetY - cameraRef.current.position.y) * 0.003;
      cameraRef.current.lookAt(0, 0, 0);
    }

    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  const cleanup = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    
    if (sculptureRef.current) {
      sceneRef.current?.remove(sculptureRef.current);
      sculptureRef.current.geometry?.dispose();
      sculptureRef.current.material?.dispose();
    }
    
    if (rendererRef.current && mountRef.current && mountRef.current.contains(rendererRef.current.domElement)) {
      mountRef.current.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
    }
  };

  return (
    <>
      <div 
        ref={mountRef}
        className="luxury-high-performance gpu-accelerated"
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
      
      {/* Mouse interaction zone */}
      <div 
        className={`sculpture-interaction-zone ${isMouseActive ? 'active' : ''}`}
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      />
    </>
  );
};

export default LuxuryBackground;