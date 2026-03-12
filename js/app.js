// =====================================================
// Navigation & Section Management
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    const cards = document.querySelectorAll('.card[data-target]');
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    function showSection(id) {
        sections.forEach(s => s.classList.remove('active'));
        navLinks.forEach(l => l.classList.remove('active'));
        const target = document.getElementById(id);
        if (target) target.classList.add('active');
        const link = document.querySelector(`.nav-link[data-section="${id}"]`);
        if (link) link.classList.add('active');
        if (navMenu) navMenu.classList.remove('open');
        window.scrollTo(0, 0);
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

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => navMenu.classList.toggle('open'));
    }

    // HiDPI canvas setup
    document.querySelectorAll('canvas').forEach(setupHiDPI);

    // Initialize all modules
    initLLN();
    initCLT();
    initBayes();
    initDistributions();
    initConditional();
    initMarkov();
    initHypothesisTesting();
    initConfidenceIntervals();
    initMonteCarlo();
});

// =====================================================
// Utility: HiDPI Canvas Support
// =====================================================
function setupHiDPI(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = canvas.width;
    const h = canvas.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.dataset.logicalWidth = w;
    canvas.dataset.logicalHeight = h;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
}

function getLogicalSize(canvas) {
    return {
        w: parseInt(canvas.dataset.logicalWidth) || canvas.width,
        h: parseInt(canvas.dataset.logicalHeight) || canvas.height
    };
}

// =====================================================
// Utility: Canvas Drawing Helpers
// =====================================================
function clearCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const { w, h } = getLogicalSize(canvas);
    ctx.clearRect(0, 0, w, h);
    return ctx;
}

function drawAxes(ctx, w, h, padding, options) {
    options = options || {};
    var xLabel = options.xLabel;
    var yLabel = options.yLabel;
    var xTicks = options.xTicks;
    var yTicks = options.yTicks;

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
        xTicks.forEach(function(tick) {
            var x = padding + tick.pos * (w - 2 * padding);
            ctx.beginPath();
            ctx.moveTo(x, h - padding);
            ctx.lineTo(x, h - padding + 4);
            ctx.stroke();
            ctx.fillText(tick.label, x, h - padding + 6);
        });
    }

    if (yTicks) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        yTicks.forEach(function(tick) {
            var y = h - padding - tick.pos * (h - 2 * padding);
            ctx.beginPath();
            ctx.moveTo(padding - 4, y);
            ctx.lineTo(padding, y);
            ctx.stroke();
            ctx.fillText(tick.label, padding - 6, y);
        });
    }
}

// Standard normal CDF approximation
function normalCDF(x) {
    var t = 1 / (1 + 0.2316419 * Math.abs(x));
    var d = 0.3989422804014327;
    var p = d * Math.exp(-x * x / 2) * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.8212560 + t * 1.3302744))));
    return x > 0 ? 1 - p : p;
}

// Inverse normal CDF (approximation)
function normalInvCDF(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;
    var a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    var c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    var pLow = 0.02425, pHigh = 1 - pLow;
    var q, r;
    if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) / ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
    } else if (p <= pHigh) {
        q = p - 0.5; r = q * q;
        return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q / (((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1);
    } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) / ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
    }
}

// Normal PDF
function normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Box-Muller normal random
function randn() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}


