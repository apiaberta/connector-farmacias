import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Pharmacy, Shift, SyncState, SYNC_ID } from '../src/db/models.js'
import { currentShiftWindow } from '../src/lib/shift.js'
import { startTestApp } from './helpers.js'

describe('HTTP routes', () => {
    let app
    let shiftDay

    before(async () => {
        const ctx = await startTestApp()
        app = ctx.app
        thisClose = ctx.close
        shiftDay = currentShiftWindow().shift_day
        const { shift_start, shift_end } = currentShiftWindow()
        await Pharmacy.insertMany([
            {
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
                nif: '501234567',
                active: true
            },
            {
                _id: '5689',
                license_number: '5689',
                name: 'DE BELAS',
                street: 'Rua Paz e Amizade',
                locality: 'Belas',
                municipality: 'Sintra',
                municipality_code: '1111',
                district: 'Lisboa',
                district_code: '11',
                active: true
            }
        ])
        await Shift.create({
            shift_day: shiftDay,
            municipality_code: '0504',
            municipality: 'Fundão',
            district: 'Castelo Branco',
            district_code: '05',
            pharmacy_id: '4911',
            name: 'Farmácia Sena Padez',
            street: 'Av. Eugenio de Andrade Lote 65',
            town: 'Fundão',
            shift: 'Farmácia por chamada pelo 1400 após as 24h',
            shift_start,
            shift_end,
            latitude: 40.14,
            longitude: -7.50
        })
        await SyncState.create({
            _id: SYNC_ID,
            catalog_last_success: new Date('2026-11-27T04:00:00Z'),
            service_last_success: new Date('2026-11-27T09:05:00Z')
        })
    })

    let thisClose
    after(async () => {
        await thisClose()
    })

    it('GET /health and /status', async () => {
        const health = await app.inject({ method: 'GET', url: '/health' })
        assert.equal(health.statusCode, 200)
        assert.equal(health.json().service, 'connector-farmacias')
        assert.equal(health.json().status, 'ok')
        const status = await app.inject({ method: 'GET', url: '/status' })
        assert.equal(status.statusCode, 200)
        assert.equal(status.json().status, 'ok')
        assert.ok(status.json().sources.catalog.name.includes('INFARMED'))
        assert.ok(status.json().sources.service.name.includes('1400'))
    })

    it('GET /farmacias/meta includes last collection dates and attribution', async () => {
        const res = await app.inject({ method: 'GET', url: '/farmacias/meta' })
        assert.equal(res.statusCode, 200)
        const body = res.json()
        assert.equal(body.connector, 'connector-farmacias')
        assert.ok(body.stats.last_catalog_sync)
        assert.ok(body.stats.last_service_sync)
        assert.ok(body.attribution.join(' ').includes('Infarmed'))
        assert.ok(body.attribution.join(' ').includes('1400'))
    })

    it('GET /farmacias lists with { data, meta } and filters', async () => {
        const all = await app.inject({ method: 'GET', url: '/farmacias' })
        assert.equal(all.statusCode, 200)
        assert.ok(Array.isArray(all.json().data))
        assert.equal(all.json().meta.total, 2)
        assert.equal(all.json().meta.page, 1)
        const fundao = await app.inject({ method: 'GET', url: '/farmacias?municipality=0504' })
        assert.equal(fundao.json().data.length, 1)
        assert.equal(fundao.json().data[0].id, '4911')
        const q = await app.inject({ method: 'GET', url: '/farmacias?q=Sena' })
        assert.equal(q.json().data[0].name, 'SENA PADEZ')
        const dist = await app.inject({ method: 'GET', url: '/farmacias?district=Lisboa' })
        assert.equal(dist.json().data[0].municipality_code, '1111')
    })

    it('GET /farmacias/:id returns detail', async () => {
        const res = await app.inject({ method: 'GET', url: '/farmacias/4911' })
        assert.equal(res.statusCode, 200)
        assert.equal(res.json().data.license_number, '4911')
        assert.equal(res.json().data.latitude, 40.14)
        const missing = await app.inject({ method: 'GET', url: '/farmacias/999999' })
        assert.equal(missing.statusCode, 404)
    })

    it('GET /farmacias/servico and /farmacias/servico/:municipality', async () => {
        const list = await app.inject({ method: 'GET', url: '/farmacias/servico?municipality=0504' })
        assert.equal(list.statusCode, 200)
        assert.equal(list.json().data.length, 1)
        assert.equal(list.json().data[0].pharmacy_id, '4911')
        assert.match(list.json().data[0].shift_start, /T09:00:00/)
        assert.ok(list.json().data[0].shift)
        const shortcut = await app.inject({ method: 'GET', url: '/farmacias/servico/0504' })
        assert.equal(shortcut.statusCode, 200)
        assert.equal(shortcut.json().data[0].name, 'Farmácia Sena Padez')
        const unknown = await app.inject({ method: 'GET', url: '/farmacias/servico/0000' })
        assert.equal(unknown.statusCode, 404)
    })

    it('GET /farmacias/municipios includes counts', async () => {
        const res = await app.inject({ method: 'GET', url: '/farmacias/municipios' })
        assert.equal(res.statusCode, 200)
        assert.equal(res.json().meta.total, 308)
        const fundao = res.json().data.find(m => m.municipality_code === '0504')
        assert.equal(fundao.pharmacies, 1)
        assert.equal(fundao.on_duty, 1)
        const lisboa = res.json().data.find(m => m.municipality_code === '1106')
        assert.equal(lisboa.pharmacies, 0)
        assert.equal(lisboa.on_duty, 0)
    })
})
