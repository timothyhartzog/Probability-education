import * as d3 from 'd3';

/**
 * ResponsiveHistogram - A reusable D3 histogram component with optional KDE overlay
 * and reference curve support. Uses viewBox-based responsive SVG.
 */
export default class ResponsiveHistogram {
  /**
   * @param {string} containerSelector - CSS selector for the container element
   * @param {Object} options
   * @param {number} [options.width=600] - SVG width (viewBox units)
   * @param {number} [options.height=400] - SVG height (viewBox units)
   * @param {Object} [options.margin] - {top, right, bottom, left}
   * @param {number} [options.bins=30] - Number of histogram bins
   * @param {string} [options.color='steelblue'] - Bar fill color
   * @param {boolean} [options.showKDE=false] - Whether to show KDE overlay
   * @param {number} [options.kdeBandwidth=1] - Bandwidth for KDE Gaussian kernel
   */
  constructor(containerSelector, options = {}) {
    this.container = d3.select(containerSelector);
    if (this.container.empty()) {
      throw new Error(`Container not found: ${containerSelector}`);
    }

    this.width = options.width || 600;
    this.height = options.height || 400;
    this.margin = Object.assign(
      { top: 20, right: 20, bottom: 40, left: 50 },
      options.margin
    );
    this.bins = options.bins || 30;
    this.color = options.color || 'steelblue';
    this.showKDE = options.showKDE || false;
    this.kdeBandwidth = options.kdeBandwidth || 1;

    this.innerWidth = this.width - this.margin.left - this.margin.right;
    this.innerHeight = this.height - this.margin.top - this.margin.bottom;

    this._overlayFn = null;
    this._overlayDomain = null;
    this._data = [];

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

    this.barsG = this.g.append('g').attr('class', 'bars');
    this.kdeG = this.g.append('g').attr('class', 'kde-overlay');
    this.overlayG = this.g.append('g').attr('class', 'reference-overlay');
  }

  /**
   * Update the histogram with new data.
   * @param {number[]} data - Array of numeric values
   */
  update(data) {
    this._data = data;
    if (!data || data.length === 0) {
      this.barsG.selectAll('rect').remove();
      this.kdeG.selectAll('path').remove();
      this.overlayG.selectAll('path').remove();
      return;
    }

    const extent = d3.extent(data);
    this.xScale.domain(extent).nice();

    const binner = d3
      .bin()
      .domain(this.xScale.domain())
      .thresholds(this.xScale.ticks(this.bins));

    const binnedData = binner(data);

    // Use density (proportion per unit x) so histogram and KDE/overlay share a y-axis
    const binWidth =
      binnedData.length > 0 ? binnedData[0].x1 - binnedData[0].x0 : 1;
    const n = data.length;
    const densityBins = binnedData.map((b) => ({
      x0: b.x0,
      x1: b.x1,
      density: b.length / (n * binWidth),
    }));

    const maxDensity = d3.max(densityBins, (d) => d.density) || 0;

    // Determine y-domain considering KDE and overlay peaks
    let yMax = maxDensity;
    if (this.showKDE) {
      const kdeLine = this._computeKDE(data);
      yMax = Math.max(yMax, d3.max(kdeLine, (d) => d[1]) || 0);
    }
    if (this._overlayFn) {
      const overlayLine = this._computeOverlay();
      yMax = Math.max(yMax, d3.max(overlayLine, (d) => d[1]) || 0);
    }
    this.yScale.domain([0, yMax * 1.05]).nice();

    // Axes
    this.xAxisG
      .transition()
      .duration(500)
      .call(d3.axisBottom(this.xScale));
    this.yAxisG
      .transition()
      .duration(500)
      .call(d3.axisLeft(this.yScale));

    // --- Enter / Update / Exit for bars ---
    const bars = this.barsG
      .selectAll('rect')
      .data(densityBins, (d) => d.x0);

    // Exit
    bars.exit().transition().duration(300).attr('height', 0).attr('y', this.innerHeight).remove();

    // Enter
    const barsEnter = bars
      .enter()
      .append('rect')
      .attr('x', (d) => this.xScale(d.x0) + 1)
      .attr('width', (d) =>
        Math.max(0, this.xScale(d.x1) - this.xScale(d.x0) - 1)
      )
      .attr('y', this.innerHeight)
      .attr('height', 0)
      .attr('fill', this.color)
      .attr('opacity', 0.7);

    // Update (merge enter + existing)
    barsEnter
      .merge(bars)
      .transition()
      .duration(500)
      .attr('x', (d) => this.xScale(d.x0) + 1)
      .attr('width', (d) =>
        Math.max(0, this.xScale(d.x1) - this.xScale(d.x0) - 1)
      )
      .attr('y', (d) => this.yScale(d.density))
      .attr('height', (d) => this.innerHeight - this.yScale(d.density));

    // --- KDE overlay ---
    this._renderKDE(data);

    // --- Reference overlay ---
    this._renderOverlay();
  }

