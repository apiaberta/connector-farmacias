import mongoose from 'mongoose'
import cron from 'node-cron'
import { buildApp } from './app.js'
import {
    CATALOG_CRON,
    COORD_DELAY_MS,
    CRON_TZ,
    PORT,
    SERVICE_CRON,
    resolveMongoUri
} from './config.js'
import { ensureIndexes } from './db/indexes.js'
import { Pharmacy } from './db/models.js'
import { assertSafeMongoTarget } from './db/mongoUri.js'
import { backfillCoordinates, syncCatalog } from './sync/infarmed.js'
import { syncService } from './sync/service1400.js'

mongoose.set('autoIndex', false)

const MONGO_URI = resolveMongoUri()
assertSafeMongoTarget(MONGO_URI)

const app = await buildApp()

await mongoose.connect(MONGO_URI)
app.log.info('Connected to MongoDB')

const indexResult = await ensureIndexes()
app.log.info({ indexes: indexResult.length }, 'MongoDB indexes ensured')

async function runCatalog (reason) {
    try {
        const result = await syncCatalog()
        app.log.info({ result, reason }, 'Infarmed catalog synced')
        backfillCoordinates({ delayMs: COORD_DELAY_MS })
            .then(r => app.log.info({ result: r }, 'Coordinate backfill finished'))
            .catch(err => app.log.error({ err }, 'Coordinate backfill failed'))
        return result
    } catch (err) {
        app.log.error({ err, reason }, 'Infarmed catalog sync failed')
        throw err
    }
}

async function runService (reason) {
    try {
        const result = await syncService()
        app.log.info({ result, reason }, '1400safe on-duty sync finished')
        return result
    } catch (err) {
        app.log.error({ err, reason }, '1400safe on-duty sync failed')
        throw err
    }
}

cron.schedule(CATALOG_CRON, () => {
    runCatalog('cron').catch(() => {})
}, { timezone: CRON_TZ })

cron.schedule(SERVICE_CRON, () => {
    runService('cron').catch(() => {})
}, { timezone: CRON_TZ })

await app.listen({ port: PORT, host: '0.0.0.0' })

setImmediate(async () => {
    try {
        const count = await Pharmacy.countDocuments()
        if (count === 0) {
            app.log.info('Pharmacy collection empty — running initial Infarmed catalog sync')
            await runCatalog('startup-empty').catch(() => {})
        }
        await runService('startup').catch(() => {})
    } catch (err) {
        app.log.error({ err }, 'Startup sync failed')
    }
})
