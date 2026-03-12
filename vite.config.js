import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
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
        lebesgueRiemann: resolve(__dirname, 'src/modules/1.3-lebesgue-riemann/index.html'),
        cantorSet: resolve(__dirname, 'src/modules/1.4-cantor-set/index.html'),
        characteristicFunctions: resolve(__dirname, 'src/modules/3.1-characteristic-functions/index.html'),
        convolutionCFs: resolve(__dirname, 'src/modules/3.2-convolution-cfs/index.html'),
      },
    },
  },
});
