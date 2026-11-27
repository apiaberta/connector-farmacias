import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { assertSafeMongoTarget, isLocalMongoUri } from '../src/db/mongoUri.js'
import { resolveMongoUri } from '../src/config.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('Mongo target guard', () => {
    it('allows localhost and memory-server URIs', () => {
        assert.equal(isLocalMongoUri('mongodb://localhost:27017/apiaberta-farmacias'), true)
        assert.equal(isLocalMongoUri('mongodb://127.0.0.1:27017/test'), true)
        assert.equal(
            assertSafeMongoTarget('mongodb://localhost:27017/apiaberta-farmacias', 'test'),
            'mongodb://localhost:27017/apiaberta-farmacias'
        )
    })

    it('refuses Atlas and other remote hosts outside production', () => {
        assert.throws(
            () => assertSafeMongoTarget('mongodb+srv://user:pass@cluster0.mongodb.net/apiaberta', 'development'),
            /non-local/
        )
        assert.throws(
            () => assertSafeMongoTarget('mongodb://prod.example.com:27017/db', 'test'),
            /non-local/
        )
        assert.doesNotThrow(() =>
            assertSafeMongoTarget('mongodb+srv://cluster0.mongodb.net/db', 'production')
        )
    })

    it('accepts MONGO_URI and MONGODB_URI', () => {
        assert.equal(
            resolveMongoUri({ MONGO_URI: 'mongodb://localhost:27017/a' }),
            'mongodb://localhost:27017/a'
        )
        assert.equal(
            resolveMongoUri({ MONGODB_URI: 'mongodb://localhost:27017/b' }),
            'mongodb://localhost:27017/b'
        )
    })
})

describe('forbidden sources', () => {
    it('never calls farmaciasdeservico.net as a source URL', () => {
        const root = join(dirname(fileURLToPath(import.meta.url)), '..')
        const files = [
            'src/http.js',
            'src/sync/infarmed.js',
            'src/sync/service1400.js',
            'src/config.js'
        ]
        for (const file of files) {
            const text = readFileSync(join(root, file), 'utf8')
            assert.doesNotMatch(text, /https?:\/\/([a-z0-9.-]+\.)?farmaciasdeservico\.net/i)
        }
    })
})
