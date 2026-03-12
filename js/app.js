// =====================================================
// Navigation & Section Management
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    const cards = document.querySelectorAll('.card[data-target]');

    function showSection(id) {
        sections.forEach(s => s.classList.remove('active'));
        navLinks.forEach(l => l.classList.remove('active'));
        const target = document.getElementById(id);
        if (target) target.classList.add('active');
        const link = document.querySelector(`.nav-link[data-section="${id}"]`);
        if (link) link.classList.add('active');
    }

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            showSection(link.dataset.section);
        });
    });

    cards.forEach(card => {
        card.addEventListener('click', () => showSection(card.dataset.target));
    });

    // Initialize all modules
    initLLN();
    initCLT();
    initBayes();
    initDistributions();
    initConditional();
    initMarkov();
});

// =====================================================
// Utility: Canvas Drawing Helpers
// =====================================================
function clearCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return ctx;
}

function drawAxes(ctx, w, h, padding, options = {}) {
    const { xLabel, yLabel, xTicks, yTicks } = options;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, h - padding);
    ctx.lineTo(w - padding, h - padding);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';

    if (xLabel) {
        ctx.textAlign = 'center';
        ctx.fillText(xLabel, w / 2, h - 5);
    }
    if (yLabel) {
        ctx.save();
        ctx.translate(12, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
    }

    if (xTicks) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        xTicks.forEach(({ pos, label }) => {
            const x = padding + pos * (w - 2 * padding);
            ctx.beginPath();
            ctx.moveTo(x, h - padding);
            ctx.lineTo(x, h - padding + 4);
            ctx.stroke();
            ctx.fillText(label, x, h - padding + 6);
        });
    }

    if (yTicks) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        yTicks.forEach(({ pos, label }) => {
            const y = h - padding - pos * (h - 2 * padding);
            ctx.beginPath();
            ctx.moveTo(padding - 4, y);
            ctx.lineTo(padding, y);
            ctx.stroke();
            ctx.fillText(label, padding - 6, y);
        });
    }
}

