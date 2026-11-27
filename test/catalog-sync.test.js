import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Pharmacy } from '../src/db/models.js'
import { syncCatalog } from '../src/sync/infarmed.js'
import { fixturePath, readFixture, startTestMongo, textResponse, binaryResponse } from './helpers.js'

describe('Infarmed catalog sync with in-memory Mongo', () => {
    let mongo

    before(async () => {
        mongo = await startTestMongo()
    })

    after(async () => {
        await mongo.stop()
    })

    it('parses the export and upserts pharmacies', async () => {
        const xls = readFileSync(fixturePath('infarmed-catalog.xls'))
        const fetchImpl = async (url, opts = {}) => {
            if (!opts.method || opts.method === 'GET') {
                return textResponse(readFixture('infarmed-list.html'), {
                    setCookie: 'JSESSIONID=test.fo1; path=/'
                })
            }
            if (String(opts.body).includes('searchButton')) {
                return textResponse('<partial-response><changes><update id="j_id1:javax.faces.ViewState:0"><![CDATA[-1:2]]></update></changes></partial-response>', { contentType: 'text/xml' })
            }
            if (String(opts.body).includes('exportResultsButton')) {
                return binaryResponse(xls)
            }
            throw new Error(`unexpected fetch ${url} ${opts.body}`)
        }
        const result = await syncCatalog({ fetchImpl, minCount: 2 })
        assert.equal(result.count, 5)
        assert.equal(result.upserted, 5)
        const one = await Pharmacy.findById('3853').lean()
        assert.equal(one.name, 'SÁ DA BANDEIRA')
        assert.equal(one.municipality_code, '1315')
        assert.equal(one.active, true)
    })
})