// =====================================================
// Module: Law of Large Numbers
// =====================================================
function initLLN() {
    var canvas = document.getElementById('lln-canvas');
    var startBtn = document.getElementById('lln-start');
    var resetBtn = document.getElementById('lln-reset');
    var experimentSel = document.getElementById('lln-experiment');
    var speedSlider = document.getElementById('lln-speed');
    var interpEl = document.getElementById('lln-interpretation');

    var running = false;
    var animId = null;
    var trials = [];
    var runningAvg = [];

    function getExperiment() {
        switch (experimentSel.value) {
            case 'coin': return { sample: function() { return Math.random() < 0.5 ? 1 : 0; }, expected: 0.5, name: 'Fair Coin' };
            case 'die': return { sample: function() { return Math.floor(Math.random() * 6) + 1; }, expected: 3.5, name: 'Fair Die' };
            case 'biased': return { sample: function() { return Math.random() < 0.7 ? 1 : 0; }, expected: 0.7, name: 'Biased Coin' };
        }
    }

    function updateInterpretation() {
        if (trials.length === 0) { interpEl.innerHTML = 'Start the simulation to see the Law of Large Numbers in action.'; return; }
        var exp = getExperiment();
        var avg = runningAvg[runningAvg.length - 1];
        var gap = Math.abs(avg - exp.expected);
        interpEl.innerHTML = 'After <strong>' + trials.length + '</strong> trials, the running average is <strong>' +
            avg.toFixed(4) + '</strong>, which is <strong>' + gap.toFixed(4) + '</strong> away from the expected value of <strong>' +
            exp.expected + '</strong>. ' + (trials.length > 100 ? 'As trials increase, this gap shrinks \u2014 that is the Law of Large Numbers in action.' :
            'Run more trials to watch the average converge toward the expected value.');
    }

    function draw() {
        var size = getLogicalSize(canvas);
        var w = size.w, h = size.h;
        var padding = 50;
        var ctx = clearCanvas(canvas);

        var exp = getExperiment();
        var expected = exp.expected;

        drawAxes(ctx, w, h, padding, { xLabel: 'Number of Trials', yLabel: 'Running Average' });

        if (runningAvg.length === 0) return;

        var allVals = runningAvg;
        var yMin = Math.min.apply(null, allVals.concat([expected - 0.1]));
        var yMax = Math.max.apply(null, allVals.concat([expected + 0.1]));
        var yRange = yMax - yMin || 1;
        yMin -= yRange * 0.1;
        yMax += yRange * 0.1;

        var plotW = w - 2 * padding;
        var plotH = h - 2 * padding;

        var expY = h - padding - ((expected - yMin) / (yMax - yMin)) * plotH;
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
        ctx.fillText('E[X] = ' + expected, w - padding + 5, expY + 4);

        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        var n = runningAvg.length;
        for (var i = 0; i < n; i++) {
            var x = padding + (i / Math.max(n - 1, 1)) * plotW;
            var y = h - padding - ((runningAvg[i] - yMin) / (yMax - yMin)) * plotH;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        [0, 0.25, 0.5, 0.75, 1].forEach(function(s) {
            var trialNum = Math.round(s * (n - 1)) + 1;
            ctx.fillText(trialNum.toString(), padding + s * plotW, h - padding + 15);
        });
        ctx.textAlign = 'right';
        for (var i = 0; i <= 4; i++) {
            var val = yMin + (i / 4) * (yMax - yMin);
            ctx.fillText(val.toFixed(2), padding - 6, h - padding - (i / 4) * plotH + 3);
        }
    }

    function update() {
        var exp = getExperiment();
        var batchSize = Math.max(1, Math.floor(speedSlider.value / 10));
        for (var b = 0; b < batchSize; b++) {
            var val = exp.sample();
            trials.push(val);
            var sum = 0; for (var i = 0; i < trials.length; i++) sum += trials[i];
            runningAvg.push(sum / trials.length);
        }
        document.getElementById('lln-trials').textContent = trials.length;
        document.getElementById('lln-avg').textContent = runningAvg[runningAvg.length - 1].toFixed(4);
        document.getElementById('lln-expected').textContent = exp.expected;
        draw();
        updateInterpretation();
        if (running && trials.length < 10000) {
            animId = requestAnimationFrame(update);
        } else { running = false; startBtn.textContent = 'Start Simulation'; }
    }

    startBtn.addEventListener('click', function() {
        if (running) { running = false; cancelAnimationFrame(animId); startBtn.textContent = 'Start Simulation'; }
        else { running = true; startBtn.textContent = 'Pause'; update(); }
    });
    resetBtn.addEventListener('click', function() {
        running = false; cancelAnimationFrame(animId); trials = []; runningAvg = [];
        startBtn.textContent = 'Start Simulation';
        document.getElementById('lln-trials').textContent = '0';
        document.getElementById('lln-avg').textContent = '-';
        draw(); updateInterpretation();
    });
    experimentSel.addEventListener('change', function() {
        document.getElementById('lln-expected').textContent = getExperiment().expected;
    });
    draw();
    updateInterpretation();
}

// =====================================================
// Module: Central Limit Theorem
// =====================================================
function initCLT() {
    var popCanvas = document.getElementById('clt-population-canvas');
    var meansCanvas = document.getElementById('clt-means-canvas');
    var nSlider = document.getElementById('clt-n');
    var samplesSlider = document.getElementById('clt-samples');
    var distSelect = document.getElementById('clt-distribution');
    var genBtn = document.getElementById('clt-generate');
    var resetBtn = document.getElementById('clt-reset');
    var interpEl = document.getElementById('clt-interpretation');

    nSlider.addEventListener('input', function() { document.getElementById('clt-n-display').textContent = nSlider.value; });
    samplesSlider.addEventListener('input', function() { document.getElementById('clt-samples-display').textContent = samplesSlider.value; });

    function sampleFromDist() {
        switch (distSelect.value) {
            case 'uniform': return Math.random();
            case 'exponential': return -Math.log(1 - Math.random());
            case 'bernoulli': return Math.random() < 0.3 ? 1 : 0;
        }
    }
    function getPopStats() {
        switch (distSelect.value) {
            case 'uniform': return { mean: 0.5, variance: 1/12, name: 'Uniform(0,1)' };
            case 'exponential': return { mean: 1, variance: 1, name: 'Exponential(1)' };
            case 'bernoulli': return { mean: 0.3, variance: 0.21, name: 'Bernoulli(0.3)' };
        }
    }
    function drawHistogram(canvas, data, bins, color, normalOverlay) {
        var ctx = clearCanvas(canvas);
        var size = getLogicalSize(canvas);
        var w = size.w, h = size.h;
        var padding = 40;
        if (data.length === 0) {
            ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('Click "Generate Samples" to begin', w/2, h/2); return;
        }
        var min = Math.min.apply(null, data), max = Math.max.apply(null, data);
        var range = max - min || 1;
        var counts = new Array(bins).fill(0);
        data.forEach(function(v) { var idx = Math.floor(((v - min) / range) * bins); if (idx >= bins) idx = bins - 1; counts[idx]++; });
        var maxCount = Math.max.apply(null, counts);
        var plotW = w - 2 * padding, plotH = h - 2 * padding;
        var barW = plotW / bins;
        drawAxes(ctx, w, h, padding);
        ctx.fillStyle = color; ctx.globalAlpha = 0.7;
        counts.forEach(function(c, i) { var barH = (c / maxCount) * plotH; ctx.fillRect(padding + i * barW, h - padding - barH, barW - 1, barH); });
        ctx.globalAlpha = 1;
        if (normalOverlay) {
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.beginPath();
            for (var i = 0; i <= plotW; i++) {
                var x = padding + i; var val = min + (i / plotW) * range;
                var z = (val - normalOverlay.mean) / normalOverlay.std;
                var density = Math.exp(-0.5 * z * z) / (normalOverlay.std * Math.sqrt(2 * Math.PI));
                var binWidth = range / bins;
                var expectedCount = density * binWidth * data.length;
                var y = h - padding - (expectedCount / maxCount) * plotH;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        for (var i = 0; i <= 4; i++) { var val = min + (i / 4) * range; ctx.fillText(val.toFixed(2), padding + (i / 4) * plotW, h - padding + 15); }
    }
    function drawPopulation() {
        var samples = []; for (var i = 0; i < 5000; i++) samples.push(sampleFromDist());
        drawHistogram(popCanvas, samples, 30, '#64748b');
    }
    genBtn.addEventListener('click', function() {
        var n = parseInt(nSlider.value), numSamples = parseInt(samplesSlider.value);
        var stats = getPopStats();
        drawPopulation();
        var means = [];
        for (var s = 0; s < numSamples; s++) { var sum = 0; for (var i = 0; i < n; i++) sum += sampleFromDist(); means.push(sum / n); }
        var sampleMean = means.reduce(function(a, c) { return a + c; }, 0) / means.length;
        var sampleVar = means.reduce(function(a, c) { return a + (c - sampleMean) * (c - sampleMean); }, 0) / means.length;
        var sampleStd = Math.sqrt(sampleVar);
        drawHistogram(meansCanvas, means, 40, '#2563eb', { mean: sampleMean, std: sampleStd });
        document.getElementById('clt-pop-mean').textContent = stats.mean.toFixed(4);
        document.getElementById('clt-sample-mean').textContent = sampleMean.toFixed(4);
        document.getElementById('clt-sample-std').textContent = sampleStd.toFixed(4);
        var theoreticalStd = Math.sqrt(stats.variance / n);
        interpEl.innerHTML = 'Even though the ' + stats.name + ' population is <strong>' +
            (distSelect.value === 'uniform' ? 'flat' : distSelect.value === 'exponential' ? 'right-skewed' : 'discrete (0 or 1)') +
            '</strong>, the distribution of sample means looks bell-shaped. With n=' + n +
            ', the theoretical standard error is \u03C3/\u221An = <strong>' + theoreticalStd.toFixed(4) +
            '</strong>, and the observed standard deviation of sample means is <strong>' + sampleStd.toFixed(4) + '</strong>.';
    });
    resetBtn.addEventListener('click', function() {
        clearCanvas(popCanvas); clearCanvas(meansCanvas);
        document.getElementById('clt-pop-mean').textContent = '-';
        document.getElementById('clt-sample-mean').textContent = '-';
        document.getElementById('clt-sample-std').textContent = '-';
        interpEl.innerHTML = '';
        drawPopulation();
        var ctx2 = meansCanvas.getContext('2d');
        var size = getLogicalSize(meansCanvas);
        ctx2.fillStyle = '#94a3b8'; ctx2.font = '14px sans-serif'; ctx2.textAlign = 'center';
        ctx2.fillText('Click "Generate Samples" to begin', size.w / 2, size.h / 2);
    });
    drawPopulation();
    var ctx2 = meansCanvas.getContext('2d');
    var mSize = getLogicalSize(meansCanvas);
    ctx2.fillStyle = '#94a3b8'; ctx2.font = '14px sans-serif'; ctx2.textAlign = 'center';
    ctx2.fillText('Click "Generate Samples" to begin', mSize.w / 2, mSize.h / 2);
}


// =====================================================
// Module: Bayes' Theorem
// =====================================================
function initBayes() {
    var canvas = document.getElementById('bayes-canvas');
    var priorSlider = document.getElementById('bayes-prior');
    var sensitivitySlider = document.getElementById('bayes-sensitivity');
    var fpSlider = document.getElementById('bayes-fp');
    var scenarioSel = document.getElementById('bayes-scenario');
    var scenarios = { medical: { prior: 0.01, sensitivity: 0.95, fp: 0.05 }, email: { prior: 0.20, sensitivity: 0.90, fp: 0.01 }, custom: null };

    function updateBayes() {
        var prior = parseFloat(priorSlider.value);
        var sensitivity = parseFloat(sensitivitySlider.value);
        var fp = parseFloat(fpSlider.value);
        document.getElementById('bayes-prior-display').textContent = prior.toFixed(3);
        document.getElementById('bayes-sensitivity-display').textContent = sensitivity.toFixed(3);
        document.getElementById('bayes-fp-display').textContent = fp.toFixed(3);
        var pE = sensitivity * prior + fp * (1 - prior);
        var posterior = (sensitivity * prior) / pE;
        document.getElementById('bayes-prior-val').textContent = prior.toFixed(4);
        document.getElementById('bayes-evidence').textContent = pE.toFixed(4);
        document.getElementById('bayes-posterior').textContent = posterior.toFixed(4);
        var interpEl = document.getElementById('bayes-interpretation');
        var ratio = posterior / prior;
        interpEl.innerHTML = 'Even with a test sensitivity of <strong>' + (sensitivity * 100).toFixed(1) + '%</strong> ' +
            'and a false positive rate of <strong>' + (fp * 100).toFixed(1) + '%</strong>, ' +
            'a positive result updates the probability from <strong>' + (prior * 100).toFixed(2) + '%</strong> ' +
            'to <strong>' + (posterior * 100).toFixed(2) + '%</strong> ' +
            '(a <strong>' + ratio.toFixed(1) + 'x</strong> increase). ' +
            (posterior < 0.5 ? 'The posterior is still below 50%, meaning a positive test result is more likely a false positive!' :
            'The posterior exceeds 50%, so a positive result likely indicates a true positive.');
        drawBayes(prior, sensitivity, fp, posterior, pE);
    }

    function drawBayes(prior, sensitivity, fp, posterior, pE) {
        var ctx = clearCanvas(canvas);
        var size = getLogicalSize(canvas);
        var w = size.w, h = size.h;
        var padding = 50;
        var startX = padding + 40, startY = h / 2;
        var midX = w * 0.35, endX = w * 0.7;

        function drawBranch(x1, y1, x2, y2, label, prob, color) {
            ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, prob * 8);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            ctx.fillStyle = '#1e293b'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(label + ' = ' + prob.toFixed(3), mx, my + (y2 < y1 ? -10 : 14));
        }
        function drawNode(x, y, text, bgColor) {
            ctx.fillStyle = bgColor;
            var tw = ctx.measureText(text).width + 16, boxH = 24;
            ctx.beginPath(); ctx.roundRect(x - tw/2, y - boxH/2, tw, boxH, 4); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, x, y);
        }

        var hY = startY - 100, nhY = startY + 100;
        drawBranch(startX, startY, midX, hY, 'P(H)', prior, '#2563eb');
        drawBranch(startX, startY, midX, nhY, 'P(\u00ACH)', 1 - prior, '#94a3b8');
        drawBranch(midX, hY, endX, hY - 50, 'P(E|H)', sensitivity, '#10b981');
        drawBranch(midX, hY, endX, hY + 50, 'P(\u00ACE|H)', 1 - sensitivity, '#94a3b8');
        drawBranch(midX, nhY, endX, nhY - 50, 'P(E|\u00ACH)', fp, '#f59e0b');
        drawBranch(midX, nhY, endX, nhY + 50, 'P(\u00ACE|\u00ACH)', 1 - fp, '#94a3b8');
        drawNode(startX, startY, 'Start', '#64748b');
        drawNode(midX, hY, 'H', '#2563eb');
        drawNode(midX, nhY, '\u00ACH', '#64748b');

        ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
        var jp1 = prior * sensitivity, jp2 = prior * (1 - sensitivity);
        var jp3 = (1 - prior) * fp, jp4 = (1 - prior) * (1 - fp);
        ctx.fillStyle = '#10b981'; ctx.fillText(jp1.toFixed(4), endX + 10, hY - 50);
        ctx.fillStyle = '#94a3b8'; ctx.fillText(jp2.toFixed(4), endX + 10, hY + 50);
        ctx.fillStyle = '#f59e0b'; ctx.fillText(jp3.toFixed(4), endX + 10, nhY - 50);
        ctx.fillStyle = '#94a3b8'; ctx.fillText(jp4.toFixed(4), endX + 10, nhY + 50);

        ctx.fillStyle = '#ecfdf5'; ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2;
        var boxX = endX + 80, boxY = h / 2 - 30;
        ctx.beginPath(); ctx.roundRect(boxX, boxY, 130, 60, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#064e3b'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('P(H|E)', boxX + 65, boxY + 22);
        ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#10b981';
        ctx.fillText(posterior.toFixed(4), boxX + 65, boxY + 46);
    }

    scenarioSel.addEventListener('change', function() {
        var s = scenarios[scenarioSel.value];
        if (s) { priorSlider.value = s.prior; sensitivitySlider.value = s.sensitivity; fpSlider.value = s.fp; }
        updateBayes();
    });
    [priorSlider, sensitivitySlider, fpSlider].forEach(function(el) { el.addEventListener('input', updateBayes); });
    updateBayes();
}

// =====================================================
// Module: Probability Distributions
// =====================================================
function initDistributions() {
    var canvas = document.getElementById('dist-canvas');
    var distType = document.getElementById('dist-type');
    var normalMu = document.getElementById('normal-mu');
    var normalSigma = document.getElementById('normal-sigma');
    var binomN = document.getElementById('binom-n');
    var binomP = document.getElementById('binom-p');
    var poissonLambda = document.getElementById('poisson-lambda');
    var interpEl = document.getElementById('dist-interpretation');

    function showParams(type) {
        document.getElementById('normal-params').style.display = type === 'normal' ? 'flex' : 'none';
        document.getElementById('binomial-params').style.display = type === 'binomial' ? 'flex' : 'none';
        document.getElementById('poisson-params').style.display = type === 'poisson' ? 'flex' : 'none';
    }
    function logBinom(n, k) {
        if (k > n) return -Infinity;
        var result = 0;
        for (var i = 0; i < k; i++) result += Math.log(n - i) - Math.log(i + 1);
        return result;
    }

    function drawDistribution() {
        var ctx = clearCanvas(canvas);
        var size = getLogicalSize(canvas);
        var w = size.w, h = size.h;
        var padding = 50, plotW = w - 2 * padding, plotH = h - 2 * padding;
        var type = distType.value;
        var xValues = [], yValues = [], mean, variance;

        if (type === 'normal') {
            var mu = parseFloat(normalMu.value), sigma = parseFloat(normalSigma.value);
            mean = mu; variance = sigma * sigma;
            document.getElementById('normal-mu-display').textContent = mu.toFixed(1);
            document.getElementById('normal-sigma-display').textContent = sigma.toFixed(1);
            var xMin = mu - 4 * sigma, xMax = mu + 4 * sigma;
            for (var i = 0; i <= 200; i++) {
                var x = xMin + (i / 200) * (xMax - xMin);
                var z = (x - mu) / sigma;
                xValues.push(x); yValues.push(Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI)));
            }
            var yMax = Math.max.apply(null, yValues) * 1.1;
            ctx.fillStyle = 'rgba(37, 99, 235, 0.2)'; ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(padding, h - padding);
            xValues.forEach(function(x, i) {
                var px = padding + ((x - xValues[0]) / (xValues[xValues.length-1] - xValues[0])) * plotW;
                ctx.lineTo(px, h - padding - (yValues[i] / yMax) * plotH);
            });
            ctx.lineTo(padding + plotW, h - padding); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            xValues.forEach(function(x, i) {
                var px = padding + ((x - xValues[0]) / (xValues[xValues.length-1] - xValues[0])) * plotW;
                var py = h - padding - (yValues[i] / yMax) * plotH;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            });
            ctx.stroke();
            drawAxes(ctx, w, h, padding, {
                xLabel: 'x', yLabel: 'f(x)',
                xTicks: [0,0.25,0.5,0.75,1].map(function(p) { return { pos: p, label: (xValues[0] + p * (xValues[xValues.length-1] - xValues[0])).toFixed(1) }; }),
                yTicks: [0,0.25,0.5,0.75,1].map(function(p) { return { pos: p, label: (p * yMax).toFixed(3) }; })
            });
            interpEl.innerHTML = 'This Normal distribution has mean \u03BC = <strong>' + mu.toFixed(1) + '</strong> and standard deviation \u03C3 = <strong>' + sigma.toFixed(1) +
                '</strong>. About 68% of values fall within [' + (mu - sigma).toFixed(1) + ', ' + (mu + sigma).toFixed(1) +
                '] and 95% within [' + (mu - 2*sigma).toFixed(1) + ', ' + (mu + 2*sigma).toFixed(1) + '].';
        } else if (type === 'binomial') {
            var n = parseInt(binomN.value), p = parseFloat(binomP.value);
            mean = n * p; variance = n * p * (1 - p);
            document.getElementById('binom-n-display').textContent = n;
            document.getElementById('binom-p-display').textContent = p.toFixed(2);
            for (var k = 0; k <= n; k++) {
                var logP = logBinom(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
                xValues.push(k); yValues.push(Math.exp(logP));
            }
            drawDiscreteDistribution(ctx, w, h, padding, xValues, yValues);
            interpEl.innerHTML = 'This Binomial(' + n + ', ' + p.toFixed(2) + ') distribution models the number of successes in ' + n +
                ' independent trials, each with probability ' + p.toFixed(2) + '. The most likely outcome is around <strong>' + Math.round(mean) + '</strong> successes.';
        } else {
            var lambda = parseFloat(poissonLambda.value);
            mean = lambda; variance = lambda;
            document.getElementById('poisson-lambda-display').textContent = lambda.toFixed(1);
            var maxK = Math.max(20, Math.ceil(lambda + 4 * Math.sqrt(lambda)));
            for (var k = 0; k <= maxK; k++) {
                var logP = -lambda + k * Math.log(lambda);
                for (var i = 1; i <= k; i++) logP -= Math.log(i);
                xValues.push(k); yValues.push(Math.exp(logP));
            }
            drawDiscreteDistribution(ctx, w, h, padding, xValues, yValues);
            interpEl.innerHTML = 'This Poisson(\u03BB=' + lambda.toFixed(1) + ') distribution models the number of events in a fixed interval. ' +
                'Both the mean and variance equal \u03BB = <strong>' + lambda.toFixed(1) + '</strong>.';
        }
        document.getElementById('dist-mean').textContent = mean.toFixed(4);
        document.getElementById('dist-variance').textContent = variance.toFixed(4);
        document.getElementById('dist-std').textContent = Math.sqrt(variance).toFixed(4);
    }

    function drawDiscreteDistribution(ctx, w, h, padding, xValues, yValues) {
        var plotW = w - 2 * padding, plotH = h - 2 * padding;
        var yMax = Math.max.apply(null, yValues) * 1.15;
        var xMin = xValues[0], xMax = xValues[xValues.length-1], xRange = xMax - xMin || 1;
        var barW = Math.max(2, Math.min(20, plotW / xValues.length - 1));
        ctx.fillStyle = 'rgba(37, 99, 235, 0.6)';
        xValues.forEach(function(x, i) {
            var px = padding + ((x - xMin) / xRange) * plotW;
            var barH = (yValues[i] / yMax) * plotH;
            ctx.fillRect(px - barW/2, h - padding - barH, barW, barH);
        });
        drawAxes(ctx, w, h, padding, {
            xLabel: 'k', yLabel: 'P(X = k)',
            xTicks: [0,0.25,0.5,0.75,1].map(function(p) { return { pos: p, label: Math.round(xMin + p * xRange).toString() }; }),
            yTicks: [0,0.25,0.5,0.75,1].map(function(p) { return { pos: p, label: (p * yMax).toFixed(3) }; })
        });
    }

    distType.addEventListener('change', function() { showParams(distType.value); drawDistribution(); });
    [normalMu, normalSigma, binomN, binomP, poissonLambda].forEach(function(el) { el.addEventListener('input', drawDistribution); });
    showParams('normal');
    drawDistribution();
}


// =====================================================
// Module: Conditional Probability
// =====================================================
function initConditional() {
    var canvas = document.getElementById('conditional-canvas');
    var paSlider = document.getElementById('cond-pa');
    var pbSlider = document.getElementById('cond-pb');
    var pabSlider = document.getElementById('cond-pab');
    var interpEl = document.getElementById('cond-interpretation');

    function update() {
        var pA = parseFloat(paSlider.value), pB = parseFloat(pbSlider.value);
        var pAB = parseFloat(pabSlider.value);
        pAB = Math.min(pAB, pA, pB);
        pabSlider.max = Math.min(pA, pB).toFixed(2);
        if (pAB > Math.min(pA, pB)) { pAB = Math.min(pA, pB); pabSlider.value = pAB; }
        document.getElementById('cond-pa-display').textContent = pA.toFixed(2);
        document.getElementById('cond-pb-display').textContent = pB.toFixed(2);
        document.getElementById('cond-pab-display').textContent = pAB.toFixed(2);
        var pAgivenB = pB > 0 ? pAB / pB : 0;
        var pBgivenA = pA > 0 ? pAB / pA : 0;
        var pAorB = pA + pB - pAB;
        var independent = Math.abs(pAB - pA * pB) < 0.01;
        document.getElementById('cond-a-given-b').textContent = pAgivenB.toFixed(4);
        document.getElementById('cond-b-given-a').textContent = pBgivenA.toFixed(4);
        document.getElementById('cond-a-or-b').textContent = pAorB.toFixed(4);
        document.getElementById('cond-independent').textContent = independent ? 'Yes' : 'No';
        document.getElementById('cond-independent').style.color = independent ? '#10b981' : '#ef4444';

        interpEl.innerHTML = 'Given that B has occurred, the probability of A <strong>' +
            (pAgivenB > pA ? 'increases' : pAgivenB < pA ? 'decreases' : 'stays the same') +
            '</strong> from ' + pA.toFixed(2) + ' to <strong>' + pAgivenB.toFixed(4) + '</strong>. ' +
            'Events A and B are <strong>' + (independent ? 'independent' : 'dependent') + '</strong> because P(A\u2229B) = ' +
            pAB.toFixed(2) + (independent ? ' \u2248 ' : ' \u2260 ') + 'P(A)\u00B7P(B) = ' + (pA * pB).toFixed(4) + '.';
        drawVenn(pA, pB, pAB);
    }

    function drawVenn(pA, pB, pAB) {
        var ctx = clearCanvas(canvas);
        var size = getLogicalSize(canvas);
        var w = size.w, h = size.h;
        var cx = w / 2, cy = h / 2;
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
        ctx.strokeRect(40, 30, w - 80, h - 60);
        ctx.fillStyle = '#64748b'; ctx.font = '12px sans-serif';
        ctx.fillText('S (Sample Space)', 50, 50);
        var maxR = Math.min(w, h) * 0.3;
        var rA = Math.sqrt(pA) * maxR, rB = Math.sqrt(pB) * maxR;
        var overlapRatio = Math.min(pA, pB) > 0 ? pAB / Math.min(pA, pB) : 0;
        var maxDist = rA + rB, minDist = Math.abs(rA - rB);
        var dist = maxDist - overlapRatio * (maxDist - minDist);
        var aX = cx - dist * 0.3, bX = cx + dist * 0.3;

        ctx.globalAlpha = 0.3; ctx.fillStyle = '#2563eb';
        ctx.beginPath(); ctx.arc(aX, cy, rA, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.arc(bX, cy, rB, 0, 2 * Math.PI); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(aX, cy, rA, 0, 2 * Math.PI); ctx.stroke();
        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath(); ctx.arc(bX, cy, rB, 0, 2 * Math.PI); ctx.stroke();

        ctx.fillStyle = '#1e40af'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('A', aX - rA * 0.4, cy - rA * 0.3);
        ctx.fillText(pA.toFixed(2), aX - rA * 0.4, cy - rA * 0.3 + 18);
        ctx.fillStyle = '#92400e';
        ctx.fillText('B', bX + rB * 0.4, cy - rB * 0.3);
        ctx.fillText(pB.toFixed(2), bX + rB * 0.4, cy - rB * 0.3 + 18);

        if (pAB > 0) {
            var intX = (aX + bX) / 2;
            ctx.fillStyle = '#065f46'; ctx.font = 'bold 13px sans-serif';
            ctx.fillText('A\u2229B', intX, cy - 5);
            ctx.fillText(pAB.toFixed(2), intX, cy + 13);
        }

        var barY = h - 45, barW = w - 120, barH = 12, barX = 60;
        var pAgivenB = pB > 0 ? pAB / pB : 0;
        var pBgivenA = pA > 0 ? pAB / pA : 0;
        ctx.fillStyle = '#e2e8f0'; ctx.fillRect(barX, barY - 18, barW, barH);
        ctx.fillStyle = '#2563eb'; ctx.fillRect(barX, barY - 18, barW * pAgivenB, barH);
        ctx.fillStyle = '#1e293b'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('P(A|B) = ' + pAgivenB.toFixed(3), barX + barW + 5, barY - 8);
        ctx.fillStyle = '#e2e8f0'; ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#f59e0b'; ctx.fillRect(barX, barY, barW * pBgivenA, barH);
        ctx.fillStyle = '#1e293b';
        ctx.fillText('P(B|A) = ' + pBgivenA.toFixed(3), barX + barW + 5, barY + 10);
    }

    [paSlider, pbSlider, pabSlider].forEach(function(el) { el.addEventListener('input', update); });
    update();
}

// =====================================================
// Module: Markov Chains
// =====================================================
function initMarkov() {
    var diagramCanvas = document.getElementById('markov-diagram-canvas');
    var evolutionCanvas = document.getElementById('markov-evolution-canvas');
    var presetSel = document.getElementById('markov-preset');
    var stepsSlider = document.getElementById('markov-steps');
    var simBtn = document.getElementById('markov-simulate');
    var resetBtn = document.getElementById('markov-reset');
    var interpEl = document.getElementById('markov-interpretation');

    var presets = {
        weather: { states: ['Sunny', 'Rainy'], matrix: [[0.7, 0.3], [0.4, 0.6]] },
        gambler: { states: ['Broke', 'Has $1', 'Rich'], matrix: [[1, 0, 0], [0.5, 0, 0.5], [0, 0, 1]] },
        custom: { states: ['A', 'B'], matrix: [[0.5, 0.5], [0.5, 0.5]] }
    };

    function getMatrix() {
        var inputs = document.querySelectorAll('.matrix-input');
        var n = Math.round(Math.sqrt(inputs.length));
        var matrix = [];
        for (var i = 0; i < n; i++) { matrix[i] = [];
            for (var j = 0; j < n; j++) {
                var input = document.querySelector('.matrix-input[data-row="' + i + '"][data-col="' + j + '"]');
                matrix[i][j] = parseFloat(input.value) || 0;
            }
        }
        return matrix;
    }
    function getStates() { return presets[presetSel.value].states; }

    function buildMatrixEditor(states, matrix) {
        var table = document.getElementById('markov-matrix');
        var thead = table.querySelector('thead tr'), tbody = table.querySelector('tbody');
        thead.innerHTML = '<th></th>';
        states.forEach(function(s) { var th = document.createElement('th'); th.textContent = s; thead.appendChild(th); });
        tbody.innerHTML = '';
        states.forEach(function(s, i) {
            var tr = document.createElement('tr');
            var th = document.createElement('th'); th.textContent = s; tr.appendChild(th);
            states.forEach(function(_, j) {
                var td = document.createElement('td');
                var input = document.createElement('input');
                input.type = 'number'; input.className = 'matrix-input';
                input.dataset.row = i; input.dataset.col = j;
                input.value = matrix[i][j]; input.min = 0; input.max = 1; input.step = 0.05;
                td.appendChild(input); tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    function multiplyMatVec(matrix, vec) {
        var n = vec.length, result = new Array(n).fill(0);
        for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) result[j] += vec[i] * matrix[i][j];
        return result;
    }
    function findStationary(matrix) {
        var n = matrix.length, vec = new Array(n).fill(1 / n);
        for (var iter = 0; iter < 1000; iter++) vec = multiplyMatVec(matrix, vec);
        return vec;
    }

    function drawDiagram(states, matrix) {
        var ctx = clearCanvas(diagramCanvas);
        var size = getLogicalSize(diagramCanvas);
        var w = size.w, h = size.h;
        var n = states.length, cx = w / 2, cy = h / 2;
        var radius = Math.min(w, h) * 0.3, nodeR = 25;
        var positions = states.map(function(_, i) {
            var angle = (i / n) * 2 * Math.PI - Math.PI / 2;
            return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
        });
        var colors = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

        for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
            if (matrix[i][j] <= 0) continue;
            var p = matrix[i][j];
            if (i === j) {
                var pos = positions[i], angle = (i / n) * 2 * Math.PI - Math.PI / 2;
                var loopCx = pos.x + 30 * Math.cos(angle), loopCy = pos.y + 30 * Math.sin(angle);
                ctx.strokeStyle = 'rgba(37,99,235,' + (0.3 + 0.7 * p) + ')'; ctx.lineWidth = 1 + p * 2;
                ctx.beginPath(); ctx.arc(loopCx, loopCy, 15, 0, 2 * Math.PI); ctx.stroke();
                ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(p.toFixed(2), loopCx + 20 * Math.cos(angle), loopCy + 20 * Math.sin(angle));
            } else {
                var from = positions[i], to = positions[j];
                var dx = to.x - from.x, dy = to.y - from.y, dist = Math.sqrt(dx*dx + dy*dy);
                var ux = dx/dist, uy = dy/dist;
                var sX = from.x + ux * nodeR, sY = from.y + uy * nodeR;
                var eX = to.x - ux * nodeR, eY = to.y - uy * nodeR;
                var perpX = -uy * 8, perpY = ux * 8;
                ctx.strokeStyle = 'rgba(37,99,235,' + (0.3 + 0.7 * p) + ')'; ctx.lineWidth = 1 + p * 2;
                ctx.beginPath(); ctx.moveTo(sX + perpX, sY + perpY); ctx.lineTo(eX + perpX, eY + perpY); ctx.stroke();
                var aS = 8, ax = eX + perpX, ay = eY + perpY;
                ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(ax, ay);
                ctx.lineTo(ax - aS * ux + aS * 0.4 * uy, ay - aS * uy - aS * 0.4 * ux);
                ctx.lineTo(ax - aS * ux - aS * 0.4 * uy, ay - aS * uy + aS * 0.4 * ux);
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#1e293b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(p.toFixed(2), (sX+eX)/2 + perpX*1.5, (sY+eY)/2 + perpY*1.5);
            }
        }
        positions.forEach(function(pos, i) {
            ctx.fillStyle = colors[i % colors.length];
            ctx.beginPath(); ctx.arc(pos.x, pos.y, nodeR, 0, 2 * Math.PI); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(states[i], pos.x, pos.y);
        });
    }

    function drawEvolution(states, history) {
        var ctx = clearCanvas(evolutionCanvas);
        var size = getLogicalSize(evolutionCanvas);
        var w = size.w, h = size.h;
        var padding = 40, plotW = w - 2*padding, plotH = h - 2*padding;
        var n = states.length, steps = history.length;
        if (steps === 0) return;
        drawAxes(ctx, w, h, padding, { xLabel: 'Step', yLabel: 'Probability' });
        var colors = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
        for (var s = 0; s < n; s++) {
            ctx.strokeStyle = colors[s % colors.length]; ctx.lineWidth = 2; ctx.beginPath();
            history.forEach(function(dist, t) {
                var x = padding + (t / Math.max(steps - 1, 1)) * plotW;
                var y = h - padding - dist[s] * plotH;
                if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
            var ly = padding + s * 18;
            ctx.fillStyle = colors[s % colors.length]; ctx.fillRect(w - padding - 80, ly, 12, 12);
            ctx.fillStyle = '#1e293b'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
            ctx.fillText(states[s], w - padding - 64, ly + 10);
        }
        ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        for (var i = 0; i <= 4; i++) { ctx.fillText(Math.round((i/4) * (steps-1)).toString(), padding + (i/4)*plotW, h-padding+15); }
        ctx.textAlign = 'right';
        for (var i = 0; i <= 4; i++) { ctx.fillText((i/4).toFixed(2), padding - 6, h - padding - (i/4)*plotH + 3); }
    }

    presetSel.addEventListener('change', function() {
        var preset = presets[presetSel.value];
        buildMatrixEditor(preset.states, preset.matrix);
        drawDiagram(preset.states, preset.matrix);
        clearCanvas(evolutionCanvas);
        interpEl.innerHTML = '';
    });
    stepsSlider.addEventListener('input', function() { document.getElementById('markov-steps-display').textContent = stepsSlider.value; });

    simBtn.addEventListener('click', function() {
        var states = getStates(), matrix = getMatrix(), steps = parseInt(stepsSlider.value);
        drawDiagram(states, matrix);
        var n = states.length, dist = new Array(n).fill(1 / n);
        var history = [dist.slice()];
        for (var t = 0; t < steps; t++) { dist = multiplyMatVec(matrix, dist); history.push(dist.slice()); }
        drawEvolution(states, history);
        var stationary = findStationary(matrix);
        document.getElementById('markov-stationary').textContent = '[' + stationary.map(function(v) { return v.toFixed(3); }).join(', ') + ']';
        var currentState = 0;
        for (var t = 0; t < steps; t++) {
            var r = Math.random(), cum = 0;
            for (var j = 0; j < n; j++) { cum += matrix[currentState][j]; if (r < cum) { currentState = j; break; } }
        }
        document.getElementById('markov-current').textContent = states[currentState];

        // Find convergence step
        var convStep = steps;
        for (var t = 1; t < history.length; t++) {
            var maxDiff = 0;
            for (var s = 0; s < n; s++) maxDiff = Math.max(maxDiff, Math.abs(history[t][s] - stationary[s]));
            if (maxDiff < 0.01) { convStep = t; break; }
        }
        interpEl.innerHTML = 'The chain converges to steady state after approximately <strong>' + convStep +
            '</strong> steps. In the long run, the system spends ' +
            states.map(function(s, i) { return '<strong>' + (stationary[i] * 100).toFixed(1) + '%</strong> of time in ' + s; }).join(', ') + '.';
    });

    resetBtn.addEventListener('click', function() {
        var preset = presets[presetSel.value];
        buildMatrixEditor(preset.states, preset.matrix);
        drawDiagram(preset.states, preset.matrix);
        clearCanvas(evolutionCanvas);
        document.getElementById('markov-stationary').textContent = '-';
        document.getElementById('markov-current').textContent = '-';
        interpEl.innerHTML = '';
    });

    var preset = presets[presetSel.value];
    buildMatrixEditor(preset.states, preset.matrix);
    drawDiagram(preset.states, preset.matrix);
}


// =====================================================
// Module: Hypothesis Testing
// =====================================================
function initHypothesisTesting() {
    var canvas = document.getElementById('ht-canvas');
    var testTypeSel = document.getElementById('ht-test-type');
    var alphaSlider = document.getElementById('ht-alpha');
    var mu0Slider = document.getElementById('ht-mu0');
    var xbarSlider = document.getElementById('ht-xbar');
    var sigmaSlider = document.getElementById('ht-sigma');
    var nSlider = document.getElementById('ht-n');
    var interpEl = document.getElementById('ht-interpretation');

    function update() {
        var alpha = parseFloat(alphaSlider.value);
        var mu0 = parseFloat(mu0Slider.value);
        var xbar = parseFloat(xbarSlider.value);
        var sigma = parseFloat(sigmaSlider.value);
        var n = parseInt(nSlider.value);
        var testType = testTypeSel.value;

        document.getElementById('ht-alpha-display').textContent = alpha.toFixed(2);
        document.getElementById('ht-mu0-display').textContent = mu0;
        document.getElementById('ht-xbar-display').textContent = xbar;
        document.getElementById('ht-sigma-display').textContent = sigma;
        document.getElementById('ht-n-display').textContent = n;

        var se = sigma / Math.sqrt(n);
        var z = (xbar - mu0) / se;
        var pValue;
        var criticalText;

        if (testType === 'two-tailed') {
            pValue = 2 * (1 - normalCDF(Math.abs(z)));
            var cv = normalInvCDF(1 - alpha / 2);
            criticalText = '\u00B1' + cv.toFixed(3);
        } else if (testType === 'left-tailed') {
            pValue = normalCDF(z);
            var cv = normalInvCDF(alpha);
            criticalText = cv.toFixed(3);
        } else {
            pValue = 1 - normalCDF(z);
            var cv = normalInvCDF(1 - alpha);
            criticalText = cv.toFixed(3);
        }

        var reject = pValue < alpha;
        document.getElementById('ht-z').textContent = z.toFixed(4);
        document.getElementById('ht-pvalue').textContent = pValue.toFixed(4);
        document.getElementById('ht-critical').textContent = criticalText;
        var decisionEl = document.getElementById('ht-decision');
        decisionEl.textContent = reject ? 'Reject H\u2080' : 'Fail to Reject H\u2080';
        decisionEl.className = 'stat-value ' + (reject ? 'decision-reject' : 'decision-fail');

        interpEl.innerHTML = 'The z-statistic is <strong>' + z.toFixed(3) + '</strong> with a p-value of <strong>' + pValue.toFixed(4) + '</strong>. ' +
            'At \u03B1 = ' + alpha.toFixed(2) + ', we <strong>' + (reject ? 'reject' : 'fail to reject') + '</strong> the null hypothesis. ' +
            (reject ? 'There is sufficient evidence that the true mean differs from ' + mu0 + '.' :
            'There is not enough evidence to conclude the true mean differs from ' + mu0 + '.') +
            ' <em>Note: A p-value is NOT the probability that H\u2080 is true \u2014 it is the probability of observing data this extreme if H\u2080 were true.</em>';

        drawHT(z, alpha, testType, reject);
    }

    function drawHT(z, alpha, testType, reject) {
        var ctx = clearCanvas(canvas);
        var size = getLogicalSize(canvas);
        var w = size.w, h = size.h;
        var padding = 50, plotW = w - 2 * padding, plotH = h - 2 * padding;

        // Draw standard normal curve
        var xMin = -4, xMax = 4;

        // Find max PDF value for scaling
        var yMax = normalPDF(0) * 1.15;

        drawAxes(ctx, w, h, padding, { xLabel: 'z', yLabel: 'Density' });

        // Shade rejection region(s) first
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        if (testType === 'two-tailed') {
            var cv = normalInvCDF(1 - alpha / 2);
            // Left tail
            ctx.beginPath(); ctx.moveTo(padding, h - padding);
            for (var px = 0; px <= plotW; px++) {
                var zVal = xMin + (px / plotW) * (xMax - xMin);
                if (zVal > -cv) break;
                ctx.lineTo(padding + px, h - padding - (normalPDF(zVal) / yMax) * plotH);
            }
            ctx.lineTo(padding + ((-cv - xMin) / (xMax - xMin)) * plotW, h - padding);
            ctx.closePath(); ctx.fill();
            // Right tail
            ctx.beginPath();
            var startPx = ((cv - xMin) / (xMax - xMin)) * plotW;
            ctx.moveTo(padding + startPx, h - padding);
            for (var px = Math.floor(startPx); px <= plotW; px++) {
                var zVal = xMin + (px / plotW) * (xMax - xMin);
                ctx.lineTo(padding + px, h - padding - (normalPDF(zVal) / yMax) * plotH);
            }
            ctx.lineTo(padding + plotW, h - padding);
            ctx.closePath(); ctx.fill();
        } else if (testType === 'left-tailed') {
            var cv = normalInvCDF(alpha);
            ctx.beginPath(); ctx.moveTo(padding, h - padding);
            for (var px = 0; px <= plotW; px++) {
                var zVal = xMin + (px / plotW) * (xMax - xMin);
                if (zVal > cv) break;
                ctx.lineTo(padding + px, h - padding - (normalPDF(zVal) / yMax) * plotH);
            }
            ctx.lineTo(padding + ((cv - xMin) / (xMax - xMin)) * plotW, h - padding);
            ctx.closePath(); ctx.fill();
        } else {
            var cv = normalInvCDF(1 - alpha);
            ctx.beginPath();
            var startPx = ((cv - xMin) / (xMax - xMin)) * plotW;
            ctx.moveTo(padding + startPx, h - padding);
            for (var px = Math.floor(startPx); px <= plotW; px++) {
                var zVal = xMin + (px / plotW) * (xMax - xMin);
                ctx.lineTo(padding + px, h - padding - (normalPDF(zVal) / yMax) * plotH);
            }
            ctx.lineTo(padding + plotW, h - padding);
            ctx.closePath(); ctx.fill();
        }

        // Draw the curve
        ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; ctx.beginPath();
        for (var px = 0; px <= plotW; px++) {
            var zVal = xMin + (px / plotW) * (xMax - xMin);
            var y = h - padding - (normalPDF(zVal) / yMax) * plotH;
            if (px === 0) ctx.moveTo(padding + px, y); else ctx.lineTo(padding + px, y);
        }
        ctx.stroke();

        // Draw z-statistic line
        var zPx = padding + ((z - xMin) / (xMax - xMin)) * plotW;
        if (zPx >= padding && zPx <= w - padding) {
            ctx.strokeStyle = reject ? '#ef4444' : '#10b981';
            ctx.lineWidth = 3; ctx.setLineDash([5, 3]);
            ctx.beginPath(); ctx.moveTo(zPx, h - padding); ctx.lineTo(zPx, padding + 20); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = reject ? '#ef4444' : '#10b981';
            ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('z = ' + z.toFixed(2), zPx, padding + 15);
        }

        // X-axis labels
        ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        for (var i = -4; i <= 4; i++) {
            var x = padding + ((i - xMin) / (xMax - xMin)) * plotW;
            ctx.fillText(i.toString(), x, h - padding + 15);
        }

        // Rejection region label
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'; ctx.font = '11px sans-serif';
        ctx.fillText('\u03B1 = ' + alpha.toFixed(2), w - padding - 40, padding + 30);
    }

    [testTypeSel, alphaSlider, mu0Slider, xbarSlider, sigmaSlider, nSlider].forEach(function(el) {
        el.addEventListener('input', update);
        el.addEventListener('change', update);
    });
    update();
}


// =====================================================
// Module: Confidence Intervals
// =====================================================
function initConfidenceIntervals() {
    var canvas = document.getElementById('ci-canvas');
    var muSlider = document.getElementById('ci-mu');
    var sigmaSlider = document.getElementById('ci-sigma');
    var nSlider = document.getElementById('ci-n');
    var levelSel = document.getElementById('ci-level');
    var countSlider = document.getElementById('ci-count');
    var genBtn = document.getElementById('ci-generate');
    var interpEl = document.getElementById('ci-interpretation');

    muSlider.addEventListener('input', function() { document.getElementById('ci-mu-display').textContent = muSlider.value; });
    sigmaSlider.addEventListener('input', function() { document.getElementById('ci-sigma-display').textContent = sigmaSlider.value; });
    nSlider.addEventListener('input', function() { document.getElementById('ci-n-display').textContent = nSlider.value; });
    countSlider.addEventListener('input', function() { document.getElementById('ci-count-display').textContent = countSlider.value; });
    levelSel.addEventListener('change', function() { document.getElementById('ci-level-display').textContent = (parseFloat(levelSel.value) * 100) + '%'; });

    genBtn.addEventListener('click', function() {
        var mu = parseFloat(muSlider.value);
        var sigma = parseFloat(sigmaSlider.value);
        var n = parseInt(nSlider.value);
        var level = parseFloat(levelSel.value);
        var count = parseInt(countSlider.value);

        var zStar = normalInvCDF(1 - (1 - level) / 2);
        var se = sigma / Math.sqrt(n);
        var margin = zStar * se;

        var intervals = [];
        var hits = 0;
        for (var i = 0; i < count; i++) {
            // Generate sample mean ~ N(mu, se^2)
            var sampleMean = mu + randn() * se;
            var lower = sampleMean - margin;
            var upper = sampleMean + margin;
            var contains = (lower <= mu && mu <= upper);
            if (contains) hits++;
            intervals.push({ mean: sampleMean, lower: lower, upper: upper, contains: contains });
        }

        var coverage = hits / count;
        document.getElementById('ci-hits').textContent = hits + ' / ' + count;
        document.getElementById('ci-coverage').textContent = (coverage * 100).toFixed(1) + '%';
        document.getElementById('ci-margin').textContent = '\u00B1' + margin.toFixed(3);

        interpEl.innerHTML = (level * 100) + '% confidence means that if we repeated this process many times, about ' +
            (level * 100) + '% of intervals would contain the true mean. In this run, <strong>' +
            (coverage * 100).toFixed(1) + '%</strong> of ' + count + ' intervals captured \u03BC = ' + mu +
            '. The <span style="color:#ef4444">red intervals</span> missed the true mean.';

        drawCI(intervals, mu, margin);
    });

    function drawCI(intervals, mu, margin) {
        var ctx = clearCanvas(canvas);
        var size = getLogicalSize(canvas);
        var w = size.w, h = size.h;
        var padding = 50;
        var plotW = w - 2 * padding, plotH = h - 2 * padding;
        var count = intervals.length;

        // Find x range
        var allVals = [];
        intervals.forEach(function(ci) { allVals.push(ci.lower, ci.upper); });
        allVals.push(mu);
        var xMin = Math.min.apply(null, allVals) - 1;
        var xMax = Math.max.apply(null, allVals) + 1;
        var xRange = xMax - xMin;

        drawAxes(ctx, w, h, padding, { xLabel: 'Value' });

        // Draw true mean vertical line
        var muX = padding + ((mu - xMin) / xRange) * plotW;
        ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
        ctx.beginPath(); ctx.moveTo(muX, padding); ctx.lineTo(muX, h - padding); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#2563eb'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('\u03BC = ' + mu, muX, padding - 8);

        // Draw each interval
        var rowH = Math.min(plotH / count, 8);
        intervals.forEach(function(ci, i) {
            var y = padding + i * (plotH / count) + (plotH / count) / 2;
            var lx = padding + ((ci.lower - xMin) / xRange) * plotW;
            var rx = padding + ((ci.upper - xMin) / xRange) * plotW;
            var mx = padding + ((ci.mean - xMin) / xRange) * plotW;

            var color = ci.contains ? '#10b981' : '#ef4444';
            ctx.strokeStyle = color; ctx.lineWidth = ci.contains ? 1.5 : 2;
            ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(rx, y); ctx.stroke();

            // Dot for sample mean
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(mx, y, 2, 0, 2 * Math.PI); ctx.fill();
        });

        // X-axis ticks
        ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        for (var i = 0; i <= 5; i++) {
            var val = xMin + (i / 5) * xRange;
            ctx.fillText(val.toFixed(1), padding + (i / 5) * plotW, h - padding + 15);
        }
    }

    // Initial placeholder
    var ctx = canvas.getContext('2d');
    var sz = getLogicalSize(canvas);
    ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Click "Generate Intervals" to begin', sz.w / 2, sz.h / 2);
}

// =====================================================
// Module: Monte Carlo Simulation
// =====================================================
function initMonteCarlo() {
    var canvas = document.getElementById('mc-canvas');
    var scenarioSel = document.getElementById('mc-scenario');
    var speedSlider = document.getElementById('mc-speed');
    var startBtn = document.getElementById('mc-start');
    var resetBtn = document.getElementById('mc-reset');
    var interpEl = document.getElementById('mc-interpretation');

    var running = false, animId = null;
    var state = null;

    function getScenario() {
        switch (scenarioSel.value) {
            case 'pi': return { name: 'Estimate Pi', trueValue: Math.PI };
            case 'integral': return { name: 'Integral of sin(x) from 0 to \u03C0', trueValue: 2 };
            case 'monty': return { name: 'Monty Hall (Switch Strategy)', trueValue: 2/3 };
        }
    }

    function resetState() {
        var scenario = scenarioSel.value;
        if (scenario === 'pi') {
            state = { points: [], inside: 0, total: 0 };
        } else if (scenario === 'integral') {
            state = { points: [], hits: 0, total: 0, estimates: [] };
        } else {
            state = { switchWins: 0, stayWins: 0, total: 0 };
        }
        document.getElementById('mc-samples').textContent = '0';
        document.getElementById('mc-estimate').textContent = '-';
        document.getElementById('mc-true').textContent = getScenario().trueValue.toFixed(6);
        document.getElementById('mc-error').textContent = '-';
        interpEl.innerHTML = 'Click Start to begin the Monte Carlo simulation.';
        drawMC();
    }

    function step() {
        var scenario = scenarioSel.value;
        var batchSize = Math.max(1, Math.floor(speedSlider.value / 5));

        if (scenario === 'pi') {
            for (var b = 0; b < batchSize; b++) {
                var x = Math.random(), y = Math.random();
                var inside = (x * x + y * y) <= 1;
                if (inside) state.inside++;
                state.total++;
                if (state.points.length < 5000) state.points.push({ x: x, y: y, inside: inside });
            }
            var estimate = 4 * state.inside / state.total;
            document.getElementById('mc-estimate').textContent = estimate.toFixed(6);
            document.getElementById('mc-error').textContent = Math.abs(estimate - Math.PI).toFixed(6);
        } else if (scenario === 'integral') {
            // Integral of sin(x) from 0 to pi, bounding box [0,pi] x [0,1]
            for (var b = 0; b < batchSize; b++) {
                var x = Math.random() * Math.PI;
                var y = Math.random();
                var hit = y <= Math.sin(x);
                if (hit) state.hits++;
                state.total++;
                if (state.points.length < 5000) state.points.push({ x: x, y: y, hit: hit });
            }
            var estimate = (state.hits / state.total) * Math.PI; // area = fraction * bounding box area
            state.estimates.push(estimate);
            document.getElementById('mc-estimate').textContent = estimate.toFixed(6);
            document.getElementById('mc-error').textContent = Math.abs(estimate - 2).toFixed(6);
        } else {
            for (var b = 0; b < batchSize; b++) {
                // Monty Hall: 3 doors
                var car = Math.floor(Math.random() * 3);
                var pick = Math.floor(Math.random() * 3);
                // Host opens a door that is not car and not pick
                var hostOptions = [];
                for (var d = 0; d < 3; d++) if (d !== car && d !== pick) hostOptions.push(d);
                // Switch: pick the remaining door
                var switchWin = (pick !== car); // switching wins iff original pick was wrong
                if (switchWin) state.switchWins++;
                else state.stayWins++;
                state.total++;
            }
            var switchRate = state.switchWins / state.total;
            document.getElementById('mc-estimate').textContent = switchRate.toFixed(6);
            document.getElementById('mc-error').textContent = Math.abs(switchRate - 2/3).toFixed(6);
        }
        document.getElementById('mc-samples').textContent = state.total;
        drawMC();
        updateMCInterpretation();
    }

    function updateMCInterpretation() {
        var scenario = scenarioSel.value;
        var sc = getScenario();
        if (state.total === 0) return;
        if (scenario === 'pi') {
            var est = 4 * state.inside / state.total;
            interpEl.innerHTML = 'By randomly placing <strong>' + state.total + '</strong> points in a unit square, ' +
                'the ratio inside the quarter-circle estimates \u03C0/4. Current estimate: <strong>' + est.toFixed(4) +
                '</strong> (true: 3.14159...). The Law of Large Numbers drives this estimate toward \u03C0.';
        } else if (scenario === 'integral') {
            var est = (state.hits / state.total) * Math.PI;
            interpEl.innerHTML = 'Estimating \u222B sin(x)dx from 0 to \u03C0 using <strong>' + state.total +
                '</strong> random points. The fraction below sin(x) times the bounding box area gives <strong>' +
                est.toFixed(4) + '</strong> (true: 2.0000).';
        } else {
            var switchRate = state.switchWins / state.total;
            var stayRate = state.stayWins / state.total;
            interpEl.innerHTML = 'After <strong>' + state.total + '</strong> games: switching wins <strong>' +
                (switchRate * 100).toFixed(1) + '%</strong> of the time, staying wins <strong>' +
                (stayRate * 100).toFixed(1) + '%</strong>. The optimal strategy is to always switch (2/3 win rate).';
        }
    }

    function drawMC() {
        var ctx = clearCanvas(canvas);
        var size = getLogicalSize(canvas);
        var w = size.w, h = size.h;
        var padding = 50;
        var scenario = scenarioSel.value;

        if (scenario === 'pi') {
            // Draw unit square with quarter circle
            var plotSize = Math.min(w - 2 * padding, h - 2 * padding);
            var ox = padding, oy = padding;

            // Background
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(ox, oy, plotSize, plotSize);

            // Quarter circle arc
            ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(ox, oy + plotSize, plotSize, -Math.PI / 2, 0); ctx.stroke();

            // Points
            state.points.forEach(function(p) {
                ctx.fillStyle = p.inside ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.3)';
                ctx.beginPath();
                ctx.arc(ox + p.x * plotSize, oy + (1 - p.y) * plotSize, 1.5, 0, 2 * Math.PI);
                ctx.fill();
            });

            // Labels
            ctx.fillStyle = '#1e293b'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('0', ox, oy + plotSize + 15);
            ctx.fillText('1', ox + plotSize, oy + plotSize + 15);

            // Estimate display
            if (state.total > 0) {
                var est = (4 * state.inside / state.total);
                ctx.fillStyle = '#2563eb'; ctx.font = 'bold 20px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('\u03C0 \u2248 ' + est.toFixed(4), ox + plotSize + 30, oy + 30);
                ctx.font = '13px sans-serif'; ctx.fillStyle = '#64748b';
                ctx.fillText('Inside: ' + state.inside, ox + plotSize + 30, oy + 55);
                ctx.fillText('Total: ' + state.total, ox + plotSize + 30, oy + 75);
            }

        } else if (scenario === 'integral') {
            var plotW = w - 2 * padding, plotH = h - 2 * padding;
            // Bounding box: [0, pi] x [0, 1]
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(padding, padding, plotW, plotH);

            // Draw sin curve
            ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; ctx.beginPath();
            for (var i = 0; i <= 200; i++) {
                var x = (i / 200) * Math.PI;
                var px = padding + (x / Math.PI) * plotW;
                var py = padding + (1 - Math.sin(x)) * plotH;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();

            // Points
            state.points.forEach(function(p) {
                ctx.fillStyle = p.hit ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.3)';
                ctx.beginPath();
                ctx.arc(padding + (p.x / Math.PI) * plotW, padding + (1 - p.y) * plotH, 1.5, 0, 2 * Math.PI);
                ctx.fill();
            });

            ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('0', padding, h - padding + 15);
            ctx.fillText('\u03C0', w - padding, h - padding + 15);
            ctx.fillText('sin(x)', w / 2, padding - 8);

        } else {
            // Monty Hall bar chart
            var plotW = w - 2 * padding, plotH = h - 2 * padding;
            var barWidth = plotW * 0.25;

            if (state.total > 0) {
                var switchRate = state.switchWins / state.total;
                var stayRate = state.stayWins / state.total;

                // Switch bar
                var switchH = switchRate * plotH;
                ctx.fillStyle = '#10b981';
                ctx.fillRect(padding + plotW * 0.15, h - padding - switchH, barWidth, switchH);

                // Stay bar
                var stayH = stayRate * plotH;
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(padding + plotW * 0.6, h - padding - stayH, barWidth, stayH);

                // Labels
                ctx.fillStyle = '#1e293b'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText('Switch', padding + plotW * 0.15 + barWidth / 2, h - padding + 20);
                ctx.fillText('Stay', padding + plotW * 0.6 + barWidth / 2, h - padding + 20);

                ctx.font = 'bold 16px sans-serif';
                ctx.fillStyle = '#10b981';
                ctx.fillText((switchRate * 100).toFixed(1) + '%', padding + plotW * 0.15 + barWidth / 2, h - padding - switchH - 10);
                ctx.fillStyle = '#ef4444';
                ctx.fillText((stayRate * 100).toFixed(1) + '%', padding + plotW * 0.6 + barWidth / 2, h - padding - stayH - 10);

                // 2/3 reference line
                var refY = h - padding - (2/3) * plotH;
                ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1; ctx.setLineDash([5, 3]);
                ctx.beginPath(); ctx.moveTo(padding, refY); ctx.lineTo(w - padding, refY); ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = '#2563eb'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
                ctx.fillText('Theoretical: 66.7%', w - padding - 120, refY - 5);
            } else {
                ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText('Click Start to simulate the Monty Hall problem', w / 2, h / 2);
            }

            // Y-axis
            drawAxes(ctx, w, h, padding, { yLabel: 'Win Rate' });
            ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
            for (var i = 0; i <= 4; i++) {
                var val = i / 4;
                ctx.fillText((val * 100).toFixed(0) + '%', padding - 6, h - padding - val * plotH + 3);
            }
        }
    }

    function animate() {
        step();
        if (running && state.total < 50000) {
            animId = requestAnimationFrame(animate);
        } else {
            running = false;
            startBtn.textContent = 'Start';
        }
    }

    startBtn.addEventListener('click', function() {
        if (running) {
            running = false; cancelAnimationFrame(animId); startBtn.textContent = 'Start';
        } else {
            if (!state || state.total === 0) resetState();
            running = true; startBtn.textContent = 'Pause'; animate();
        }
    });

    resetBtn.addEventListener('click', function() {
        running = false; cancelAnimationFrame(animId); startBtn.textContent = 'Start';
        resetState();
    });

    scenarioSel.addEventListener('change', function() {
        running = false; cancelAnimationFrame(animId); startBtn.textContent = 'Start';
        resetState();
    });

    resetState();
}
