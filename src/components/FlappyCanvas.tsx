import React, { useEffect, useRef, useState } from 'react';
import { GameState, Difficulty, Theme, BirdSkin, Particle, Pipe } from '../types';
import { soundSystem } from '../utils/audio';

interface FlappyCanvasProps {
  theme: Theme;
  difficulty: Difficulty;
  skin: BirdSkin;
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  onFlapTriggered: () => void;
  onPipeCleared: () => void;
  onCollisionOccurred: () => void;
  triggerReset: number;
}

// Fixed game canvas size (virtual coordinate space)
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 550;
const GROUND_HEIGHT = 65;
const CEILING_LIMIT = 0;

export const FlappyCanvas: React.FC<FlappyCanvasProps> = ({
  theme,
  difficulty,
  skin,
  gameState,
  setGameState,
  setScore,
  onFlapTriggered,
  onPipeCleared,
  onCollisionOccurred,
  triggerReset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Safe wrapper for haptic vibration feedback
  const safeVibrate = (pattern: number | number[]) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      console.debug('Haptic feedback is not permitted in this sandbox container:', e);
    }
  };
  
  // Game loop variables using ref to prevent React state re-render lags
  const birdRef = useRef({
    x: 80,
    y: 220,
    radius: 13,
    velocity: 0,
    gravity: 0.24,
    jumpPower: -5.5,
    angle: 0,
    flapPhase: 0,
  });

  const pipesRef = useRef<Pipe[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const frameCountRef = useRef<number>(0);
  const nextParticleIdRef = useRef<number>(0);
  
  // Parallax background items
  const backgroundElementsRef = useRef<{ x: number; y: number; size: number; speed: number; alpha?: number }[]>([]);
  const groundOffsetRef = useRef<number>(0);

  // Initialize background elements based on theme
  const initBackgroundElements = (currentTheme: Theme) => {
    const list: any[] = [];
    if (currentTheme === Theme.DAY) {
      // 5 fluffy clouds
      for (let i = 0; i < 5; i++) {
        list.push({
          x: Math.random() * CANVAS_WIDTH * 1.5,
          y: 40 + Math.random() * 120,
          size: 25 + Math.random() * 25,
          speed: 0.15 + Math.random() * 0.15,
        });
      }
    } else if (currentTheme === Theme.NIGHT) {
      // 30 twinkling stars
      for (let i = 0; i < 35; i++) {
        list.push({
          x: Math.random() * CANVAS_WIDTH,
          y: Math.random() * (CANVAS_HEIGHT - GROUND_HEIGHT),
          size: 1 + Math.random() * 2.2,
          speed: 0.01 + Math.random() * 0.03, // blinks
          alpha: Math.random(),
        });
      }
    } else if (currentTheme === Theme.CYBERPUNK) {
      // Stream nodes OR digital lines
      for (let i = 0; i < 15; i++) {
        list.push({
          x: Math.random() * CANVAS_WIDTH,
          y: Math.random() * (CANVAS_HEIGHT - GROUND_HEIGHT),
          size: 12 + Math.random() * 24, // font height
          speed: 0.5 + Math.random() * 1.2, // falling speed
          alpha: 0.1 + Math.random() * 0.3,
        });
      }
    }
    backgroundElementsRef.current = list;
  };

  // Setup/Reset game world
  const resetGameWorld = () => {
    // Determine physics by difficulty
    let g = 0.24;
    let jp = -5.5;

    if (difficulty === Difficulty.EASY) {
      g = 0.18;
      jp = -4.5;
    } else if (difficulty === Difficulty.MEDIUM) {
      g = 0.24;
      jp = -5.5;
    } else if (difficulty === Difficulty.HARD) {
      g = 0.28;
      jp = -6.2;
    }

    birdRef.current = {
      x: 90,
      y: 220,
      radius: 13,
      velocity: 0,
      gravity: g,
      jumpPower: jp,
      angle: 0,
      flapPhase: 0,
    };

    pipesRef.current = [];
    particlesRef.current = [];
    frameCountRef.current = 0;
    groundOffsetRef.current = 0;
    initBackgroundElements(theme);
    setScore(0);
  };

  // Trigger reset on state change request or manual refresh
  useEffect(() => {
    resetGameWorld();
  }, [triggerReset, difficulty, theme]);

  // Handle jump action safely
  const flapBird = () => {
    if (gameState === GameState.COLLIDED || gameState === GameState.GAMEOVER) {
      return;
    }

    if (gameState === GameState.START) {
      setGameState(GameState.PLAYING);
    }

    if (gameState === GameState.PAUSED) {
      return;
    }

    // Set velocity to jump force
    birdRef.current.velocity = birdRef.current.jumpPower;
    
    // Play sound and callbacks
    soundSystem.playFlap();
    onFlapTriggered();
    safeVibrate(15); // Short haptic pulse for jumping

    // Create flap particles
    const b = birdRef.current;
    let particleColor = '#facc15'; // default yellow
    let particleType: 'feather' | 'trail' = 'feather';

    if (skin === BirdSkin.PHOENIX) particleColor = '#fb923c';
    if (skin === BirdSkin.ROBO) {
      particleColor = '#38bdf8';
      particleType = 'trail';
    }
    if (skin === BirdSkin.BAT) particleColor = '#c084fc';

    for (let i = 0; i < 5; i++) {
      const pid = nextParticleIdRef.current++;
      particlesRef.current.push({
        id: pid,
        x: b.x - 10,
        y: b.y + (Math.random() * 8 - 4),
        vx: -1.5 - Math.random() * 2,
        vy: -1 + Math.random() * 2,
        size: 3 + Math.random() * 4,
        color: particleColor,
        alpha: 0.9,
        decay: 0.03 + Math.random() * 0.03,
        type: particleType,
      });
    }
  };

  // Mount inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        flapBird();
      }
    };

    const handleCanvasClick = (e: MouseEvent) => {
      e.preventDefault();
      flapBird();
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      flapBird();
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('click', handleCanvasClick);
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    }
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (canvas) {
        canvas.removeEventListener('click', handleCanvasClick);
        canvas.removeEventListener('touchstart', handleTouchStart);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, skin, difficulty, theme]);

  // Main rendering & update loops
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = () => {
      // Perform updates
      updateGame();
      // Perform rendering
      renderGame(ctx);

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    // Physics parameters according to difficulty
    let scrollSpeed = 2.2;
    let pipeInterval = 110;
    let pipeGap = 140;

    if (difficulty === Difficulty.EASY) {
      scrollSpeed = 1.6;
      pipeInterval = 140;
      pipeGap = 165;
    } else if (difficulty === Difficulty.MEDIUM) {
      scrollSpeed = 2.2;
      pipeInterval = 110;
      pipeGap = 135;
    } else if (difficulty === Difficulty.HARD) {
      scrollSpeed = 2.8;
      pipeInterval = 90;
      pipeGap = 115;
    }

    const updateGame = () => {
      if (gameState === GameState.PAUSED) return;

      frameCountRef.current++;

      // Update background scrolling
      if (gameState !== GameState.COLLIDED && gameState !== GameState.GAMEOVER) {
        groundOffsetRef.current = (groundOffsetRef.current + scrollSpeed) % 24;

        // Drift background parallax elements
        backgroundElementsRef.current.forEach((el) => {
          if (theme === Theme.DAY) {
            el.x -= el.speed;
            if (el.x + el.size * 2 < 0) {
              el.x = CANVAS_WIDTH + 10 + Math.random() * 50;
              el.y = 40 + Math.random() * 120;
            }
          } else if (theme === Theme.NIGHT) {
            // twinkle
            if (el.alpha !== undefined) {
              el.alpha += el.speed * (Math.random() > 0.5 ? 1 : -1);
              if (el.alpha < 0.2) el.alpha = 0.2;
              if (el.alpha > 1) el.alpha = 1;
            }
          } else if (theme === Theme.CYBERPUNK) {
            // cascading binary stream falling
            el.y += el.speed;
            if (el.y > CANVAS_HEIGHT - GROUND_HEIGHT) {
              el.y = -el.size;
              el.x = Math.random() * CANVAS_WIDTH;
            }
          }
        });
      }

      // Update bird physics
      const bird = birdRef.current;
      if (gameState === GameState.PLAYING || gameState === GameState.COLLIDED) {
        bird.velocity += bird.gravity;
        bird.y += bird.velocity;

        // Terminal downward speed
        if (bird.velocity > 12) bird.velocity = 12;

        // Angle setting
        if (bird.velocity < 2) {
          bird.angle = Math.max(-0.4, bird.angle - 0.08); // Tilt upward slightly
        } else if (bird.velocity > 4) {
          bird.angle = Math.min(Math.PI / 2 - 0.2, bird.angle + 0.07); // Nose dive
        }

        // Flapping motion wing phase
        bird.flapPhase = (bird.flapPhase + (gameState === GameState.PLAYING ? 0.35 : 0)) % 10;
      }

      // Clamp ceiling
      if (bird.y < CEILING_LIMIT + bird.radius) {
        bird.y = CEILING_LIMIT + bird.radius;
        bird.velocity = Math.max(0, bird.velocity);
      }

      // Check ground collision
      const maxBirdY = CANVAS_HEIGHT - GROUND_HEIGHT - bird.radius;
      if (bird.y >= maxBirdY) {
        bird.y = maxBirdY;
        if (gameState === GameState.PLAYING) {
          // Play crash sound
          soundSystem.playHit();
          onCollisionOccurred();
          safeVibrate([100, 50, 150]); // Intense double-pulse vibration on crash
          setGameState(GameState.GAMEOVER);
          
          // Explode feathers
          createCrashParticles(bird.x, bird.y);
        } else if (gameState === GameState.COLLIDED) {
          setGameState(GameState.GAMEOVER);
        }
      }

      // Update pipes and detect scoring / collision (Playing only)
      if (gameState === GameState.PLAYING) {
        // Spawn pipes
        if (frameCountRef.current % pipeInterval === 0) {
          const minHeight = 40;
          const maxHeight = CANVAS_HEIGHT - GROUND_HEIGHT - pipeGap - minHeight;
          const topHeight = minHeight + Math.floor(Math.random() * (maxHeight - minHeight));
          const bottomY = topHeight + pipeGap;

          const newPipe: Pipe = {
            x: CANVAS_WIDTH,
            width: 54,
            topHeight,
            bottomY,
            passed: false,
          };

          // Extra hard mode trick: pipes move up and down
          if (difficulty === Difficulty.HARD) {
            newPipe.speedY = 0.65 * (Math.random() > 0.5 ? 1 : -1);
            newPipe.dirY = 1;
            // set boundaries for pivot point
            newPipe.rangeY = [
              Math.max(30, topHeight - 45),
              Math.min(CANVAS_HEIGHT - GROUND_HEIGHT - pipeGap - 30, topHeight + 45),
            ];
          }

          pipesRef.current.push(newPipe);
        }

        // Update pipe motion and logic
        pipesRef.current = pipesRef.current.filter((pipe) => {
          pipe.x -= scrollSpeed;

          // Hard mode moving action
          if (pipe.speedY && pipe.dirY && pipe.rangeY) {
            pipe.topHeight += pipe.speedY * pipe.dirY;
            pipe.bottomY = pipe.topHeight + pipeGap;

            if (pipe.topHeight <= pipe.rangeY[0]) {
              pipe.dirY = 1;
            } else if (pipe.topHeight >= pipe.rangeY[1]) {
              pipe.dirY = -1;
            }
          }

          // Scoring logic
          if (!pipe.passed && pipe.x + pipe.width / 2 < bird.x) {
            pipe.passed = true;
            soundSystem.playScore();
            setScore((prev) => prev + 1);
            onPipeCleared();
            safeVibrate(8); // Softer quick pulse for passing a pipe

            // Spawn score fireworks particles in colors of theme!
            const sparkCount = 8;
            const sparkColor = theme === Theme.CYBERPUNK ? '#06b6d4' : theme === Theme.NIGHT ? '#eab308' : '#22c55e';
            for (let i = 0; i < sparkCount; i++) {
              const pid = nextParticleIdRef.current++;
              const angle = (i / sparkCount) * Math.PI * 2;
              const spd = 2 + Math.random() * 2;
              particlesRef.current.push({
                id: pid,
                x: pipe.x + pipe.width / 2,
                y: (pipe.topHeight + pipe.bottomY) / 2,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                size: 2 + Math.random() * 3,
                color: sparkColor,
                alpha: 1.0,
                decay: 0.05,
                type: 'star',
              });
            }
          }

          // AABB to Circle collision detection
          const bx = bird.x;
          const by = bird.y;
          const br = bird.radius - 1; // slightly smaller hitbox for better player feel

          // Top pipe rect
          const topCollide = checkCircleRectCollision(bx, by, br, pipe.x, 0, pipe.width, pipe.topHeight);
          // Bottom pipe rect
          const bottomCollide = checkCircleRectCollision(
            bx,
            by,
            br,
            pipe.x,
            pipe.bottomY,
            pipe.width,
            CANVAS_HEIGHT - GROUND_HEIGHT - pipe.bottomY
          );

          if (topCollide || bottomCollide) {
            soundSystem.playHit();
            onCollisionOccurred();
            safeVibrate([100, 50, 150]); // Intense double-pulse vibration on crash
            setGameState(GameState.COLLIDED);
            bird.velocity = -2; // bounce up slightly on impact
            // Explode feathers
            createCrashParticles(bird.x, bird.y);
          }

          // Keep pipes until they drift off screen fully
          return pipe.x + pipe.width > -10;
        });
      }

      // Generate soft flight residues
      if (gameState === GameState.PLAYING && frameCountRef.current % 4 === 0) {
        const b = birdRef.current;
        let trailColor = '#facc1555';
        if (skin === BirdSkin.PHOENIX) trailColor = '#ff6b3d44';
        if (skin === BirdSkin.ROBO) trailColor = '#38bdf844';
        if (skin === BirdSkin.BAT) trailColor = '#a855f755';

        const pid = nextParticleIdRef.current++;
        particlesRef.current.push({
          id: pid,
          x: b.x - 12,
          y: b.y + (Math.random() * 6 - 3),
          vx: -1,
          vy: 0.2,
          size: 4 + Math.random() * 4,
          color: trailColor,
          alpha: 0.6,
          decay: 0.02,
          type: 'trail',
        });
      }

      // Update particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        // Gravity affects feathers.
        if (p.type === 'feather') {
          p.vy += 0.08;
          p.vx *= 0.98;
        }

        return p.alpha > 0;
      });
    };

    // Circle - Rectangle Collision check helper
    const checkCircleRectCollision = (
      cx: number,
      cy: number,
      r: number,
      rx: number,
      ry: number,
      rw: number,
      rh: number
    ) => {
      // Find closest point on the pipe rect
      const closestX = Math.max(rx, Math.min(cx, rx + rw));
      const closestY = Math.max(ry, Math.min(cy, ry + rh));

      // Distance between circle center and closest point on rect
      const dX = cx - closestX;
      const dY = cy - closestY;
      const distanceSquared = dX * dX + dY * dY;

      return distanceSquared < r * r;
    };

    const createCrashParticles = (x: number, y: number) => {
      let colors = ['#facc15', '#fb923c', '#ffffff', '#e2e8f0'];
      if (skin === BirdSkin.PHOENIX) colors = ['#f97316', '#ef4444', '#facc15', '#450a0a'];
      if (skin === BirdSkin.ROBO) colors = ['#0284c7', '#38bdf8', '#0ea5e9', '#cbd5e1'];
      if (skin === BirdSkin.BAT) colors = ['#1e1b4b', '#a855f7', '#111827', '#ffffff'];

      for (let i = 0; i < 28; i++) {
        const pid = nextParticleIdRef.current++;
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 4.5;
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        particlesRef.current.push({
          id: pid,
          x,
          y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 1, // shift up slightly
          size: 2.5 + Math.random() * 5,
          color: randomColor,
          alpha: 1.0,
          decay: 0.015 + Math.random() * 0.015,
          type: 'feather',
        });
      }
    };

    // GAME CANVAS RENDERING ENGINE
    const renderGame = (c: CanvasRenderingContext2D) => {
      c.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 1. Draw Background Sky Gradient
      let skyGrad = c.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      if (theme === Theme.DAY) {
        skyGrad.addColorStop(0, '#7dd3fc'); // baby blue
        skyGrad.addColorStop(0.5, '#bae6fd');
        skyGrad.addColorStop(1, '#e0f2fe'); // light tint
      } else if (theme === Theme.NIGHT) {
        skyGrad.addColorStop(0, '#090514'); // midnight black
        skyGrad.addColorStop(0.6, '#180f30'); // indigo deep
        skyGrad.addColorStop(1, '#2d1847'); // subtle sunset purple
      } else if (theme === Theme.CYBERPUNK) {
        skyGrad.addColorStop(0, '#030712'); // obsidian black
        skyGrad.addColorStop(0.6, '#021822'); // glowing grid cyan dark tint
        skyGrad.addColorStop(1, '#083344'); // dark teal glow
      }
      c.fillStyle = skyGrad;
      c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 2. Draw Background Decor elements (Stars, Clouds, Binary streams)
      if (theme === Theme.DAY) {
        // Draw elegant puffy white clouds
        backgroundElementsRef.current.forEach((cloud) => {
          c.fillStyle = 'rgba(255, 255, 255, 0.72)';
          c.beginPath();
          const r = cloud.size;
          const cx = cloud.x;
          const cy = cloud.y;

          c.arc(cx, cy, r, 0, Math.PI * 2);
          c.arc(cx - r * 0.6, cy + r * 0.1, r * 0.7, 0, Math.PI * 2);
          c.arc(cx + r * 0.6, cy + r * 0.1, r * 0.7, 0, Math.PI * 2);
          c.arc(cx - r * 1.1, cy + r * 0.3, r * 0.45, 0, Math.PI * 2);
          c.arc(cx + r * 1.1, cy + r * 0.3, r * 0.45, 0, Math.PI * 2);
          
          c.closePath();
          c.fill();
        });
      } else if (theme === Theme.NIGHT) {
        // Star map blinkers
        backgroundElementsRef.current.forEach((star) => {
          c.fillStyle = `rgba(254, 240, 138, ${star.alpha ?? 0.8})`;
          c.beginPath();
          c.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          c.fill();
        });

        // Add a giant crescent moon in night mode
        c.fillStyle = 'rgba(254, 240, 138, 0.9)';
        c.beginPath();
        c.arc(310, 80, 24, 0, Math.PI * 2);
        c.fill();
        // overlap a crescent mask
        c.fillStyle = skyGrad;
        c.beginPath();
        c.arc(298, 74, 24, 0, Math.PI * 2);
        c.fill();
      } else if (theme === Theme.CYBERPUNK) {
        // falling cyber 1s and 0s
        c.font = '700 11px monospace';
        backgroundElementsRef.current.forEach((node) => {
          c.fillStyle = `rgba(6, 182, 212, ${node.alpha ?? 0.25})`;
          // Draw random binary string
          const text = Math.random() > 0.5 ? '1' : '0';
          c.fillText(text, node.x, node.y);
        });

        // perspective cyberGrid floor lines
        c.strokeStyle = '#06b6d418';
        c.lineWidth = 1.5;
        const horizonY = 320;
        const numLines = 14;
        for (let i = 0; i <= numLines; i++) {
          const startX = (i / numLines) * CANVAS_WIDTH;
          const slantX = ((i / numLines) * (CANVAS_WIDTH + 300)) - 150;
          c.beginPath();
          c.moveTo(startX, horizonY);
          c.lineTo(slantX, CANVAS_HEIGHT - GROUND_HEIGHT);
          c.stroke();
        }
      }

      // 3. Draw Pipes
      pipesRef.current.forEach((pipe) => {
        const topY1 = 0;
        const topY2 = pipe.topHeight;
        const botY1 = pipe.bottomY;
        const botY2 = CANVAS_HEIGHT - GROUND_HEIGHT;

        // Custom gradients and stylings according to Theme
        let pipeGrad = c.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
        let highlightColor = '#22c55e'; // Green
        let outlineColor = '#15803d';

        if (theme === Theme.DAY) {
          pipeGrad.addColorStop(0, '#15803d');
          pipeGrad.addColorStop(0.25, '#22c55e');
          pipeGrad.addColorStop(0.5, '#4ade80');
          pipeGrad.addColorStop(0.8, '#22c55e');
          pipeGrad.addColorStop(1, '#166534');
        } else if (theme === Theme.NIGHT) {
          // Purple-indigo cyber pipe design
          pipeGrad.addColorStop(0, '#581c87');
          pipeGrad.addColorStop(0.3, '#a855f7');
          pipeGrad.addColorStop(0.65, '#d8b4fe');
          pipeGrad.addColorStop(1, '#3b0764');
          highlightColor = '#a855f7';
          outlineColor = '#c084fc';
        } else if (theme === Theme.CYBERPUNK) {
          // Glowing neon cyan cyber grids
          pipeGrad.addColorStop(0, '#0f172a');
          pipeGrad.addColorStop(0.5, '#0284c7');
          pipeGrad.addColorStop(1, '#0f172a');
          highlightColor = '#06b6d4';
          outlineColor = '#06b6d4';
        }

        c.fillStyle = pipeGrad;
        c.lineWidth = theme === Theme.CYBERPUNK ? 2.5 : 2;
        c.strokeStyle = outlineColor;

        // Draw top pipe shaft
        c.fillRect(pipe.x, topY1, pipe.width, topY2);
        c.strokeRect(pipe.x, topY1, pipe.width, topY2);

        // Draw bottom pipe shaft
        c.fillRect(pipe.x, botY1, pipe.width, botY2 - botY1);
        c.strokeRect(pipe.x, botY1, pipe.width, botY2 - botY1);

        // Draw top pipe lip/head
        const lipHeight = 22;
        const lipOffset = 3;
        const topLipY = pipe.topHeight - lipHeight;
        c.fillRect(pipe.x - lipOffset, topLipY, pipe.width + lipOffset * 2, lipHeight);
        c.strokeRect(pipe.x - lipOffset, topLipY, pipe.width + lipOffset * 2, lipHeight);

        // Top pipe inner structural shine
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.fillRect(pipe.x + 4, 0, 4, pipe.topHeight - lipHeight - 2);
        c.fillRect(pipe.x + 4, topLipY + 2, 4, lipHeight - 4);

        // Draw bottom pipe lip/head
        c.fillStyle = pipeGrad;
        const botLipY = pipe.bottomY;
        c.fillRect(pipe.x - lipOffset, botLipY, pipe.width + lipOffset * 2, lipHeight);
        c.strokeRect(pipe.x - lipOffset, botLipY, pipe.width + lipOffset * 2, lipHeight);

        // Bottom pipe inner structural shine
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.fillRect(pipe.x + 4, pipe.bottomY + lipHeight + 2, 4, CANVAS_HEIGHT - GROUND_HEIGHT - pipe.bottomY - lipHeight);
        c.fillRect(pipe.x + 4, botLipY + 2, 4, lipHeight - 4);

        // Tech visual scanlines for Cyberpunk
        if (theme === Theme.CYBERPUNK) {
          c.fillStyle = '#06b6d444';
          // top scanline strip
          c.fillRect(pipe.x - lipOffset, topLipY, pipe.width + lipOffset * 2, 2);
          c.fillRect(pipe.x, topY2 / 2, pipe.width, 2);
          // bottom scanline strip
          c.fillRect(pipe.x - lipOffset, botLipY + lipHeight - 2, pipe.width + lipOffset * 2, 2);
          c.fillRect(pipe.x, (botY1 + botY2) / 2, pipe.width, 2);
        }
      });

      // 4. Draw Trails & Particles
      particlesRef.current.forEach((p) => {
        c.fillStyle = p.color;
        c.globalAlpha = p.alpha;
        c.beginPath();

        if (p.type === 'feather') {
          // Feathers drawn as cute mini ellipsoids
          c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        } else if (p.type === 'star') {
          // Twinkle particles
          c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        } else {
          // circular dust puffs
          c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }

        c.fill();
      });
      c.globalAlpha = 1.0; // Reset globalAlpha

      // 5. Draw Bird
      const bird = birdRef.current;
      c.save();
      c.translate(bird.x, bird.y);
      c.rotate(bird.angle);

      // Render custom skins
      if (skin === BirdSkin.RETRO) {
        // Yellow Retro Chick
        // Shadow base
        c.fillStyle = '#00000025';
        c.beginPath();
        c.arc(2, 6, 12, 0, Math.PI * 2);
        c.fill();

        // Main body
        c.fillStyle = '#facc15'; // yellow
        c.strokeStyle = '#854d0e'; // dark yellow stroke
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(0, 0, bird.radius, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // Eye white
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(4, -4, 4.5, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // Pupil check
        c.fillStyle = '#000000';
        c.beginPath();
        c.arc(5.2, -4, 1.8, 0, Math.PI * 2);
        c.fill();

        // Cheerful rosy cheeks
        c.fillStyle = '#f87171';
        c.beginPath();
        c.arc(1.5, 1.5, 2, 0, Math.PI * 2);
        c.fill();

        // Cute orange Beak
        c.fillStyle = '#f97316';
        c.strokeStyle = '#7c2d12';
        c.beginPath();
        c.moveTo(11, -1.8);
        c.lineTo(17, 1);
        c.lineTo(10, 3.8);
        c.closePath();
        c.fill();
        c.stroke();

        // Flapping wing based on flap phase
        // Wing anchors on side
        const wingYOffset = Math.sin(bird.flapPhase) * 4.2;
        c.fillStyle = '#eab308'; // darker/deeper yellow
        c.beginPath();
        c.ellipse(-4, 0.5 + wingYOffset, 6.5, 4.5, -0.15, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else if (skin === BirdSkin.PHOENIX) {
        // Red Hot Fiery Phoenix
        // Flame halo
        const haloRadius = bird.radius + 3 + Math.sin(frameCountRef.current * 0.2) * 2;
        const fireGrad = c.createRadialGradient(0, 0, bird.radius - 2, 0, 0, haloRadius);
        fireGrad.addColorStop(0, '#f9731688');
        fireGrad.addColorStop(0.5, '#ef444455');
        fireGrad.addColorStop(1, '#ef444400');
        c.fillStyle = fireGrad;
        c.beginPath();
        c.arc(0, 0, haloRadius, 0, Math.PI * 2);
        c.fill();

        // Main body
        c.fillStyle = '#dc2626'; // Red
        c.strokeStyle = '#450a0a'; // blood crimson red
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(0, 0, bird.radius, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // Crown Feathers
        c.fillStyle = '#f97316';
        c.beginPath();
        c.moveTo(-7, -11);
        c.quadraticCurveTo(-12, -18, -15, -16);
        c.quadraticCurveTo(-11, -8, -10, -8);
        c.fill();

        // Phoenix Eye (Angry & glowing gold)
        c.fillStyle = '#facc15';
        c.beginPath();
        c.moveTo(2, -5);
        c.lineTo(8, -4);
        c.lineTo(4, -1);
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = '#000000';
        c.beginPath();
        c.arc(4.5, -4, 0.8, 0, Math.PI * 2);
        c.fill();

        // Phoenix Golden Beak
        c.fillStyle = '#eab308';
        c.beginPath();
        c.moveTo(11, -3);
        c.lineTo(19, 0);
        c.lineTo(9, 4);
        c.closePath();
        c.fill();
        c.stroke();

        // Fire wings
        const flameOffset = Math.sin(bird.flapPhase) * 4.5;
        c.fillStyle = '#ea580c';
        c.beginPath();
        c.ellipse(-4, flameOffset, 7.5, 4.5, -0.2, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      } else if (skin === BirdSkin.ROBO) {
        // Digital Cypher Mecha-Bird
        // metallic body
        let roboGrad = c.createLinearGradient(-10, -10, 10, 10);
        roboGrad.addColorStop(0, '#cbd5e1');
        roboGrad.addColorStop(0.5, '#64748b');
        roboGrad.addColorStop(1, '#334155');
        c.fillStyle = roboGrad;
        c.strokeStyle = '#0f172a';
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(0, 0, bird.radius, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // Laser scan line visor
        c.fillStyle = '#0f172a';
        c.fillRect(1, -5, 12, 4);
        c.strokeRect(1, -5, 12, 4);

        c.fillStyle = '#38bdf8'; // neon light
        c.beginPath();
        c.arc(7 + Math.sin(frameCountRef.current * 0.1) * 2, -3, 1.5, 0, Math.PI * 2);
        c.fill();

        // Jet booster funnel
        c.fillStyle = '#475569';
        c.beginPath();
        c.moveTo(-11, -4);
        c.lineTo(-15, -6);
        c.lineTo(-15, 6);
        c.lineTo(-11, 4);
        c.closePath();
        c.fill();
        c.stroke();

        // Steel Beak
        c.fillStyle = '#94a3b8';
        c.beginPath();
        c.moveTo(11, -2);
        c.lineTo(16, 0);
        c.lineTo(10, 2);
        c.closePath();
        c.fill();
        c.stroke();

        // Mecha Wing
        const roboWingY = Math.sin(bird.flapPhase) * 3;
        c.fillStyle = '#475569';
        c.beginPath();
        c.rect(-5, -2 + roboWingY, 7, 5);
        c.fill();
        c.stroke();
      } else if (skin === BirdSkin.BAT) {
        // Dark Mode Bat
        c.fillStyle = '#374151'; // dark stone
        c.strokeStyle = '#111827';
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(0, 0, bird.radius, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // Bat Ears
        c.fillStyle = '#1f2937';
        c.beginPath();
        c.moveTo(-6, -11);
        c.lineTo(-8, -19);
        c.lineTo(-1, -12);
        c.closePath();
        c.fill();
        c.stroke();

        c.beginPath();
        c.moveTo(1, -12);
        c.lineTo(4, -19);
        c.lineTo(6, -11);
        c.closePath();
        c.fill();
        c.stroke();

        // Red vampire eyes
        c.fillStyle = '#ef4444';
        c.beginPath();
        c.arc(5, -3, 2, 0, Math.PI * 2);
        c.fill();

        // Tiny fangs
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(7, 2);
        c.lineTo(8.5, 5);
        c.lineTo(9.5, 2);
        c.moveTo(10, 2);
        c.lineTo(11.5, 5);
        c.lineTo(12.5, 2);
        c.fill();

        // Bat Wings (black folded shape)
        const flapAmplitude = Math.sin(bird.flapPhase) * 4.5;
        c.fillStyle = '#111827';
        c.beginPath();
        c.moveTo(-3, 0);
        c.quadraticCurveTo(-14, -6 + flapAmplitude, -17, flapAmplitude);
        c.quadraticCurveTo(-10, 8 + flapAmplitude, -3, 0);
        c.fill();
        c.stroke();
      }

      c.restore();

      // 6. Draw Ground Layer
      let groundGradient = c.createLinearGradient(0, CANVAS_HEIGHT - GROUND_HEIGHT, 0, CANVAS_HEIGHT);
      let groundBorder = '#166534';
      if (theme === Theme.DAY) {
        groundGradient.addColorStop(0, '#86efac'); // bright grass green
        groundGradient.addColorStop(0.12, '#22c55e'); // grass
        groundGradient.addColorStop(0.13, '#15803d'); // grass split line
        groundGradient.addColorStop(0.14, '#eab308'); // dirt gold
        groundGradient.addColorStop(1, '#ca8a04'); // deep soil
        groundBorder = '#16a34a';
      } else if (theme === Theme.NIGHT) {
        groundGradient.addColorStop(0, '#100c2a');
        groundGradient.addColorStop(0.12, '#1e1b4b');
        groundGradient.addColorStop(0.14, '#1c1917');
        groundGradient.addColorStop(1, '#0c0a09');
        groundBorder = '#312e81';
      } else if (theme === Theme.CYBERPUNK) {
        groundGradient.addColorStop(0, '#06b6d4'); // glowing cyan neon ledge
        groundGradient.addColorStop(0.08, '#083344');
        groundGradient.addColorStop(1, '#020617');
        groundBorder = '#06b6d4';
      }

      // Draw bottom rectangle
      c.fillStyle = groundGradient;
      c.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);

      // Draw scrolling ground highlights
      if (gameState !== GameState.COLLIDED && gameState !== GameState.GAMEOVER) {
        c.strokeStyle = theme === Theme.CYBERPUNK ? '#22d3ee' : '#1e3a1e';
        c.lineWidth = 2.5;
        const totalStripes = 24;
        const widthBetween = CANVAS_WIDTH / totalStripes;

        c.save();
        if (theme === Theme.DAY) {
          // Classic retro diagonal segments
          c.fillStyle = '#16a34a'; // grass shade block offsets
          c.beginPath();
          c.rect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, 8);
          c.fill();

          c.fillStyle = '#eab308'; // dirt hatch
          for (let i = -1; i < totalStripes + 1; i++) {
            const sx = i * widthBetween - groundOffsetRef.current;
            c.beginPath();
            c.moveTo(sx, CANVAS_HEIGHT - GROUND_HEIGHT + 8);
            c.lineTo(sx + 12, CANVAS_HEIGHT - GROUND_HEIGHT + 8);
            c.lineTo(sx - 3, CANVAS_HEIGHT);
            c.lineTo(sx - 15, CANVAS_HEIGHT);
            c.closePath();
            c.fill();
          }
        } else if (theme === Theme.NIGHT) {
          c.fillStyle = '#312e81';
          for (let i = -1; i < totalStripes + 1; i++) {
            const sx = i * widthBetween - groundOffsetRef.current;
            c.beginPath();
            c.rect(sx, CANVAS_HEIGHT - GROUND_HEIGHT + 8, 10, 6);
            c.fill();
          }
        } else if (theme === Theme.CYBERPUNK) {
          // grid ticker line
          c.strokeStyle = '#06b6d4';
          c.beginPath();
          c.moveTo(0, CANVAS_HEIGHT - GROUND_HEIGHT);
          c.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_HEIGHT);
          c.stroke();

          // glow pulse lines
          c.fillStyle = '#06b6d425';
          for (let i = -1; i < totalStripes + 1; i++) {
            const sx = i * widthBetween - groundOffsetRef.current;
            c.fillRect(sx, CANVAS_HEIGHT - GROUND_HEIGHT + 10, 8, 30);
          }
        }
        c.restore();
      }

      // Ground Top border line
      c.strokeStyle = groundBorder;
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(0, CANVAS_HEIGHT - GROUND_HEIGHT);
      c.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_HEIGHT);
      c.stroke();

      // EXTRA DESIGN: Add subtle Vignette CRT arcade layout shadow over the game content
      let crtGrad = c.createRadialGradient(
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2,
        CANVAS_HEIGHT * 0.45,
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2,
        CANVAS_HEIGHT * 0.8
      );
      crtGrad.addColorStop(0, 'rgba(0,0,0,0)');
      crtGrad.addColorStop(1, 'rgba(0,0,0,0.22)');
      c.fillStyle = crtGrad;
      c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Subtle scanline overlay
      c.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      c.lineWidth = 1.0;
      for (let y = 0; y < CANVAS_HEIGHT; y += 4) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(CANVAS_WIDTH, y);
        c.stroke();
      }

      // 7. Draw "P - Pause Hint" or Start visual overlays on Canvas
      if (gameState === GameState.START) {
        // Beautiful floating start prompt
        c.fillStyle = 'rgba(0, 0, 0, 0.45)';
        c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_HEIGHT);

        c.textAlign = 'center';
        
        // Let's draw high-contrast arcade titles
        c.font = '800 24px system-ui, sans-serif';
        c.fillStyle = '#ffffff';
        c.fillText('FLAPPY BIRD', CANVAS_WIDTH / 2, 180);
        
        c.font = '500 13px system-ui, sans-serif';
        c.fillStyle = '#cbd5e1';
        c.fillText('Click, Tap, or Press SPACE to flap', CANVAS_WIDTH / 2, 220);

        // draw click pulse indicator
        const scaleVal = 1 + Math.sin(frameCountRef.current * 0.15) * 0.08;
        c.save();
        c.translate(CANVAS_WIDTH / 2, 330);
        c.scale(scaleVal, scaleVal);
        
        c.fillStyle = '#facc15';
        c.strokeStyle = '#eab308';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, 22, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // draw cute wing flaps in symbol
        c.fillStyle = '#000000Color';
        c.font = 'bold 15px system-ui';
        c.fillStyle = '#451a03';
        c.fillText('GO', 0, 5);
        c.restore();
      }

      if (gameState === GameState.PAUSED) {
        // Dim screen
        c.fillStyle = 'rgba(0,0,0,0.5)';
        c.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        c.textAlign = 'center';
        c.font = '800 28px system-ui';
        c.fillStyle = '#ffffff';
        c.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);

        c.font = '500 13px system-ui';
        c.fillStyle = '#e2e8f0';
        c.fillText('Press P to Resume', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 15);
      }
    };

    // Run the cycle
    gameLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, theme, difficulty, skin]);

  return (
    <div className="relative overflow-hidden w-full h-full aspect-[400/550] select-none rounded-[1.5rem] bg-slate-950 border border-slate-800/80 shadow-2xl">
      <canvas
        id="game-canvas"
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full block rounded-[1.4rem] cursor-pointer"
      />
    </div>
  );
};
