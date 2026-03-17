import { describe, it, expect, beforeEach } from 'vitest';
import { Simulation } from '../src/simulation.js';

// A simple linear step: x_new = x + input * dt, state unchanged
function linearStep(x, state, params) {
  return [x + params.dt, { ...state, t: state.t + params.dt }];
}

// Doubling step: x_new = x * 2
function doublingStep(x, state, params) {
  return [x * 2, state];
}

function makeConfig(overrides = {}) {
  return {
    params: [],
    plotType: 'timeseries',
    plotConfig: { xaxis: { range: [0, 10] } },
    initialState: { t: 0 },
    initialX: 1,
    dt: 0.1,
    maxPoints: 100,
    ...overrides,
  };
}

describe('Simulation', () => {
  let sim;

  beforeEach(() => {
    sim = new Simulation(makeConfig(), () => linearStep);
  });

  describe('constructor', () => {
    it('initializes with config values', () => {
      expect(sim.x).toBe(1);
      expect(sim.time).toBe(0);
      expect(sim.plotData).toEqual([]);
      expect(sim.dt).toBe(0.1);
      expect(sim.plotType).toBe('timeseries');
    });

    it('uses defaults for missing config', () => {
      const sim2 = new Simulation({}, () => linearStep);
      expect(sim2.initialX).toBe(0);
      expect(sim2.dt).toBe(0.01);
      expect(sim2.plotType).toBe('timeseries');
      expect(sim2.maxPoints).toBe(1000);
    });
  });

  describe('step', () => {
    it('advances state by one tick', () => {
      // linearStep: x_new = inputValue + dt = 1 + 0.1 = 1.1
      const result = sim.step(1, {});
      expect(result.x).toBeCloseTo(1.1);
      expect(sim.x).toBeCloseTo(1.1);
      expect(sim.time).toBeCloseTo(0.1);
    });

    it('accumulates plot data', () => {
      sim.step(0, {});
      sim.step(0, {});
      sim.step(0, {});
      expect(sim.plotData).toHaveLength(3);
    });

    it('passes params including dt to step function', () => {
      let receivedParams;
      const spy = (x, state, params) => {
        receivedParams = params;
        return [x, state];
      };
      const sim2 = new Simulation(makeConfig(), () => spy);
      sim2.step(5, { alpha: 0.5 });
      expect(receivedParams.dt).toBe(0.1);
      expect(receivedParams.alpha).toBe(0.5);
    });

    it('throws if no step function available', () => {
      const sim2 = new Simulation(makeConfig(), () => null);
      expect(() => sim2.step(0, {})).toThrow('No step function available');
    });

    it('collects timeseries data as [time, x]', () => {
      // linearStep with input=1: x_new = 1 + 0.1 = 1.1
      sim.step(1, {});
      expect(sim.plotData[0][0]).toBeCloseTo(0.1); // time
      expect(sim.plotData[0][1]).toBeCloseTo(1.1); // x
    });
  });

  describe('stepProvider indirection (live code replacement)', () => {
    it('picks up a replaced step function on next tick', () => {
      let currentStep = linearStep;
      const sim2 = new Simulation(makeConfig(), () => currentStep);

      // linearStep with input=1: x_new = 1 + 0.1 = 1.1
      sim2.step(1, {});
      const xAfterLinear = sim2.x; // 1.1

      // Swap to doubling: x_new = input * 2
      currentStep = doublingStep;
      // doublingStep with input=5: x_new = 5 * 2 = 10
      sim2.step(5, {});
      expect(sim2.x).toBeCloseTo(10);
    });
  });

  describe('reset', () => {
    it('restores initial conditions', () => {
      sim.step(0, {});
      sim.step(0, {});
      sim.reset();

      expect(sim.x).toBe(1);
      expect(sim.time).toBe(0);
      expect(sim.plotData).toEqual([]);
      expect(sim.state).toEqual({ t: 0 });
    });

    it('does not mutate the original initialState', () => {
      sim.step(0, {});
      sim.reset();
      // initialState should still be { t: 0 }, not the modified state
      expect(sim.initialState).toEqual({ t: 0 });
    });
  });

  describe('getPlotArrays', () => {
    it('returns x and y arrays for timeseries', () => {
      sim.step(0, {});
      sim.step(0, {});
      const arrays = sim.getPlotArrays();
      expect(arrays.x).toHaveLength(2);
      expect(arrays.y).toHaveLength(2);
      expect(arrays.z).toBeUndefined();
    });

    it('returns x, y, z arrays for 3d plot', () => {
      const step3d = (x, state, params) => {
        return [x, { x: 1, y: 2, z: 3 }];
      };
      const sim3d = new Simulation(makeConfig({ plotType: '3d' }), () => step3d);
      sim3d.step(0, {});
      const arrays = sim3d.getPlotArrays();
      expect(arrays.x).toEqual([1]);
      expect(arrays.y).toEqual([2]);
      expect(arrays.z).toEqual([3]);
    });
  });

  describe('getTimeseriesRange', () => {
    it('returns config range when time is within window', () => {
      expect(sim.getTimeseriesRange()).toEqual([0, 10]);
    });

    it('returns sliding window when time exceeds range', () => {
      // Step past the configured range end (10)
      for (let i = 0; i < 120; i++) {
        sim.step(0, {});
      }
      // time ~ 12.0
      const range = sim.getTimeseriesRange();
      expect(range[1]).toBeCloseTo(sim.time);
      expect(range[1] - range[0]).toBeCloseTo(10); // window size preserved
    });
  });

  describe('buffer management', () => {
    it('limits non-timeseries data to maxPoints', () => {
      const sim2d = new Simulation(
        makeConfig({ plotType: '2d', maxPoints: 5 }),
        () => linearStep
      );
      for (let i = 0; i < 10; i++) {
        sim2d.step(0, {});
      }
      expect(sim2d.plotData.length).toBeLessThanOrEqual(5);
    });

    it('trims timeseries buffer when it exceeds 2x target', () => {
      // dt=0.1, xaxis.range[1]=10 → windowSize=10
      // pointsPerWindow = ceil(10/0.1) = 100
      // bufferPoints = ceil(100*0.5) = 50
      // targetPoints = 150, trim triggers at > 300
      // After 350 steps: trims at step 301 to 150, then 49 more → 199
      const sim2 = new Simulation(
        makeConfig({ dt: 0.1, plotConfig: { xaxis: { range: [0, 10] } } }),
        () => linearStep
      );
      for (let i = 0; i < 350; i++) {
        sim2.step(0, {});
      }
      // After trim + continued accumulation, should be well under 2x target
      expect(sim2.plotData.length).toBeLessThan(300);
      expect(sim2.plotData.length).toBeGreaterThan(0);
    });
  });
});
