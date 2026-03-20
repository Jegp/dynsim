/**
 * SimulationView — DOM + Plotly rendering.
 *
 * Creates the UI (sliders, buttons, plot area), reads user input,
 * and updates the Plotly chart. Emits events via callbacks.
 * Contains no simulation logic.
 */
export class SimulationView {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container - DOM element to render into
   * @param {Array} options.params - Parameter definitions [{id, label, min, max, step, value}]
   * @param {number} options.initialX - Initial input value
   * @param {number} options.height - Plot height in pixels
   * @param {string} options.plotType - 'timeseries' | '3d' | '2d'
   * @param {object} options.plotConfig - Plotly layout config
   * @param {object} [options.callbacks] - { onReset, onPauseToggle }
   */
  constructor({ container, params, input, height, plotType, plotConfig, spikeThreshold, callbacks }) {
    this.container = container;
    this.params = params;
    this.input = input || { label: 'Input (x)', min: -2, max: 2, step: 0.1, value: 0 };
    this.height = height || 400;
    this.plotType = plotType || 'timeseries';
    this.plotConfig = plotConfig || {};
    this.spikeThreshold = spikeThreshold;
    this.callbacks = callbacks || {};

    this.plotDiv = null;

    this.createHTML();
    this.initPlot();
  }

  createHTML() {
    this.container.innerHTML = `
      <div class="dynsim-container" style="font-family: Arial, sans-serif; font-size: 0.9em;">
        <div class="dynsim-controls" style="background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #ddd; margin-bottom: 12px; box-sizing: border-box;">
          <div class="dynsim-params"></div>
        </div>
        <div style="width: 100%; height: ${this.height}px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; overflow: hidden;">
          <div class="dynsim-plot" style="width: 100%; height: 100%;"></div>
        </div>
      </div>
    `;

    this._buildControls();
    this.plotDiv = this.container.querySelector('.dynsim-plot');

    // Typeset LaTeX in labels if MathJax is available
    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
      MathJax.typesetPromise([this.container.querySelector('.dynsim-controls')]);
    }
  }

  _buildControls() {
    const paramsDiv = this.container.querySelector('.dynsim-params');

    // Input slider row
    let html = `
      <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 8px;">
        <label style="font-weight: 600; font-size: 0.85em; color: #0056b3; white-space: nowrap;">${this.input.label}:</label>
        <input type="range" class="dynsim-input"
          min="${this.input.min}" max="${this.input.max}" step="${this.input.step}" value="${this.input.value}"
          style="flex: 1; height: 6px; min-width: 100px;">
        <span class="dynsim-input-value" style="background: #cfe2ff; padding: 2px 8px; border-radius: 3px; font-size: 0.85em; min-width: 40px; text-align: center; font-family: monospace;">${this.input.value.toFixed(2)}</span>
        <button class="dynsim-reset" style="background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center;" title="Reset">
          <svg width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-9 -9c2.5 0 4.8 1 6.5 2.5l.5 .5"/>
            <path d="M21 3v6h-6"/>
          </svg>
        </button>
      </div>
    `;

    // Parameter sliders row
    html += `<div style="display: flex; gap: 12px; align-items: center;">`;
    html += this.params.map(param => `
      <label style="font-weight: 600; font-size: 0.85em; white-space: nowrap;">${param.label}:</label>
      <input type="range" class="dynsim-param" data-param="${param.id}"
        min="${param.min}" max="${param.max}" step="${param.step}" value="${param.value}"
        style="flex: 1; height: 6px; min-width: 100px;">
      <span class="dynsim-param-value" style="background: #e9ecef; padding: 2px 8px; border-radius: 3px; font-size: 0.85em; min-width: 40px; text-align: center; font-family: monospace;">${param.value.toFixed(2)}</span>
    `).join('');
    html += `
      <button class="dynsim-pause" style="background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center;" title="Pause">
        ${SimulationView.PAUSE_ICON}
      </button>
    </div>`;

    paramsDiv.innerHTML = html;

    // Wire up slider display updates
    paramsDiv.querySelector('.dynsim-input').addEventListener('input', (e) => {
      e.target.closest('div').querySelector('.dynsim-input-value')
        .textContent = parseFloat(e.target.value).toFixed(2);
    });
    paramsDiv.querySelectorAll('.dynsim-param').forEach(slider => {
      slider.addEventListener('input', (e) => {
        e.target.nextElementSibling.textContent = parseFloat(e.target.value).toFixed(2);
      });
    });

    // Wire up button callbacks
    this.container.querySelector('.dynsim-reset')
      .addEventListener('click', () => this.callbacks.onReset?.());
    this.container.querySelector('.dynsim-pause')
      .addEventListener('click', () => this.callbacks.onPauseToggle?.());
  }

  initPlot() {
    if (this.plotType === '3d') {
      Plotly.newPlot(this.plotDiv, [{
        x: [], y: [], z: [],
        mode: 'lines',
        type: 'scatter3d',
        line: { color: '#2196f3', width: 4 }
      }], {
        title: this.plotConfig.title,
        scene: {
          xaxis: { title: this.plotConfig.xaxis?.title || 'X' },
          yaxis: { title: this.plotConfig.yaxis?.title || 'Y' },
          zaxis: { title: this.plotConfig.zaxis?.title || 'Z' }
        },
        margin: { l: 0, r: 0, t: 30, b: 0 }
      });
    } else {
      const layout = { margin: { l: 50, r: 20, t: 40, b: 50 } };
      if (this.plotConfig.title) layout.title = this.plotConfig.title;
      if (this.plotConfig.xaxis) layout.xaxis = this.plotConfig.xaxis;
      if (this.plotConfig.yaxis) layout.yaxis = this.plotConfig.yaxis;

      Plotly.newPlot(this.plotDiv, [{
        x: [], y: [],
        mode: 'lines',
        line: { color: '#2196f3', width: 2 }
      }], layout);
    }
  }

  /**
   * Read the current input slider value.
   * @returns {number}
   */
  getInput() {
    return parseFloat(this.container.querySelector('.dynsim-input').value);
  }

  /**
   * Read current parameter slider values as a dict keyed by param ID.
   * @returns {object}
   */
  getParameters() {
    const result = {};
    this.container.querySelectorAll('.dynsim-param').forEach(slider => {
      result[slider.dataset.param] = parseFloat(slider.value);
    });
    return result;
  }

  /**
   * Update the Plotly chart with new data.
   * @param {object} plotArrays - { x, y, z? } from Simulation.getPlotArrays()
   * @param {[number, number]} [xRange] - x-axis range for timeseries
   * @param {number[]} [spikeTimes] - spike times to render as vertical lines
   */
  updatePlot(plotArrays, xRange, spikeTimes) {
    if (this.plotType === '3d') {
      Plotly.animate(this.plotDiv, {
        data: [{ x: plotArrays.x, y: plotArrays.y, z: plotArrays.z }]
      }, { transition: { duration: 0 }, frame: { duration: 0 } });
    } else if (this.plotType === 'timeseries') {
      const layout = {
        title: this.plotConfig.title,
        xaxis: { title: this.plotConfig.xaxis?.title || 'Time', range: xRange },
        yaxis: this.plotConfig.yaxis,
        margin: { l: 50, r: 20, t: 40, b: 50 }
      };

      // Render spike markers and threshold line
      const shapes = [];

      // Spike threshold: horizontal dashed line
      if (this.spikeThreshold != null) {
        shapes.push({
          type: 'line',
          x0: 0, x1: 1, xref: 'paper',
          y0: this.spikeThreshold, y1: this.spikeThreshold,
          line: { color: 'grey', width: 1, dash: 'dash' }
        });
      }

      // Spike times: vertical lines
      if (spikeTimes && spikeTimes.length > 0) {
        for (const t of spikeTimes) {
          shapes.push({
            type: 'line',
            x0: t, x1: t,
            y0: 0, y1: 1, yref: 'paper',
            line: { color: 'rgba(255, 0, 0, 0.4)', width: 1 }
          });
        }
      }

      if (shapes.length > 0) layout.shapes = shapes;

      Plotly.react(this.plotDiv,
        [{ x: plotArrays.x, y: plotArrays.y, mode: 'lines', line: { color: '#2196f3', width: 2 } }],
        layout
      );
    } else {
      Plotly.animate(this.plotDiv, {
        data: [{ x: plotArrays.x, y: plotArrays.y }]
      }, { transition: { duration: 0 }, frame: { duration: 0 } });
    }
  }

  /**
   * Update the pause button icon.
   * @param {boolean} isRunning
   */
  setPauseState(isRunning) {
    const btn = this.container.querySelector('.dynsim-pause');
    btn.title = isRunning ? 'Pause' : 'Play';
    btn.innerHTML = isRunning ? SimulationView.PAUSE_ICON : SimulationView.PLAY_ICON;
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

SimulationView.PAUSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="10" y1="15" x2="10" y2="9"></line><line x1="14" y1="15" x2="14" y2="9"></line></svg>`;

SimulationView.PLAY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>`;
