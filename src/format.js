export function formatPharmacy (doc, { detailed = false } = {}) {
    if (!doc) return null
    const base = {
        id: doc._id || doc.license_number,
        license_number: doc.license_number,
        name: doc.name,
        operator: doc.operator ?? null,
        nif: doc.nif ?? null,
        street: doc.street ?? null,
        postal_code: doc.postal_code ?? null,
        locality: doc.locality ?? null,
        parish: doc.parish ?? null,
        municipality: doc.municipality ?? null,
        municipality_code: doc.municipality_code ?? null,
        district: doc.district ?? null,
        district_code: doc.district_code ?? null,
        latitude: doc.latitude ?? null,
        longitude: doc.longitude ?? null,
        license_status: doc.license_status ?? null
    }
    if (!detailed) return base
    return {
        ...base,
        home_delivery: doc.home_delivery ?? null,
        internet_sales: doc.internet_sales ?? null,
        website: doc.website ?? null,
        technical_director: doc.technical_director ?? null,
        active: doc.active !== false,
        synced_at: doc.synced_at ? new Date(doc.synced_at).toISOString() : null
    }
}

export function formatShift (doc) {
    return {
        pharmacy_id: doc.pharmacy_id ?? null,
        name: doc.name,
        street: doc.street || null,
        town: doc.town ?? null,
        municipality: doc.municipality ?? null,
        municipality_code: doc.municipality_code ?? null,
        district: doc.district ?? null,
        district_code: doc.district_code ?? null,
        latitude: doc.latitude ?? null,
        longitude: doc.longitude ?? null,
        shift: doc.shift ?? null,
        shift_start: doc.shift_start,
        shift_end: doc.shift_end,
        shift_day: doc.shift_day
    }
}
