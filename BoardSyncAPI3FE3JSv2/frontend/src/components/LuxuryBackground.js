import React, { useEffect, useRef, useState } from 'react';

const LuxuryBackground = ({ currentView, analysisData, selectedColumn, isLoading }) => {
  const canvasRef = useRef(null);
  const animationIdRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const dotsRef = useRef([]);
  const connectionsRef = useRef([]);
  const lastViewRef = useRef('');
  const lastColumnRef = useRef('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mouseZoom, setMouseZoom] = useState({ x: 0, y: 0, active: false });
  const animationTimeRef = useRef(0);

  // Enhanced configuration with more dots and continuous movement
  const config = {
    dotCount: 65, // Increased back to 65 for more visual richness
    maxConnections: 2,
    connectionDistance: 200, // Adjusted for new dot count
    cursorConnectionDistance: 180,
    dotSize: 2.2,
    lineWidth: 1.8,
    glowIntensity: 0.8,
    fadeSpeed: 0.04,
    transitionDuration: 400,
    zoomIntensity: 0.12, // Increased zoom effect
    zoomRadius: 200, // Larger zoom radius
    // New animation properties
    floatSpeed: 0.0008, // Speed of floating animation
    floatAmplitude: 25, // How far dots move from their base position
    waveSpeed: 0.0015, // Speed of wave-like movement
    breathingSpeed: 0.001 // Gentle breathing effect
  };

  // Simple distance calculation utility
  const calculateDistance = (point1, point2) => {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Enhanced Dot class with continuous movement
  class Dot {
    constructor(x, y, index) {
      this.baseX = x; // Original position
      this.baseY = y;
      this.x = x;
      this.y = y;
      this.targetX = x;
      this.targetY = y;
      this.vx = 0;
      this.vy = 0;
      this.size = config.dotSize + Math.random() * 0.8;
      this.opacity = 0.5 + Math.random() * 0.3;
      this.baseOpacity = this.opacity;
      this.glowIntensity = 0;
      this.connections = [];
      this.lastConnectionTime = 0;
      
      // Animation properties
      this.floatOffsetX = Math.random() * Math.PI * 2; // Random phase for X movement
      this.floatOffsetY = Math.random() * Math.PI * 2; // Random phase for Y movement
      this.floatSpeedMultiplier = 0.8 + Math.random() * 0.4; // Vary speed per dot
      this.index = index;
      
      // Size breathing effect
      this.breathingOffset = Math.random() * Math.PI * 2;
      this.baseSize = this.size;
    }

    update(time) {
      // Continuous floating animation
      const floatX = Math.sin(time * config.floatSpeed * this.floatSpeedMultiplier + this.floatOffsetX) * config.floatAmplitude;
      const floatY = Math.cos(time * config.floatSpeed * this.floatSpeedMultiplier + this.floatOffsetY) * config.floatAmplitude * 0.7;
      
      // Wave-like movement across the screen
      const waveX = Math.sin(time * config.waveSpeed + this.index * 0.1) * 15;
      const waveY = Math.cos(time * config.waveSpeed * 0.7 + this.index * 0.15) * 10;
      
      // Update target position with floating animation
      this.targetX = this.baseX + floatX + waveX;
      this.targetY = this.baseY + floatY + waveY;

      // Smooth movement to animated target position
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      this.vx += dx * 0.08;
      this.vy += dy * 0.08;
      this.vx *= 0.90;
      this.vy *= 0.90;
      this.x += this.vx;
      this.y += this.vy;

      // Breathing size effect
      const breathingScale = 1 + Math.sin(time * config.breathingSpeed + this.breathingOffset) * 0.2;
      this.size = this.baseSize * breathingScale;

      // Faster glow fade
      this.glowIntensity *= 0.92;
      
      // Update opacity based on connections
      if (this.connections.length > 0) {
        this.opacity = Math.min(1, this.baseOpacity + 0.5);
      } else {
        this.opacity = this.baseOpacity;
      }
    }

    // Method to update base position (for page transitions)
    updateBasePosition(newX, newY) {
      this.baseX = newX;
      this.baseY = newY;
    }

    draw(ctx) {
      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.size * 3
      );
      
      const alpha = this.opacity;
      const glowAlpha = Math.min(0.9, this.glowIntensity);
      
      // Darker color scheme
      gradient.addColorStop(0, `rgba(71, 85, 105, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(100, 116, 139, ${alpha * 0.7})`);
      gradient.addColorStop(1, `rgba(148, 163, 184, 0)`);

      // Enhanced glow effect with darker blue
      if (this.glowIntensity > 0.1) {
        ctx.shadowColor = `rgba(30, 64, 175, ${glowAlpha})`;
        ctx.shadowBlur = 18;
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();

      // Reset shadow
      ctx.shadowBlur = 0;
    }

    addGlow() {
      this.glowIntensity = 1;
      this.lastConnectionTime = Date.now();
    }
  }

  // Enhanced Connection class
  class Connection {
    constructor(point1, point2, isCursorConnection = false) {
      this.point1 = point1;
      this.point2 = point2;
      this.isCursorConnection = isCursorConnection;
      this.opacity = 0;
      this.targetOpacity = isCursorConnection ? 0.9 : 0.7;
      this.createdAt = Date.now();
      this.isActive = true;
    }

    update() {
      if (this.isActive) {
        this.opacity = Math.min(this.targetOpacity, this.opacity + 0.08);
      } else {
        this.opacity *= 0.88;
      }
      
      return this.opacity > 0.01;
    }

    draw(ctx) {
      if (this.opacity <= 0) return;

      const distance = calculateDistance(this.point1, this.point2);
      const maxDistance = this.isCursorConnection ? 
        config.cursorConnectionDistance : config.connectionDistance;
      
      const distanceOpacity = 1 - (distance / maxDistance);
      const finalOpacity = this.opacity * distanceOpacity;

      if (finalOpacity <= 0) return;

      // Darker gradient lines
      const gradient = ctx.createLinearGradient(
        this.point1.x, this.point1.y,
        this.point2.x, this.point2.y
      );

      if (this.isCursorConnection) {
        gradient.addColorStop(0, `rgba(30, 64, 175, ${finalOpacity})`);
        gradient.addColorStop(1, `rgba(15, 23, 42, ${finalOpacity * 0.8})`);
      } else {
        gradient.addColorStop(0, `rgba(71, 85, 105, ${finalOpacity})`);
        gradient.addColorStop(0.5, `rgba(100, 116, 139, ${finalOpacity * 0.9})`);
        gradient.addColorStop(1, `rgba(71, 85, 105, ${finalOpacity})`);
      }

      // Enhanced glow effect
      ctx.shadowColor = this.isCursorConnection ? 
        `rgba(30, 64, 175, ${finalOpacity * 0.6})` : 
        `rgba(71, 85, 105, ${finalOpacity * 0.4})`;
      ctx.shadowBlur = this.isCursorConnection ? 10 : 6;

      ctx.strokeStyle = gradient;
      ctx.lineWidth = config.lineWidth;
      ctx.beginPath();
      ctx.moveTo(this.point1.x, this.point1.y);
      ctx.lineTo(this.point2.x, this.point2.y);
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;
    }

    deactivate() {
      this.isActive = false;
    }
  }

  // Initialize dots with better spacing and movement setup
  const initializeDots = (width, height) => {
    const dots = [];
    const minDistance = 140; // Adjusted for more dots
    
    for (let i = 0; i < config.dotCount; i++) {
      let x, y, validPosition = false, attempts = 0;
      
      while (!validPosition && attempts < 50) {
        x = 80 + Math.random() * (width - 160);
        y = 80 + Math.random() * (height - 160);
        
        validPosition = true;
        for (const existingDot of dots) {
          if (calculateDistance({ x, y }, { x: existingDot.baseX, y: existingDot.baseY }) < minDistance) {
            validPosition = false;
            break;
          }
        }
        attempts++;
      }
      
      if (validPosition) {
        dots.push(new Dot(x, y, i));
      }
    }
    return dots;
  };

  // Enhanced rearrange function that updates base positions
  const rearrangeDots = (width, height) => {
    const minDistance = 140;
    
    dotsRef.current.forEach((dot, index) => {
      let newX, newY, validPosition = false, attempts = 0;
      
      while (!validPosition && attempts < 30) {
        newX = 80 + Math.random() * (width - 160);
        newY = 80 + Math.random() * (height - 160);
        
        validPosition = true;
        for (let i = 0; i < dotsRef.current.length; i++) {
          if (i !== index) {
            const otherDot = dotsRef.current[i];
            if (calculateDistance({ x: newX, y: newY }, { x: otherDot.baseX, y: otherDot.baseY }) < minDistance) {
              validPosition = false;
              break;
            }
          }
        }
        attempts++;
      }
      
      if (validPosition) {
        dot.updateBasePosition(newX, newY);
      }
    });
  };

  // Find nearby dots for connections
  const findNearbyDots = (dot, excludeDots = []) => {
    return dotsRef.current
      .filter(other => other !== dot && !excludeDots.includes(other))
      .filter(other => calculateDistance(dot, other) <= config.connectionDistance)
      .sort((a, b) => calculateDistance(dot, a) - calculateDistance(dot, b));
  };

  // Update connections between dots
  const updateDotConnections = () => {
    // Clear existing non-cursor connections
    connectionsRef.current = connectionsRef.current.filter(conn => conn.isCursorConnection);

    // Create new dot-to-dot connections
    dotsRef.current.forEach(dot => {
      if (dot.connections.length < 1) {
        const nearby = findNearbyDots(dot, dot.connections);
        
        if (nearby.length > 0) {
          const nearestDot = nearby[0];
          
          const existingConnection = connectionsRef.current.find(conn => 
            (conn.point1 === dot && conn.point2 === nearestDot) ||
            (conn.point1 === nearestDot && conn.point2 === dot)
          );

          if (!existingConnection && nearestDot.connections.length < 1) {
            const connection = new Connection(dot, nearestDot);
            connectionsRef.current.push(connection);
            dot.connections.push(nearestDot);
            nearestDot.connections.push(dot);
            
            dot.addGlow();
            nearestDot.addGlow();
          }
        }
      }
    });
  };

  // Enhanced cursor connections with improved zoom effect
  const updateCursorConnections = () => {
    const mouse = mouseRef.current;
    
    // Remove old cursor connections
    connectionsRef.current = connectionsRef.current.filter(conn => {
      if (conn.isCursorConnection) {
        conn.deactivate();
        return conn.update();
      }
      return true;
    });

    // Find nearest dots to cursor
    const nearestDots = dotsRef.current
      .filter(dot => calculateDistance(dot, mouse) <= config.cursorConnectionDistance)
      .sort((a, b) => calculateDistance(a, mouse) - calculateDistance(b, mouse))
      .slice(0, config.maxConnections);

    // Update zoom effect with smoother activation
    if (nearestDots.length > 0) {
      const closestDistance = calculateDistance(nearestDots[0], mouse);
      const zoomStrength = Math.max(0, 1 - (closestDistance / config.cursorConnectionDistance));
      setMouseZoom({ 
        x: mouse.x, 
        y: mouse.y, 
        active: true,
        strength: zoomStrength
      });
    } else {
      setMouseZoom(prev => ({ ...prev, active: false, strength: 0 }));
    }

    // Create cursor connections
    nearestDots.forEach(dot => {
      const cursorPoint = { x: mouse.x, y: mouse.y };
      const connection = new Connection(cursorPoint, dot, true);
      connectionsRef.current.push(connection);
      dot.addGlow();
    });

    // Create triangular connections between cursor-connected dots
    if (nearestDots.length >= 2) {
      for (let i = 0; i < nearestDots.length - 1; i++) {
        for (let j = i + 1; j < nearestDots.length; j++) {
          const dot1 = nearestDots[i];
          const dot2 = nearestDots[j];
          
          if (calculateDistance(dot1, dot2) <= config.connectionDistance) {
            const connection = new Connection(dot1, dot2);
            connectionsRef.current.push(connection);
            dot1.addGlow();
            dot2.addGlow();
          }
        }
      }
    }
  };

  // Enhanced animation loop with time-based animation
  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Update animation time
    animationTimeRef.current += 16; // Approximate 60fps

    // Clear canvas with darker gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f8fafc');
    gradient.addColorStop(0.3, '#e2e8f0');
    gradient.addColorStop(0.7, '#cbd5e1');
    gradient.addColorStop(1, '#94a3b8');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Update dots with time-based animation
    dotsRef.current.forEach(dot => {
      dot.connections = [];
      dot.update(animationTimeRef.current);
    });

    // Update connections
    updateDotConnections();
    updateCursorConnections();

    // Clean up dead connections
    connectionsRef.current = connectionsRef.current.filter(conn => conn.update());

    // Draw connections
    connectionsRef.current.forEach(conn => conn.draw(ctx));

    // Draw dots
    dotsRef.current.forEach(dot => dot.draw(ctx));

    animationIdRef.current = requestAnimationFrame(animate);
  };

  // Enhanced mouse movement handler
  const handleMouseMove = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    mouseRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  // Handle window resize
  const handleResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (dotsRef.current.length === 0) {
      dotsRef.current = initializeDots(canvas.width, canvas.height);
    } else {
      rearrangeDots(canvas.width, canvas.height);
    }
  };

  // Enhanced navigation change handler
  const handleNavigationChange = () => {
    if (currentView !== lastViewRef.current || selectedColumn !== lastColumnRef.current) {
      lastViewRef.current = currentView;
      lastColumnRef.current = selectedColumn;

      setIsTransitioning(true);

      // Faster fade out all connections
      connectionsRef.current.forEach(conn => conn.deactivate());

      // Much faster rearrangement
      setTimeout(() => {
        if (canvasRef.current) {
          rearrangeDots(canvasRef.current.width, canvasRef.current.height);
        }
        setIsTransitioning(false);
      }, 150);
    }
  };

  // Initialize and cleanup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    dotsRef.current = initializeDots(canvas.width, canvas.height);
    animationTimeRef.current = 0; // Reset animation time
    animate();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Handle navigation changes
  useEffect(() => {
    handleNavigationChange();
  }, [currentView, selectedColumn]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -2,
          pointerEvents: 'none',
          backgroundColor: 'transparent'
        }}
      />
      
      {/* Enhanced transition indicator */}
      {isTransitioning && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1e40af, #0f172a)',
            opacity: 0.8,
            zIndex: 5,
            animation: 'fastPulse 0.6s ease-in-out infinite'
          }}
        />
      )}
      
      {/* Enhanced mouse zoom indicator */}
      {/* {mouseZoom.active && mouseZoom.strength > 0 && (
        <div
          style={{
            position: 'fixed',
            left: mouseZoom.x - 15,
            top: mouseZoom.y - 15,
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            border: `0.001px solid rgba(30, 64, 175, ${0.2 + mouseZoom.strength * 0.4})`,
            pointerEvents: 'none',
            zIndex: 1,
            transform: `scale(${0.8 + mouseZoom.strength * 0.4})`,
            transition: 'all 0.1s ease-out',
            background: `radial-gradient(circle, rgba(30, 64, 175, ${mouseZoom.strength * 0.1}), transparent 70%)`
          }}
        />
      )} */}
      
      <style jsx>{`
        @keyframes fastPulse {
          0%, 100% { 
            transform: scale(1);
            opacity: 0.8;
          }
          50% { 
            transform: scale(1.4);
            opacity: 1;
          }
        }
        
        @keyframes simpleRotate {
          from { transform: translate(-50%, -50%) rotate(45deg); }
          to { transform: translate(-50%, -50%) rotate(405deg); }
        }
      `}</style>
    </>
  );
};

export default LuxuryBackground;