// =====================================================
// Module: Law of Large Numbers
// =====================================================
function initLLN() {
    const canvas = document.getElementById('lln-canvas');
    const ctx = canvas.getContext('2d');
    const startBtn = document.getElementById('lln-start');
    const resetBtn = document.getElementById('lln-reset');
    const experimentSel = document.getElementById('lln-experiment');
    const speedSlider = document.getElementById('lln-speed');

    let running = false;
    let animId = null;
    let trials = [];
    let runningAvg = [];

    function getExperiment() {
        switch (experimentSel.value) {
            case 'coin': return { sample: () => Math.random() < 0.5 ? 1 : 0, expected: 0.5, name: 'Fair Coin' };
            case 'die': return { sample: () => Math.floor(Math.random() * 6) + 1, expected: 3.5, name: 'Fair Die' };
            case 'biased': return { sample: () => Math.random() < 0.7 ? 1 : 0, expected: 0.7, name: 'Biased Coin' };
        }
    }

    function draw() {
        const w = canvas.width, h = canvas.height;
        const padding = 50;
        clearCanvas(canvas);

        const exp = getExperiment();
        const expected = exp.expected;

        drawAxes(ctx, w, h, padding, {
            xLabel: 'Number of Trials',
            yLabel: 'Running Average'
        });

        if (runningAvg.length === 0) return;

        // Determine y-axis range
        const allVals = runningAvg;
        let yMin = Math.min(...allVals, expected - 0.1);
        let yMax = Math.max(...allVals, expected + 0.1);
        const yRange = yMax - yMin || 1;
        yMin -= yRange * 0.1;
        yMax += yRange * 0.1;

        const plotW = w - 2 * padding;
        const plotH = h - 2 * padding;

        // Draw expected value line
        const expY = h - padding - ((expected - yMin) / (yMax - yMin)) * plotH;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(padding, expY);
        ctx.lineTo(w - padding, expY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ef4444';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`E[X] = ${expected}`, w - padding + 5, expY + 4);

        // Draw running average line
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const n = runningAvg.length;
        for (let i = 0; i < n; i++) {
            const x = padding + (i / Math.max(n - 1, 1)) * plotW;
            const y = h - padding - ((runningAvg[i] - yMin) / (yMax - yMin)) * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // X-axis ticks
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const steps = [0, 0.25, 0.5, 0.75, 1];
        steps.forEach(s => {
            const trialNum = Math.round(s * (n - 1)) + 1;
            const x = padding + s * plotW;
            ctx.fillText(trialNum.toString(), x, h - padding + 15);
        });

        // Y-axis ticks
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const val = yMin + (i / 4) * (yMax - yMin);
            const y = h - padding - (i / 4) * plotH;
            ctx.fillText(val.toFixed(2), padding - 6, y + 3);
        }
    }

    function update() {
        const exp = getExperiment();
        const batchSize = Math.max(1, Math.floor(speedSlider.value / 10));

        for (let b = 0; b < batchSize; b++) {
            const val = exp.sample();
            trials.push(val);
            const sum = trials.reduce((a, c) => a + c, 0);
            runningAvg.push(sum / trials.length);
        }

        document.getElementById('lln-trials').textContent = trials.length;
        document.getElementById('lln-avg').textContent = runningAvg[runningAvg.length - 1].toFixed(4);
        document.getElementById('lln-expected').textContent = exp.expected;

        draw();

        if (running && trials.length < 10000) {
            animId = requestAnimationFrame(update);
        } else {
            running = false;
            startBtn.textContent = 'Start Simulation';
        }
    }

    startBtn.addEventListener('click', () => {
        if (running) {
            running = false;
            cancelAnimationFrame(animId);
            startBtn.textContent = 'Start Simulation';
        } else {
            running = true;
            startBtn.textContent = 'Pause';
            update();
        }
    });

    resetBtn.addEventListener('click', () => {
        running = false;
        cancelAnimationFrame(animId);
        trials = [];
        runningAvg = [];
        startBtn.textContent = 'Start Simulation';
        document.getElementById('lln-trials').textContent = '0';
        document.getElementById('lln-avg').textContent = '-';
        draw();
    });

    experimentSel.addEventListener('change', () => {
        const exp = getExperiment();
        document.getElementById('lln-expected').textContent = exp.expected;
    });

    draw();
}

// =====================================================
// Module: Central Limit Theorem
// =====================================================
function initCLT() {
    const popCanvas = document.getElementById('clt-population-canvas');
    const meansCanvas = document.getElementById('clt-means-canvas');
    const nSlider = document.getElementById('clt-n');
    const samplesSlider = document.getElementById('clt-samples');
    const distSelect = document.getElementById('clt-distribution');
    const genBtn = document.getElementById('clt-generate');
    const resetBtn = document.getElementById('clt-reset');

    nSlider.addEventListener('input', () => {
        document.getElementById('clt-n-display').textContent = nSlider.value;
    });
    samplesSlider.addEventListener('input', () => {
        document.getElementById('clt-samples-display').textContent = samplesSlider.value;
    });

    function sampleFromDist() {
        switch (distSelect.value) {
            case 'uniform': return Math.random();
            case 'exponential': return -Math.log(1 - Math.random());
            case 'bernoulli': return Math.random() < 0.3 ? 1 : 0;
        }
    }

    function getPopStats() {
        switch (distSelect.value) {
            case 'uniform': return { mean: 0.5, variance: 1 / 12 };
            case 'exponential': return { mean: 1, variance: 1 };
            case 'bernoulli': return { mean: 0.3, variance: 0.21 };
        }
    }

    function drawHistogram(canvas, data, bins, color, normalOverlay = null) {
        const ctx = clearCanvas(canvas);
        const w = canvas.width, h = canvas.height;
        const padding = 40;

        if (data.length === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click "Generate Samples" to begin', w / 2, h / 2);
            return;
        }

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;

        const counts = new Array(bins).fill(0);
        data.forEach(v => {
            let idx = Math.floor(((v - min) / range) * bins);
            if (idx >= bins) idx = bins - 1;
            counts[idx]++;
        });

        const maxCount = Math.max(...counts);
        const plotW = w - 2 * padding;
        const plotH = h - 2 * padding;
        const barW = plotW / bins;

        drawAxes(ctx, w, h, padding);

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7;
        counts.forEach((c, i) => {
            const barH = (c / maxCount) * plotH;
            ctx.fillRect(padding + i * barW, h - padding - barH, barW - 1, barH);
        });
        ctx.globalAlpha = 1;

        // Normal overlay
        if (normalOverlay) {
            const { mean, std } = normalOverlay;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i <= plotW; i++) {
                const x = padding + i;
                const val = min + (i / plotW) * range;
                const z = (val - mean) / std;
                const density = Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
                const binWidth = range / bins;
                const expectedCount = density * binWidth * data.length;
                const y = h - padding - (expectedCount / maxCount) * plotH;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // X-axis labels
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i <= 4; i++) {
            const val = min + (i / 4) * range;
            ctx.fillText(val.toFixed(2), padding + (i / 4) * plotW, h - padding + 15);
        }
    }

    function drawPopulation() {
        const samples = [];
        for (let i = 0; i < 5000; i++) samples.push(sampleFromDist());
        drawHistogram(popCanvas, samples, 30, '#64748b');
    }

    genBtn.addEventListener('click', () => {
        const n = parseInt(nSlider.value);
        const numSamples = parseInt(samplesSlider.value);
        const stats = getPopStats();

        drawPopulation();

        const means = [];
        for (let s = 0; s < numSamples; s++) {
            let sum = 0;
            for (let i = 0; i < n; i++) sum += sampleFromDist();
            means.push(sum / n);
        }

        const sampleMean = means.reduce((a, c) => a + c, 0) / means.length;
        const sampleVar = means.reduce((a, c) => a + (c - sampleMean) ** 2, 0) / means.length;
        const sampleStd = Math.sqrt(sampleVar);

        drawHistogram(meansCanvas, means, 40, '#2563eb', { mean: sampleMean, std: sampleStd });

        document.getElementById('clt-pop-mean').textContent = stats.mean.toFixed(4);
        document.getElementById('clt-sample-mean').textContent = sampleMean.toFixed(4);
        document.getElementById('clt-sample-std').textContent = sampleStd.toFixed(4);
    });

    resetBtn.addEventListener('click', () => {
        clearCanvas(popCanvas);
        clearCanvas(meansCanvas);
        document.getElementById('clt-pop-mean').textContent = '-';
        document.getElementById('clt-sample-mean').textContent = '-';
        document.getElementById('clt-sample-std').textContent = '-';
        drawPopulation();
        const ctx = meansCanvas.getContext('2d');
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Click "Generate Samples" to begin', meansCanvas.width / 2, meansCanvas.height / 2);
    });

    drawPopulation();
    const ctx2 = meansCanvas.getContext('2d');
    ctx2.fillStyle = '#94a3b8';
    ctx2.font = '14px sans-serif';
    ctx2.textAlign = 'center';
    ctx2.fillText('Click "Generate Samples" to begin', meansCanvas.width / 2, meansCanvas.height / 2);
}

// =====================================================
// Module: Bayes' Theorem
// =====================================================
function initBayes() {
    const canvas = document.getElementById('bayes-canvas');
    const priorSlider = document.getElementById('bayes-prior');
    const sensitivitySlider = document.getElementById('bayes-sensitivity');
    const fpSlider = document.getElementById('bayes-fp');
    const scenarioSel = document.getElementById('bayes-scenario');

    const scenarios = {
        medical: { prior: 0.01, sensitivity: 0.95, fp: 0.05 },
        email: { prior: 0.20, sensitivity: 0.90, fp: 0.01 },
        custom: null
    };

    function updateBayes() {
        const prior = parseFloat(priorSlider.value);
        const sensitivity = parseFloat(sensitivitySlider.value);
        const fp = parseFloat(fpSlider.value);

        document.getElementById('bayes-prior-display').textContent = prior.toFixed(3);
        document.getElementById('bayes-sensitivity-display').textContent = sensitivity.toFixed(3);
        document.getElementById('bayes-fp-display').textContent = fp.toFixed(3);

        const pE = sensitivity * prior + fp * (1 - prior);
        const posterior = (sensitivity * prior) / pE;

        document.getElementById('bayes-prior-val').textContent = prior.toFixed(4);
        document.getElementById('bayes-evidence').textContent = pE.toFixed(4);
        document.getElementById('bayes-posterior').textContent = posterior.toFixed(4);

        // Interpretation
        const interpEl = document.getElementById('bayes-interpretation');
        const ratio = posterior / prior;
        interpEl.innerHTML = `Even with a test sensitivity of <strong>${(sensitivity * 100).toFixed(1)}%</strong> ` +
            `and a false positive rate of <strong>${(fp * 100).toFixed(1)}%</strong>, ` +
            `a positive result updates the probability from <strong>${(prior * 100).toFixed(2)}%</strong> ` +
            `to <strong>${(posterior * 100).toFixed(2)}%</strong> ` +
            `(a <strong>${ratio.toFixed(1)}x</strong> increase). ` +
            (posterior < 0.5 ?
                'The posterior is still below 50%, meaning a positive test result is more likely to be a false positive!' :
                'The posterior exceeds 50%, so a positive result likely indicates a true positive.');

        drawBayes(prior, sensitivity, fp, posterior, pE);
    }

    function drawBayes(prior, sensitivity, fp, posterior, pE) {
        const ctx = clearCanvas(canvas);
        const w = canvas.width, h = canvas.height;
        const padding = 50;

        // Draw a tree diagram
        const startX = padding + 40;
        const startY = h / 2;
        const midX = w * 0.35;
        const endX = w * 0.7;

        // Helper to draw a branch
        function drawBranch(x1, y1, x2, y2, label, prob, color) {
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1, prob * 8);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            const offset = y2 < y1 ? -10 : 14;
            ctx.fillText(`${label} = ${prob.toFixed(3)}`, mx, my + offset);
        }

        function drawNode(x, y, text, bgColor) {
            ctx.fillStyle = bgColor;
            const tw = ctx.measureText(text).width + 16;
            const boxH = 24;
            ctx.beginPath();
            ctx.roundRect(x - tw / 2, y - boxH / 2, tw, boxH, 4);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, y);
        }

        // Prior branches
        const hY = startY - 100;
        const nhY = startY + 100;
        drawBranch(startX, startY, midX, hY, 'P(H)', prior, '#2563eb');
        drawBranch(startX, startY, midX, nhY, 'P(\u00ACH)', 1 - prior, '#94a3b8');

        // Likelihood branches from H
        const eGivenH_Y = hY - 50;
        const neGivenH_Y = hY + 50;
        drawBranch(midX, hY, endX, eGivenH_Y, 'P(E|H)', sensitivity, '#10b981');
        drawBranch(midX, hY, endX, neGivenH_Y, 'P(\u00ACE|H)', 1 - sensitivity, '#94a3b8');

        // Likelihood branches from not-H
        const eGivenNH_Y = nhY - 50;
        const neGivenNH_Y = nhY + 50;
        drawBranch(midX, nhY, endX, eGivenNH_Y, 'P(E|\u00ACH)', fp, '#f59e0b');
        drawBranch(midX, nhY, endX, neGivenNH_Y, 'P(\u00ACE|\u00ACH)', 1 - fp, '#94a3b8');

        // Nodes
        drawNode(startX, startY, 'Start', '#64748b');
        drawNode(midX, hY, 'H', '#2563eb');
        drawNode(midX, nhY, '\u00ACH', '#64748b');

        // Joint probabilities
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#10b981';
        ctx.textAlign = 'left';
        const jp1 = prior * sensitivity;
        const jp2 = prior * (1 - sensitivity);
        const jp3 = (1 - prior) * fp;
        const jp4 = (1 - prior) * (1 - fp);

        ctx.fillText(`${jp1.toFixed(4)}`, endX + 10, eGivenH_Y);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${jp2.toFixed(4)}`, endX + 10, neGivenH_Y);
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`${jp3.toFixed(4)}`, endX + 10, eGivenNH_Y);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${jp4.toFixed(4)}`, endX + 10, neGivenNH_Y);

        // Posterior box
        ctx.fillStyle = '#ecfdf5';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        const boxX = endX + 80;
        const boxY = h / 2 - 30;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, 130, 60, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#064e3b';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('P(H|E)', boxX + 65, boxY + 22);
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = '#10b981';
        ctx.fillText(posterior.toFixed(4), boxX + 65, boxY + 46);
    }

    scenarioSel.addEventListener('change', () => {
        const s = scenarios[scenarioSel.value];
        if (s) {
            priorSlider.value = s.prior;
            sensitivitySlider.value = s.sensitivity;
            fpSlider.value = s.fp;
        }
        updateBayes();
    });

    [priorSlider, sensitivitySlider, fpSlider].forEach(el => {
        el.addEventListener('input', updateBayes);
    });

    updateBayes();
}

