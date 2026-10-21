# 00 — Visão geral: Backstage + TechDocs (PoC local)

## Objetivo

Subir um Backstage local (WSL) para estudo e validar o fluxo de **TechDocs no modelo recomendado**:
a documentação é gerada fora do Backstage (por um "CI") e o Backstage apenas lê e exibe.

## Escopo

**Dentro**
- Instalação do Backstage via `@backstage/create-app` (novo backend system).
- Catálogo alimentado por repositórios **públicos do GitHub do usuário**.
- TechDocs com `builder: external` + `publisher: local` (disco).
- Script local que simula o CI (gera + publica docs no disco).
- Workflow do GitHub Actions nos repos de docs que apenas **valida** que a doc gera.
- Login com **guest**.

**Fora (por enquanto)**
- Deploy (container, K8s, cloud), Postgres, HTTPS.
- Autenticação real (GitHub OAuth), permissões.
- Publisher em cloud (S3/Blob/GCS) — ver "Evolução" abaixo.
- Scaffolder/templates de software, plugins extras.

## Decisões

| # | Decisão | Escolha | Motivo |
|---|---------|---------|--------|
| D1 | Objetivo | PoC/estudo local | Aprender e validar TechDocs |
| D2 | Runtime Node | Node **24 LTS** via nvm (não o 25 instalado) | Backstage só suporta LTS ativos; deps nativas quebram em versões ímpares |
| D3 | Gerenciador de pacotes | Yarn 4 via `corepack enable` | Padrão do `create-app` |
| D4 | Banco | SQLite (`better-sqlite3`) — padrão do create-app | Zero infra na PoC |
| D5 | Auth | Guest provider | PoC sem SSO |
| D6 | Fonte do catálogo | GitHub, repos públicos do usuário | Docs reais |
| D7 | TechDocs builder | `external` | Modelo recomendado: CI gera, Backstage lê |
| D8 | TechDocs publisher | `local` (diretório em disco) | Sem dependência de cloud |
| D9 | "CI" de publicação | Script local `scripts/techdocs-publish.sh` | Runner do GitHub não alcança o disco do WSL; `techdocs-cli publish` não suporta destino local |
| D10 | Geração das docs | `techdocs-cli generate --no-docker` + `mkdocs-techdocs-core` em venv **Python 3.14** | Não há Docker; evita depender do socket do Podman |
| D11 | Repos de exemplo | 4 repos públicos `edtroleis/techdocs-*`: 1 serviço + 3 wikis | Mostrar doc de serviço vs. doc sem associação |
| D12 | Wikis | `kind: Component`, `spec.type: documentation`, tag `wiki`, sem system | TechDocs exige entidade; padrão da comunidade |

## Arquitetura

```
 Repo GitHub (público)                 Máquina local (WSL)
 ┌──────────────────────┐   git clone   ┌────────────────────────────────────┐
 │ catalog-info.yaml    │ ────────────▶ │ scripts/techdocs-publish.sh        │
 │ mkdocs.yml           │               │   techdocs-cli generate --no-docker│
 │ docs/*.md            │               │   copia site/ → techdocs-storage/  │
 │ .github/workflows/   │               └──────────────┬─────────────────────┘
 │   techdocs.yml (CI   │                              │ escreve
 │   valida o build)    │                              ▼
 └─────────┬────────────┘               techdocs-storage/<ns>/<kind>/<name>/
           │ catalog lê                                │ lê
           ▼                                           ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │ Backstage (yarn start)  — catalog + techdocs (builder: external)│
 │ http://localhost:3000                                           │
 └─────────────────────────────────────────────────────────────────┘
```

## Estrutura do repositório (alvo)

```
backstage/
├── specs/                      # estas specs
├── app/                        # app Backstage gerado pelo create-app
├── scripts/
│   └── techdocs-publish.sh     # "CI" local
├── catalog/
│   └── org.yaml                # Group platform-team + System demo-system
├── templates/                  # arquivos para copiar nos repos de docs
│   ├── catalog-info.yaml
│   ├── mkdocs.yml
│   ├── docs/index.md
│   └── .github/workflows/techdocs.yml
├── techdocs-storage/           # saída publicada (gitignored)
└── .venv/                      # venv Python com mkdocs-techdocs-core (gitignored)
```

## Specs

1. [01-backstage-install.md](01-backstage-install.md) — pré-requisitos, instalação, catálogo GitHub, guest.
2. [02-techdocs.md](02-techdocs.md) — builder externo, publisher local, script, CI, critérios de aceite.
3. [03-repos-docs.md](03-repos-docs.md) — os 4 repos de exemplo (serviço + wikis) e seu conteúdo.
4. [04-techdocs-blob-azurite.md](04-techdocs-blob-azurite.md) — publisher Azure Blob simulado com Azurite (Podman).
5. [05-portal-docs.md](05-portal-docs.md) — portal: menu Docs, cards por categoria, mermaid e PlantUML.

## Evolução (pós-PoC)

- Trocar `publisher.type: local` por `awsS3`/`azureBlobStorage`/`googleGcs` e mover o
  `techdocs-cli generate && publish` do script para o GitHub Actions. Config do Backstage
  muda só no bloco `techdocs.publisher`.
- Postgres, GitHub OAuth, imagem de container, deploy.

## Itens em aberto

Nenhum. Usuário GitHub: `edtroleis`. Node 24, Python 3.14.
