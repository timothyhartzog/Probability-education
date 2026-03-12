import * as d3 from 'd3';

/**
 * MultiPathChart - Displays multiple sample paths (random walks, martingales, etc.)
 * with optional reference line and envelope bands. Uses viewBox-based responsive SVG.
 */
export default class MultiPathChart {
  /**
   * @param {string} containerSelector - CSS selector for the container element
   * @param {Object} options
   * @param {number} [options.width=700] - SVG width (viewBox units)
   * @param {number} [options.height=400] - SVG height (viewBox units)
   * @param {Object} [options.margin] - {top, right, bottom, left}
   * @param {number} [options.maxPaths=50] - Maximum number of paths to display
   * @param {number} [options.opacity=0.3] - Path stroke opacity
   * @param {string[]} [options.colorScheme] - Array of colors or a d3 scheme name
   */
  constructor(containerSelector, options = {}) {
    this.container = d3.select(containerSelector);
    if (this.container.empty()) {
      throw new Error(`Container not found: ${containerSelector}`);
    }

    this.width = options.width || 700;
    this.height = options.height || 400;
    this.margin = Object.assign(
      { top: 20, right: 20, bottom: 40, left: 50 },
      options.margin
    );
    this.maxPaths = options.maxPaths || 50;
    this.opacity = options.opacity || 0.3;
    this.colorScheme = options.colorScheme || d3.schemeTableau10;

    this.innerWidth = this.width - this.margin.left - this.margin.right;
    this.innerHeight = this.height - this.margin.top - this.margin.bottom;

    this._paths = [];
    this._referenceLine = null;
    this._envelopeUpper = null;
    this._envelopeLower = null;

    this._initSVG();
  }

