import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimulationEngine } from '../src/shared/SimulationEngine';

describe('SimulationEngine: Resilience & Error Trapping', () => {
  let engine;
  let updateMock;

  beforeEach(() => {
    updateMock = vi.fn();
    engine = new SimulationEngine({
      name: 'Test Simulator',
      onUpdate: updateMock
    });
  });

  it('should continue running after a single frame error', async () => {
    // Fail on the first call, succeed on the second
    updateMock.mockRejectedValueOnce(new Error('Transient Math Error'));
    updateMock.mockResolvedValueOnce(true);

    await engine.step({ val: 1 });
    expect(engine.errorCount).toBe(1);
    
    await engine.step({ val: 2 });
    expect(engine.errorCount).toBe(1); // No new error
    expect(updateMock).toHaveBeenCalledTimes(2);
  });

  it('should stop after exceeding high error frequency', async () => {
    engine.maxErrors = 5; // Simulating low threshold
    updateMock.mockRejectedValue(new Error('Persistent Failure'));

    // Trigger 12 errors (threshold in code is 10)
    for (let i = 0; i < 12; i++) {
      await engine.step({});
    }

    expect(engine.isRunning).toBe(false);
    expect(engine.errorCount).toBeGreaterThan(10);
  });

  it('should correctly snapshot state for Antigravity telemetry', async () => {
    const testState = { patients: 10, queue: 5 };
    await engine.step(testState);
    
    const telemetry = engine.getTelemetryData();
    expect(telemetry.lastStates[0].state).toEqual(testState);
  });
});
