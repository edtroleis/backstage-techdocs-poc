# 03 — Repositórios de exemplo com docs

Quatro repositórios **públicos** em `github.com/edtroleis`, criados via `gh repo create`.
Todos seguem os modelos de `templates/` (ver [02-techdocs.md](02-techdocs.md)).

| Repo | Entidade | `spec.type` | Associação |
|------|----------|-------------|------------|
| `techdocs-demo-service` | Component `demo-service` | `service` | Pertence ao System `demo-system` |
| `techdocs-wiki-golden-path` | Component `wiki-golden-path` | `documentation` | Nenhuma |
| `techdocs-wiki-onboarding` | Component `wiki-onboarding` | `documentation` | Nenhuma |
| `techdocs-wiki-engineering` | Component `wiki-engineering` | `documentation` | Nenhuma |

## Docs de serviço vs. wikis

- **Doc de serviço**: vive no repo do serviço e aparece na aba **Docs** da página do componente,
  com links para system, owner e API.
- **Wiki** (sem associação): é um Component `type: documentation`, sem `system`, `dependsOn`
  ou `providesApis`. Aparece em `/docs` e na busca. Tag `wiki` para filtrar.

Por que `Component` e não outro kind: o TechDocs exige uma entidade, e `Component/documentation`
é o padrão da comunidade, que a página `/docs` exibe sem nenhuma customização.

## Entidades de organização (no repo do Backstage)

`catalog/org.yaml`, registrado como location `type: file`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Group
metadata: { name: platform-team }
spec: { type: team, children: [] }
---
apiVersion: backstage.io/v1alpha1
kind: System
metadata: { name: demo-system, description: Sistema de exemplo da PoC }
spec: { owner: platform-team }
```

Owner de todos os componentes: `platform-team`.

## Conteúdo

### 1. `techdocs-demo-service` — doc de serviço

Contém uma API mínima (Python/FastAPI, 1–2 endpoints) só para dar contexto. A doc é o foco.

```
docs/
├── index.md            # o que é, responsáveis, links
├── architecture.md     # componentes, dependências, fluxo de dados
├── api.md              # endpoints, exemplos de request/response
├── runbook.md          # deploy, rollback, alertas, troubleshooting
└── adr/
    └── 0001-escolha-fastapi.md
```

`catalog-info.yaml`: `type: service`, `system: demo-system`, `providesApis: [demo-api]`
e uma entidade `API` (`type: openapi`) no mesmo arquivo, para mostrar a relação serviço ↔ API.

### 2. `techdocs-wiki-golden-path` — golden path de arquitetura

```
docs/
├── index.md                 # o que é um golden path e quando segui-lo
├── principios.md            # princípios de arquitetura
├── estrutura-servico.md     # layout de repo, config, 12-factor
├── ci-cd.md                 # pipeline padrão, ambientes, promoção
├── observabilidade.md       # logs, métricas, traces, health checks
├── seguranca.md             # segredos, dependências, imagens
└── checklist.md             # checklist de prontidão para produção
```

### 3. `techdocs-wiki-onboarding` — onboarding do dev

```
docs/
├── index.md              # boas-vindas, trilha da primeira semana
├── primeiro-dia.md       # acessos, ferramentas, contatos
├── ambiente-local.md     # setup (WSL, Git, Node, Python, containers)
├── fluxo-de-trabalho.md  # branches, PRs, code review, deploy
├── backstage.md          # como usar o catálogo e o TechDocs
└── faq.md
```

### 4. `techdocs-wiki-engineering` — wiki de engenharia

```
docs/
├── index.md
├── padroes-codigo.md     # convenções, lint, testes
├── code-review.md        # o que revisar, SLAs
├── adrs.md               # como escrever ADRs + índice
└── glossario.md
```

## Recursos do mkdocs para demonstrar

Todos vêm no `techdocs-core`, sem plugin extra:

- `nav` com seções aninhadas.
- Admonitions (`!!! note`, `!!! warning`).
- Blocos de código com destaque de sintaxe.
- Tabelas.
- Links entre wikis (URLs absolutas `http://localhost:3000/docs/default/component/<name>`).

Fora: diagramas mermaid/PlantUML, que exigiriam plugin e configuração extra (fica para evolução).

## Arquivos comuns em cada repo

- `README.md` com uma linha e o link para a doc no Backstage local.
- `catalog-info.yaml`, `mkdocs.yml`, `docs/`.
- `.github/workflows/techdocs.yml` para validar o build (Python 3.14, Node 24).

## Registro e publicação

`app/app-config.yaml`:

```yaml
catalog:
  locations:
    - type: file
      target: ../../../catalog/org.yaml   # relativo a app/packages/backend
    - type: url
      target: https://github.com/edtroleis/techdocs-demo-service/blob/main/catalog-info.yaml
    - type: url
      target: https://github.com/edtroleis/techdocs-wiki-golden-path/blob/main/catalog-info.yaml
    - type: url
      target: https://github.com/edtroleis/techdocs-wiki-onboarding/blob/main/catalog-info.yaml
    - type: url
      target: https://github.com/edtroleis/techdocs-wiki-engineering/blob/main/catalog-info.yaml
```

`scripts/repos.txt` lista as 4 URLs, e `scripts/techdocs-publish.sh --all` publica todas.

## Critérios de aceite

- [ ] Os 4 repos existem, são públicos e o workflow `techdocs` está verde em cada um.
- [ ] O catálogo mostra `demo-service` ligado a `demo-system`, `platform-team` e `demo-api`.
- [ ] `/docs` lista as 4 docs; filtrar pela tag `wiki` mostra só as 3 wikis.
- [ ] A aba Docs do `demo-service` renderiza; as wikis abrem por `/docs/default/component/<name>`.
- [ ] A busca do Backstage encontra texto de dentro das wikis.
