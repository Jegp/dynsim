import { describe, it, expect, beforeEach } from 'vitest';
import * as registry from '../src/registry.js';

// Reset registry state between tests by re-registering
function dummyStep(x, state, params) {
  return [x, state];
}

function altStep(x, state, params) {
  return [x * 2, state];
}

const rawConfig = {
  params: '[{"id":"a","label":"A","min":0,"max":1,"step":0.1,"value":0.5}]',
  plotType: 'timeseries',
  plotConfig: '{"title":"Test"}',
  initialState: '{"t":0}',
  input: '{"label":"Input","min":0,"max":5,"step":0.1,"value":1}',
  height: 400,
  dt: 0.05,
};

describe('registry', () => {
  beforeEach(() => {
    // Register a known system to work with
    registry.register('test-container', dummyStep, rawConfig);
  });

  describe('register', () => {
    it('parses raw config and stores system', () => {
      const config = registry.getConfig('test-container');
      expect(config.params).toHaveLength(1);
      expect(config.params[0].id).toBe('a');
      expect(config.plotType).toBe('timeseries');
      expect(config.plotConfig.title).toBe('Test');
      expect(config.initialState).toEqual({ t: 0 });
      expect(config.input.value).toBe(1);
      expect(config.input.min).toBe(0);
      expect(config.input.max).toBe(5);
      expect(config.dt).toBe(0.05);
    });

    it('stores the step function', () => {
      expect(registry.getStep('test-container')).toBe(dummyStep);
    });
  });

  describe('getStep / getConfig', () => {
    it('returns null for unknown container', () => {
      expect(registry.getStep('nonexistent')).toBeNull();
      expect(registry.getConfig('nonexistent')).toBeNull();
    });
  });

  describe('replaceStep', () => {
    it('replaces the step function while keeping config', () => {
      registry.replaceStep('test-container', altStep);
      expect(registry.getStep('test-container')).toBe(altStep);
      expect(registry.getConfig('test-container').dt).toBe(0.05); // config unchanged
    });

    it('does nothing for unknown container', () => {
      registry.replaceStep('nonexistent', altStep);
      expect(registry.getStep('nonexistent')).toBeNull();
    });
  });

  describe('has / getContainerIds', () => {
    it('reports registered containers', () => {
      expect(registry.has('test-container')).toBe(true);
      expect(registry.has('nope')).toBe(false);
      expect(registry.getContainerIds()).toContain('test-container');
    });
  });
});
