# 04 — TechDocs com Azure Blob simulado (Azurite)

Evolução da [02-techdocs.md](02-techdocs.md): o publisher muda de disco local para **Azure Blob
Storage**, emulado localmente pelo **Azurite** num container Podman. O builder continua `external`.

## Objetivo

Exercitar o fluxo de produção (`generate` → `publish` em blob → Backstage lê do blob) sem
conta Azure. Para migrar ao Azure real, só a connection string/credenciais mudam.

## Verificações feitas (2026-10-21)

| # | Pergunta | Resultado | Evidência |
|---|----------|-----------|-----------|
| V1 | O Backstage consegue ler do Azurite? | **Sim** | `@backstage/plugin-techdocs-node` 2.1.0: `techdocs.publisher.azureBlobStorage.connectionString` → `BlobServiceClient.fromConnectionString` |
| V2 | O `techdocs-cli publish` consegue publicar no Azurite? | **Não** | `@techdocs/cli` 1.13.0 só aceita `--azureAccountName`/`--azureAccountKey`; `PublisherConfig.getValidAzureConfig` não repassa endpoint e o publisher monta `https://<conta>.blob.core.windows.net` |

### Consequência de V2

O `techdocs-cli` é só uma casca: ele monta a config e chama a classe `Publisher` do
`@backstage/plugin-techdocs-node`. O script de publish vai **chamar essa mesma classe
diretamente**, passando `connectionString`. O upload, o layout dos blobs e o
`techdocs_metadata.json` saem pelo mesmo código que o CLI e o Backstage usam.

Alternativa descartada: `az storage blob upload-batch`. Funciona, mas reimplementa por fora o
layout e os metadados que o Backstage espera, e isso diverge do fluxo real.

## Arquitetura

```
scripts/techdocs-publish.sh --target azurite <repo>
  ├─ git clone
  ├─ techdocs-cli generate --no-docker          (igual à spec 02)
  └─ node scripts/techdocs-azure-publish.cjs    Publisher.fromConfig({ azureBlobStorage.connectionString })
                                                        │ upload
                                                        ▼
                                  Azurite (podman, :10000) — container de blob "techdocs"
                                                        ▲ lê
Backstage  (app-config.yaml + app-config.azurite.yaml)  │
  techdocs.publisher.type: azureBlobStorage ────────────┘
```

## Decisões

| # | Decisão | Escolha | Motivo |
|---|---------|---------|--------|
| A1 | Emulador | Azurite, só o serviço de blob (`azurite-blob`) | Oficial da Microsoft; queue e table não são necessários |
| A2 | Imagem | `mcr.microsoft.com/azure-storage/azurite:3.37.0` | Reprodutível |
| A3 | Persistência | Volume Podman `techdocs-azurite` | Docs sobrevivem a restart do container |
| A4 | Credenciais | Conta de dev padrão `devstoreaccount1` com a chave pública documentada | Não é segredo; ainda assim lida de env var, como seria em produção |
| A5 | Upload | Script Node que usa a classe `Publisher` do `plugin-techdocs-node` do app | V2; mesmo código do CLI e do backend |
| A6 | Troca de modo | Overlay `app/app-config.azurite.yaml`; o `app-config.yaml` continua com `local` | Os dois modos coexistem; dá para comparar |
| A7 | Container de blob | `techdocs` | Nome usado em `--storage-name` / `containerName` |

## Passo 1 — Azurite no Podman

```bash
podman volume create techdocs-azurite
podman run -d --name azurite \
  -p 127.0.0.1:10000:10000 \
  -v techdocs-azurite:/data \
  mcr.microsoft.com/azure-storage/azurite:3.37.0 \
  azurite-blob --blobHost 0.0.0.0 --location /data --skipApiVersionCheck --loose
```

- `--skipApiVersionCheck`: o SDK `@azure/storage-blob` 12.34 pode usar uma API version mais
  nova que a suportada pelo Azurite.
- Bind só em `127.0.0.1`: não expõe para a rede.

Implementado em `scripts/azurite.sh up|down|status|env` (idempotente).

## Passo 2 — Connection string

```bash
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=<chave-padrão-do-azurite>;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;"
```

`scripts/azurite.sh env` imprime o `export` (a chave padrão está na documentação do Azurite).

