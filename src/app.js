import Fastify from 'fastify'
import { dataRoutes } from './routes/data.js'
import { metaRoutes } from './routes/meta.js'
import { SERVICE_NAME, SERVICE_VERSION } from './version.js'

export { SERVICE_NAME, SERVICE_VERSION }

export async function buildApp (opts = {}) {
    const app = Fastify({
        logger: opts.logger === false
            ? false
            : {
                transport: process.env.NODE_ENV !== 'production'
                    ? { target: 'pino-pretty' }
                    : undefined
            }
    })

    app.get('/health', async () => ({
        status: 'ok',
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        timestamp: new Date().toISOString()
    }))
    app.get('/farmacias/health', async () => ({
        status: 'ok',
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        timestamp: new Date().toISOString()
    }))

    await app.register(metaRoutes)
    await app.register(dataRoutes)
    return app
}
