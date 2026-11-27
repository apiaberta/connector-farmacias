export const PORT = parseInt(process.env.PORT || '3007', 10)

export const DEFAULT_MONGO_URI = 'mongodb://localhost:27017/apiaberta-farmacias'

export function resolveMongoUri (env = process.env) {
    return env.MONGO_URI || env.MONGODB_URI || DEFAULT_MONGO_URI
}

export const USER_AGENT = 'apiaberta.pt/1.0 (open-data connector)'
export const FETCH_TIMEOUT_MS = 30_000

export const INFARMED_LIST_URL =
    'https://extranet.infarmed.pt/LicenciamentoMais-fo/pages/public/listaFarmacias.xhtml'

export const SAFE1400_ORIGIN = 'https://www.1400safe.pt'
export const SAFE1400_MUNICIPALITIES_URL =
    `${SAFE1400_ORIGIN}/FourteenHundred/LoadMunicipalities`
export const SAFE1400_PHARMACIES_URL =
    `${SAFE1400_ORIGIN}/FourteenHundred/LoadPharmacies`

export const FORBIDDEN_HOSTS = Object.freeze(['farmaciasdeservico.net'])

export const CATALOG_CRON = '0 4 * * 1'
export const SERVICE_CRON = '5 9,21 * * *'
export const CRON_TZ = 'Europe/Lisbon'

export const COORD_DELAY_MS = parseInt(process.env.COORD_DELAY_MS || '1000', 10)
export const SERVICE_DELAY_MS = parseInt(process.env.SERVICE_DELAY_MS || '300', 10)
export const WRITE_BATCH_SIZE = 200

export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100