## Passo 3 — Publish

`scripts/techdocs-azure-publish.cjs <site-dir> <namespace/kind/name>`:

1. Resolve `@backstage/plugin-techdocs-node` a partir de `app/node_modules` (sem instalar nada novo).
2. Monta `ConfigReader` com `techdocs.publisher.type: azureBlobStorage`,
   `containerName: techdocs` e `connectionString` vindo da env.
3. Cria o container se ele não existir (o publisher assume que já existe).
4. Chama `publisher.publish({ entity, directory })`.

`scripts/techdocs-publish.sh` ganha `--target local|azurite` (padrão `local`, comportamento
atual preservado). Com `azurite`, o passo de cópia para disco é trocado pelo script acima.

## Passo 4 — Backstage

`app/app-config.azurite.yaml`:

```yaml
techdocs:
  builder: 'external'
  publisher:
    type: 'azureBlobStorage'
    azureBlobStorage:
      containerName: techdocs
      connectionString: ${AZURE_STORAGE_CONNECTION_STRING}
```

```bash
cd app
eval "$(../scripts/azurite.sh env)"
GITHUB_TOKEN=$(gh auth token) yarn start --config ../../app-config.yaml --config ../../app-config.azurite.yaml
```

> `--config` **substitui** o `app-config.yaml` padrão (por isso os dois arquivos são passados), e os
> caminhos são relativos a cada pacote (`packages/backend`), não à raiz do app. Daí o `../../`.
> Com `--config` explícito, o `app-config.local.yaml` não é carregado automaticamente.

## Critérios de aceite

- [ ] `scripts/azurite.sh up` sobe o Azurite; rodar 2x não dá erro.
- [ ] `techdocs-publish.sh --target azurite --all` publica as 4 docs; os blobs ficam em
      `techdocs/default/component/<name>/...` com `techdocs_metadata.json`.
- [ ] Backstage com o overlay loga `Using 'techdocs.publisher.azureBlobStorage.connectionString'`.
- [ ] As 4 docs respondem 200 em `/api/techdocs/static/docs/default/component/<name>/index.html`.
- [ ] Com o Azurite parado, a doc falha (prova de que não está lendo do disco).
- [ ] Sem o overlay, o Backstage volta a ler de `techdocs-storage/` (modo local intacto).
- [ ] Nenhuma connection string fixa em arquivo versionado.

## Resultado da implementação (2026-10-21)

Todos os critérios de aceite passaram:

| Critério | Resultado |
|----------|-----------|
| `azurite.sh up` idempotente | ok (2ª chamada: "já está rodando") |
| Publish das 4 docs | 56–58 blobs por entidade em `techdocs/default/component/<name>/`, com `techdocs_metadata.json` |
| Log do backend | `Using 'techdocs.publisher.azureBlobStorage.connectionString'` |
| Docs via API | 4 × 200; CSS servido como `text/css` (o backend define o content-type pela extensão) |
| Azurite parado | 4 × 404 + `warn ... connect ECONNREFUSED 127.0.0.1:10000`; volta a 200 ao subir de novo |
| Modo local intacto | sem overlay: `Creating Local publisher`; 4 × 200 com o Azurite parado |
| Busca | indexa conteúdo lido do blob |
| Segredos | nenhuma connection string em arquivo versionado |

Observação: com o Azurite parado, cada requisição leva ~15 s para falhar (retries do SDK
`@azure/storage-blob`). Não importa na PoC; em produção, o storage real tem SLA.

## Riscos

- **API version**: mitigado com `--skipApiVersionCheck`.
- **Criação do container**: o publisher do Backstage não cria o container de blob; o script cria.
- **CI do GitHub**: continua sem alcançar o Azurite; o CI só valida o build (igual à spec 02).

## Migração para Azure real

1. Criar a storage account e o container `techdocs`.
2. No CI: `techdocs-cli publish --publisher-type azureBlobStorage --storage-name techdocs
   --azureAccountName <conta>` usando um service principal (`AZURE_TENANT_ID`/`CLIENT_ID`/`CLIENT_SECRET`)
   ou a account key. No Azure real o CLI funciona; o script do Passo 3 é só para o emulador.
3. Backstage: trocar `connectionString` por `credentials.accountName` (+ managed identity ou key).
