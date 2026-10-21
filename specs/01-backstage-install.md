# 01 — Instalação do Backstage

## Pré-requisitos

| Item | Requerido | Estado atual | Ação |
|------|-----------|--------------|------|
| Node.js | 24 LTS | v25.9.0 | `nvm install 24`; fixar com `.nvmrc` |
| Yarn | 4.x | ausente | `corepack enable` |
| Git | qualquer recente | 2.53.0 | ok |
| Build tools | `make`, `g++`, `python3` | python 3.14 ok | `sudo apt install -y build-essential` se faltar |
| Python (TechDocs) | 3.14 | 3.14 | ver [02-techdocs.md](02-techdocs.md) |

```bash
# Node LTS
nvm install 24 && nvm use 24
echo 24 > .nvmrc
corepack enable
node -v && yarn -v
```

## Passo 1 — Criar o app

```bash
cd ~/code/backstage
npx @backstage/create-app@latest --path app   # nome do app: "backstage"
cd app
yarn start                                     # frontend :3000, backend :7007
```

Resultado esperado: http://localhost:3000 abre com o login de guest.

## Passo 2 — Guest login

O `create-app` já vem com o provider `guest`. Garantir em `app/app-config.yaml`:

```yaml
auth:
  providers:
    guest: {}
```

Para PoC local isso basta. (Em `production` o guest é desabilitado por padrão — não é objetivo aqui.)

## Passo 3 — Integração GitHub

Repos são públicos, então leitura funciona sem token, mas o limite anônimo da API é 60 req/h.
Usar um **fine-grained PAT** somente leitura (Public repositories, sem permissões extras).

`app/app-config.local.yaml` (gitignored pelo create-app):

```yaml
integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN}
```

```bash
export GITHUB_TOKEN=github_pat_xxx   # não commitar
```

## Passo 4 — Registrar repos no catálogo

Cada repo de docs deve ter um `catalog-info.yaml` na raiz (modelo em `templates/`).
Registrar via `app-config.yaml`:

```yaml
catalog:
  rules:
    - allow: [Component, System, API, Resource, Location, Group, User]
  locations:
    - type: url
      target: https://github.com/edtroleis/<repo>/blob/main/catalog-info.yaml   # lista completa em 03-repos-docs.md
```

Alternativa manual: UI → "Create" → "Register Existing Component" com a mesma URL.

Feito: `examples/entities.yaml` foi removido das locations. `examples/org.yaml` (User `guest`) e o template de exemplo foram mantidos.

## Banco de dados

Manter o padrão do `create-app` (SQLite via `better-sqlite3`). Se em memória, o catálogo
é reprocessado a cada restart — aceitável na PoC. Para persistir entre restarts:

```yaml
backend:
  database:
    client: better-sqlite3
    connection:
      directory: ./sqlite-data
```

## Critérios de aceite

- [ ] `node -v` → 24.x; `yarn -v` → 4.x.
- [ ] `yarn start` sobe sem erros; http://localhost:3000 acessível.
- [ ] Login como guest funciona.
- [ ] Os 4 componentes de [03-repos-docs.md](03-repos-docs.md) aparecem no catálogo.
- [ ] Nenhum token commitado (`app-config.local.yaml` e `.env` no `.gitignore`).

## Riscos

- **Node 25**: `yarn install` falha em `isolated-vm`/`better-sqlite3` → usar LTS.
- **WSL + `/mnt/c`**: manter o projeto no filesystem Linux (`~/code`), já está.
- **Rate limit GitHub** sem token → erros de ingestão intermitentes.
