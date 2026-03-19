/**
 * SimulationEngine.js
 * A robust wrapper for D3/JS simulations to provide extensive error handling,
 * state-snapshotting (for AI debugging), and global recovery boundaries.
 */

import * as d3 from 'd3';

export class SimulationEngine {
  constructor(options = {}) {
    this.name = options.name || 'Unnamed Simulator';
    this.fps = options.fps || 60;
    this.lastFrameTime = 0;
    this.isRunning = false;
    this.timer = null;
    this.onUpdate = options.onUpdate || (() => {});
    this.onError = options.onError || this.defaultErrorHandler.bind(this);
    
    // Performance and Debugging
    this.stateLog = [];
    this.maxLogSize = 100;
    this.errorCount = 0;
    this.recoveryAttempts = 0;
  }

  /**
   * Safe execution wrapper for simulation steps.
   * Captures the current state and catches any mathematical or rendering exceptions.
   */
  async step(stateSnapshot = {}) {
    try {
      // 1. Snapshot the state (for telemetry and debugging)
      if (this.stateLog.length > this.maxLogSize) this.stateLog.shift();
      this.stateLog.push({
        timestamp: Date.now(),
        state: JSON.parse(JSON.stringify(stateSnapshot))
      });

      // 2. Execute the user-provided update logic
      await this.onUpdate();

    } catch (error) {
      this.errorCount++;
      this.onError(error, stateSnapshot);
      
      // Attempt recovery by pausing if errors are frequent
      if (this.errorCount > 10) {
        console.warn(`[${this.name}] High error frequency. Suspending simulation for stability.`);
        this.stop();
      }
    }
  }

  /**
   * Starts the simulation using d3.timer for high-precision frame timing.
   */
  start(stateRef) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[${this.name}] Simulation Engine Started.`);

    this.timer = d3.timer((elapsed) => {
      this.step(stateRef);
      if (!this.isRunning) this.timer.stop();
    });
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      this.timer.stop();
      this.timer = null;
    }
    console.log(`[${this.name}] Simulation Engine Stopped.`);
  }

  /**
   * Default error handler that provides detailed telemetry for Antigravity.
   */
  defaultErrorHandler(error, stateSnapshot) {
    const errorPayload = {
      simulator: this.name,
      message: error.message,
      stack: error.stack,
      snapshot: stateSnapshot,
      errorId: `ERR-${Date.now()}`
    };

    console.error(`[Simulation Failure :: ${this.name}]`, errorPayload);

    // Provide visual feedback in the UI if possible
    const overlay = document.getElementById('error-overlay');
    if (overlay) {
      overlay.style.display = 'block';
      overlay.innerHTML = `
        <div class="m-error-card">
          <h4>Simulation Exception Encountered</h4>
          <p class="text-xs">${error.message}</p>
          <code>ID: ${errorPayload.errorId}</code>
          <button onclick="location.reload()" class="btn btn-error btn-sm mt-2">Recover System</button>
        </div>
      `;
    }
  }

  /**
   * Telemetry dump for AI Assistant (Antigravity) processing.
   */
  getTelemetryData() {
    return {
      name: this.name,
      uptime: this.isRunning ? Date.now() - this.lastFrameTime : 0,
      errors: this.errorCount,
      lastStates: this.stateLog.slice(-5)
    };
  }
}
