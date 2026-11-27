import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fetchPharmacyDetail, openInfarmedSession, searchCatalog } from '../src/sync/infarmed.js'
import { fixturePath, readFixture, textResponse } from './helpers.js'

describe('Infarmed HTTP client (mocked fetch)', () => {
    it('opens a session from JSESSIONID + ViewState', async () => {
        const fetchImpl = async (url) => {
            assert.match(url, /listaFarmacias\.xhtml/)
            assert.doesNotMatch(url, /farmaciasdeservico/)
            return textResponse(readFixture('infarmed-list.html'), {
                setCookie: 'JSESSIONID=abc123.fo1; path=/LicenciamentoMais-fo'
            })
        }
        const session = await openInfarmedSession({ fetchImpl })
        assert.equal(session.cookie, 'abc123.fo1')
        assert.equal(session.viewState, '-123:456')
    })

    it('posts the unfiltered search and updates ViewState', async () => {
        const session = { cookie: 'abc', viewState: '-123:456', url: 'https://extranet.infarmed.pt/LicenciamentoMais-fo/pages/public/listaFarmacias.xhtml' }
        const fetchImpl = async (url, opts) => {
            assert.equal(opts.method, 'POST')
            assert.match(opts.body, /listPharmacyForm%3AsearchButton/)
            assert.match(opts.headers.Cookie, /JSESSIONID=abc/)
            const xml = `<partial-response><changes><update id="j_id1:javax.faces.ViewState:0"><![CDATA[-999:111]]></update></changes></partial-response>`
            return textResponse(xml, { contentType: 'text/xml' })
        }
        const result = await searchCatalog(session, { fetchImpl })
        assert.equal(result.viewState, '-999:111')
        assert.equal(session.viewState, '-999:111')
    })

    it('parses coordinates from a real detail payload', async () => {
        const session = {
            cookie: 'abc',
            viewState: '-1:2',
            url: 'https://extranet.infarmed.pt/LicenciamentoMais-fo/pages/public/listaFarmacias.xhtml'
        }
        const fetchImpl = async () => textResponse(readFixture('infarmed-detail.xml'), { contentType: 'text/xml' })
        const detail = await fetchPharmacyDetail(session, 0, { fetchImpl })
        assert.equal(detail.latitude, 41.212917)
        assert.equal(detail.longitude, -8.54886)
        readFileSync(fixturePath('infarmed-detail.xml'))
    })
})
