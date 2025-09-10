import * as THREE from 'three';

/**
 * Fullscreen Monument Geometries - Enhanced and Detailed
 * Designed to fill the entire screen with impressive wireframe models
 */

export const createEnhancedBurjKhalifaGeometry = () => {
  const positions = [];
  const height = 25;
  const segments = 40;
  const baseRadius = 4;

  // Create the iconic stepped tapering structure
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = (t - 0.5) * height;
    
    // Complex tapering with multiple setbacks
    let radius = baseRadius;
    if (t > 0.3) radius *= (1 - (t - 0.3) * 0.8);
    if (t > 0.6) radius *= (1 - (t - 0.6) * 1.2);
    if (t > 0.8) radius *= (1 - (t - 0.8) * 2.0);
    
    // Y-shaped cross-section (3 wings)
    for (let wing = 0; wing < 3; wing++) {
      const baseAngle = (wing * Math.PI * 2) / 3;
      
      // Main wing structure
      for (let side = 0; side < 2; side++) {
        const angle = baseAngle + (side - 0.5) * 0.4;
        const wingRadius = radius * (1 - side * 0.3);
        
        const x = Math.cos(angle) * wingRadius;
        const z = Math.sin(angle) * wingRadius;
        
        // Vertical lines
        if (i > 0) {
          const prevY = ((i - 1) / segments - 0.5) * height;
          let prevRadius = baseRadius;
          const prevT = (i - 1) / segments;
          if (prevT > 0.3) prevRadius *= (1 - (prevT - 0.3) * 0.8);
          if (prevT > 0.6) prevRadius *= (1 - (prevT - 0.6) * 1.2);
          if (prevT > 0.8) prevRadius *= (1 - (prevT - 0.8) * 2.0);
          
          const prevWingRadius = prevRadius * (1 - side * 0.3);
          const prevX = Math.cos(angle) * prevWingRadius;
          const prevZ = Math.sin(angle) * prevWingRadius;
          
          positions.push(prevX, prevY, prevZ, x, y, z);
        }
        
        // Horizontal connections within wing
        if (side === 0) {
          const nextAngle = baseAngle + 0.4;
          const nextX = Math.cos(nextAngle) * radius * 0.7;
          const nextZ = Math.sin(nextAngle) * radius * 0.7;
          positions.push(x, y, z, nextX, y, nextZ);
        }
      }
      
      // Cross-bracing between wings every few levels
      if (i % 5 === 0 && i > 0) {
        const nextWingAngle = ((wing + 1) % 3 * Math.PI * 2) / 3;
        const wingX = Math.cos(baseAngle) * radius;
        const wingZ = Math.sin(baseAngle) * radius;
        const nextWingX = Math.cos(nextWingAngle) * radius;
        const nextWingZ = Math.sin(nextWingAngle) * radius;
        
        positions.push(wingX, y, wingZ, nextWingX, y, nextWingZ);
      }
    }
  }

  // Add spire details
  const spireHeight = height * 0.15;
  const spireSegments = 20;
  for (let i = 0; i < spireSegments; i++) {
    const t = i / spireSegments;
    const spireY = height * 0.5 + t * spireHeight;
    const nextSpireY = height * 0.5 + ((i + 1) / spireSegments) * spireHeight;
    
    positions.push(0, spireY, 0, 0, nextSpireY, 0);
    
    // Spire cross-bracing
    if (i % 3 === 0) {
      const spireRadius = 0.5 * (1 - t);
      for (let j = 0; j < 4; j++) {
        const angle = (j / 4) * Math.PI * 2;
        const x = Math.cos(angle) * spireRadius;
        const z = Math.sin(angle) * spireRadius;
        positions.push(0, spireY, 0, x, spireY, z);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
};

export const createEnhancedEiffelTowerGeometry = () => {
  const positions = [];
  const height = 20;
  const baseWidth = 8;
  
  // Define the four levels with accurate proportions
  const levels = [
    { y: -height/2, width: baseWidth, detail: true },
    { y: -height/4, width: baseWidth * 0.65, detail: true },
    { y: height/8, width: baseWidth * 0.4, detail: false },
    { y: height/2.5, width: baseWidth * 0.25, detail: false },
    { y: height/2, width: 0, detail: false }
  ];

  // Create the four main legs with cross-bracing
  for (let i = 0; i < levels.length - 1; i++) {
    const currentLevel = levels[i];
    const nextLevel = levels[i + 1];
    
    // Four corner legs
    for (let corner = 0; corner < 4; corner++) {
      const angle = (corner / 4) * Math.PI * 2 + Math.PI / 4;
      
      const x1 = Math.cos(angle) * currentLevel.width / 2;
      const z1 = Math.sin(angle) * currentLevel.width / 2;
      const x2 = nextLevel.width > 0 ? Math.cos(angle) * nextLevel.width / 2 : 0;
      const z2 = nextLevel.width > 0 ? Math.sin(angle) * nextLevel.width / 2 : 0;
      
      // Main leg segments
      positions.push(x1, currentLevel.y, z1, x2, nextLevel.y, z2);
      
      // Horizontal perimeter at each level
      const nextCorner = (corner + 1) % 4;
      const nextAngle = (nextCorner / 4) * Math.PI * 2 + Math.PI / 4;
      const nx1 = Math.cos(nextAngle) * currentLevel.width / 2;
      const nz1 = Math.sin(nextAngle) * currentLevel.width / 2;
      
      positions.push(x1, currentLevel.y, z1, nx1, currentLevel.y, nz1);
      
      // Detailed cross-bracing for first two levels
      if (currentLevel.detail) {
        // X-cross bracing
        const oppAngle = angle + Math.PI;
        const ox1 = Math.cos(oppAngle) * currentLevel.width / 2;
        const oz1 = Math.sin(oppAngle) * currentLevel.width / 2;
        
        // Diagonal braces
        const midY = (currentLevel.y + nextLevel.y) / 2;
        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;
        
        positions.push(x1, currentLevel.y, z1, midX, midY, midZ);
        positions.push(midX, midY, midZ, x2, nextLevel.y, z2);
        
        // Add intermediate horizontal bracing
        if (i === 0) {
          const segments = 8;
          for (let s = 1; s < segments; s++) {
            const segmentY = currentLevel.y + (s / segments) * (nextLevel.y - currentLevel.y);
            const segmentWidth = currentLevel.width * (1 - (s / segments) * 0.35);
            const sx = Math.cos(angle) * segmentWidth / 2;
            const sz = Math.sin(angle) * segmentWidth / 2;
            const snx = Math.cos(nextAngle) * segmentWidth / 2;
            const snz = Math.sin(nextAngle) * segmentWidth / 2;
            
            positions.push(sx, segmentY, sz, snx, segmentY, snz);
          }
        }
      }
    }
    
    // Add curved arch connections for the first level
    if (i === 0) {
      const archSegments = 20;
      for (let corner = 0; corner < 4; corner++) {
        const angle1 = (corner / 4) * Math.PI * 2 + Math.PI / 4;
        const angle2 = ((corner + 1) / 4) * Math.PI * 2 + Math.PI / 4;
        
        for (let s = 0; s < archSegments; s++) {
          const t1 = s / archSegments;
          const t2 = (s + 1) / archSegments;
          
          // Create curved arch
          const archHeight = height * 0.1;
          const arch1Y = currentLevel.y + Math.sin(t1 * Math.PI) * archHeight;
          const arch2Y = currentLevel.y + Math.sin(t2 * Math.PI) * archHeight;
          
          const lerpAngle1 = angle1 + (angle2 - angle1) * t1;
          const lerpAngle2 = angle1 + (angle2 - angle1) * t2;
          
          const ax1 = Math.cos(lerpAngle1) * currentLevel.width / 2;
          const az1 = Math.sin(lerpAngle1) * currentLevel.width / 2;
          const ax2 = Math.cos(lerpAngle2) * currentLevel.width / 2;
          const az2 = Math.sin(lerpAngle2) * currentLevel.width / 2;
          
          positions.push(ax1, arch1Y, az1, ax2, arch2Y, az2);
        }
      }
    }
  }

  // Add antenna/spire
  const antennaSegments = 15;
  const antennaHeight = height * 0.25;
  for (let i = 0; i < antennaSegments; i++) {
    const y1 = height/2 + (i / antennaSegments) * antennaHeight;
    const y2 = height/2 + ((i + 1) / antennaSegments) * antennaHeight;
    positions.push(0, y1, 0, 0, y2, 0);
    
    // Antenna support lines
    if (i % 3 === 0) {
      const supportRadius = 0.3 * (1 - i / antennaSegments);
      for (let j = 0; j < 6; j++) {
        const angle = (j / 6) * Math.PI * 2;
        const sx = Math.cos(angle) * supportRadius;
        const sz = Math.sin(angle) * supportRadius;
        positions.push(0, y1, 0, sx, y1, sz);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
};

export const createEnhancedPhoneGeometry = () => {
  const positions = [];
  const width = 6;
  const height = 12;
  const depth = 0.8;
  const cornerRadius = 1.5;
  
  // Main body outline with rounded corners
  const segments = 32;
  const bodyPoints = [];
  
  // Generate rounded rectangle points
  const corners = [
    { x: width/2 - cornerRadius, y: height/2 - cornerRadius },
    { x: -width/2 + cornerRadius, y: height/2 - cornerRadius },
    { x: -width/2 + cornerRadius, y: -height/2 + cornerRadius },
    { x: width/2 - cornerRadius, y: -height/2 + cornerRadius }
  ];
  
  corners.forEach((corner, cornerIndex) => {
    for (let i = 0; i <= segments/4; i++) {
      const angle = (cornerIndex * Math.PI/2) + (i / (segments/4)) * (Math.PI/2);
      const x = corner.x + Math.cos(angle) * cornerRadius;
      const y = corner.y + Math.sin(angle) * cornerRadius;
      bodyPoints.push({ x, y, z: depth/2 });
    }
  });

  // Connect body outline
  for (let i = 0; i < bodyPoints.length; i++) {
    const current = bodyPoints[i];
    const next = bodyPoints[(i + 1) % bodyPoints.length];
    positions.push(current.x, current.y, current.z, next.x, next.y, next.z);
    positions.push(current.x, current.y, -current.z, next.x, next.y, -next.z);
  }
  
  // Connect front and back faces
  bodyPoints.forEach(point => {
    positions.push(point.x, point.y, point.z, point.x, point.y, -point.z);
  });

  // Screen bezel (inner rectangle)
  const screenMargin = 0.8;
  const screenCornerRadius = 0.8;
  const screenWidth = width - screenMargin * 2;
  const screenHeight = height - screenMargin * 3;
  
  const screenCorners = [
    { x: screenWidth/2 - screenCornerRadius, y: screenHeight/2 - screenCornerRadius },
    { x: -screenWidth/2 + screenCornerRadius, y: screenHeight/2 - screenCornerRadius },
    { x: -screenWidth/2 + screenCornerRadius, y: -screenHeight/2 + screenCornerRadius },
    { x: screenWidth/2 - screenCornerRadius, y: -screenHeight/2 + screenCornerRadius }
  ];
  
  const screenPoints = [];
  screenCorners.forEach((corner, cornerIndex) => {
    for (let i = 0; i <= 8; i++) {
      const angle = (cornerIndex * Math.PI/2) + (i / 8) * (Math.PI/2);
      const x = corner.x + Math.cos(angle) * screenCornerRadius;
      const y = corner.y + Math.sin(angle) * screenCornerRadius;
      screenPoints.push({ x, y });
    }
  });
  
  // Screen outline
  for (let i = 0; i < screenPoints.length; i++) {
    const current = screenPoints[i];
    const next = screenPoints[(i + 1) % screenPoints.length];
    positions.push(current.x, current.y, depth/2 + 0.01, next.x, next.y, depth/2 + 0.01);
  }

  // Camera array (iPhone Pro style)
  const cameraSize = 0.8;
  const cameraPositions = [
    { x: -width/2 + 1.5, y: height/2 - 2, offset: { x: 0, y: 0 } },
    { x: -width/2 + 1.5, y: height/2 - 2, offset: { x: 0.8, y: 0 } },
    { x: -width/2 + 1.5, y: height/2 - 2, offset: { x: 0.4, y: -0.8 } }
  ];
  
  cameraPositions.forEach(cam => {
    const centerX = cam.x + cam.offset.x;
    const centerY = cam.y + cam.offset.y;
    const segments = 12;
    
    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;
      
      const x1 = centerX + Math.cos(angle1) * cameraSize / 2;
      const y1 = centerY + Math.sin(angle1) * cameraSize / 2;
      const x2 = centerX + Math.cos(angle2) * cameraSize / 2;
      const y2 = centerY + Math.sin(angle2) * cameraSize / 2;
      
      positions.push(x1, y1, depth/2 + 0.02, x2, y2, depth/2 + 0.02);
    }
  });

  // Side buttons and details
  const buttonPositions = [
    // Volume buttons
    { x: -width/2 - 0.02, y: height/4, width: 0.1, height: 1.2 },
    { x: -width/2 - 0.02, y: height/4 - 1.5, width: 0.1, height: 0.8 },
    // Power button
    { x: width/2 + 0.02, y: height/4, width: 0.1, height: 1.0 }
  ];
  
  buttonPositions.forEach(btn => {
    const corners = [
      { x: btn.x, y: btn.y + btn.height/2 },
      { x: btn.x, y: btn.y - btn.height/2 }
    ];
    positions.push(corners[0].x, corners[0].y, depth/2, corners[1].x, corners[1].y, depth/2);
    positions.push(corners[0].x, corners[0].y, -depth/2, corners[1].x, corners[1].y, -depth/2);
  });

  // Lightning port
  const portWidth = 1.2;
  const portHeight = 0.3;
  const portY = -height/2;
  
  const portCorners = [
    { x: -portWidth/2, y: portY },
    { x: portWidth/2, y: portY },
    { x: portWidth/2, y: portY + portHeight },
    { x: -portWidth/2, y: portY + portHeight }
  ];
  
  for (let i = 0; i < portCorners.length; i++) {
    const current = portCorners[i];
    const next = portCorners[(i + 1) % portCorners.length];
    positions.push(current.x, current.y, -depth/2 - 0.01, next.x, next.y, -depth/2 - 0.01);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
};

export const createEnhancedTajMahalGeometry = () => {
  const positions = [];
  
  // Central dome (detailed wireframe sphere)
  const domeRadius = 4;
  const domeSegments = 24;
  const domeRings = 16;
  
  // Main dome structure
  for (let ring = 0; ring < domeRings; ring++) {
    const phi1 = (ring / domeRings) * Math.PI;
    const phi2 = ((ring + 1) / domeRings) * Math.PI;
    const y1 = Math.cos(phi1) * domeRadius + 2;
    const y2 = Math.cos(phi2) * domeRadius + 2;
    const r1 = Math.sin(phi1) * domeRadius;
    const r2 = Math.sin(phi2) * domeRadius;
    
    for (let segment = 0; segment < domeSegments; segment++) {
      const angle1 = (segment / domeSegments) * Math.PI * 2;
      const angle2 = ((segment + 1) / domeSegments) * Math.PI * 2;
      
      // Meridians
      const x1 = Math.cos(angle1) * r1;
      const z1 = Math.sin(angle1) * r1;
      const x2 = Math.cos(angle1) * r2;
      const z2 = Math.sin(angle1) * r2;
      
      positions.push(x1, y1, z1, x2, y2, z2);
      
      // Parallels
      const x3 = Math.cos(angle2) * r1;
      const z3 = Math.sin(angle2) * r1;
      
      positions.push(x1, y1, z1, x3, y1, z3);
    }
  }

  // Four corner minarets with detailed spiral patterns
  const minaretPositions = [
    { x: -10, z: -10 }, { x: 10, z: -10 }, { x: 10, z: 10 }, { x: -10, z: 10 }
  ];
  
  minaretPositions.forEach(pos => {
    const minaretHeight = 12;
    const minaretRadius = 0.8;
    const spiralTurns = 8;
    const segments = 60;
    
    // Main minaret shaft
    positions.push(pos.x, -2, pos.z, pos.x, minaretHeight, pos.z);
    
    // Spiral decorative pattern
    for (let i = 0; i < segments; i++) {
      const t1 = i / segments;
      const t2 = (i + 1) / segments;
      
      const y1 = -2 + t1 * minaretHeight;
      const y2 = -2 + t2 * minaretHeight;
      
      const angle1 = t1 * spiralTurns * Math.PI * 2;
      const angle2 = t2 * spiralTurns * Math.PI * 2;
      
      const x1 = pos.x + Math.cos(angle1) * minaretRadius;
      const z1 = pos.z + Math.sin(angle1) * minaretRadius;
      const x2 = pos.x + Math.cos(angle2) * minaretRadius;
      const z2 = pos.z + Math.sin(angle2) * minaretRadius;
      
      positions.push(x1, y1, z1, x2, y2, z2);
      
      // Connecting lines to shaft
      if (i % 5 === 0) {
        positions.push(pos.x, y1, pos.z, x1, y1, z1);
      }
    }
    
    // Minaret dome cap
    const capRadius = 1.2;
    const capSegments = 12;
    for (let i = 0; i < capSegments; i++) {
      const angle1 = (i / capSegments) * Math.PI * 2;
      const angle2 = ((i + 1) / capSegments) * Math.PI * 2;
      
      const x1 = pos.x + Math.cos(angle1) * capRadius;
      const z1 = pos.z + Math.sin(angle1) * capRadius;
      const x2 = pos.x + Math.cos(angle2) * capRadius;
      const z2 = pos.z + Math.sin(angle2) * capRadius;
      
      positions.push(x1, minaretHeight, z1, x2, minaretHeight, z2);
      positions.push(pos.x, minaretHeight + capRadius, pos.z, x1, minaretHeight, z1);
    }
  });

  // Main building base structure
  const baseWidth = 16;
  const baseHeight = 8;
  const archWidth = 6;
  const archHeight = 6;
  
  // Outer walls
  const wallCorners = [
    { x: -baseWidth/2, z: -baseWidth/2 },
    { x: baseWidth/2, z: -baseWidth/2 },
    { x: baseWidth/2, z: baseWidth/2 },
    { x: -baseWidth/2, z: baseWidth/2 }
  ];
  
  // Wall structure with decorative arches
  for (let i = 0; i < wallCorners.length; i++) {
    const corner1 = wallCorners[i];
    const corner2 = wallCorners[(i + 1) % wallCorners.length];
    
    // Vertical corners
    positions.push(corner1.x, -2, corner1.z, corner1.x, baseHeight, corner1.z);
    
    // Top edge
    positions.push(corner1.x, baseHeight, corner1.z, corner2.x, baseHeight, corner2.z);
    
    // Base edge
    positions.push(corner1.x, -2, corner1.z, corner2.x, -2, corner2.z);
    
    // Decorative arches along each wall
    const wallLength = Math.sqrt(
      Math.pow(corner2.x - corner1.x, 2) + Math.pow(corner2.z - corner1.z, 2)
    );
    const archCount = Math.floor(wallLength / 4);
    
    for (let arch = 0; arch < archCount; arch++) {
      const archT = (arch + 0.5) / archCount;
      const archX = corner1.x + (corner2.x - corner1.x) * archT;
      const archZ = corner1.z + (corner2.z - corner1.z) * archT;
      
      // Create pointed arch
      const archSegments = 12;
      for (let seg = 0; seg < archSegments; seg++) {
        const t1 = seg / archSegments;
        const t2 = (seg + 1) / archSegments;
        
        // Pointed arch shape
        const archY1 = -2 + Math.sin(t1 * Math.PI) * archHeight * (1 - Math.abs(t1 - 0.5) * 0.5);
        const archY2 = -2 + Math.sin(t2 * Math.PI) * archHeight * (1 - Math.abs(t2 - 0.5) * 0.5);
        
        const offset1 = (t1 - 0.5) * archWidth;
        const offset2 = (t2 - 0.5) * archWidth;
        
        let archX1, archZ1, archX2, archZ2;
        if (Math.abs(corner2.x - corner1.x) > Math.abs(corner2.z - corner1.z)) {
          archX1 = archX + offset1;
          archZ1 = archZ;
          archX2 = archX + offset2;
          archZ2 = archZ;
        } else {
          archX1 = archX;
          archZ1 = archZ + offset1;
          archX2 = archX;
          archZ2 = archZ + offset2;
        }
        
        positions.push(archX1, archY1, archZ1, archX2, archY2, archZ2);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
};

// Enhanced material creation with dynamic colors
export const createEnhancedMonumentMaterial = (monumentType = 'default', hovered = false) => {
  const colors = {
    burj: hovered ? 0x3b82f6 : 0xe2e8f0,
    eiffel: hovered ? 0xf59e0b : 0xe2e8f0,
    phone: hovered ? 0x6366f1 : 0xe2e8f0,
    taj: hovered ? 0xec4899 : 0xe2e8f0,
    default: hovered ? 0x06b6d4 : 0xe2e8f0
  };
  
  return new THREE.LineBasicMaterial({
    color: colors[monumentType] || colors.default,
    transparent: true,
    opacity: hovered ? 0.9 : 0.6,
    linewidth: hovered ? 2 : 1
  });
};

// Position configurations for fullscreen layout
export const getFullscreenMonumentPositions = () => {
  return [
    {
      type: 'burj',
      position: { x: 15, y: 0, z: -20 },
      scale: 0.8,
      rotation: { x: 0, y: 0.2, z: 0 }
    },
    {
      type: 'eiffel',
      position: { x: -15, y: -5, z: -25 },
      scale: 1.0,
      rotation: { x: 0, y: -0.3, z: 0 }
    },
    {
      type: 'phone',
      position: { x: 0, y: 0, z: -15 },
      scale: 1.2,
      rotation: { x: 0.1, y: 0, z: 0 }
    },
    {
      type: 'taj',
      position: { x: -20, y: -3, z: -30 },
      scale: 0.9,
      rotation: { x: 0, y: 0.4, z: 0 }
    }
  ];
};