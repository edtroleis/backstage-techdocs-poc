# Backstage + TechDocs (PoC local)

Specs em [`specs/`](specs/00-overview.md).

| Caminho | O que é |
|---------|---------|
| `app/` | App Backstage (create-app; repositório git próprio) |
| `catalog/org.yaml` | Group `platform-team` + System `demo-system` |
| `scripts/techdocs-publish.sh` | "CI" local: gera e publica docs em `techdocs-storage/` |
| `scripts/azurite.sh` | Azurite (Azure Blob emulado) no Podman: `up\|down\|status\|env` |
| `scripts/techdocs-azure-publish.cjs` | Publish no blob via classe `Publisher` do Backstage |
| `scripts/repos.txt` | Repos publicados por `--all` |
| `templates/` | Arquivos-base para novos repos de docs |
| `repos/` | Clones dos 4 repos `edtroleis/techdocs-*` |
| `techdocs-storage/` | HTML publicado, lido pelo Backstage |
| `.venv/` | Python 3.14 + mkdocs-techdocs-core |

## Rodar

```bash
nvm use 24
scripts/techdocs-publish.sh --all            # gera e publica as docs
cd app && GITHUB_TOKEN=$(gh auth token) yarn start
```

- Catálogo: http://localhost:3000
- Docs: menu **Docs** → On Boarding, Wikis, Golden Paths, Manuais, All Docs ([specs/05](specs/05-portal-docs.md))

Pré-requisito para diagramas PlantUML: `plantuml` no PATH (`~/.local/bin/plantuml`, Java).

### Modo Azure Blob (Azurite), ver [specs/04](specs/04-techdocs-blob-azurite.md)

```bash
scripts/azurite.sh up                                  # Azurite no Podman (:10000)
scripts/techdocs-publish.sh --target azurite --all     # publica no blob
cd app && eval "$(../scripts/azurite.sh env)" && \
  GITHUB_TOKEN=$(gh auth token) yarn start --config ../../app-config.yaml --config ../../app-config.azurite.yaml
```

Depois de alterar a doc num repo: push, depois `scripts/techdocs-publish.sh <repo-url>`, e recarregue a página.
