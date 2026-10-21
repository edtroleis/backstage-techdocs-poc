import { Entity } from '@backstage/catalog-model';
import { CodeSnippet, Content, Link } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Button, Paper, Typography, makeStyles } from '@material-ui/core';
import GitHubIcon from '@material-ui/icons/GitHub';
import MenuBookIcon from '@material-ui/icons/MenuBook';

const GITHUB_SLUG_ANNOTATION = 'github.com/project-slug';
const EXAMPLE_REPO = 'https://github.com/edtroleis/techdocs-pedidos-service';

const useStyles = makeStyles(theme => ({
  intro: { marginBottom: theme.spacing(3), maxWidth: 900 },
  step: { padding: theme.spacing(2, 3), marginBottom: theme.spacing(2), maxWidth: 900 },
  stepTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    fontWeight: 700,
  },
  number: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontSize: '0.9rem',
    flexShrink: 0,
  },
  actions: { display: 'flex', gap: theme.spacing(1), flexWrap: 'wrap', marginTop: theme.spacing(1.5) },
  action: { textTransform: 'none' },
}));

function mkdocsYaml(title: string) {
  return `site_name: ${title}
# Avisos do mkdocs (links/nav quebrados) viram erro e falham o CI
strict: true
nav:
  - Início: index.md
plugins:
  - techdocs-core
markdown_extensions:
  # Diagramas mermaid renderizados no Backstage
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
`;
}

function indexMd(entity: Entity, title: string) {
  return `# ${title}

${entity.metadata.description ?? 'Descreva aqui o que este componente faz.'}

## Visão geral

| | |
|---|---|
| **Owner** | \`${entity.spec?.owner ?? 'meu-time'}\` |
| **Tipo** | ${entity.spec?.type ?? '-'} |

## Como rodar localmente

\`\`\`bash
# comandos para rodar o serviço
\`\`\`

## Runbook

O que fazer quando algo dá errado.
`;
}

function annotationYaml(entity: Entity) {
  return `apiVersion: ${entity.apiVersion}
kind: ${entity.kind}
metadata:
  name: ${entity.metadata.name}
  annotations:
    backstage.io/techdocs-ref: dir:.   # ← adicione esta linha
`;
}

const WORKFLOW = `# .github/workflows/techdocs.yml (valida que a doc gera em todo PR)
name: techdocs
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.14' }
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: pip install mkdocs-techdocs-core==1.7.1
      - run: npx -y @techdocs/cli@1.13.0 generate --no-docker --source-dir . --output-dir ./site
`;

