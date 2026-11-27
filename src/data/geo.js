import { MUNICIPALITIES } from './municipalities.js'
import { normalizeText } from '../lib/normalize.js'

export const DISTRICTS_1400 = Object.freeze([
    Object.freeze({ id: 1, name: 'Aveiro', ine_prefix: '01' }),
    Object.freeze({ id: 2, name: 'Beja', ine_prefix: '02' }),
    Object.freeze({ id: 3, name: 'Braga', ine_prefix: '03' }),
    Object.freeze({ id: 4, name: 'Bragança', ine_prefix: '04' }),
    Object.freeze({ id: 5, name: 'Castelo Branco', ine_prefix: '05' }),
    Object.freeze({ id: 6, name: 'Coimbra', ine_prefix: '06' }),
    Object.freeze({ id: 7, name: 'Évora', ine_prefix: '07' }),
    Object.freeze({ id: 8, name: 'Faro', ine_prefix: '08' }),
    Object.freeze({ id: 9, name: 'Guarda', ine_prefix: '09' }),
    Object.freeze({ id: 10, name: 'Leiria', ine_prefix: '10' }),
    Object.freeze({ id: 11, name: 'Lisboa', ine_prefix: '11' }),
    Object.freeze({ id: 12, name: 'Portalegre', ine_prefix: '12' }),
    Object.freeze({ id: 13, name: 'Porto', ine_prefix: '13' }),
    Object.freeze({ id: 14, name: 'Santarém', ine_prefix: '14' }),
    Object.freeze({ id: 15, name: 'Setúbal', ine_prefix: '15' }),
    Object.freeze({ id: 16, name: 'Viana do Castelo', ine_prefix: '16' }),
    Object.freeze({ id: 17, name: 'Vila Real', ine_prefix: '17' }),
    Object.freeze({ id: 18, name: 'Viseu', ine_prefix: '18' }),
    Object.freeze({ id: 19, name: 'Madeira', ine_prefix: '31' }),
    Object.freeze({ id: 20, name: 'Porto Santo', ine_prefix: '32' }),
    Object.freeze({ id: 21, name: 'Santa Maria', ine_prefix: '41' }),
    Object.freeze({ id: 22, name: 'São Miguel', ine_prefix: '42' }),
    Object.freeze({ id: 23, name: 'Terceira', ine_prefix: '43' }),
    Object.freeze({ id: 24, name: 'Graciosa', ine_prefix: '44' }),
    Object.freeze({ id: 25, name: 'São Jorge', ine_prefix: '45' }),
    Object.freeze({ id: 26, name: 'Pico', ine_prefix: '46' }),
    Object.freeze({ id: 27, name: 'Faial', ine_prefix: '47' }),
    Object.freeze({ id: 28, name: 'Flores', ine_prefix: '48' }),
    Object.freeze({ id: 29, name: 'Corvo', ine_prefix: '49' })
])

const byIne = new Map()
const bySourceId = new Map()
const byDistrictId = new Map()
const byNormDistrictName = new Map()

for (const row of MUNICIPALITIES) {
    byIne.set(row.ine, row)
    bySourceId.set(row.municipality_id, row)
    const list = byDistrictId.get(row.district_id) || []
    list.push(row)
    byDistrictId.set(row.district_id, list)
}

for (const d of DISTRICTS_1400) {
    byNormDistrictName.set(normalizeText(d.name), d)
    const prefixMatches = MUNICIPALITIES.filter(m => m.district_code === d.ine_prefix)
    if (prefixMatches[0]) {
        byNormDistrictName.set(normalizeText(prefixMatches[0].district), d)
    }
}

export function allMunicipalities () {
    return MUNICIPALITIES
}

export function getByIne (code) {
    if (code == null) return null
    const key = String(code).padStart(4, '0')
    return byIne.get(key) || null
}

export function getBySourceId (id) {
    return bySourceId.get(Number(id)) || null
}

export function municipalitiesByDistrictId (id) {
    return byDistrictId.get(Number(id)) || []
}

export function findDistrict (value) {
    if (value == null || value === '') return null
    const raw = String(value).trim()
    if (/^\d{1,2}$/.test(raw)) {
        const id = Number(raw)
        const from1400 = DISTRICTS_1400.find(d => d.id === id)
        if (from1400) return from1400
        const padded = raw.padStart(2, '0')
        return DISTRICTS_1400.find(d => d.ine_prefix === padded) || null
    }
    if (/^\d{2}$/.test(raw) || /^\d{4}$/.test(raw)) {
        const prefix = raw.slice(0, 2)
        return DISTRICTS_1400.find(d => d.ine_prefix === prefix) || null
    }
    return byNormDistrictName.get(normalizeText(raw)) || null
}

export function findMunicipality ({ name, district, ine } = {}) {
    if (ine) return getByIne(ine)
    const nName = normalizeText(name)
    if (!nName) return null
    const dist = district ? findDistrict(district) : null
    const pool = dist
        ? MUNICIPALITIES.filter(m => m.district_code === dist.ine_prefix)
        : MUNICIPALITIES
    const exact = pool.filter(m =>
        normalizeText(m.name) === nName || normalizeText(m.source_name) === nName
    )
    if (exact.length === 1) return exact[0]
    const contains = pool.filter(m => {
        const nn = normalizeText(m.name)
        const sn = normalizeText(m.source_name)
        return nn.includes(nName) || nName.includes(nn) || sn.includes(nName) || nName.includes(sn)
    })
    return contains.length === 1 ? contains[0] : (exact[0] || null)
}

export function assertCompleteMapping () {
    const ines = new Set(MUNICIPALITIES.map(m => m.ine))
    const sourceIds = new Set(MUNICIPALITIES.map(m => m.municipality_id))
    return {
        count: MUNICIPALITIES.length,
        unique_ine: ines.size,
        unique_source_ids: sourceIds.size,
        complete: MUNICIPALITIES.length === 308 && ines.size === 308 && sourceIds.size === 308
    }
}
