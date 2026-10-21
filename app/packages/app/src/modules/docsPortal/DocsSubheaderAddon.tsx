import { Link } from '@backstage/core-components';
import { useTechDocsReaderPage } from '@backstage/plugin-techdocs-react';
import { Button, makeStyles } from '@material-ui/core';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import ChatBubbleOutlineIcon from '@material-ui/icons/ChatBubbleOutline';
import { docsPortalPaths } from './paths';
import { DocRating } from './DocRating';

/** Seção do portal de cada `spec.type`; tipos fora daqui (ex.: service) não mostram o link. */
const sections: Record<string, { label: string; to: string }> = {
  wiki: { label: 'Wikis', to: docsPortalPaths.wikis },
  'golden-path': { label: 'Golden Paths', to: docsPortalPaths.goldenPaths },
  manual: { label: 'Manuais', to: docsPortalPaths.manuais },
};

const GITHUB_SLUG_ANNOTATION = 'github.com/project-slug';

const useStyles = makeStyles(theme => ({
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  back: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontWeight: 600,
  },
  comment: { textTransform: 'none', fontWeight: 600 },
}));

/** Abre uma issue no repo da doc com o título e o endereço da página atual. */
function openCommentIssue(slug: string, docTitle: string, shadowRoot?: ShadowRoot) {
  // Remove o "¶" do link permanente que o mkdocs adiciona aos títulos
  const pageTitle =
    shadowRoot?.querySelector('article h1')?.textContent?.replace(/¶/g, '').trim() ||
    docTitle;
  const title = `Comentário: ${docTitle} · ${pageTitle}`;
  const body = [
    `**Página:** ${window.location.href}`,
    '',
    '**Comentário:**',
    '',
    '<!-- Escreva aqui sua dúvida, correção ou sugestão. -->',
  ].join('\n');
  const url = `https://github.com/${slug}/issues/new?${new URLSearchParams({ title, body })}`;
  window.open(url, '_blank', 'noopener');
}

/**
 * Addon do TechDocs (Subheader): "← Voltar para <seção>" conforme o tipo da doc, avaliação de
 * 1 a 5 estrelas e o botão "Comentar", que abre uma issue no GitHub do repositório da doc.
 */
export const DocsSubheaderAddon = () => {
  const classes = useStyles();
  const { entityMetadata, title, shadowRoot } = useTechDocsReaderPage();
  const entity = entityMetadata.value;
  const type = entity?.spec?.type;
  const section = typeof type === 'string' ? sections[type] : undefined;
  const slug = entity?.metadata.annotations?.[GITHUB_SLUG_ANNOTATION];

  if (!entity) {
    return null;
  }
  return (
    <div className={classes.bar}>
      {section && (
        <Link to={section.to} className={classes.back}>
          <ArrowBackIcon fontSize="small" />
          Voltar para {section.label}
        </Link>
      )}
      <DocRating entity={entity} />
      {slug && (
        <Button
          variant="outlined"
          color="primary"
          size="small"
          className={classes.comment}
          startIcon={<ChatBubbleOutlineIcon fontSize="small" />}
          onClick={() =>
            openCommentIssue(slug, entity?.metadata.title ?? title, shadowRoot)
          }
        >
          Comentar
        </Button>
      )}
    </div>
  );
};
