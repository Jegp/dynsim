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
      initialX: config.initialX ?? 0,
      height: config.height || 400,
      plotType: config.plotType || 'timeseries',
      plotConfig: config.plotConfig || {},
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
    this.view.setPauseState(this.isRunning);
  }

  animate() {
    if (this.isRunning) {
      const inputValue = this.view.getInput();
      const paramValues = this.view.getParameters();

      try {
        this.simulation.step(inputValue, paramValues);
      } catch (e) {
        console.error('[DynSim] Step error:', e);
        this.stop();
        return;
      }
    }

    const plotArrays = this.simulation.getPlotArrays();
    const xRange = this.simulation.plotType === 'timeseries'
      ? this.simulation.getTimeseriesRange()
      : undefined;
    this.view.updatePlot(plotArrays, xRange);

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    this.stop();
    this.view.destroy();
  }
}
