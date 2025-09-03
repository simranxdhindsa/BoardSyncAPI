import * as THREE from 'three';

/**
 * Architectural Monument Geometries for Background Elements
 * Light-themed wireframe models of famous buildings and structures
 */

export const createBurjKhalifaGeometry = () => {
  const points = [];
  
  // Base structure - tapering tower
  const height = 15;
  const segments = 20;
  
  for (let i = 0; i <= segments; i++) {
    const y = (i / segments) * height - height / 2;
    const radius = Math.max(0.2, (1 - i / segments) * 1.5); // Tapering effect
    
    // Create octagonal cross-section
    for (let j = 0; j < 8; j++) {
      const angle = (j / 8) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      points.push(new THREE.Vector3(x, y, z));
      
      // Connect to next level
      if (i > 0) {
        const prevIndex = (i - 1) * 8 + j;
        const currentIndex = i * 8 + j;
        // Vertical lines will be connected in the line segments
      }
      
      // Connect around the circumference
      if (j < 7) {
        // Horizontal lines will be connected in the line segments
      } else {
        // Connect last to first
      }
    }
  }
  
  // Create line segments for the structure
  const lineGeometry = new THREE.BufferGeometry();
  const positions = [];
  
  // Vertical lines
  for (let j = 0; j < 8; j++) {
    for (let i = 0; i < segments; i++) {
      const currentLevel = i * 8 + j;
      const nextLevel = (i + 1) * 8 + j;
      
      positions.push(
        points[currentLevel].x, points[currentLevel].y, points[currentLevel].z,
        points[nextLevel].x, points[nextLevel].y, points[nextLevel].z
      );
    }
  }
  
  // Horizontal lines
  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j < 8; j++) {
      const current = i * 8 + j;
      const next = i * 8 + ((j + 1) % 8);
      
      positions.push(
        points[current].x, points[current].y, points[current].z,
        points[next].x, points[next].y, points[next].z
      );
    }
  }
  
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return lineGeometry;
};

export const createEiffelTowerGeometry = () => {
  const points = [];
  const positions = [];
  
  const height = 12;
  const baseWidth = 3;
  
  // Create the iconic Eiffel Tower structure
  const levels = [
    { y: -height/2, width: baseWidth },
    { y: -height/3, width: baseWidth * 0.8 },
    { y: 0, width: baseWidth * 0.6 },
    { y: height/3, width: baseWidth * 0.4 },
    { y: height/2, width: 0.2 }
  ];
  
  // Create tower legs and cross-bracing
  for (let i = 0; i < levels.length - 1; i++) {
    const currentLevel = levels[i];
    const nextLevel = levels[i + 1];
    
    // Four corner legs
    for (let corner = 0; corner < 4; corner++) {
      const angle = (corner / 4) * Math.PI * 2 + Math.PI / 4;
      
      const x1 = Math.cos(angle) * currentLevel.width / 2;
      const z1 = Math.sin(angle) * currentLevel.width / 2;
      const x2 = Math.cos(angle) * nextLevel.width / 2;
      const z2 = Math.sin(angle) * nextLevel.width / 2;
      
      // Vertical leg segments
      positions.push(
        x1, currentLevel.y, z1,
        x2, nextLevel.y, z2
      );
      
      // Cross-bracing between legs
      if (corner < 3) {
        const nextAngle = ((corner + 1) / 4) * Math.PI * 2 + Math.PI / 4;
        const nx1 = Math.cos(nextAngle) * currentLevel.width / 2;
        const nz1 = Math.sin(nextAngle) * currentLevel.width / 2;
        
        positions.push(
          x1, currentLevel.y, z1,
          nx1, currentLevel.y, nz1
        );
      } else {
        // Connect last to first
        const firstAngle = Math.PI / 4;
        const fx1 = Math.cos(firstAngle) * currentLevel.width / 2;
        const fz1 = Math.sin(firstAngle) * currentLevel.width / 2;
        
        positions.push(
          x1, currentLevel.y, z1,
          fx1, currentLevel.y, fz1
        );
      }
    }
  }
  
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return lineGeometry;
};

export const createModernSkyscraperGeometry = (height = 10, width = 2) => {
  const positions = [];
  
  // Simple rectangular tower with details
  const floors = Math.floor(height / 0.5);
  
  // Main structure
  const corners = [
    [-width/2, 0, -width/2],
    [width/2, 0, -width/2], 
    [width/2, 0, width/2],
    [-width/2, 0, width/2]
  ];
  
  // Vertical edges
  corners.forEach(corner => {
    positions.push(
      corner[0], -height/2, corner[2],
      corner[0], height/2, corner[2]
    );
  });
  
  // Horizontal floor lines
  for (let floor = 0; floor < floors; floor++) {
    const y = -height/2 + (floor / floors) * height;
    
    // Floor outline
    for (let i = 0; i < corners.length; i++) {
      const current = corners[i];
      const next = corners[(i + 1) % corners.length];
      
      positions.push(
        current[0], y, current[2],
        next[0], y, next[2]
      );
    }
  }
  
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return lineGeometry;
};

export const createBridgeGeometry = () => {
  const positions = [];
  const span = 20;
  const height = 4;
  const towers = 6;
  
  // Main bridge deck
  positions.push(
    -span/2, -2, 0,
    span/2, -2, 0
  );
  
  // Support towers
  for (let i = 0; i < towers; i++) {
    const x = -span/2 + (i / (towers - 1)) * span;
    
    positions.push(
      x, -2, 0,
      x, height - 2, 0
    );
    
    // Suspension cables
    if (i > 0 && i < towers - 1) {
      const prevX = -span/2 + ((i - 1) / (towers - 1)) * span;
      const nextX = -span/2 + ((i + 1) / (towers - 1)) * span;
      
      // Curved cable effect (simplified as straight lines)
      positions.push(
        prevX, height - 2, 0,
        x, height - 2, 0
      );
      positions.push(
        x, height - 2, 0,
        nextX, height - 2, 0
      );
    }
  }
  
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return lineGeometry;
};

