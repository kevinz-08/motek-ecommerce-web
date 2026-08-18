const { resolve } = require('path')
const nodeExternals = require('webpack-node-externals')

/**
 * webpack config personalizado para NestJS en monorepo pnpm.
 *
 * Por qué: webpack-node-externals externaliza TODOS los node_modules, incluyendo
 * los workspace packages (@motek/*). En runtime, Node.js hace require('@motek/database')
 * que resuelve al .ts fuente y falla con "Unexpected token ':'".
 *
 * Solución: allowlist de @motek/* fuerza a webpack a bundlear esos paquetes
 * directamente (ts-loader los transforma a JS durante el build).
 */
module.exports = function (options) {
  return {
    ...options,
    externals: [
      // Externalizar binarios nativos .node (e.g. @sentry/profiling-node)
      // webpack no puede procesar archivos ELF/Mach-O/PE.
      ({ request }, callback) => {
        if (request && request.endsWith('.node')) return callback(null, `commonjs ${request}`)
        callback()
      },
      nodeExternals({
        allowlist: [/^@motek\//],
        modulesDir: resolve(__dirname, '../../node_modules'),
      }),
    ],
    resolve: {
      ...options.resolve,
      alias: {
        '@motek/database': resolve(__dirname, '../../packages/database/src/index.ts'),
        '@motek/domain': resolve(__dirname, '../../packages/domain/src/index.ts'),
        '@motek/types': resolve(__dirname, '../../packages/types/src/index.ts'),
      },
    },
  }
}
