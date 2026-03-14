import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: process.env.GITHUB_ACTIONS ? '/Probability-education/' : './',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@modules': resolve(__dirname, 'src/modules'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        convergenceModes: resolve(__dirname, 'src/modules/2.1-convergence-modes/index.html'),
        llnLab: resolve(__dirname, 'src/modules/2.3-lln-lab/index.html'),
        cltStudio: resolve(__dirname, 'src/modules/2.4-clt-studio/index.html'),
        martingaleExplorer: resolve(__dirname, 'src/modules/4.2-martingale-explorer/index.html'),
        donsker: resolve(__dirname, 'src/modules/5.1-donsker/index.html'),
        brownianProperties: resolve(__dirname, 'src/modules/5.2-brownian-properties/index.html'),
        markovDashboard: resolve(__dirname, 'src/modules/6.1-markov-dashboard/index.html'),
        spcControlChart: resolve(__dirname, 'src/modules/mq-1-spc-control-chart/index.html'),
        funnelPlot: resolve(__dirname, 'src/modules/mq-2-funnel-plot/index.html'),
        cusumChart: resolve(__dirname, 'src/modules/mq-3-cusum-chart/index.html'),
        paretoChart: resolve(__dirname, 'src/modules/mq-4-pareto-chart/index.html'),
        sigmaAlgebra: resolve(__dirname, 'src/modules/1.1-sigma-algebra/index.html'),
        measureRandomVars: resolve(__dirname, 'src/modules/1.2-measure-random-vars/index.html'),
        lebesgueRiemann: resolve(__dirname, 'src/modules/1.3-lebesgue-riemann/index.html'),
        cantorSet: resolve(__dirname, 'src/modules/1.4-cantor-set/index.html'),
        borelCantelli: resolve(__dirname, 'src/modules/2.2-borel-cantelli/index.html'),
        characteristicFunctions: resolve(__dirname, 'src/modules/3.1-characteristic-functions/index.html'),
        convolutionCFs: resolve(__dirname, 'src/modules/3.2-convolution-cfs/index.html'),
        conditionalExpectation: resolve(__dirname, 'src/modules/4.1-conditional-expectation/index.html'),
        ergodicMixing: resolve(__dirname, 'src/modules/6.2-ergodic-mixing/index.html'),
        diagnosticTesting: resolve(__dirname, 'src/modules/mq-5-diagnostic-testing/index.html'),
        metaAnalysis: resolve(__dirname, 'src/modules/mq-6-meta-analysis/index.html'),
        clinicalStatistics: resolve(__dirname, 'src/modules/mq-7-clinical-statistics/index.html'),
        itoIntegral: resolve(__dirname, 'src/modules/7.1-ito-integral/index.html'),
        sdeSolver: resolve(__dirname, 'src/modules/7.2-sde-solver/index.html'),
        priorPosterior: resolve(__dirname, 'src/modules/8.1-prior-posterior/index.html'),
        mcmcExplorer: resolve(__dirname, 'src/modules/8.2-mcmc-explorer/index.html'),
        entropyKl: resolve(__dirname, 'src/modules/9.1-entropy-kl/index.html'),
        mutualInformation: resolve(__dirname, 'src/modules/9.2-mutual-information/index.html'),
        diseaseModeling: resolve(__dirname, 'src/modules/mq-8-disease-modeling/index.html'),
        vaccinePreventable: resolve(__dirname, 'src/modules/mq-9-vaccine-preventable/index.html'),
      },
    },
  },
});
