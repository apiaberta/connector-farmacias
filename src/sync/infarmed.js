import { COORD_DELAY_MS, INFARMED_LIST_URL, WRITE_BATCH_SIZE } from '../config.js'
import { Pharmacy, SyncState, SYNC_ID } from '../db/models.js'
import { fetchBuffer, fetchText } from '../http.js'
import {
    extractCookie,
    extractViewState,
    parseCatalogBuffer,
    parseDetailHtml
} from './infarmedParse.js'

function formBody (fields) {
    return new URLSearchParams(fields).toString()
}

function cookieHeader (session) {
    return `JSESSIONID=${session.cookie}`
}

export function catalogFormFields (viewState, extra = {}) {
    return {
        listPharmacyForm: 'listPharmacyForm',
        'listPharmacyForm:entityName': '',
        'listPharmacyForm:property': '',
        'listPharmacyForm:nif': '',
        'listPharmacyForm:charterNumber': extra.charterNumber || '',
        'listPharmacyForm:country_focus': '',
        'listPharmacyForm:country_input': '',
        'listPharmacyForm:locality': '',
        'listPharmacyForm:district_focus': '',
        'listPharmacyForm:district_input': '',
        'listPharmacyForm:county_focus': '',
        'listPharmacyForm:county_input': '',
        'listPharmacyForm:parish_focus': '',
        'listPharmacyForm:parish_input': '',
        'listPharmacyForm:resultsTable_scrollState': '0,0',
        'javax.faces.ViewState': viewState,
        ...extra.fields
    }
}

export async function openInfarmedSession ({ fetchImpl } = {}) {
    const { res, text } = await fetchText(INFARMED_LIST_URL, { fetchImpl, timeoutMs: 45_000 })
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching Infarmed list`)
    const cookie = extractCookie(res.headers.get('set-cookie'))
    const viewState = extractViewState(text)
    if (!cookie || !viewState) throw new Error('Infarmed session is missing JSESSIONID or ViewState')
    return { cookie, viewState, url: INFARMED_LIST_URL }
}

export async function searchCatalog (session, { fetchImpl, charterNumber = '' } = {}) {
    const fields = catalogFormFields(session.viewState, {
        charterNumber,
        fields: {
            'javax.faces.partial.ajax': 'true',
            'javax.faces.source': 'listPharmacyForm:searchButton',
            'javax.faces.partial.execute': '@all',
            'javax.faces.partial.render': 'listPharmacyForm:resultsTable listPharmacyForm:exportResultsButton',
            'listPharmacyForm:searchButton': 'listPharmacyForm:searchButton'
        }
    })
    const { res, text } = await fetchText(session.url, {
        method: 'POST',
        fetchImpl,
        timeoutMs: 60_000,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Faces-Request': 'partial/ajax',
            'X-Requested-With': 'XMLHttpRequest',
            Cookie: cookieHeader(session)
        },
        body: formBody(fields)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} searching Infarmed catalog`)
    const viewState = extractViewState(text) || session.viewState
    session.viewState = viewState
    return { xml: text, viewState }
}

export async function exportCatalogXls (session, { fetchImpl } = {}) {
    const fields = catalogFormFields(session.viewState, {
        fields: {
            'listPharmacyForm:exportResultsButton': 'listPharmacyForm:exportResultsButton'
        }
    })
    const { res, buffer } = await fetchBuffer(session.url, {
        method: 'POST',
        fetchImpl,
        timeoutMs: 120_000,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Cookie: cookieHeader(session)
        },
        body: formBody(fields)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} exporting Infarmed catalog`)
    return buffer
}

export async function fetchPharmacyDetail (session, rowIndex, { fetchImpl } = {}) {
    const source = `listPharmacyForm:resultsTable:${rowIndex}:consultResult`
    const fields = catalogFormFields(session.viewState, {
        fields: {
            'javax.faces.partial.ajax': 'true',
            'javax.faces.source': source,
            'javax.faces.partial.execute': source,
            'javax.faces.partial.render': 'pharmacyDetailsForm',
            [source]: source
        }
    })
    const { res, text } = await fetchText(session.url, {
        method: 'POST',
        fetchImpl,
        timeoutMs: 30_000,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Faces-Request': 'partial/ajax',
            'X-Requested-With': 'XMLHttpRequest',
            Cookie: cookieHeader(session)
        },
        body: formBody(fields)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching Infarmed pharmacy detail`)
    session.viewState = extractViewState(text) || session.viewState
    return parseDetailHtml(text)
}

