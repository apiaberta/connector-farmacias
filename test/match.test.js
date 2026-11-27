import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchCatalogPharmacy } from '../src/lib/match.js'
import { attachCatalogMatch, mapServicePharmacy } from '../src/sync/service1400.js'
import { getByIne } from '../src/data/geo.js'
import { readFixtureJson } from './helpers.js'

describe('catalog matching', () => {
    const catalog = readFixtureJson('infarmed-fundao.json').map(row => ({
        _id: String(row['Nº do Alvará']),
        license_number: String(row['Nº do Alvará']),
        name: row['Farmácia'],
        street: row.Arruamento,
        locality: row.Localidade,
        parish: row.Freguesia,
        municipality: row.Concelho
    }))
    const muni = getByIne('0504')
    const payload = readFixtureJson('1400-pharmacies-63.json')

    it('links Fundão on-duty pharmacies to Infarmed alvarás', () => {
        const mapped = payload.Pharmacies.map(raw =>
            attachCatalogMatch(
                mapServicePharmacy(raw, muni, payload.CurrentDate, payload.NextDate),
                catalog
            )
        )
        const sena = mapped.find(p => /sena padez/i.test(p.name))
        assert.equal(sena.pharmacy_id, '4911')
        const alpe = mapped.find(p => /alpedrinha/i.test(p.name))
        assert.equal(alpe.pharmacy_id, '2130')
        const silvares = mapped.find(p => /silvares/i.test(p.name))
        assert.equal(silvares.pharmacy_id, '375')
        const vale = mapped.find(p => /vale de prazeres/i.test(p.name))
        assert.equal(vale.pharmacy_id, '4796')
    })

    it('returns null pharmacy_id when nothing matches', () => {
        const hit = matchCatalogPharmacy(
            { name: 'Farmácia Inexistente XYZ', street: 'Rua Nova 1', town: 'Fundão' },
            catalog
        )
        assert.equal(hit, null)
    })
})
