import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildApp } from '../src/app.js'
import { ensureIndexes } from '../src/db/indexes.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

export function fixturePath (name) {
    return join(FIXTURES, name)
}

export function readFixture (name, encoding = 'utf8') {
    return readFileSync(fixturePath(name), encoding)
}

export function readFixtureJson (name) {
    return JSON.parse(readFixture(name))
}

export function jsonResponse (data, status = 200) {
    const body = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data))
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (key) => {
                const k = String(key).toLowerCase()
                if (k === 'set-cookie') return null
                if (k === 'content-type') return 'application/json'
                return null
            }
        },
        arrayBuffer: async () => body
    }
}

export function textResponse (text, { status = 200, contentType = 'text/html', setCookie } = {}) {
    const body = Buffer.from(text)
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (key) => {
                const k = String(key).toLowerCase()
                if (k === 'set-cookie') return setCookie || null
                if (k === 'content-type') return contentType
                return null
            }
        },
        arrayBuffer: async () => body
    }
}

export function binaryResponse (buffer, { status = 200, contentType = 'application/vnd.ms-excel' } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (key) => String(key).toLowerCase() === 'content-type' ? contentType : null
        },
        arrayBuffer: async () => buffer
    }
}

export async function startTestMongo () {
    const mongod = await MongoMemoryServer.create()
    const uri = mongod.getUri()
    await mongoose.connect(uri)
    await ensureIndexes()
    return {
        uri,
        async stop () {
            await mongoose.disconnect()
            await mongod.stop()
        }
    }
}

export async function startTestApp () {
    const mongo = await startTestMongo()
    const app = await buildApp({ logger: false })
    return {
        app,
        async close () {
            await app.close()
            await mongo.stop()
        }
    }
}
