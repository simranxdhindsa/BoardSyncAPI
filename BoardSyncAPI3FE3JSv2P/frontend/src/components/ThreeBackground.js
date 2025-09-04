import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createCreativeElement, getCurrentElement } from '../utils/monumentGeometries';

const ThreeBackground = ({ currentView, analysisData, selectedColumn, isLoading }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const animationIdRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, normalizedX: 0, normalizedY: 0 });
  
  const galaxyRef = useRef(null);
  const backgroundElementsRef = useRef([]);
  
  const animationStateRef = useRef({
    phase: 'steady', // Start directly with galaxy
    startTime: Date.now(),
    currentElementType: null,
    isTransitioning: false,
    transitionStartTime: 0,
    transitionDirection: 'left'
  });

  useEffect(() => {
    initScene();
    createGalaxy();
    startAnimation();

    const handleMouseMove = (event) => {
      mouseRef.current = {
        normalizedX: (event.clientX / window.innerWidth) * 2 - 1,
        normalizedY: -(event.clientY / window.innerHeight) * 2 + 1
      };
    };

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
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

  useEffect(() => {
    if (currentView === 'results') {
      triggerPageTransition('left');
    } else if (currentView === 'dashboard') {
      triggerPageTransition('right');
    }
  }, [currentView]);

  const initScene = () => {
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0x000011, 50, 300);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75, // Good field of view for galaxy
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    camera.position.set(0, 20, 100);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      powerPreference: "high-performance"
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = false; // Not needed for particles
    renderer.sortObjects = false; // Better performance for particles
    rendererRef.current = renderer;

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    // Minimal lighting for galaxy effect
    const ambientLight = new THREE.AmbientLight(0x111133, 0.3);
    scene.add(ambientLight);

    // Subtle directional light
    const directionalLight = new THREE.DirectionalLight(0x4466aa, 0.4);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);
  };

  const createGalaxy = () => {
    const scene = sceneRef.current;
    
    if (galaxyRef.current) {
      scene.remove(galaxyRef.current);
      disposeElement(galaxyRef.current);
    }

    const galaxy = createCreativeElement('particle_galaxy', 1);
    galaxy.position.set(0, 0, -40);
    
    scene.add(galaxy);
    galaxyRef.current = galaxy;
    
    
  };

  const updateElementIndicator = (elementName) => {
    const indicator = document.querySelector('.element-indicator');
    if (indicator) {
      indicator.textContent = `${elementName}`;
    } else {
      const newIndicator = document.createElement('div');
      newIndicator.className = 'element-indicator';
      newIndicator.textContent = `${elementName}`;
      document.body.appendChild(newIndicator);
    }
  };

  const disposeElement = (element) => {
    if (element) {
      element.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  };

  const updateAnimationSequence = () => {
    const state = animationStateRef.current;
    
    // Handle page transitions
    if (state.isTransitioning) {
      const currentTime = Date.now();
      const transitionElapsed = currentTime - state.transitionStartTime;
      const transitionDuration = 1200;
      const progress = Math.min(transitionElapsed / transitionDuration, 1);
      
      const easeInOut = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      const multiplier = state.transitionDirection === 'left' ? -1 : 1;
      
      if (galaxyRef.current) {
        const targetX = multiplier * 150;
        galaxyRef.current.position.x = targetX * easeInOut;
      }
      
      if (progress >= 1) {
        state.isTransitioning = false;
        if (galaxyRef.current) {
          galaxyRef.current.position.x = 0; // Reset position
        }
      }
    }
  };

  const triggerPageTransition = (direction) => {
    const state = animationStateRef.current;
    state.isTransitioning = true;
    state.transitionDirection = direction;
    state.transitionStartTime = Date.now();
  };

  const animate = () => {
    animationIdRef.current = requestAnimationFrame(animate);
    
    updateAnimationSequence();
    
    const time = Date.now() * 0.001;
    
    // Update galaxy shader time uniform
    if (galaxyRef.current && galaxyRef.current.userData.material) {
      galaxyRef.current.userData.material.uniforms.time.value = time;
    }
    
    // Rotate galaxy slowly
    if (galaxyRef.current) {
      galaxyRef.current.rotation.y += 0.002;
      galaxyRef.current.rotation.z += 0.001;
    }
    
    // Mouse-responsive camera
    if (cameraRef.current && !animationStateRef.current.isTransitioning) {
      const mouse = mouseRef.current;
      const targetX = mouse.normalizedX * 30;
      const targetY = -mouse.normalizedY * 20 + 20;
      
      cameraRef.current.position.x += (targetX - cameraRef.current.position.x) * 0.003;
      cameraRef.current.position.y += (targetY - cameraRef.current.position.y) * 0.003;
      cameraRef.current.lookAt(0, 0, 0);
    }

    // Render
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  const startAnimation = () => {
    animate();
  };

  const cleanup = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    
    disposeElement(galaxyRef.current);
    
    backgroundElementsRef.current.forEach(element => {
      disposeElement(element);
    });
    
    const indicator = document.querySelector('.element-indicator');
    if (indicator) {
      indicator.remove();
    }
    
    if (rendererRef.current && mountRef.current) {
      mountRef.current.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
    }
  };

  return <div ref={mountRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }} />;
};

export default ThreeBackground;