  /**
   * Compute KDE using Gaussian kernel.
   * @param {number[]} data
   * @returns {Array<[number, number]>} Array of [x, density] pairs
   */
  _computeKDE(data) {
    const bandwidth = this.kdeBandwidth;
    const [xMin, xMax] = this.xScale.domain();
    const ticks = d3.range(xMin, xMax, (xMax - xMin) / 200);

    function gaussianKernel(u) {
      return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
    }

    return ticks.map((x) => {
      const density =
        d3.mean(data, (d) => gaussianKernel((x - d) / bandwidth)) / bandwidth;
      return [x, density];
    });
  }

  /** Render or remove the KDE path. */
  _renderKDE(data) {
    this.kdeG.selectAll('path').remove();

    if (!this.showKDE || !data || data.length === 0) return;

    const kdeLine = this._computeKDE(data);

    const line = d3
      .line()
      .x((d) => this.xScale(d[0]))
      .y((d) => this.yScale(d[1]))
      .curve(d3.curveBasis);

    this.kdeG
      .append('path')
      .datum(kdeLine)
      .attr('fill', 'none')
      .attr('stroke', 'orangered')
      .attr('stroke-width', 2)
      .attr('d', line)
      .attr('opacity', 0)
      .transition()
      .duration(500)
      .attr('opacity', 1);
  }

  /**
   * Set a reference curve overlay (e.g., normal PDF).
   * @param {Function} fn - A function f(x) returning the density value
   * @param {[number, number]} domain - [min, max] domain for the curve
   */
  setOverlay(fn, domain) {
    this._overlayFn = fn;
    this._overlayDomain = domain;
    // Re-render if we already have data
    if (this._data.length > 0) {
      this.update(this._data);
    }
  }

  /** Compute overlay curve points. */
  _computeOverlay() {
    if (!this._overlayFn) return [];
    const [xMin, xMax] = this._overlayDomain || this.xScale.domain();
    const steps = 200;
    const step = (xMax - xMin) / steps;
    const points = [];
    for (let x = xMin; x <= xMax; x += step) {
      points.push([x, this._overlayFn(x)]);
    }
    return points;
  }

  /** Render or remove the reference overlay path. */
  _renderOverlay() {
    this.overlayG.selectAll('path').remove();

    if (!this._overlayFn) return;

    const overlayLine = this._computeOverlay();

    const line = d3
      .line()
      .x((d) => this.xScale(d[0]))
      .y((d) => this.yScale(d[1]))
      .curve(d3.curveBasis);

    this.overlayG
      .append('path')
      .datum(overlayLine)
      .attr('fill', 'none')
      .attr('stroke', '#222')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6 3')
      .attr('d', line)
      .attr('opacity', 0)
      .transition()
      .duration(500)
      .attr('opacity', 0.8);
  }

  /** Recalculate dimensions from the container and re-render. */
  resize() {
    // viewBox handles responsiveness; call update to re-render with current data
    if (this._data.length > 0) {
      this.update(this._data);
    }
  }

  /** Remove the SVG and clean up. */
  destroy() {
    this.svg.remove();
    this._data = [];
    this._overlayFn = null;
    this._overlayDomain = null;
  }
}
