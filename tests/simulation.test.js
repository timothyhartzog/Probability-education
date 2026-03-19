import { describe, it, expect, beforeEach } from 'vitest';

// We'll mock a minimal version of a hospital system for testing
class HospitalModel {
  constructor(beds, arrivals, service) {
    this.beds = beds;
    this.arrivals = arrivals;
    this.service = service;
    this.patients = [];
    this.queue = 0;
  }

  step() {
    // 1. Service (deterministic for tests)
    this.patients = this.patients.filter(p => {
      p.stay -= 1;
      return p.stay > 0;
    });

    // 2. Queue processing
    while (this.queue > 0 && this.patients.length < this.beds) {
      this.queue--;
      this.patients.push({ stay: this.service });
    }

    // 3. Arrivals (using Poisson logic would be stochastic, 
    // but for unit tests we can mock the arrival count)
    return this.patients.length;
  }

  addArrivals(n) {
    for (let i = 0; i < n; i++) {
      if (this.patients.length < this.beds) {
        this.patients.push({ stay: this.service });
      } else {
        this.queue++;
      }
    }
  }
}

describe('Chapter 7: Patient Flow Mathematics', () => {
  it('should never exceed bed capacity in active patient list', () => {
    const h = new HospitalModel(25, 4, 3);
    h.addArrivals(50); // Massive surge
    expect(h.patients.length).toBe(25);
    expect(h.queue).toBe(25);
  });

  it('should correctly discharge patients after service time', () => {
    const h = new HospitalModel(25, 4, 2);
    h.addArrivals(5);
    expect(h.patients.length).toBe(5);
    
    h.step(); // Day 1
    expect(h.patients.length).toBe(5); // Stay is 2
    
    h.step(); // Day 2
    expect(h.patients.length).toBe(0); // All discharged
  });

  it('should process queue when beds become available', () => {
    const h = new HospitalModel(2, 1, 2);
    h.addArrivals(4); // 2 in beds, 2 in queue
    expect(h.patients.length).toBe(2);
    expect(h.queue).toBe(2);

    h.step(); 
    h.step(); // Beds clear
    expect(h.patients.length).toBe(2); // Queue moved in
    expect(h.queue).toBe(0);
  });
});