export const createTajMahalGeometry = () => {
  const positions = [];
  
  // Central dome (simplified as wireframe sphere)
  const radius = 3;
  const segments = 16;
  
  // Vertical meridians
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    
    for (let j = 0; j < segments; j++) {
      const phi1 = (j / segments) * Math.PI;
      const phi2 = ((j + 1) / segments) * Math.PI;
      
      const x1 = Math.sin(phi1) * Math.cos(angle) * radius;
      const y1 = Math.cos(phi1) * radius;
      const z1 = Math.sin(phi1) * Math.sin(angle) * radius;
      
      const x2 = Math.sin(phi2) * Math.cos(angle) * radius;
      const y2 = Math.cos(phi2) * radius;
      const z2 = Math.sin(phi2) * Math.sin(angle) * radius;
      
      positions.push(x1, y1, z1, x2, y2, z2);
    }
  }
  
  // Horizontal parallels
  for (let j = 0; j < segments; j++) {
    const phi = (j / segments) * Math.PI;
    const r = Math.sin(phi) * radius;
    const y = Math.cos(phi) * radius;
    
    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;
      
      const x1 = Math.cos(angle1) * r;
      const z1 = Math.sin(angle1) * r;
      const x2 = Math.cos(angle2) * r;
      const z2 = Math.sin(angle2) * r;
      
      positions.push(x1, y, z1, x2, y, z2);
    }
  }
  
  // Minarets (simplified towers at corners)
  const minaretPositions = [
    [-6, 0, -6], [6, 0, -6], [6, 0, 6], [-6, 0, 6]
  ];
  
  minaretPositions.forEach(pos => {
    positions.push(
      pos[0], -3, pos[2],
      pos[0], 8, pos[2]
    );
  });
  
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return lineGeometry;
};

export const createiPhoneGeometry = () => {
  const positions = [];
  
  // iPhone outline (simplified rectangular form)
  const width = 3;
  const height = 6;
  const depth = 0.3;
  const cornerRadius = 0.5;
  
  // Main body outline
  const bodyPoints = [
    [-width/2 + cornerRadius, -height/2, 0],
    [width/2 - cornerRadius, -height/2, 0],
    [width/2, -height/2 + cornerRadius, 0],
    [width/2, height/2 - cornerRadius, 0],
    [width/2 - cornerRadius, height/2, 0],
    [-width/2 + cornerRadius, height/2, 0],
    [-width/2, height/2 - cornerRadius, 0],
    [-width/2, -height/2 + cornerRadius, 0]
  ];
  
  // Connect body outline
  for (let i = 0; i < bodyPoints.length; i++) {
    const current = bodyPoints[i];
    const next = bodyPoints[(i + 1) % bodyPoints.length];
    positions.push(
      current[0], current[1], current[2],
      next[0], next[1], next[2]
    );
  }
  
  // Screen outline (inner rectangle)
  const screenMargin = 0.3;
  const screenPoints = [
    [-width/2 + screenMargin, -height/2 + screenMargin * 2, 0.01],
    [width/2 - screenMargin, -height/2 + screenMargin * 2, 0.01],
    [width/2 - screenMargin, height/2 - screenMargin, 0.01],
    [-width/2 + screenMargin, height/2 - screenMargin, 0.01]
  ];
  
  for (let i = 0; i < screenPoints.length; i++) {
    const current = screenPoints[i];
    const next = screenPoints[(i + 1) % screenPoints.length];
    positions.push(
      current[0], current[1], current[2],
      next[0], next[1], next[2]
    );
  }
  
  // Home button (circle)
  const buttonRadius = 0.2;
  const buttonSegments = 12;
  const buttonY = -height/2 + screenMargin;
  
  for (let i = 0; i < buttonSegments; i++) {
    const angle1 = (i / buttonSegments) * Math.PI * 2;
    const angle2 = ((i + 1) / buttonSegments) * Math.PI * 2;
    
    positions.push(
      Math.cos(angle1) * buttonRadius, buttonY, 0.01,
      Math.cos(angle2) * buttonRadius, buttonY, 0.01
    );
  }
  
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return lineGeometry;
};

// Monument positioning helper
export const getMonumentPositions = () => {
  return {
    burjKhalifa: { x: 25, y: 0, z: -10, scale: 1.2 },
    eiffelTower: { x: -25, y: 0, z: -15, scale: 1.0 },
    modernBuilding1: { x: 35, y: 0, z: 5, scale: 0.8 },
    modernBuilding2: { x: -35, y: 0, z: 8, scale: 1.1 },
    modernBuilding3: { x: 20, y: 0, z: 20, scale: 0.9 },
    bridge: { x: 0, y: -8, z: -25, scale: 1.5 },
    tajMahal: { x: 0, y: 0, z: -30, scale: 0.7 },
    iPhone: { x: 0, y: 0, z: 0, scale: 1.0 } // Center position for analysis mode
  };
};

// Material creation helper
export const createMonumentMaterial = (hovered = false) => {
  return new THREE.LineBasicMaterial({
    color: hovered ? 0x3b82f6 : 0xe2e8f0, // Blue when hovered, light gray default
    transparent: true,
    opacity: hovered ? 0.8 : 0.4,
    linewidth: hovered ? 2 : 1
  });
};