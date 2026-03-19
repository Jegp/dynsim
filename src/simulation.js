/**
 * Pure simulation engine — no DOM, no Plotly.
 *
 * Manages state, stepping, and plot data buffering.
 * The step function is resolved via a stepProvider on each tick,
 * enabling live code replacement.
 */
export class Simulation {
  /**
   * @param {object} config
   * @param {Array} config.params - Parameter definitions [{id, label, min, max, step, value}]
   * @param {string} config.plotType - 'timeseries' | '3d' | '2d'
   * @param {object} config.plotConfig - Plotly layout config (title, axes, etc.)
   * @param {object} config.initialState - Initial state object
   * @param {number} config.initialX - Initial input/output value
   * @param {number} config.dt - Time step
   * @param {number} [config.maxPoints=1000] - Max buffered points (non-timeseries)
   * @param {number} [config.maxPoints=1000] - Max buffered points (non-timeseries)
   * @param {number} [config.pauseTime=null] - Pause simulation at this time (null = run forever)
   * @param {string} [config.spikes=null] - State variable name to check for spikes (e.g. 'z'). Falsy = no spikes.
   * @param {function} stepProvider - () => stepFunction. Called each tick to get the current step function.
   */
  constructor(config, stepProvider) {
    this.params = config.params;
    this.plotType = config.plotType || 'timeseries';
    this.plotConfig = config.plotConfig || {};
    this.initialState = config.initialState || { t: 0 };
    this.initialX = config.initialX ?? 0;
    this.dt = config.dt || 0.01;
    this.maxPoints = config.maxPoints || 1000;
    this.pauseTime = config.pauseTime ?? null;
    this.spikes = config.spikes || null;

    this.stepProvider = stepProvider;

    this.x = this.initialX;
    this.state = { ...this.initialState };
    this.time = 0;
    this.plotData = [];
    this.spikeTimes = [];
  }

  /**
   * Advance one time step.
   * @param {number} inputValue - Current input from the user (slider)
   * @param {object} paramValues - Parameter values keyed by param ID
   * @returns {{ x: number, state: object, dataPoint: Array }} result of the step
   * @throws if stepProvider returns null or step function throws
   */
  step(inputValue, paramValues) {
    const stepFn = this.stepProvider();
    if (!stepFn) {
      throw new Error('No step function available');
    }

    // Add dt to params
    const params = { ...paramValues, dt: this.dt };

    const result = stepFn(inputValue, this.state, params);
    this.x = result[0];
    this.state = result[1];
    this.time += this.dt;

    // Record spike if the configured state variable is truthy
    if (this.spikes && this.state[this.spikes]) {
      this.spikeTimes.push(this.time);
    }

    const dataPoint = this._collectDataPoint();
    this.plotData.push(dataPoint);
    this._manageBuffer();

    return { x: this.x, state: this.state, dataPoint };
  }

  /**
   * Whether the simulation has reached its pause time.
   * @returns {boolean}
   */
  get paused() {
    return this.pauseTime != null && this.time >= this.pauseTime;
  }

  /**
   * Reset simulation to initial conditions.
   */
  reset() {
    this.x = this.initialX;
    this.state = { ...this.initialState };
    this.time = 0;
    this.plotData = [];
    this.spikeTimes = [];
  }

  /**
   * Get current plot data arrays suitable for Plotly.
   * @returns {object} { x, y, z? } arrays
   */
  getPlotArrays() {
    if (this.plotType === '3d') {
      return {
        x: this.plotData.map(d => d[0]),
        y: this.plotData.map(d => d[1]),
        z: this.plotData.map(d => d[2])
      };
    }
    return {
      x: this.plotData.map(d => d[0]),
      y: this.plotData.map(d => d[1])
    };
  }

  /**
   * Compute the current x-axis range for timeseries plots.
   * @returns {[number, number]} [min, max]
   */
  getTimeseriesRange() {
    const windowSize = (this.plotConfig.xaxis?.range?.[1] - this.plotConfig.xaxis?.range?.[0]) || 50;
    const originalEnd = this.plotConfig.xaxis?.range?.[1] || 50;

    if (this.time > originalEnd) {
      return [this.time - windowSize, this.time];
    }
    return this.plotConfig.xaxis?.range || [0, 50];
  }

  // --- Private ---

  _collectDataPoint() {
    if (this.plotType === '3d') {
      return [this.state.x || this.x, this.state.y || 0, this.state.z || 0];
    } else if (this.plotType === 'timeseries') {
      return [this.time, this.x];
    } else {
      return [this.x, this.state.y || 0];
    }
  }

  _manageBuffer() {
    if (this.plotType === 'timeseries') {
      const windowSize = this.plotConfig.xaxis?.range?.[1] || 50;
      const pointsPerWindow = Math.ceil(windowSize / this.dt);
      const bufferPoints = Math.ceil(pointsPerWindow * 0.5);
      const targetPoints = pointsPerWindow + bufferPoints;

      if (this.plotData.length > targetPoints * 2) {
        this.plotData = this.plotData.slice(-targetPoints);
        // Trim old spike times outside the buffer
        if (this.spikeTimes.length > 0) {
          const cutoff = this.plotData[0][0]; // earliest time in buffer
          const firstKeep = this.spikeTimes.findIndex(t => t >= cutoff);
          if (firstKeep > 0) this.spikeTimes = this.spikeTimes.slice(firstKeep);
        }
      }
    } else {
      if (this.plotData.length > this.maxPoints) {
        this.plotData.shift();
      }
    }
  }
}
