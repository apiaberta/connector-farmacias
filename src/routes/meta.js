import { Pharmacy, Shift, SyncState, SYNC_ID } from '../db/models.js'
import { SERVICE_NAME, SERVICE_VERSION } from '../version.js'
import { currentShiftWindow } from '../lib/shift.js'

const SOURCE = {
    catalog: {
        name: 'INFARMED — Autoridade Nacional do Medicamento e Produtos de Saúde, I.P.',
        url: 'https://extranet.infarmed.pt/LicenciamentoMais-fo/pages/public/listaFarmacias.xhtml',
        attribution: 'Catálogo de farmácias licenciado pelo Infarmed (lista pública de alvarás).'
    },
    service: {
        name: 'Linha 1400 / ANF (Associação Nacional das Farmácias)',
        url: 'https://www.1400safe.pt/',
        attribution: 'Farmácias de serviço do dia (9h–9h, hora de Lisboa), Linha 1400.'
    }
}

export async function metaPayload () {
    const { shift_day } = currentShiftWindow()
    const [state, pharmacies, withCoords, onDuty] = await Promise.all([
        SyncState.findById(SYNC_ID).lean(),
        Pharmacy.countDocuments({ active: { $ne: false } }),
        Pharmacy.countDocuments({
            active: { $ne: false },
            latitude: { $ne: null },
            longitude: { $ne: null }
        }),
        Shift.countDocuments({ shift_day })
    ])

    return {
        connector: SERVICE_NAME,
        version: SERVICE_VERSION,
        description: 'Catálogo nacional de farmácias (Infarmed) e farmácias de serviço (Linha 1400 / ANF).',
        source: [SOURCE.catalog.url, SOURCE.service.url],
        attribution: [SOURCE.catalog.attribution, SOURCE.service.attribution],
        sources: SOURCE,
        update_freq: {
            catalog: 'weekly (Monday 04:00 Europe/Lisbon) and on empty startup',
            service: '09:05 and 21:05 Europe/Lisbon and on startup',
            coordinates: 'incremental, 1 request/s, only pharmacies still missing lat/lon'
        },
        endpoints: [
            { path: '/v1/farmacias', method: 'GET', description: 'Catálogo de farmácias' },
            { path: '/v1/farmacias/{id}', method: 'GET', description: 'Detalhe (alvará Infarmed)' },
            { path: '/v1/farmacias/servico', method: 'GET', description: 'Farmácias de serviço agora' },
            { path: '/v1/farmacias/servico/{municipality}', method: 'GET', description: 'Farmácias de serviço no concelho INE' },
            { path: '/v1/farmacias/municipios', method: 'GET', description: 'Concelhos com contagens' },
            { path: '/v1/farmacias/meta', method: 'GET', description: 'Metadados do conector' }
        ],
        stats: {
            pharmacies,
            with_coordinates: withCoords,
            on_duty: onDuty,
            shift_day,
            last_catalog_sync: state?.catalog_last_success ?? null,
            last_service_sync: state?.service_last_success ?? null,
            coords_pending: state?.coords_pending ?? null,
            catalog_last_error: state?.catalog_last_error ?? null,
            service_last_error: state?.service_last_error ?? null
        }
    }
}

export async function statusPayload () {
    const meta = await metaPayload()
    return {
        status: 'ok',
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        timestamp: new Date().toISOString(),
        last_catalog_sync: meta.stats.last_catalog_sync,
        last_service_sync: meta.stats.last_service_sync,
        sources: SOURCE
    }
}

export async function metaRoutes (app) {
    app.get('/meta', async () => metaPayload())
    app.get('/farmacias/meta', async () => metaPayload())
    app.get('/status', async () => statusPayload())
    app.get('/farmacias/status', async () => statusPayload())
}
