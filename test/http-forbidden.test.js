import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { assertAllowedUrl, fetchJson } from '../src/http.js'

describe('HTTP allow-list', () => {
    it('blocks farmaciasdeservico.net', async () => {
        assert.throws(
            () => assertAllowedUrl('https://farmaciasdeservico.net/foo'),
            /Forbidden data source/
        )
        assert.throws(
            () => assertAllowedUrl('https://www.farmaciasdeservico.net/'),
            /Forbidden data source/
        )
        await assert.rejects(
            () => fetchJson('https://farmaciasdeservico.net/api'),
            /Forbidden data source/
        )
    })

    it('allows Infarmed and 1400safe', () => {
        assert.doesNotThrow(() =>
            assertAllowedUrl('https://extranet.infarmed.pt/LicenciamentoMais-fo/pages/public/listaFarmacias.xhtml')
        )
        assert.doesNotThrow(() =>
            assertAllowedUrl('https://www.1400safe.pt/FourteenHundred/LoadPharmacies')
        )
    })
})
