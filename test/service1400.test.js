import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Pharmacy } from '../src/db/models.js'
import { loadMunicipalities, loadPharmacies, syncMunicipalityService, syncService } from '../src/sync/service1400.js'
import { getByIne } from '../src/data/geo.js'
import { jsonResponse, readFixtureJson, startTestMongo } from './helpers.js'

describe('1400safe client (mocked fetch)', () => {
    it('loads Castelo Branco municipalities including Fundão=63', async () => {
        const payload = readFixtureJson('1400-municipalities-5.json')
        const fetchImpl = async (url, opts) => {
            assert.match(url, /LoadMunicipalities/)
            assert.equal(JSON.parse(opts.body).districtId, '5')
            return jsonResponse(payload)
        }
        const rows = await loadMunicipalities(5, { fetchImpl })
        const fundao = rows.find(r => r.Text === 'Fundão')
        assert.equal(fundao.Value, '63')
        assert.ok(rows.length >= 10)
    })

    it('loads on-duty pharmacies for Fundão and Lisboa', async () => {
        const fundao = readFixtureJson('1400-pharmacies-63.json')
        const fetchImpl = async (url, opts) => {
            assert.match(url, /LoadPharmacies/)
            assert.equal(JSON.parse(opts.body).municipalityId, '63')
            return jsonResponse(fundao)
        }
        const data = await loadPharmacies(63, { fetchImpl })
        assert.equal(data.CurrentDate, '27-11-2026')
        assert.equal(data.NextDate, '28-11-2026')
        assert.ok(data.Pharmacies.some(p => /Sena Padez/i.test(p.Name)))
        assert.ok(data.Pharmacies.every(p => p.Shift && p.Street))
    })
})

describe('1400safe sync with in-memory Mongo', () => {
    let mongo

    before(async () => {
        mongo = await startTestMongo()
        await Pharmacy.create({
            _id: '4911',
            license_number: '4911',
            name: 'SENA PADEZ',
            street: 'AV EUGENIO DE ANDRADE, LOTE 65',
            locality: 'FUNDAO',
            municipality: 'Fundão',
            municipality_code: '0504',
            district: 'Castelo Branco',
            district_code: '05',
            latitude: 40.14,
            longitude: -7.50,
            active: true
        })
    })

    after(async () => {
        await mongo.stop()
    })

    it('upserts shifts and links pharmacy_id when the catalog matches', async () => {
        const payload = readFixtureJson('1400-pharmacies-63.json')
        const fetchImpl = async () => jsonResponse(payload)
        const result = await syncMunicipalityService(getByIne('0504'), { fetchImpl })
        assert.equal(result.municipality_code, '0504')
        assert.equal(result.count, payload.Pharmacies.length)
        const { Shift } = await import('../src/db/models.js')
        const sena = await Shift.findOne({ name: /Sena Padez/i }).lean()
        assert.equal(sena.pharmacy_id, '4911')
        assert.equal(sena.latitude, 40.14)
        assert.equal(sena.shift_start, '2026-11-27T09:00:00+00:00')
        assert.equal(sena.shift_end, '2026-11-28T09:00:00+00:00')
    })

    it('tolerates a failed municipality and continues', async () => {
        const munis = [
            getByIne('0504'),
            getByIne('1106')
        ]
        const fetchImpl = async (url, opts) => {
            const body = JSON.parse(opts.body)
            if (body.municipalityId === '153') {
                throw new Error('timeout')
            }
            return jsonResponse(readFixtureJson('1400-pharmacies-63.json'))
        }
        const result = await syncService({
            fetchImpl,
            municipalities: munis,
            delayMs: 0,
            sleepFn: async () => {}
        })
        assert.equal(result.ok, 1)
        assert.equal(result.failed, 1)
        assert.equal(result.errors[0].ine, '1106')
    })
})