  /** Initialize the SVG element with viewBox for responsiveness. */
  _initSVG() {
    this.svg = this.container
      .append('svg')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('height', 'auto');

    this.g = this.svg
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.xScale = d3.scaleLinear().range([0, this.innerWidth]);
    this.yScale = d3.scaleLinear().range([this.innerHeight, 0]);

    this.xAxisG = this.g
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.innerHeight})`);

    this.yAxisG = this.g.append('g').attr('class', 'y-axis');

    // Layer ordering: envelope behind paths, reference on top
    this.envelopeG = this.g.append('g').attr('class', 'envelope');
    this.pathsG = this.g.append('g').attr('class', 'paths');
    this.referenceG = this.g.append('g').attr('class', 'reference-line');
  }

  /**
   * Compute x/y domains from all currently stored paths, envelope, and reference.
   */
  _computeDomains() {
    const allPoints = this._paths.flat();
    if (allPoints.length === 0) return;

    let xExtent = d3.extent(allPoints, (d) => d.x);
    let yExtent = d3.extent(allPoints, (d) => d.y);

    // Extend domain to include envelope
    if (this._envelopeUpper) {
      const uYMax = d3.max(this._envelopeUpper, (d) => d.y);
      yExtent[1] = Math.max(yExtent[1], uYMax);
    }
    if (this._envelopeLower) {
      const lYMin = d3.min(this._envelopeLower, (d) => d.y);
      yExtent[0] = Math.min(yExtent[0], lYMin);
    }

    // Extend domain to include reference line
    if (this._referenceLine !== null) {
      yExtent[0] = Math.min(yExtent[0], this._referenceLine);
      yExtent[1] = Math.max(yExtent[1], this._referenceLine);
    }

    // Add a small padding to y domain
    const yPad = (yExtent[1] - yExtent[0]) * 0.05 || 1;
    this.xScale.domain(xExtent);
    this.yScale.domain([yExtent[0] - yPad, yExtent[1] + yPad]);
  }

  /** Render axes, paths, reference line, and envelope. */
  _render() {
    this._computeDomains();

    // Axes
    this.xAxisG.transition().duration(400).call(d3.axisBottom(this.xScale));
    this.yAxisG.transition().duration(400).call(d3.axisLeft(this.yScale));

    const lineGen = d3
      .line()
      .x((d) => this.xScale(d.x))
      .y((d) => this.yScale(d.y));

    const colorScale = (i) =>
      this.colorScheme[i % this.colorScheme.length];

    // --- Enter / Update / Exit for paths ---
    const pathSelection = this.pathsG
      .selectAll('path.sample-path')
      .data(this._paths, (_d, i) => i);

    // Exit
    pathSelection
      .exit()
      .transition()
      .duration(300)
      .attr('opacity', 0)
      .remove();

    // Enter
    const pathEnter = pathSelection
      .enter()
      .append('path')
      .attr('class', 'sample-path')
      .attr('fill', 'none')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0);

    // Update (merge)
    pathEnter
      .merge(pathSelection)
      .attr('stroke', (_d, i) => colorScale(i))
      .transition()
      .duration(400)
      .attr('d', (d) => lineGen(d))
      .attr('opacity', this.opacity);

    // --- Reference line ---
    this._renderReferenceLine();

    // --- Envelope ---
    this._renderEnvelope();
  }

  /** Render the dashed horizontal reference line. */
  _renderReferenceLine() {
    this.referenceG.selectAll('line').remove();

    if (this._referenceLine === null) return;

    const y = this.yScale(this._referenceLine);

    this.referenceG
      .append('line')
      .attr('x1', 0)
      .attr('x2', this.innerWidth)
      .attr('y1', y)
      .attr('y2', y)
      .attr('stroke', '#333')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '8 4')
      .attr('opacity', 0)
      .transition()
      .duration(400)
      .attr('opacity', 0.8);
  }

  /** Render the envelope band as a semi-transparent filled area. */
  _renderEnvelope() {
    this.envelopeG.selectAll('path').remove();

    if (!this._envelopeUpper || !this._envelopeLower) return;

    const areaGen = d3
      .area()
      .x((d) => this.xScale(d.x))
      .y0((d, i) => this.yScale(this._envelopeLower[i]?.y ?? 0))
      .y1((d) => this.yScale(d.y));

    this.envelopeG
      .append('path')
      .datum(this._envelopeUpper)
      .attr('fill', 'steelblue')
      .attr('opacity', 0.1)
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.3)
      .attr('d', areaGen);
  }

  /**
   * Replace all paths and re-render.
   * @param {Array<Array<{x: number, y: number}>>} pathsArray
   */
  update(pathsArray) {
    this._paths = (pathsArray || []).slice(0, this.maxPaths);
    this._render();
  }

  /**
   * Add a single path. If maxPaths exceeded, the oldest path is dropped.
   * @param {Array<{x: number, y: number}>} path
   */
  addPath(path) {
    this._paths.push(path);
    if (this._paths.length > this.maxPaths) {
      this._paths.shift();
    }
    this._render();
  }

  /** Remove all paths and clear the chart. */
  clear() {
    this._paths = [];
    this._referenceLine = null;
    this._envelopeUpper = null;
    this._envelopeLower = null;
    this.pathsG.selectAll('path').remove();
    this.referenceG.selectAll('line').remove();
    this.envelopeG.selectAll('path').remove();
  }

  /**
   * Set a horizontal reference line (e.g., true mean).
   * @param {number} y - The y-value for the reference line
   */
  setReferenceLine(y) {
    this._referenceLine = y;
    if (this._paths.length > 0) {
      this._render();
    }
  }

  /**
   * Set an envelope band (e.g., confidence bounds).
   * @param {Array<{x: number, y: number}>} upper - Upper bound path
   * @param {Array<{x: number, y: number}>} lower - Lower bound path
   */
  setEnvelope(upper, lower) {
    this._envelopeUpper = upper;
    this._envelopeLower = lower;
    if (this._paths.length > 0) {
      this._render();
    }
  }

  /** Re-render with current data (viewBox handles resize automatically). */
  resize() {
    this._render();
  }

  /** Remove the SVG and clean up. */
  destroy() {
    this.svg.remove();
    this._paths = [];
    this._referenceLine = null;
    this._envelopeUpper = null;
    this._envelopeLower = null;
  }
}