const newFileUrl = (slug: string, filename: string, value: string) =>
  `https://github.com/${slug}/new/main?${new URLSearchParams({ filename, value })}`;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const classes = useStyles();
  return (
    <Paper variant="outlined" className={classes.step}>
      <Typography variant="h6" className={classes.stepTitle}>
        <span className={classes.number}>{n}</span>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

/**
 * Aba TechDocs de uma entidade sem `backstage.io/techdocs-ref`: passo a passo, já com o nome da
 * entidade, para criar e publicar a documentação (substitui o "Missing Annotation" padrão).
 */
export const DocsHowToEmptyState = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const title = entity.metadata.title ?? entity.metadata.name;
  const slug = entity.metadata.annotations?.[GITHUB_SLUG_ANNOTATION];
  const kind = entity.kind.toLowerCase();
  const repoUrl = slug ? `https://github.com/${slug}.git` : '<url-do-repositório>.git';

  return (
    <Content>
      <div className={classes.intro}>
        <Typography variant="h4" gutterBottom>
          📝 {title} ainda não tem documentação
        </Typography>
        <Typography variant="body1" color="textSecondary">
          A documentação mora no próprio repositório (<i>docs-as-code</i>), em Markdown, e aparece
          nesta aba depois de publicada. São 5 passos, cerca de 15 minutos. Os exemplos abaixo já
          estão preenchidos para <b>{entity.metadata.name}</b>.
        </Typography>
        <div className={classes.actions}>
          <Button
            className={classes.action}
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<MenuBookIcon />}
            href={EXAMPLE_REPO}
            target="_blank"
          >
            Ver um serviço já documentado
          </Button>
          <Button
            className={classes.action}
            size="small"
            href="https://backstage.io/docs/features/techdocs/creating-and-publishing"
            target="_blank"
          >
            Documentação oficial do TechDocs
          </Button>
        </div>
      </div>

      <Step n={1} title="Crie o mkdocs.yml na raiz do repositório">
        <Typography variant="body2" paragraph>
          Define o título e o menu da documentação.
        </Typography>
        <CodeSnippet text={mkdocsYaml(title)} language="yaml" showCopyCodeButton />
        {slug && (
          <div className={classes.actions}>
            <Button className={classes.action} variant="contained" color="primary" size="small"
              startIcon={<GitHubIcon />} href={newFileUrl(slug, 'mkdocs.yml', mkdocsYaml(title))} target="_blank">
              Criar mkdocs.yml no GitHub
            </Button>
          </div>
        )}
      </Step>

      <Step n={2} title="Escreva a primeira página em docs/index.md">
        <Typography variant="body2" paragraph>
          Markdown comum. Comece pelo básico: o que é, quem é o dono, como rodar e o runbook.
          Novas páginas entram em <code>docs/</code> e no <code>nav</code> do <code>mkdocs.yml</code>.
        </Typography>
        <CodeSnippet text={indexMd(entity, title)} language="markdown" showCopyCodeButton />
        {slug && (
          <div className={classes.actions}>
            <Button className={classes.action} variant="contained" color="primary" size="small"
              startIcon={<GitHubIcon />} href={newFileUrl(slug, 'docs/index.md', indexMd(entity, title))} target="_blank">
              Criar docs/index.md no GitHub
            </Button>
          </div>
        )}
      </Step>

      <Step n={3} title="Adicione a anotação no catalog-info.yaml">
        <Typography variant="body2" paragraph>
          É ela que liga o componente à documentação e faz esta aba mostrar a doc.
        </Typography>
        <CodeSnippet text={annotationYaml(entity)} language="yaml" highlightedNumbers={[6]} showCopyCodeButton />
        {slug && (
          <div className={classes.actions}>
            <Button className={classes.action} variant="contained" color="primary" size="small"
              startIcon={<GitHubIcon />} href={`https://github.com/${slug}/edit/main/catalog-info.yaml`} target="_blank">
              Editar catalog-info.yaml no GitHub
            </Button>
          </div>
        )}
      </Step>

      <Step n={4} title="Valide no CI (recomendado)">
        <Typography variant="body2" paragraph>
          Com este workflow, uma doc quebrada falha o PR, como código quebrado.
        </Typography>
        <CodeSnippet text={WORKFLOW} language="yaml" showCopyCodeButton />
      </Step>

      <Step n={5} title="Publique e confira">
        <Typography variant="body2" paragraph>
          Neste ambiente o Backstage <b>não gera</b> as docs (<code>techdocs.builder: external</code>):
          elas são geradas e publicadas fora dele. Depois do merge, publique:
        </Typography>
        <CodeSnippet
          text={`# na raiz do projeto backstage\nscripts/techdocs-publish.sh ${repoUrl}`}
          language="bash"
          showCopyCodeButton
        />
        <Typography variant="body2" paragraph style={{ marginTop: 12 }}>
          O catálogo relê o <code>catalog-info.yaml</code> em alguns minutos. Para acelerar, abra o
          menu de três pontos no canto superior direito desta página e escolha <b>Refresh</b>. Depois,
          esta aba passa a mostrar a
          documentação, que também aparece em <Link to="/docs">All Docs</Link> e na busca.
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Em produção, o próprio pipeline publica (<code>techdocs-cli publish</code>) num storage
          (S3, Azure Blob ou GCS), sem passo manual. Entidade: <code>{kind}:{entity.metadata.namespace ?? 'default'}/{entity.metadata.name}</code>.
        </Typography>
      </Step>
    </Content>
  );
};