export async function downloadCatalog ({ fetchImpl, minCount = 100 } = {}) {
    const session = await openInfarmedSession({ fetchImpl })
    await searchCatalog(session, { fetchImpl })
    const buffer = await exportCatalogXls(session, { fetchImpl })
    const pharmacies = parseCatalogBuffer(buffer)
    if (pharmacies.length < minCount) {
        throw new Error(`Infarmed catalog too small (${pharmacies.length})`)
    }
    return { session, pharmacies, buffer }
}

async function bulkUpsert (docs) {
    let upserted = 0
    for (let i = 0; i < docs.length; i += WRITE_BATCH_SIZE) {
        const slice = docs.slice(i, i + WRITE_BATCH_SIZE)
        const ops = slice.map(doc => ({
            updateOne: {
                filter: { _id: doc._id },
                update: {
                    $set: {
                        ...doc,
                        synced_at: new Date()
                    },
                    $setOnInsert: {
                        latitude: doc.latitude ?? null,
                        longitude: doc.longitude ?? null
                    }
                },
                upsert: true
            }
        }))
        // $set would overwrite coords with null. Keep coords out of $set unless present.
        for (const op of ops) {
            delete op.updateOne.update.$set.latitude
            delete op.updateOne.update.$set.longitude
            delete op.updateOne.update.$set.home_delivery
            delete op.updateOne.update.$set.internet_sales
            delete op.updateOne.update.$set.website
            delete op.updateOne.update.$set.technical_director
        }
        await Pharmacy.bulkWrite(ops, { ordered: false })
        upserted += slice.length
    }
    return upserted
}

export async function touchSync (patch) {
    await SyncState.updateOne(
        { _id: SYNC_ID },
        { $set: { ...patch, updated_at: new Date() } },
        { upsert: true }
    )
}

export async function syncCatalog ({ fetchImpl, now = new Date(), minCount = 100 } = {}) {
    await touchSync({ catalog_last_attempt: now })
    try {
        const { session, pharmacies } = await downloadCatalog({ fetchImpl, minCount })
        const upserted = await bulkUpsert(pharmacies)
        const ids = pharmacies.map(p => p._id)
        await Pharmacy.updateMany(
            { _id: { $nin: ids } },
            { $set: { active: false, synced_at: now } }
        )
        const missingCoords = await Pharmacy.countDocuments({
            active: true,
            $or: [{ latitude: null }, { longitude: null }]
        })
        await touchSync({
            catalog_last_success: now,
            catalog_last_error: null,
            catalog_count: pharmacies.length,
            coords_pending: missingCoords
        })
        return { upserted, count: pharmacies.length, missingCoords, session }
    } catch (err) {
        await touchSync({ catalog_last_error: err.message })
        throw err
    }
}

function sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export async function backfillCoordinates ({
    fetchImpl,
    delayMs = COORD_DELAY_MS,
    limit = Infinity,
    sleepFn = sleep
} = {}) {
    const missing = await Pharmacy.find({
        active: true,
        $or: [{ latitude: null }, { longitude: null }]
    }).select({ _id: 1, license_number: 1 }).lean()

    if (!missing.length) {
        await touchSync({ coords_pending: 0 })
        return { filled: 0, failed: 0, remaining: 0 }
    }

    let filled = 0
    let failed = 0
    let session = await openInfarmedSession({ fetchImpl })

    for (const [i, pharmacy] of missing.entries()) {
        if (i >= limit) break
        try {
            await searchCatalog(session, { fetchImpl, charterNumber: pharmacy.license_number })
            const detail = await fetchPharmacyDetail(session, 0, { fetchImpl })
            const lat = Number.isFinite(detail.latitude) ? detail.latitude : null
            const lon = Number.isFinite(detail.longitude) ? detail.longitude : null
            if (lat == null || lon == null) {
                failed += 1
            } else {
                await Pharmacy.updateOne(
                    { _id: pharmacy._id },
                    {
                        $set: {
                            latitude: lat,
                            longitude: lon,
                            home_delivery: detail.home_delivery,
                            internet_sales: detail.internet_sales,
                            website: detail.website,
                            technical_director: detail.technical_director
                        }
                    }
                )
                filled += 1
            }
        } catch {
            failed += 1
            try {
                session = await openInfarmedSession({ fetchImpl })
            } catch {
                // keep going; next iteration will try again
            }
        }
        if (i + 1 < missing.length && i + 1 < limit) {
            await sleepFn(delayMs)
        }
    }

    const remaining = await Pharmacy.countDocuments({
        active: true,
        $or: [{ latitude: null }, { longitude: null }]
    })
    const coordsFilled = await Pharmacy.countDocuments({
        active: true,
        latitude: { $ne: null },
        longitude: { $ne: null }
    })
    await touchSync({ coords_pending: remaining, coords_filled: coordsFilled })
    return { filled, failed, remaining }
}
