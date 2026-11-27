import * as XLSX from 'xlsx'
import { findMunicipality } from '../data/geo.js'

export const CATALOG_COLUMNS = {
    name: ['Farmácia', 'Farmacia', 'name'],
    operator: ['Propriedade/ Exploração', 'Propriedade/ Exploracao', 'Propriedade', 'operator'],
    nif: ['NIF / NIPC', 'NIF', 'NIPC', 'nif'],
    license_number: ['Nº do Alvará', 'Nº do Alvara', 'Alvará', 'Alvara', 'license_number'],
    street: ['Arruamento', 'Morada', 'street'],
    postal_code: ['Código Postal', 'Codigo Postal', 'postal_code'],
    locality: ['Localidade', 'locality'],
    district: ['Distrito', 'district'],
    municipality: ['Concelho', 'municipality'],
    parish: ['Freguesia', 'parish'],
    license_status: ['Situação do Alvará', 'Situacao do Alvara', 'license_status']
}

function cell (row, keys) {
    for (const key of keys) {
        if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim()
    }
    return null
}

export function looksLikeHtml (buffer) {
    const head = buffer.slice(0, 256).toString('utf8').trim().toLowerCase()
    return head.startsWith('<html') || head.startsWith('<!doctype') || head.startsWith('<table') || head.includes('<html')
}

function rowsFromSheet (sheet) {
    return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
}

export function parseHtmlTable (html) {
    const workbook = XLSX.read(html, { type: 'string' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    return rowsFromSheet(sheet)
}

export function parseCatalogBuffer (buffer) {
    if (!buffer || !buffer.length) throw new Error('Empty Infarmed catalog file')
    let rows
    if (looksLikeHtml(buffer)) {
        rows = parseHtmlTable(buffer.toString('utf8'))
    } else {
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        if (!sheet) throw new Error('Infarmed catalog has no sheet')
        rows = rowsFromSheet(sheet)
    }
    return rows.map(mapCatalogRow).filter(Boolean)
}

export function mapCatalogRow (row) {
    const license_number = cell(row, CATALOG_COLUMNS.license_number)
    const name = cell(row, CATALOG_COLUMNS.name)
    if (!license_number || !name) return null
    const municipalityName = cell(row, CATALOG_COLUMNS.municipality)
    const districtName = cell(row, CATALOG_COLUMNS.district)
    const geo = findMunicipality({ name: municipalityName, district: districtName })
    return {
        _id: String(license_number),
        license_number: String(license_number),
        name,
        operator: cell(row, CATALOG_COLUMNS.operator),
        nif: cell(row, CATALOG_COLUMNS.nif),
        street: cell(row, CATALOG_COLUMNS.street),
        postal_code: cell(row, CATALOG_COLUMNS.postal_code),
        locality: cell(row, CATALOG_COLUMNS.locality),
        parish: cell(row, CATALOG_COLUMNS.parish),
        municipality: geo?.name || municipalityName,
        municipality_code: geo?.ine || null,
        district: geo?.district || districtName,
        district_code: geo?.district_code || null,
        license_status: cell(row, CATALOG_COLUMNS.license_status),
        active: true
    }
}

function yesNo (value) {
    const v = String(value ?? '').trim().toLowerCase()
    if (['sim', 'yes', 'true', '1'].includes(v)) return true
    if (['nao', 'não', 'no', 'false', '0'].includes(v)) return false
    return null
}

export function parseDetailHtml (html) {
    const pick = (id) => {
        const re = new RegExp(`id="${id}"[^>]*value="([^"]*)"`, 'i')
        const m = html.match(re)
        return m ? m[1].trim() : null
    }
    const lat = pick('pharmacyDetailsForm:latitude')
    const lon = pick('pharmacyDetailsForm:longitude')
    const home = pick('pharmacyDetailsForm:homeDeliveryYes')
        ?? pick('pharmacyDetailsForm:homeDeliveryNo')
    const internet = pick('pharmacyDetailsForm:internetSalesYes')
        ?? pick('pharmacyDetailsForm:internetSalesNo')
    return {
        latitude: lat ? Number(lat.replace(',', '.')) : null,
        longitude: lon ? Number(lon.replace(',', '.')) : null,
        home_delivery: yesNo(home),
        internet_sales: yesNo(internet),
        website: pick('pharmacyDetailsForm:webPage') || null,
        technical_director: pick('pharmacyDetailsForm:j_idt90') || null
    }
}

export function extractViewState (html) {
    const cdata = html.match(/<update id="[^"]*javax\.faces\.ViewState[^"]*">\s*<!\[CDATA\[(.*?)\]\]>/)
    if (cdata) return cdata[1]
    const input = html.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/)
        || html.match(/value="([^"]+)"[^>]*name="javax\.faces\.ViewState"/)
    return input ? input[1] : null
}

export function extractCookie (setCookie, name = 'JSESSIONID') {
    if (!setCookie) return null
    const header = Array.isArray(setCookie) ? setCookie.join(',') : String(setCookie)
    const m = header.match(new RegExp(`${name}=([^;]+)`))
    return m ? m[1] : null
}

export function parseTableAlvaras (html) {
    const rows = []
    const re = /data-ri="(\d+)"[\s\S]*?:j_idt73"[^>]*>\s*([^<]+)/g
    let m
    while ((m = re.exec(html))) {
        rows.push({ index: Number(m[1]), license_number: m[2].trim() })
    }
    return rows
}
