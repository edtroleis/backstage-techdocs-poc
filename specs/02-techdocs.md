# 02 — TechDocs: builder externo + publisher local

Referência: https://backstage.io/docs/features/techdocs/

## Modelo

- **Backstage não gera docs** (`builder: external`). Ele só lê HTML já publicado.
- **Publicação** em disco local (`publisher.type: local`).
- **Geração** feita por `scripts/techdocs-publish.sh`, que simula o passo de CI.
- **CI no GitHub** apenas valida que a doc gera (falha o PR se o mkdocs quebrar).

## Passo 1 — Plugin TechDocs

O `create-app` já inclui frontend (`@backstage/plugin-techdocs`) e backend
(`@backstage/plugin-techdocs-backend`). Verificar:

- `app/packages/backend/src/index.ts` contém `backend.add(import('@backstage/plugin-techdocs-backend'))`.
- A página da entidade mostra a aba **Docs** (`EntityTechdocsContent`) e existe a rota `/docs`.

## Passo 2 — Configuração

`app/app-config.yaml`:

```yaml
techdocs:
  builder: 'external'
  publisher:
    type: 'local'
    local:
      # Relativo ao processo do backend (app/packages/backend) → <raiz>/techdocs-storage
      publishDirectory: ../../../techdocs-storage
```

Layout esperado no storage (triplet em minúsculas):

```
techdocs-storage/<namespace>/<kind>/<name>/
├── index.html
├── techdocs_metadata.json
└── ...
```

Ex.: `techdocs-storage/default/component/meu-servico/`.

## Passo 3 — Ambiente de geração (Python)

```bash
cd ~/code/backstage
python3 -m venv .venv          # Python 3.14
source .venv/bin/activate
pip install -r requirements.txt   # mkdocs-techdocs-core==1.7.1
```

O `techdocs-cli` roda via `npx @techdocs/cli@1.13.0` (versão fixada, sem instalar global).

## Passo 4 — Script "CI" local

`scripts/techdocs-publish.sh`

**Uso**
```bash
scripts/techdocs-publish.sh <repo-git-url> [ref]
# ex.: scripts/techdocs-publish.sh https://github.com/edtroleis/meu-servico.git main
```

**Comportamento**
1. Clona o repo (shallow, `ref` padrão `main`) num diretório temporário.
2. Lê `catalog-info.yaml` e extrai `metadata.namespace` (padrão `default`), `kind` e `metadata.name`.
3. Ativa `.venv` e roda `npx @techdocs/cli generate --no-docker --source-dir <clone> --output-dir <tmp>/site`.
4. Substitui `techdocs-storage/<ns>/<kind>/<name>/` pelo conteúdo de `site/` (minúsculas).
5. Remove o clone temporário. Sai com código ≠ 0 em qualquer falha (`set -euo pipefail`).

Requisitos: idempotente (rodar 2x dá o mesmo resultado); não depende de Docker; parsing de
YAML sem dependência pesada (ex.: `python -c` com `yaml` do venv, que vem com mkdocs).

`--all` publica todos os repos listados em `scripts/repos.txt` (ver [03-repos-docs.md](03-repos-docs.md)).

## Passo 5 — Arquivos nos repos de docs (`templates/`)

`catalog-info.yaml`
```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: meu-servico
  description: Exemplo com TechDocs
  annotations:
    github.com/project-slug: edtroleis/meu-servico
    backstage.io/techdocs-ref: dir:.
spec:
  type: service
  lifecycle: experimental
  owner: platform-team
```

> Com `builder: external` a anotação `techdocs-ref` continua necessária: é ela que faz a aba Docs aparecer.

`mkdocs.yml`
```yaml
site_name: Meu Serviço
strict: true   # avisos (nav/links quebrados) viram erro → CI falha
nav:
  - Início: index.md
plugins:
  - techdocs-core
```

`docs/index.md` — página inicial simples.

`.github/workflows/techdocs.yml` — valida o build em PR/push:
```yaml
name: techdocs
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.14' }
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: pip install -r requirements.txt
      - run: npx -y @techdocs/cli@1.13.0 generate --no-docker --source-dir . --output-dir ./site
```

## Fluxo ponta a ponta

1. Usuário commita docs no repo → GitHub Actions valida o build.
2. Localmente: `scripts/techdocs-publish.sh <repo>` → HTML em `techdocs-storage/`.
3. Backstage (`yarn start`) → Catálogo → componente → aba **Docs** exibe o conteúdo.
4. Alterou a doc? Rodar o script de novo e recarregar a página (há cache no frontend/backend).

## Critérios de aceite

- [ ] `techdocs.builder` = `external`; Backstage **não** tenta gerar docs (sem logs de mkdocs/docker no backend).
- [ ] Script publica um repo público do usuário em `techdocs-storage/default/component/<name>/`.
- [ ] Aba Docs do componente mostra o conteúdo; `/docs` lista o componente.
- [ ] Componente sem docs publicadas mostra a mensagem de "documentação não encontrada" (comportamento esperado do modo externo).
- [ ] Workflow do GitHub passa no repo de exemplo e falha se o `mkdocs.yml` estiver inválido.
- [ ] Rodar o script duas vezes seguidas não gera erro nem lixo.

## Riscos

- **Python 3.14 × mkdocs-techdocs-core**: validado. `mkdocs-techdocs-core==1.7.1` (mkdocs 1.6.1, material 9.7.7) funciona no 3.14.3.
- **Build não falha por padrão**: sem `strict: true`, nav ou links quebrados são só avisos, e o `techdocs-cli` **remove** plugins não suportados em silêncio (só emite um warn). Por isso todos os repos usam `strict: true`. Plugin desconhecido continua passando, já que o próprio techdocs-cli o remove.
- **Caminho relativo do `publishDirectory`**: depende do cwd do backend → validar.
- **Case do triplet**: storage deve estar em minúsculas (padrão atual do TechDocs).
- **Cache**: TechDocs pode servir versão antiga por alguns minutos após republicar.

## Evolução

Para ir a produção: mover o passo 3 do script para o workflow
(`techdocs-cli publish --publisher-type awsS3 ...`) e trocar `techdocs.publisher` no Backstage.
Nada mais muda no app.
