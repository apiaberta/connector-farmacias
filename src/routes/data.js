import { Pharmacy, Shift } from '../db/models.js'
import { allMunicipalities, getByIne } from '../data/geo.js'
import { formatPharmacy, formatShift } from '../format.js'
import { envelope, parsePageLimit } from '../lib/pagination.js'
import { currentShiftWindow } from '../lib/shift.js'
import { QueryError, pharmacyFilter, shiftFilter } from '../query.js'

export async function dataRoutes (app) {
    app.get('/farmacias/servico', {
        schema: {
            description: 'Farmácias de serviço no turno actual (9h–9h, Europe/Lisbon)',
            tags: ['Farmácias'],
            querystring: {
                type: 'object',
                properties: {
                    municipality: { type: 'string', description: 'Código INE de 4 dígitos (DDCC)' },
                    district: { type: 'string', description: 'Distrito (nome ou código)' },
                    page: { type: 'integer', default: 1, minimum: 1 },
                    limit: { type: 'integer', default: 20, maximum: 100 }
                }
            }
        }
    }, async (req, reply) => {
        try {
            const { page, limit, skip } = parsePageLimit(req.query)
            const { shift_day } = currentShiftWindow()
            const filter = shiftFilter(req.query, shift_day)
            const [rows, total] = await Promise.all([
                Shift.find(filter).sort({ municipality_code: 1, name: 1 }).skip(skip).limit(limit).lean(),
                Shift.countDocuments(filter)
            ])
            return envelope(rows.map(formatShift), { page, limit, total })
        } catch (err) {
            if (err instanceof QueryError) {
                return reply.code(err.statusCode).send({ error: err.message })
            }
            throw err
        }
    })

    app.get('/farmacias/servico/:municipality', {
        schema: {
            description: 'Farmácias de serviço no concelho (código INE)',
            tags: ['Farmácias']
        }
    }, async (req, reply) => {
        const code = String(req.params.municipality).padStart(4, '0')
        if (!getByIne(code)) {
            return reply.code(404).send({ error: 'Unknown municipality' })
        }
        const { shift_day } = currentShiftWindow()
        const rows = await Shift.find({
            shift_day,
            municipality_code: code
        }).sort({ name: 1 }).lean()
        return {
            data: rows.map(formatShift),
            meta: {
                municipality: code,
                total: rows.length,
                shift_day
            }
        }
    })

    app.get('/farmacias/municipios', {
        schema: {
            description: 'Concelhos com contagem de farmácias e de farmácias de serviço',
            tags: ['Farmácias']
        }
    }, async () => {
        const { shift_day } = currentShiftWindow()
        const [catalogCounts, serviceCounts] = await Promise.all([
            Pharmacy.aggregate([
                { $match: { active: { $ne: false }, municipality_code: { $ne: null } } },
                { $group: { _id: '$municipality_code', pharmacies: { $sum: 1 } } }
            ]),
            Shift.aggregate([
                { $match: { shift_day } },
                { $group: { _id: '$municipality_code', on_duty: { $sum: 1 } } }
            ])
        ])
        const catalogMap = new Map(catalogCounts.map(r => [r._id, r.pharmacies]))
        const serviceMap = new Map(serviceCounts.map(r => [r._id, r.on_duty]))
        const data = allMunicipalities().map(m => ({
            municipality_code: m.ine,
            name: m.name,
            district: m.district,
            district_code: m.district_code,
            pharmacies: catalogMap.get(m.ine) || 0,
            on_duty: serviceMap.get(m.ine) || 0
        }))
        return {
            data,
            meta: { total: data.length, shift_day }
        }
    })

    app.get('/farmacias', {
        schema: {
            description: 'Catálogo de farmácias (Infarmed)',
            tags: ['Farmácias'],
            querystring: {
                type: 'object',
                properties: {
                    municipality: { type: 'string' },
                    district: { type: 'string' },
                    q: { type: 'string' },
                    page: { type: 'integer', default: 1, minimum: 1 },
                    limit: { type: 'integer', default: 20, maximum: 100 }
                }
            }
        }
    }, async (req, reply) => {
        try {
            const { page, limit, skip } = parsePageLimit(req.query)
            const filter = pharmacyFilter(req.query)
            const [rows, total] = await Promise.all([
                Pharmacy.find(filter).sort({ name: 1, license_number: 1 }).skip(skip).limit(limit).lean(),
                Pharmacy.countDocuments(filter)
            ])
            return envelope(rows.map(p => formatPharmacy(p)), { page, limit, total })
        } catch (err) {
            if (err instanceof QueryError) {
                return reply.code(err.statusCode).send({ error: err.message })
            }
            throw err
        }
    })

    app.get('/farmacias/:id', {
        schema: {
            description: 'Detalhe de uma farmácia (nº de alvará Infarmed)',
            tags: ['Farmácias']
        }
    }, async (req, reply) => {
        const pharmacy = await Pharmacy.findOne({
            $or: [{ _id: req.params.id }, { license_number: req.params.id }]
        }).lean()
        if (!pharmacy) return reply.code(404).send({ error: 'Pharmacy not found' })
        return { data: formatPharmacy(pharmacy, { detailed: true }) }
    })
}
