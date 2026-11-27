import {
    SAFE1400_MUNICIPALITIES_URL,
    SAFE1400_PHARMACIES_URL,
    SERVICE_DELAY_MS,
    WRITE_BATCH_SIZE
} from '../config.js'
import { MUNICIPALITIES } from '../data/municipalities.js'
import { getByIne, getBySourceId } from '../data/geo.js'
import { Pharmacy, Shift, SYNC_ID, SyncState } from '../db/models.js'
import { fetchJson } from '../http.js'
import { matchCatalogPharmacy } from '../lib/match.js'
import { lisbonAtHour, parseDotNetDate } from '../lib/shift.js'

function sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function mapServicePharmacy (raw, municipality, currentDate, nextDate) {
    const shift_start = lisbonAtHour(currentDate, 9)
    const shift_end = lisbonAtHour(nextDate, 9)
    return {
        name: raw.Name,
        street: raw.Street || null,
        town: raw.Town || null,
        shift: raw.Shift || null,
        shift_date: parseDotNetDate(raw.ShiftDate),
        shift_start,
        shift_end,
        shift_day: shift_start.slice(0, 10),
        municipality_code: municipality.ine,
        municipality: municipality.name,
        district: municipality.district,
        district_code: municipality.district_code,
        source_municipality_id: municipality.municipality_id
    }
}

export function attachCatalogMatch (row, catalog = []) {
    const matched = matchCatalogPharmacy(row, catalog)
    return {
        ...row,
        pharmacy_id: matched?._id || matched?.license_number || null,
        latitude: matched?.latitude ?? null,
        longitude: matched?.longitude ?? null
    }
}

export async function loadMunicipalities (districtId, { fetchImpl } = {}) {
    const data = await fetchJson(SAFE1400_MUNICIPALITIES_URL, {
        method: 'POST',
        fetchImpl,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ districtId: String(districtId) })
    })
    return (data || []).filter(row => row.Value && row.Value !== '0' && !/selecione/i.test(row.Text || ''))
}

export async function loadPharmacies (municipalityId, { fetchImpl } = {}) {
    return fetchJson(SAFE1400_PHARMACIES_URL, {
        method: 'POST',
        fetchImpl,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ municipalityId: String(municipalityId) })
    })
}

async function catalogInMunicipality (ine) {
    return Pharmacy.find({ municipality_code: ine, active: true }).lean()
}

export async function syncMunicipalityService (municipality, { fetchImpl } = {}) {
    const payload = await loadPharmacies(municipality.municipality_id, { fetchImpl })
    const currentDate = payload.CurrentDate
    const nextDate = payload.NextDate
    if (!currentDate || !nextDate) {
        throw new Error(`1400safe municipality ${municipality.municipality_id} missing dates`)
    }
    const catalog = await catalogInMunicipality(municipality.ine)
    const rows = (payload.Pharmacies || []).map(raw =>
        attachCatalogMatch(
            mapServicePharmacy(raw, municipality, currentDate, nextDate),
            catalog
        )
    )
    const shiftDay = rows[0]?.shift_day || lisbonAtHour(currentDate, 9).slice(0, 10)
    if (rows.length) {
        const ops = rows.map(row => ({
            updateOne: {
                filter: {
                    shift_day: row.shift_day,
                    municipality_code: row.municipality_code,
                    name: row.name,
                    street: row.street || ''
                },
                update: {
                    $set: {
                        ...row,
                        street: row.street || '',
                        synced_at: new Date()
                    }
                },
                upsert: true
            }
        }))
        for (let i = 0; i < ops.length; i += WRITE_BATCH_SIZE) {
            await Shift.bulkWrite(ops.slice(i, i + WRITE_BATCH_SIZE), { ordered: false })
        }
        const keep = rows.map(r => ({ name: r.name, street: r.street || '' }))
        const existing = await Shift.find({
            shift_day: shiftDay,
            municipality_code: municipality.ine
        }).select({ name: 1, street: 1 }).lean()
        const keepKey = new Set(keep.map(k => `${k.name}\0${k.street}`))
        const staleIds = existing
            .filter(doc => !keepKey.has(`${doc.name}\0${doc.street || ''}`))
            .map(doc => doc._id)
        if (staleIds.length) {
            await Shift.deleteMany({ _id: { $in: staleIds } })
        }
    } else {
        await Shift.deleteMany({
            shift_day: shiftDay,
            municipality_code: municipality.ine
        })
    }
    return { municipality_code: municipality.ine, count: rows.length, shift_day: shiftDay }
}

export async function syncService ({
    fetchImpl,
    delayMs = SERVICE_DELAY_MS,
    sleepFn = sleep,
    municipalities = MUNICIPALITIES,
    now = new Date()
} = {}) {
    await SyncState.updateOne(
        { _id: SYNC_ID },
        { $set: { service_last_attempt: now, updated_at: now } },
        { upsert: true }
    )
    let ok = 0
    let failed = 0
    const errors = []
    for (const [i, muni] of municipalities.entries()) {
        const municipality = getBySourceId(muni.municipality_id) || getByIne(muni.ine) || muni
        try {
            await syncMunicipalityService(municipality, { fetchImpl })
            ok += 1
        } catch (err) {
            failed += 1
            errors.push({ ine: municipality.ine, error: err.message })
        }
        if (i + 1 < municipalities.length) await sleepFn(delayMs)
    }
    await SyncState.updateOne(
        { _id: SYNC_ID },
        {
            $set: {
                service_last_success: failed === municipalities.length ? null : now,
                service_last_error: errors[0]?.error || null,
                service_municipalities_ok: ok,
                service_municipalities_failed: failed,
                updated_at: now
            }
        },
        { upsert: true }
    )
    return { ok, failed, errors }
}
