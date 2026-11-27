import { normalizeName, normalizeStreet, normalizeText } from './normalize.js'

function scoreStreet (a, b) {
    const na = normalizeStreet(a)
    const nb = normalizeStreet(b)
    if (!na || !nb) return 0
    if (na === nb) return 3
    if (na.includes(nb) || nb.includes(na)) return 2
    const ta = new Set(na.split(' '))
    const tb = nb.split(' ')
    const overlap = tb.filter(t => t.length > 2 && ta.has(t)).length
    return overlap >= 2 ? 1 : 0
}

function scoreLocality (pharmacy, town) {
    const nTown = normalizeText(town)
    if (!nTown) return 0
    const loc = normalizeText(pharmacy.locality)
    const parish = normalizeText(pharmacy.parish)
    return loc === nTown || parish === nTown ? 4 : 0
}

/**
 * Link a 1400safe on-duty row to an Infarmed catalog pharmacy
 * in the same INE municipality.
 */
export function matchCatalogPharmacy (shift, pharmacies = []) {
    if (!pharmacies.length) return null
    const nName = normalizeName(shift.name)
    const named = nName
        ? pharmacies.filter(p => normalizeName(p.name) === nName)
        : []

    const pool = named.length ? named : pharmacies
    const ranked = pool
        .map(p => ({
            p,
            score: (named.length ? 10 : 0) + scoreLocality(p, shift.town) + scoreStreet(p.street, shift.street)
        }))
        .sort((a, b) => b.score - a.score)

    const best = ranked[0]
    if (!best) return null
    if (named.length === 1) return named[0]
    if (named.length > 1) return best.p
    if (best.score >= 5) return best.p
    return null
}
