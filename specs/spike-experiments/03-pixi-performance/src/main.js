/**
 * PixiJS Performance Test - Main Entry Point
 */

import * as PIXI from 'pixi.js';

class PerformanceTest {
  constructor() {
    this.app = null;
    this.agents = [];
    this.fpsHistory = [];
    this.lastTime = performance.now();
    this.frames = 0;

    this.init();
  }

  /**
   * Initialize PixiJS Application
   */
  async init() {
    // Create PixiJS app
    this.app = new PIXI.Application();

    await this.app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x2c3e50,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Add canvas to container
    const container = document.getElementById('canvas-container');
    container.appendChild(this.app.canvas);

    // Start FPS counter
    this.startFPSCounter();

    // Setup event listeners
    this.setupEventListeners();

    console.log('PixiJS Performance Test initialized');
    this.updateMetrics();
  }

  /**
   * Start FPS Counter
   */
  startFPSCounter() {
    this.app.ticker.add(() => {
      this.frames++;
      const now = performance.now();

      if (now - this.lastTime >= 1000) {
        const fps = Math.round(this.frames * 1000 / (now - this.lastTime));
        this.updateFPS(fps);

        this.fpsHistory.push(fps);
        if (this.fpsHistory.length > 60) {
          this.fpsHistory.shift();
        }

        this.frames = 0;
        this.lastTime = now;
      }

      this.updateMetrics();
    });
  }

  /**
   * Update FPS Display
   */
  updateFPS(fps) {
    const fpsEl = document.getElementById('fps');
    fpsEl.textContent = `FPS: ${fps}`;

    // Color coding
    if (fps >= 60) {
      fpsEl.style.color = '#4ade80'; // green
    } else if (fps >= 30) {
      fpsEl.style.color = '#fbbf24'; // yellow
    } else {
      fpsEl.style.color = '#ef4444'; // red
    }
  }

  /**
   * Update Metrics Display
   */
  updateMetrics() {
    // Agent count
    document.getElementById('agent-count').textContent = this.agents.length;

    // Memory (approximate)
    if (performance.memory) {
      const memoryMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(0);
      document.getElementById('memory').textContent = `${memoryMB} MB`;
    }

    // Draw calls (approximate)
    const drawCalls = this.app.renderer.batch.drawCalls;
    document.getElementById('draw-calls').textContent = drawCalls || 'N/A';
  }

  /**
   * Setup Event Listeners
   */
  setupEventListeners() {
    // Test 1: Basic Rendering
    document.getElementById('test-basic').addEventListener('click', () => {
      this.clearAgents();
      this.testBasicRendering();
    });

    // Test 2: Animation
    document.getElementById('test-animation').addEventListener('click', () => {
      this.clearAgents();
      this.testAnimation();
    });

    // Test 3: Zoom/Pan
    document.getElementById('test-zoom').addEventListener('click', () => {
      this.testZoomPan();
    });

    // Clear
    document.getElementById('clear').addEventListener('click', () => {
      this.clearAgents();
    });

    // Window resize
    window.addEventListener('resize', () => {
      this.app.renderer.resize(window.innerWidth, window.innerHeight);
    });
  }

  /**
   * Test 1: Basic Rendering (30 agents)
   */
  testBasicRendering() {
    console.log('Test 1: Basic Rendering - Creating 30 agents');

    const roles = ['FE', 'BE', 'QA', 'DevOps', 'PO', 'Architect'];
    const colors = [0x3b82f6, 0x10b981, 0xf59e0b, 0xef4444, 0x8b5cf6, 0x06b6d4];

    for (let i = 0; i < 30; i++) {
      const roleIndex = i % roles.length;
      const agent = this.createAgent(roles[roleIndex], colors[roleIndex]);

      // Grid layout
      const col = i % 6;
      const row = Math.floor(i / 6);
      agent.x = 150 + col * 200;
      agent.y = 150 + row * 150;

      this.app.stage.addChild(agent);
      this.agents.push(agent);
    }

    console.log(`✓ Created ${this.agents.length} agents`);
  }

  /**
   * Test 2: Animation (30 animated agents)
   */
  testAnimation() {
    console.log('Test 2: Animation - Creating 30 animated agents');

    this.testBasicRendering();

    // Add animation to all agents
    this.agents.forEach((agent, index) => {
      const speed = 0.02 + (index * 0.001);
      const radius = 20;
      const startX = agent.x;
      const startY = agent.y;

      this.app.ticker.add(() => {
        const time = Date.now() * speed;
        agent.x = startX + Math.cos(time) * radius;
        agent.y = startY + Math.sin(time) * radius;
        agent.rotation += 0.01;
      });
    });

    console.log('✓ Animation started');
  }

  /**
   * Test 3: Zoom/Pan
   */
  testZoomPan() {
    console.log('Test 3: Zoom/Pan - Testing viewport interaction');

    if (this.agents.length === 0) {
      this.testBasicRendering();
    }

    let scale = 1;
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };

    // Zoom
    this.app.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      scale = Math.max(0.5, Math.min(2, scale + delta));
      this.app.stage.scale.set(scale);
      console.log(`Zoom: ${scale.toFixed(2)}x`);
    });

    // Pan
    this.app.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragStart = { x: e.clientX - this.app.stage.x, y: e.clientY - this.app.stage.y };
    });

    this.app.canvas.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      this.app.stage.x = e.clientX - dragStart.x;
      this.app.stage.y = e.clientY - dragStart.y;
    });

    this.app.canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });

    console.log('✓ Zoom/Pan enabled - Use mouse wheel to zoom, drag to pan');
  }

  /**
   * Create Agent Sprite
   */
  createAgent(role, color) {
    const container = new PIXI.Container();

    // Circle background
    const circle = new PIXI.Graphics();
    circle.circle(0, 0, 30);
    circle.fill({ color });
    container.addChild(circle);

    // Role text
    const text = new PIXI.Text({
      text: role,
      style: {
        fontFamily: 'Arial',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0xffffff,
      }
    });
    text.anchor.set(0.5);
    container.addChild(text);

    // Interactive
    container.eventMode = 'static';
    container.cursor = 'pointer';

    container.on('pointerover', () => {
      container.scale.set(1.1);
    });

    container.on('pointerout', () => {
      container.scale.set(1);
    });

    return container;
  }

  /**
   * Clear All Agents
   */
  clearAgents() {
    console.log('Clearing all agents...');

    this.agents.forEach(agent => {
      this.app.stage.removeChild(agent);
      agent.destroy({ children: true });
    });

    this.agents = [];
    this.app.ticker.stop();
    this.app.ticker.start();

    console.log('✓ Agents cleared');
  }
}

// Initialize when DOM is ready
new PerformanceTest();
