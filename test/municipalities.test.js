import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MUNICIPALITIES } from '../src/data/municipalities.js'
import {
    assertCompleteMapping,
    findDistrict,
    findMunicipality,
    getByIne,
    getBySourceId
} from '../src/data/geo.js'

describe('INE municipality mapping', () => {
    it('covers 308/308 unique INE codes and 1400safe ids', () => {
        const summary = assertCompleteMapping()
        assert.equal(summary.count, 308)
        assert.equal(summary.unique_ine, 308)
        assert.equal(summary.unique_source_ids, 308)
        assert.equal(summary.complete, true)
        assert.equal(MUNICIPALITIES.length, 308)
    })

    it('maps Fundão to 0504 and Lisboa to 1106', () => {
        assert.equal(getBySourceId(63).ine, '0504')
        assert.equal(getByIne('0504').name, 'Fundão')
        assert.equal(getBySourceId(153).ine, '1106')
        assert.equal(getByIne('1106').name, 'Lisboa')
        assert.equal(findMunicipality({ name: 'Fundao', district: 'Castelo Branco' }).ine, '0504')
        assert.equal(findMunicipality({ name: 'Lisboa', district: 'Lisboa' }).ine, '1106')
    })

    it('disambiguates Calheta and Lagoa by island/district', () => {
        assert.equal(getBySourceId(279).ine, '3101')
        assert.equal(getBySourceId(300).ine, '4501')
        assert.equal(findMunicipality({ name: 'Lagoa (Algarve)', district: 'Faro' }).ine, '0806')
        assert.equal(getBySourceId(291).ine, '4201')
    })

    it('resolves districts by name, 1400 id and INE prefix', () => {
        assert.equal(findDistrict('Lisboa').ine_prefix, '11')
        assert.equal(findDistrict('11').ine_prefix, '11')
        assert.equal(findDistrict(5).ine_prefix, '05')
        assert.equal(findDistrict('Madeira').ine_prefix, '31')
        assert.equal(findDistrict('Flores').id, 28)
    })
})
