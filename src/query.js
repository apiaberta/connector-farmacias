import { accentInsensitiveRegex } from './lib/normalize.js'
import { findDistrict, getByIne } from './data/geo.js'

export class QueryError extends Error {
    constructor (message, statusCode = 400) {
        super(message)
        this.statusCode = statusCode
    }
}

export function pharmacyFilter (query = {}) {
    const filter = { active: { $ne: false } }
    if (query.municipality) {
        const code = String(query.municipality).padStart(4, '0')
        if (!/^\d{4}$/.test(code) || !getByIne(code)) {
            throw new QueryError('Unknown municipality INE code')
        }
        filter.municipality_code = code
    }
    if (query.district) {
        const dist = findDistrict(query.district)
        if (!dist) throw new QueryError('Unknown district')
        filter.district_code = dist.ine_prefix
    }
    if (query.q) {
        filter.name = accentInsensitiveRegex(query.q)
    }
    return filter
}

export function shiftFilter (query = {}, shiftDay) {
    const filter = { shift_day: shiftDay }
    if (query.municipality) {
        const code = String(query.municipality).padStart(4, '0')
        if (!/^\d{4}$/.test(code) || !getByIne(code)) {
            throw new QueryError('Unknown municipality INE code')
        }
        filter.municipality_code = code
    }
    if (query.district) {
        const dist = findDistrict(query.district)
        if (!dist) throw new QueryError('Unknown district')
        filter.district_code = dist.ine_prefix
    }
    return filter
}
