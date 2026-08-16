/**
 * SimulationController — wires Simulation + SimulationView + CodeEditor.
 *
 * Owns the requestAnimationFrame loop. Each tick:
 * reads input from view → calls simulation.step() → updates view.
 *
 * When config.editor is set, creates a CodeEditor above the simulation
 * that allows live editing and hot-swapping of the step function.
 */
import { Simulation } from './simulation.js';
import { SimulationView } from './view.js';
import { CodeEditor } from './editor.js';

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
    this.editor = null;

    // If editor config is present, create the editor above the sim
    if (config.editor) {
      const editorDiv = document.createElement('div');
      container.parentNode.insertBefore(editorDiv, container);
      this._editorDiv = editorDiv;

      const editorConfig = typeof config.editor === 'object' ? config.editor : {};
      this.editor = new CodeEditor({
        container: editorDiv,
        containerId: container.id,
        initialCode: editorConfig.code || '',
        live: editorConfig.live !== false,
        debounceMs: editorConfig.debounceMs || 500,
        executePython: (code, containerId) => {
          if (window._dynsimExecPython) {
            window._dynsimExecPython(code, containerId);
          } else {
            throw new Error('PyScript runtime not ready');
          }
        }
      });
    }

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

  async start() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    await this.view.initPlot();
    this.animate();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  async reset() {
    this.simulation.reset();
    await this.view.initPlot();
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
    // Stop if the plot element was detached (e.g. by React hydration).
    // The SPA polling will create a new controller on the replacement element.
    // Use isConnected rather than document.contains so this also works when the
    // plot lives inside a shadow root (document.contains is false for those).
    if (!this.view.plotDiv?.isConnected) {
      console.log('[DynSim] Plot element detached from DOM, stopping controller');
      this.stop();
      return;
    }

    let stepped = false;
    if (this.isRunning && !this.simulation.paused) {
      const inputValue = this.view.getInput();
      const paramValues = this.view.getParameters();

      try {
        this.simulation.step(inputValue, paramValues);
        this._lastStepError = null;
        stepped = true;
      } catch (e) {
        // Log but keep the loop alive — the user may fix the code in the editor
        if (this._lastStepError !== e.message) {
          console.error('[DynSim] Step error:', e);
          this._lastStepError = e.message;
        }
      }

      // Auto-pause when pause time is reached
      if (this.simulation.paused) {
        this.isRunning = false;
        this.view.setPauseState(false);
      }
    }

    // Only redraw on frames that advanced the simulation. While paused the plot
    // holds its last frame, which hands the axes back to the user: they can
    // zoom/pan/autoscale the frozen trace freely. (updatePlot re-asserts the
    // simulation's ranges every frame, so redrawing while paused would fight
    // the user's interaction.) Resuming steps again and takes the axes back.
    // This also skips Plotly.react entirely while idle.
    if (stepped) {
      const plotArrays = this.simulation.getPlotArrays();
      const xRange = this.simulation.plotType === 'timeseries'
        ? this.simulation.getTimeseriesRange()
        : undefined;
      const spikeTimes = this.simulation.spikes ? this.simulation.spikeTimes : undefined;
      this.view.updatePlot(plotArrays, xRange, spikeTimes);
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    this.stop();
    this.view.destroy();
    if (this._editorDiv) {
      this._editorDiv.remove();
      this._editorDiv = null;
      this.editor = null;
    }
  }
}
