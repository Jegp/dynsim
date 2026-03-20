/**
 * SimulationController — wires Simulation + SimulationView.
 *
 * Owns the requestAnimationFrame loop. Each tick:
 * reads input from view → calls simulation.step() → updates view.
 */
import { Simulation } from './simulation.js';
import { SimulationView } from './view.js';

export class SimulationController {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container - DOM element for the simulation view
   * @param {object} options.config - Parsed system config (from registry)
   * @param {function} options.stepProvider - () => stepFunction
   */
  constructor({ container, config, stepProvider }) {
    this.isRunning = true;
    this.animationId = null;

    this.simulation = new Simulation(config, stepProvider);

    this.view = new SimulationView({
      container,
      params: config.params,
      input: config.input || { label: 'Input (x)', min: -2, max: 2, step: 0.1, value: 0 },
      height: config.height || 400,
      plotType: config.plotType || 'timeseries',
      plotConfig: config.plotConfig || {},
      spikeThreshold: config.spikeThreshold ?? null,
      callbacks: {
        onReset: () => this.reset(),
        onPauseToggle: () => this.togglePause()
      }
    });
  }

  start() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.animate();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  reset() {
    this.simulation.reset();
    this.view.initPlot();
  }

  togglePause() {
    this.isRunning = !this.isRunning;
    // Clear pause time so the simulation can continue past it
    if (this.isRunning && this.simulation.paused) {
      this.simulation.pauseTime = null;
    }
    this.view.setPauseState(this.isRunning);
  }

  animate() {
    if (this.isRunning && !this.simulation.paused) {
      const inputValue = this.view.getInput();
      const paramValues = this.view.getParameters();

      try {
        this.simulation.step(inputValue, paramValues);
      } catch (e) {
        console.error('[DynSim] Step error:', e);
        this.stop();
        return;
      }

      // Auto-pause when pause time is reached
      if (this.simulation.paused) {
        this.isRunning = false;
        this.view.setPauseState(false);
      }
    }

    const plotArrays = this.simulation.getPlotArrays();
    const xRange = this.simulation.plotType === 'timeseries'
      ? this.simulation.getTimeseriesRange()
      : undefined;
    const spikeTimes = this.simulation.spikes ? this.simulation.spikeTimes : undefined;
    this.view.updatePlot(plotArrays, xRange, spikeTimes);

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    this.stop();
    this.view.destroy();
  }
}
