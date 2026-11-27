import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { accentInsensitiveRegex, normalizeName, normalizeStreet } from '../src/lib/normalize.js'
import { currentShiftWindow, lisbonAtHour, parseDotNetDate } from '../src/lib/shift.js'

describe('normalize', () => {
    it('strips Farmácia prefix and accents', () => {
        assert.equal(normalizeName('Farmácia Sena Padez'), 'sena padez')
        assert.equal(normalizeName('SENA PADEZ'), 'sena padez')
        assert.equal(normalizeStreet('Av. Eugénio de Andrade Lote 65'), normalizeStreet('AV EUGENIO DE ANDRADE, LOTE 65'))
    })

    it('matches names without accents', () => {
        const re = accentInsensitiveRegex('Fundao')
        assert.match('Fundão', re)
        assert.match('FUNDAO', re)
    })
})

describe('shift window', () => {
    it('emits ISO instants with Europe/Lisbon offset for 9h', () => {
        const winter = lisbonAtHour('27-11-2026', 9)
        assert.equal(winter, '2026-11-27T09:00:00+00:00')
        const summer = lisbonAtHour('2026-07-15', 9)
        assert.equal(summer, '2026-07-15T09:00:00+01:00')
        assert.equal(new Date(winter).toISOString(), '2026-11-27T09:00:00.000Z')
        assert.equal(new Date(summer).toISOString(), '2026-07-15T08:00:00.000Z')
    })

    it('parses .NET dates from 1400safe', () => {
        const d = parseDotNetDate('/Date(1795737600000)/')
        assert.equal(d.toISOString(), '2026-11-27T00:00:00.000Z')
    })

    it('uses the 9h–9h Lisbon window', () => {
        const before = currentShiftWindow(new Date('2026-11-27T08:30:00+00:00'))
        assert.equal(before.shift_day, '2026-11-26')
        assert.equal(before.shift_start, '2026-11-26T09:00:00+00:00')
        assert.equal(before.shift_end, '2026-11-27T09:00:00+00:00')
        const after = currentShiftWindow(new Date('2026-11-27T09:00:00+00:00'))
        assert.equal(after.shift_day, '2026-11-27')
        assert.equal(after.shift_end, '2026-11-28T09:00:00+00:00')
    })
})