// =====================================================
// Module: Probability Distributions
// =====================================================
function initDistributions() {
    const canvas = document.getElementById('dist-canvas');
    const distType = document.getElementById('dist-type');

    const normalMu = document.getElementById('normal-mu');
    const normalSigma = document.getElementById('normal-sigma');
    const binomN = document.getElementById('binom-n');
    const binomP = document.getElementById('binom-p');
    const poissonLambda = document.getElementById('poisson-lambda');

    function showParams(type) {
        document.getElementById('normal-params').style.display = type === 'normal' ? 'flex' : 'none';
        document.getElementById('binomial-params').style.display = type === 'binomial' ? 'flex' : 'none';
        document.getElementById('poisson-params').style.display = type === 'poisson' ? 'flex' : 'none';
    }

    // Binomial coefficient (log-based for large n)
    function logBinom(n, k) {
        if (k > n) return -Infinity;
        let result = 0;
        for (let i = 0; i < k; i++) {
            result += Math.log(n - i) - Math.log(i + 1);
        }
        return result;
    }

    function drawDistribution() {
        const ctx = clearCanvas(canvas);
        const w = canvas.width, h = canvas.height;
        const padding = 50;
        const plotW = w - 2 * padding;
        const plotH = h - 2 * padding;
        const type = distType.value;

        let xValues = [], yValues = [];
        let mean, variance;

        if (type === 'normal') {
            const mu = parseFloat(normalMu.value);
            const sigma = parseFloat(normalSigma.value);
            mean = mu;
            variance = sigma * sigma;
            document.getElementById('normal-mu-display').textContent = mu.toFixed(1);
            document.getElementById('normal-sigma-display').textContent = sigma.toFixed(1);

            const xMin = mu - 4 * sigma;
            const xMax = mu + 4 * sigma;
            for (let i = 0; i <= 200; i++) {
                const x = xMin + (i / 200) * (xMax - xMin);
                const z = (x - mu) / sigma;
                const y = Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
                xValues.push(x);
                yValues.push(y);
            }

            // Draw continuous curve
            const yMax = Math.max(...yValues) * 1.1;
            ctx.fillStyle = 'rgba(37, 99, 235, 0.2)';
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(padding, h - padding);
            xValues.forEach((x, i) => {
                const px = padding + ((x - xValues[0]) / (xValues[xValues.length - 1] - xValues[0])) * plotW;
                const py = h - padding - (yValues[i] / yMax) * plotH;
                ctx.lineTo(px, py);
            });
            ctx.lineTo(padding + plotW, h - padding);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            xValues.forEach((x, i) => {
                const px = padding + ((x - xValues[0]) / (xValues[xValues.length - 1] - xValues[0])) * plotW;
                const py = h - padding - (yValues[i] / yMax) * plotH;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.stroke();

            drawAxes(ctx, w, h, padding, {
                xLabel: 'x',
                yLabel: 'f(x)',
                xTicks: [0, 0.25, 0.5, 0.75, 1].map(p => ({
                    pos: p,
                    label: (xValues[0] + p * (xValues[xValues.length - 1] - xValues[0])).toFixed(1)
                })),
                yTicks: [0, 0.25, 0.5, 0.75, 1].map(p => ({
                    pos: p,
                    label: (p * yMax).toFixed(3)
                }))
            });

        } else if (type === 'binomial') {
            const n = parseInt(binomN.value);
            const p = parseFloat(binomP.value);
            mean = n * p;
            variance = n * p * (1 - p);
            document.getElementById('binom-n-display').textContent = n;
            document.getElementById('binom-p-display').textContent = p.toFixed(2);

            for (let k = 0; k <= n; k++) {
                const logP = logBinom(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
                xValues.push(k);
                yValues.push(Math.exp(logP));
            }

            drawDiscreteDistribution(ctx, w, h, padding, xValues, yValues);

        } else if (type === 'poisson') {
            const lambda = parseFloat(poissonLambda.value);
            mean = lambda;
            variance = lambda;
            document.getElementById('poisson-lambda-display').textContent = lambda.toFixed(1);

            const maxK = Math.max(20, Math.ceil(lambda + 4 * Math.sqrt(lambda)));
            for (let k = 0; k <= maxK; k++) {
                let logP = -lambda + k * Math.log(lambda);
                for (let i = 1; i <= k; i++) logP -= Math.log(i);
                xValues.push(k);
                yValues.push(Math.exp(logP));
            }

            drawDiscreteDistribution(ctx, w, h, padding, xValues, yValues);
        }

        document.getElementById('dist-mean').textContent = mean.toFixed(4);
        document.getElementById('dist-variance').textContent = variance.toFixed(4);
        document.getElementById('dist-std').textContent = Math.sqrt(variance).toFixed(4);
    }

    function drawDiscreteDistribution(ctx, w, h, padding, xValues, yValues) {
        const plotW = w - 2 * padding;
        const plotH = h - 2 * padding;
        const yMax = Math.max(...yValues) * 1.15;
        const xMin = xValues[0];
        const xMax = xValues[xValues.length - 1];
        const xRange = xMax - xMin || 1;

        const barW = Math.max(2, Math.min(20, plotW / xValues.length - 1));

        ctx.fillStyle = 'rgba(37, 99, 235, 0.6)';
        xValues.forEach((x, i) => {
            const px = padding + ((x - xMin) / xRange) * plotW;
            const barH = (yValues[i] / yMax) * plotH;
            ctx.fillRect(px - barW / 2, h - padding - barH, barW, barH);
        });

        drawAxes(ctx, w, h, padding, {
            xLabel: 'k',
            yLabel: 'P(X = k)',
            xTicks: [0, 0.25, 0.5, 0.75, 1].map(p => ({
                pos: p,
                label: Math.round(xMin + p * xRange).toString()
            })),
            yTicks: [0, 0.25, 0.5, 0.75, 1].map(p => ({
                pos: p,
                label: (p * yMax).toFixed(3)
            }))
        });
    }

    distType.addEventListener('change', () => {
        showParams(distType.value);
        drawDistribution();
    });

    [normalMu, normalSigma, binomN, binomP, poissonLambda].forEach(el => {
        el.addEventListener('input', drawDistribution);
    });

    showParams('normal');
    drawDistribution();
}

// =====================================================
// Module: Conditional Probability
// =====================================================
function initConditional() {
    const canvas = document.getElementById('conditional-canvas');
    const paSlider = document.getElementById('cond-pa');
    const pbSlider = document.getElementById('cond-pb');
    const pabSlider = document.getElementById('cond-pab');

    function update() {
        const pA = parseFloat(paSlider.value);
        const pB = parseFloat(pbSlider.value);
        let pAB = parseFloat(pabSlider.value);

        // Clamp intersection
        pAB = Math.min(pAB, pA, pB);
        pabSlider.max = Math.min(pA, pB).toFixed(2);
        if (pAB > Math.min(pA, pB)) {
            pAB = Math.min(pA, pB);
            pabSlider.value = pAB;
        }

        document.getElementById('cond-pa-display').textContent = pA.toFixed(2);
        document.getElementById('cond-pb-display').textContent = pB.toFixed(2);
        document.getElementById('cond-pab-display').textContent = pAB.toFixed(2);

        const pAgivenB = pB > 0 ? pAB / pB : 0;
        const pBgivenA = pA > 0 ? pAB / pA : 0;
        const pAorB = pA + pB - pAB;
        const independent = Math.abs(pAB - pA * pB) < 0.01;

        document.getElementById('cond-a-given-b').textContent = pAgivenB.toFixed(4);
        document.getElementById('cond-b-given-a').textContent = pBgivenA.toFixed(4);
        document.getElementById('cond-a-or-b').textContent = pAorB.toFixed(4);
        document.getElementById('cond-independent').textContent = independent ? 'Yes' : 'No';
        document.getElementById('cond-independent').style.color = independent ? '#10b981' : '#ef4444';

        drawVenn(pA, pB, pAB);
    }

    function drawVenn(pA, pB, pAB) {
        const ctx = clearCanvas(canvas);
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;

        // Sample space rectangle
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 30, w - 80, h - 60);
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.fillText('S (Sample Space)', 50, 50);

        // Circle sizes proportional to probability
        const maxR = Math.min(w, h) * 0.3;
        const rA = Math.sqrt(pA) * maxR;
        const rB = Math.sqrt(pB) * maxR;

        // Distance between centers based on overlap
        // Use a simple heuristic: less overlap = more separation
        const overlapRatio = Math.min(pA, pB) > 0 ? pAB / Math.min(pA, pB) : 0;
        const maxDist = rA + rB;
        const minDist = Math.abs(rA - rB);
        const dist = maxDist - overlapRatio * (maxDist - minDist);

        const aX = cx - dist * 0.3;
        const bX = cx + dist * 0.3;

        // Draw circle A
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(aX, cy, rA, 0, 2 * Math.PI);
        ctx.fill();

        // Draw circle B
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(bX, cy, rB, 0, 2 * Math.PI);
        ctx.fill();

        ctx.globalAlpha = 1;

        // Circle outlines
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(aX, cy, rA, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(bX, cy, rB, 0, 2 * Math.PI);
        ctx.stroke();

        // Labels
        ctx.fillStyle = '#1e40af';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('A', aX - rA * 0.4, cy - rA * 0.3);
        ctx.fillText(pA.toFixed(2), aX - rA * 0.4, cy - rA * 0.3 + 18);

        ctx.fillStyle = '#92400e';
        ctx.fillText('B', bX + rB * 0.4, cy - rB * 0.3);
        ctx.fillText(pB.toFixed(2), bX + rB * 0.4, cy - rB * 0.3 + 18);

        // Intersection label
        if (pAB > 0) {
            const intX = (aX + bX) / 2;
            ctx.fillStyle = '#065f46';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText('A\u2229B', intX, cy - 5);
            ctx.fillText(pAB.toFixed(2), intX, cy + 13);
        }

        // Conditional probability visualization bars
        const barY = h - 45;
        const barW = w - 120;
        const barH = 12;
        const barX = 60;

        // P(A|B) bar
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(barX, barY - 18, barW, barH);
        ctx.fillStyle = '#2563eb';
        const pAgivenB = pB > 0 ? pAB / pB : 0;
        ctx.fillRect(barX, barY - 18, barW * pAgivenB, barH);
        ctx.fillStyle = '#1e293b';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`P(A|B) = ${pAgivenB.toFixed(3)}`, barX + barW + 5, barY - 8);

        // P(B|A) bar
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#f59e0b';
        const pBgivenA = pA > 0 ? pAB / pA : 0;
        ctx.fillRect(barX, barY, barW * pBgivenA, barH);
        ctx.fillStyle = '#1e293b';
        ctx.fillText(`P(B|A) = ${pBgivenA.toFixed(3)}`, barX + barW + 5, barY + 10);
    }

    [paSlider, pbSlider, pabSlider].forEach(el => {
        el.addEventListener('input', update);
    });

    update();
}

// =====================================================
// Module: Markov Chains
// =====================================================
function initMarkov() {
    const diagramCanvas = document.getElementById('markov-diagram-canvas');
    const evolutionCanvas = document.getElementById('markov-evolution-canvas');
    const presetSel = document.getElementById('markov-preset');
    const stepsSlider = document.getElementById('markov-steps');
    const simBtn = document.getElementById('markov-simulate');
    const resetBtn = document.getElementById('markov-reset');

    const presets = {
        weather: {
            states: ['Sunny', 'Rainy'],
            matrix: [[0.7, 0.3], [0.4, 0.6]]
        },
        gambler: {
            states: ['Broke', 'Has $1', 'Rich'],
            matrix: [[1, 0, 0], [0.5, 0, 0.5], [0, 0, 1]]
        },
        custom: {
            states: ['A', 'B'],
            matrix: [[0.5, 0.5], [0.5, 0.5]]
        }
    };

    function getMatrix() {
        const inputs = document.querySelectorAll('.matrix-input');
        const n = Math.sqrt(inputs.length);
        const matrix = [];
        for (let i = 0; i < n; i++) {
            matrix[i] = [];
            for (let j = 0; j < n; j++) {
                const input = document.querySelector(`.matrix-input[data-row="${i}"][data-col="${j}"]`);
                matrix[i][j] = parseFloat(input.value) || 0;
            }
        }
        return matrix;
    }

    function getStates() {
        const preset = presets[presetSel.value];
        return preset.states;
    }

    function buildMatrixEditor(states, matrix) {
        const table = document.getElementById('markov-matrix');
        const thead = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');

        thead.innerHTML = '<th></th>';
        states.forEach(s => {
            const th = document.createElement('th');
            th.textContent = s;
            thead.appendChild(th);
        });

        tbody.innerHTML = '';
        states.forEach((s, i) => {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.textContent = s;
            tr.appendChild(th);
            states.forEach((_, j) => {
                const td = document.createElement('td');
                const input = document.createElement('input');
                input.type = 'number';
                input.className = 'matrix-input';
                input.dataset.row = i;
                input.dataset.col = j;
                input.value = matrix[i][j];
                input.min = 0;
                input.max = 1;
                input.step = 0.05;
                td.appendChild(input);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    function multiplyMatVec(matrix, vec) {
        const n = vec.length;
        const result = new Array(n).fill(0);
        for (let j = 0; j < n; j++) {
            for (let i = 0; i < n; i++) {
                result[j] += vec[i] * matrix[i][j];
            }
        }
        return result;
    }

    function findStationary(matrix) {
        const n = matrix.length;
        let vec = new Array(n).fill(1 / n);
        for (let iter = 0; iter < 1000; iter++) {
            vec = multiplyMatVec(matrix, vec);
        }
        return vec;
    }

    function drawDiagram(states, matrix) {
        const ctx = clearCanvas(diagramCanvas);
        const w = diagramCanvas.width, h = diagramCanvas.height;
        const n = states.length;
        const cx = w / 2, cy = h / 2;
        const radius = Math.min(w, h) * 0.3;
        const nodeR = 25;

        // Positions in a circle
        const positions = states.map((_, i) => {
            const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
            return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
        });

        // Draw edges (transitions)
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (matrix[i][j] <= 0) continue;
                const p = matrix[i][j];

                if (i === j) {
                    // Self-loop
                    const pos = positions[i];
                    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
                    const loopCx = pos.x + 30 * Math.cos(angle);
                    const loopCy = pos.y + 30 * Math.sin(angle);
                    ctx.strokeStyle = `rgba(37, 99, 235, ${0.3 + 0.7 * p})`;
                    ctx.lineWidth = 1 + p * 2;
                    ctx.beginPath();
                    ctx.arc(loopCx, loopCy, 15, 0, 2 * Math.PI);
                    ctx.stroke();

                    ctx.fillStyle = '#64748b';
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(p.toFixed(2), loopCx + 20 * Math.cos(angle), loopCy + 20 * Math.sin(angle));
                } else {
                    const from = positions[i];
                    const to = positions[j];
                    const dx = to.x - from.x;
                    const dy = to.y - from.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const ux = dx / dist, uy = dy / dist;

                    const startX = from.x + ux * nodeR;
                    const startY = from.y + uy * nodeR;
                    const endX = to.x - ux * nodeR;
                    const endY = to.y - uy * nodeR;

                    // Offset for bidirectional
                    const offset = 8;
                    const perpX = -uy * offset;
                    const perpY = ux * offset;

                    ctx.strokeStyle = `rgba(37, 99, 235, ${0.3 + 0.7 * p})`;
                    ctx.lineWidth = 1 + p * 2;
                    ctx.beginPath();
                    ctx.moveTo(startX + perpX, startY + perpY);
                    ctx.lineTo(endX + perpX, endY + perpY);
                    ctx.stroke();

                    // Arrow
                    const arrowSize = 8;
                    const ax = endX + perpX;
                    const ay = endY + perpY;
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.beginPath();
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(ax - arrowSize * ux + arrowSize * 0.4 * uy, ay - arrowSize * uy - arrowSize * 0.4 * ux);
                    ctx.lineTo(ax - arrowSize * ux - arrowSize * 0.4 * uy, ay - arrowSize * uy + arrowSize * 0.4 * ux);
                    ctx.closePath();
                    ctx.fill();

                    // Label
                    const mx = (startX + endX) / 2 + perpX * 1.5;
                    const my = (startY + endY) / 2 + perpY * 1.5;
                    ctx.fillStyle = '#1e293b';
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(p.toFixed(2), mx, my);
                }
            }
        }

        // Draw nodes
        const colors = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
        positions.forEach((pos, i) => {
            ctx.fillStyle = colors[i % colors.length];
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, nodeR, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(states[i], pos.x, pos.y);
        });
    }

    function drawEvolution(states, history) {
        const ctx = clearCanvas(evolutionCanvas);
        const w = evolutionCanvas.width, h = evolutionCanvas.height;
        const padding = 40;
        const plotW = w - 2 * padding;
        const plotH = h - 2 * padding;
        const n = states.length;
        const steps = history.length;

        if (steps === 0) return;

        drawAxes(ctx, w, h, padding, {
            xLabel: 'Step',
            yLabel: 'Probability'
        });

        const colors = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

        // Draw lines for each state
        for (let s = 0; s < n; s++) {
            ctx.strokeStyle = colors[s % colors.length];
            ctx.lineWidth = 2;
            ctx.beginPath();
            history.forEach((dist, t) => {
                const x = padding + (t / Math.max(steps - 1, 1)) * plotW;
                const y = h - padding - dist[s] * plotH;
                if (t === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Legend
            const ly = padding + s * 18;
            ctx.fillStyle = colors[s % colors.length];
            ctx.fillRect(w - padding - 80, ly, 12, 12);
            ctx.fillStyle = '#1e293b';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(states[s], w - padding - 64, ly + 10);
        }

        // X-axis ticks
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i <= 4; i++) {
            const step = Math.round((i / 4) * (steps - 1));
            const x = padding + (i / 4) * plotW;
            ctx.fillText(step.toString(), x, h - padding + 15);
        }

        // Y-axis ticks
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const val = i / 4;
            const y = h - padding - val * plotH;
            ctx.fillText(val.toFixed(2), padding - 6, y + 3);
        }
    }

    presetSel.addEventListener('change', () => {
        const preset = presets[presetSel.value];
        buildMatrixEditor(preset.states, preset.matrix);
        drawDiagram(preset.states, preset.matrix);
        clearCanvas(evolutionCanvas);
    });

    stepsSlider.addEventListener('input', () => {
        document.getElementById('markov-steps-display').textContent = stepsSlider.value;
    });

    simBtn.addEventListener('click', () => {
        const states = getStates();
        const matrix = getMatrix();
        const steps = parseInt(stepsSlider.value);

        drawDiagram(states, matrix);

        // Initial uniform distribution
        const n = states.length;
        let dist = new Array(n).fill(1 / n);
        const history = [dist.slice()];

        for (let t = 0; t < steps; t++) {
            dist = multiplyMatVec(matrix, dist);
            history.push(dist.slice());
        }

        drawEvolution(states, history);

        const stationary = findStationary(matrix);
        document.getElementById('markov-stationary').textContent =
            '[' + stationary.map(v => v.toFixed(3)).join(', ') + ']';

        // Simulate a single chain
        let currentState = 0;
        for (let t = 0; t < steps; t++) {
            const r = Math.random();
            let cumulative = 0;
            for (let j = 0; j < n; j++) {
                cumulative += matrix[currentState][j];
                if (r < cumulative) {
                    currentState = j;
                    break;
                }
            }
        }
        document.getElementById('markov-current').textContent = states[currentState];
    });

    resetBtn.addEventListener('click', () => {
        const preset = presets[presetSel.value];
        buildMatrixEditor(preset.states, preset.matrix);
        drawDiagram(preset.states, preset.matrix);
        clearCanvas(evolutionCanvas);
        document.getElementById('markov-stationary').textContent = '-';
        document.getElementById('markov-current').textContent = '-';
    });

    // Initialize
    const preset = presets[presetSel.value];
    buildMatrixEditor(preset.states, preset.matrix);
    drawDiagram(preset.states, preset.matrix);
}
