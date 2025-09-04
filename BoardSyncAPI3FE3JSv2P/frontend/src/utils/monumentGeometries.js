import * as THREE from 'three';

/**
 * Single Particle Galaxy - Complete Implementation
 */

// Enhanced material creation
export const createCreativeMaterial = (color, roughness = 0.3, metalness = 0.2, opacity = 0.8) => {
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: roughness,
    metalness: metalness,
    transparent: opacity < 1.0,
    opacity: opacity,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(color).multiplyScalar(0.1)
  });
};

// PARTICLE GALAXY - Single effect that fills the entire screen
export const createParticleGalaxy = (animationProgress = 1) => {
  const group = new THREE.Group();
  
  // Create galaxy arms
  const armCount = 4;
  const particlesPerArm = 200;
  const positions = [];
  const colors = [];
  const sizes = [];
  
  for (let arm = 0; arm < armCount; arm++) {
    for (let i = 0; i < particlesPerArm; i++) {
      // Galaxy arm parameters
      const t = i / particlesPerArm;
      const armAngle = (arm / armCount) * Math.PI * 2;
      const spiralAngle = armAngle + t * Math.PI * 4;
      
      // Create spiral galaxy shape
      const radius = t * 80 + Math.random() * 20;
      const x = Math.cos(spiralAngle) * radius + (Math.random() - 0.5) * 10;
      const z = Math.sin(spiralAngle) * radius + (Math.random() - 0.5) * 10;
      const y = (Math.random() - 0.5) * 30 + Math.sin(t * Math.PI * 2) * 5;
      
      positions.push(x, y, z);
      
      // Create colorful galaxy colors (blues, purples, pinks, whites)
      let hue, saturation, lightness;
      
      if (Math.random() < 0.3) {
        // Core stars - bright white/yellow
        hue = 0.1 + Math.random() * 0.1;
        saturation = 0.3 + Math.random() * 0.4;
        lightness = 0.8 + Math.random() * 0.2;
      } else if (Math.random() < 0.6) {
        // Blue stars
        hue = 0.6 + Math.random() * 0.1;
        saturation = 0.7 + Math.random() * 0.3;
        lightness = 0.5 + Math.random() * 0.4;
      } else {
        // Purple/pink nebula colors
        hue = 0.8 + Math.random() * 0.15;
        saturation = 0.6 + Math.random() * 0.4;
        lightness = 0.4 + Math.random() * 0.4;
      }
      
      const color = new THREE.Color().setHSL(hue, saturation, lightness);
      colors.push(color.r, color.g, color.b);
      
      // Vary particle sizes
      const size = 0.5 + Math.random() * 2.0;
      sizes.push(size);
    }
  }
  
  // Add central black hole effect
  for (let i = 0; i < 50; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 8;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = (Math.random() - 0.5) * 4;
    
    positions.push(x, y, z);
    
    // Dark center colors
    const color = new THREE.Color().setHSL(0.1, 0.8, 0.1 + Math.random() * 0.3);
    colors.push(color.r, color.g, color.b);
    sizes.push(0.2 + Math.random() * 0.8);
  }
  
  // Create geometry
  const galaxyGeometry = new THREE.BufferGeometry();
  galaxyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  galaxyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  galaxyGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  
  // Create shader material for better particle rendering
  const galaxyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      opacity: { value: 0.15 * animationProgress }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vSize;
      uniform float time;
      
      void main() {
        vColor = color;
        vSize = size;
        
        vec3 pos = position;
        
        // Add some movement
        pos.y += sin(time * 0.5 + position.x * 0.01) * 2.0;
        pos.x += cos(time * 0.3 + position.z * 0.01) * 1.0;
        
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vSize;
      uniform float opacity;
      
      void main() {
        float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
        float alpha = 1.0 - smoothstep(0.0, 0.5, distanceToCenter);
        
        gl_FragColor = vec4(vColor, alpha * opacity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true
  });
  
  const galaxy = new THREE.Points(galaxyGeometry, galaxyMaterial);
  group.add(galaxy);
  
  // Store material for time uniform updates
  group.userData = { material: galaxyMaterial };
  
  return group;
};

// Element configuration - only particle galaxy
export const getElementCycle = () => {
  return [
    { 
      type: 'particle_galaxy', 
      name: 'Particle Galaxy',
      position: { x: 0, y: 0, z: -40 }, 
      scale: 1.0,
      displayDuration: 999999999 // Never change - permanent display
    }
  ];
};

// Get current element - always returns galaxy
export const getCurrentElement = (elapsedTime, phase) => {
  if (phase !== 'elements' && phase !== 'steady') return null;
  
  const cycle = getElementCycle();
  return {
    ...cycle[0],
    progress: 1, // Always fully visible
    isTransitioning: false
  };
};

// Element creation factory
export const createCreativeElement = (type, animationProgress = 1) => {
  switch (type) {
    case 'particle_galaxy':
      return createParticleGalaxy(animationProgress);
    default:
      return new THREE.Group();
  }
};
