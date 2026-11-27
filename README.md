# API Aberta — Conector de Farmácias

Microserviço do catálogo nacional de farmácias (Infarmed) e das farmácias de serviço do dia (Linha 1400 / ANF).

Não usa farmaciasdeservico.net nem o `locator.json` das Farmácias Portuguesas.

## Funcionalidades

- Catálogo de farmácias licenciadas (nome, alvará, morada, concelho INE, coordenadas quando existirem)
- Farmácias de serviço no turno actual (9h–9h, hora de Lisboa), com histórico por dia de turno
- Ligação dos turnos ao catálogo Infarmed (alvará e coordenadas quando há correspondência no mesmo concelho)
- Recolhas internas com `node-cron` (sem cron do sistema)

## Endpoints

O gateway expõe estes caminhos como `/v1/farmacias/...`.

- `GET /health` — estado do serviço (o gateway usa este caminho)
- `GET /status` / `GET /farmacias/status` — estado + datas da última recolha e atribuição das fontes
- `GET /meta` / `GET /farmacias/meta` — metadados, fontes, estatísticas
- `GET /farmacias` — catálogo (`municipality` INE, `district`, `q`, `page`, `limit`)
- `GET /farmacias/:id` — detalhe (nº de alvará Infarmed)
- `GET /farmacias/servico` — farmácias de serviço agora (`municipality`, `district`, `page`, `limit`)
- `GET /farmacias/servico/:municipality` — atalho por concelho INE
- `GET /farmacias/municipios` — 308 concelhos com contagem de farmácias e de serviço

As listas devolvem `{ data, meta }` (`page`, `limit`, `total`, `pages`). Os nomes dos campos são `snake_case` em inglês.

O turno inclui `shift` (texto da Linha 1400), `shift_start` e `shift_end` em ISO com fuso de `Europe/Lisbon`. Se não houver correspondência no catálogo, `pharmacy_id` é `null` e os dados da Linha 1400 são mesmo assim devolvidos.

## Recolha

| Fonte | Quando | Notas |
|---|---|---|
| Infarmed (XLS da pesquisa pública) | Segunda 04:00 `Europe/Lisbon`, e no arranque se a colecção estiver vazia | ~2802 farmácias; o ficheiro é Excel OLE verdadeiro (também se aceita HTML disfarçado de `.xls`) |
| Coordenadas Infarmed (pedido de detalhe) | Incremental a seguir ao catálogo | 1 pedido/s, só farmácias ainda sem lat/lon |
| Linha 1400 / ANF | 09:05 e 21:05 `Europe/Lisbon`, e no arranque | 308 concelhos, 300 ms entre pedidos, falha isolada por concelho |

O mapeamento concelho 1400safe → código INE de 4 dígitos (DDCC) está **estático** em `src/data/municipalities.js` (308/308). Não depende da rede em tempo de execução.

## Configuração

```bash
npm install
cp .env.example .env
npm start
```

| Variável | Predefinição |
|---|---|
| `PORT` | `3007` |
| `NODE_ENV` | `production` no PM2 |
| `MONGO_URI` | `mongodb://localhost:27017/apiaberta-farmacias` |
| `MONGODB_URI` | alias de `MONGO_URI` |
| `SERVICE_DELAY_MS` | `300` |
| `COORD_DELAY_MS` | `1000` |

Fora de `NODE_ENV=production` o conector recusa MongoDB remoto (incluindo Atlas). Os testes usam Mongo em memória.

```bash
npm test
```

## Arranque (PM2)

```bash
pm2 start ecosystem.config.cjs
```

Nome do processo: `apiaberta-farmacias`. Porta **3007**.

## Gateway (`/v1/farmacias`)

Não altere o gateway neste repositório. No `apiaberta/gateway` é preciso:

1. `src/config.js` — acrescentar o serviço `{ name: 'Farmácias (Infarmed / Linha 1400)', prefix: '/farmacias', target: process.env.FARMACIAS_SERVICE_URL \|\| 'http://localhost:3007' }`
2. `.env.example` — `FARMACIAS_SERVICE_URL=http://localhost:3007`
3. `src/plugins/cache.js` — TTL sugerido `/farmacias`: `300` (o serviço muda às 9h e às 21h)

O proxy já tira o prefixo `/v1` e reencaminha `/farmacias/...` para este conector. O collector de estado chama `GET http://localhost:3007/health`.

## Fontes e atribuição

- **Infarmed, I.P.** — [Listagem pública de farmácias](https://extranet.infarmed.pt/LicenciamentoMais-fo/pages/public/listaFarmacias.xhtml)
- **Linha 1400 / ANF** — [1400safe](https://www.1400safe.pt/)

A informação das fontes está em constante actualização. Um turno não é garantia de abertura sem contacto com a Linha 1400 quando o texto do turno o exigir.

## Licença

MIT
