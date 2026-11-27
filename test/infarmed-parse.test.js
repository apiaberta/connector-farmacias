import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
    extractViewState,
    looksLikeHtml,
    parseCatalogBuffer,
    parseDetailHtml
} from '../src/sync/infarmedParse.js'
import { fixturePath, readFixture } from './helpers.js'

describe('Infarmed catalog parser', () => {
    it('parses HTML disguised as XLS and maps Fundão to 0504', () => {
        const buf = readFileSync(fixturePath('infarmed-catalog.html.xls'))
        assert.equal(looksLikeHtml(buf), true)
        const rows = parseCatalogBuffer(buf)
        assert.equal(rows.length, 2)
        const sena = rows.find(r => r.license_number === '4911')
        assert.equal(sena.name, 'SENA PADEZ')
        assert.equal(sena.municipality_code, '0504')
        assert.equal(sena.district_code, '05')
        assert.equal(sena.municipality, 'Fundão')
    })

    it('parses a real XLSX catalog export', () => {
        const buf = readFileSync(fixturePath('infarmed-catalog.xlsx'))
        assert.equal(looksLikeHtml(buf), false)
        const rows = parseCatalogBuffer(buf)
        assert.ok(rows.length >= 3)
        assert.ok(rows.every(r => r.license_number && r.name))
        const first = rows[0]
        assert.equal(first._id, first.license_number)
    })

    it('parses a real OLE .xls catalog export', () => {
        const buf = readFileSync(fixturePath('infarmed-catalog.xls'))
        assert.equal(looksLikeHtml(buf), false)
        const rows = parseCatalogBuffer(buf)
        assert.equal(rows.length, 5)
        assert.equal(rows[0].name, 'SÁ DA BANDEIRA')
        assert.equal(rows[0].municipality, 'Valongo')
        assert.match(rows[0].municipality_code, /^\d{4}$/)
    })

    it('extracts ViewState and lat/lon from the detail dialog', () => {
        assert.equal(extractViewState(readFixture('infarmed-list.html')), '-123:456')
        const detail = parseDetailHtml(readFixture('infarmed-detail.xml'))
        assert.equal(detail.latitude, 41.212917)
        assert.equal(detail.longitude, -8.54886)
        assert.equal(detail.home_delivery, true)
        assert.equal(detail.internet_sales, true)
        assert.match(detail.website, /appdafarmacia/)
    })
})
