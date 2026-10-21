import { useEffect, useState } from 'react';
import { Content, Link, Progress, WarningPanel } from '@backstage/core-components';
import { useApi } from '@backstage/frontend-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import {
  Card,
  CardContent,
  Chip,
  Grid,
  Typography,
  makeStyles,
} from '@material-ui/core';
import LibraryBooksIcon from '@material-ui/icons/LibraryBooks';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';

// Annotations lidas dos catalog-info.yaml dos repos de docs (ver specs/05-portal-docs.md)
const CATEGORY_ANNOTATION = 'portal.local/category';
const TOPICS_ANNOTATION = 'portal.local/topics';

// Selo do card a partir do spec.lifecycle (valores padrão do Backstage)
const LIFECYCLE_BADGES: Record<string, { label: string; color: string }> = {
  production: { label: '🟢 Produtivo', color: '#22c55e' },
  experimental: { label: '🟡 Em construção', color: '#f59e0b' },
  deprecated: { label: '🔴 Descontinuado', color: '#ef4444' },
};

const useStyles = makeStyles(theme => ({
  header: { marginBottom: theme.spacing(3) },
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderTop: `3px solid ${theme.palette.primary.main}`,
  },
  content: { flexGrow: 1, display: 'flex', flexDirection: 'column' },
  cardTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  badge: { fontWeight: 600, flexShrink: 0 },
  category: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    textTransform: 'uppercase',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  title: { fontWeight: 700, marginBottom: theme.spacing(1) },
  description: { color: theme.palette.text.secondary, marginBottom: theme.spacing(2) },
  topics: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  link: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontWeight: 600,
  },
}));

export type DocsCardsPageProps = {
  title: string;
  subtitle: string;
  /** `spec.type` das entidades exibidas (ex.: wiki, manual, golden-path) */
  type: string;
  linkLabel: string;
};

function docsPath(entity: Entity) {
  const namespace = entity.metadata.namespace ?? 'default';
  return `/docs/${namespace}/${entity.kind.toLowerCase()}/${entity.metadata.name}`;
}

function DocCard({ entity, linkLabel }: { entity: Entity; linkLabel: string }) {
  const classes = useStyles();
  const annotations = entity.metadata.annotations ?? {};
  const topics = (annotations[TOPICS_ANNOTATION] ?? '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  const lifecycle = entity.spec?.lifecycle;
  const badge = typeof lifecycle === 'string' ? LIFECYCLE_BADGES[lifecycle] : undefined;

  return (
    <Card className={classes.card} variant="outlined">
      <CardContent className={classes.content}>
        <div className={classes.cardTop}>
          <div className={classes.category}>
            <LibraryBooksIcon fontSize="small" />
            {annotations[CATEGORY_ANNOTATION] ?? entity.spec?.type}
          </div>
          {badge && (
            <Chip
              label={badge.label}
              size="small"
              variant="outlined"
              className={classes.badge}
              style={{ borderColor: badge.color, color: badge.color }}
            />
          )}
        </div>
        <Typography variant="h6" className={classes.title}>
          {entity.metadata.title ?? entity.metadata.name}
        </Typography>
        <Typography variant="body2" className={classes.description}>
          {entity.metadata.description}
        </Typography>
        <div className={classes.topics}>
          {topics.map(topic => (
            <Chip key={topic} label={topic} size="small" variant="outlined" />
          ))}
        </div>
        <Link to={docsPath(entity)} className={classes.link}>
          {linkLabel}
          <ArrowForwardIcon fontSize="small" />
        </Link>
      </CardContent>
    </Card>
  );
}

export function DocsCardsPage({ title, subtitle, type, linkLabel }: DocsCardsPageProps) {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);
  const [entities, setEntities] = useState<Entity[]>();
  const [error, setError] = useState<Error>();

  useEffect(() => {
    catalogApi
      .getEntities({
        filter: { kind: 'Component', 'spec.type': type },
        order: { field: 'metadata.title', order: 'asc' },
      })
      .then(response => setEntities(response.items))
      .catch(setError);
  }, [catalogApi, type]);

  return (
    <Content>
      <div className={classes.header}>
        <Typography variant="h4">{title}</Typography>
        <Typography variant="body1" color="textSecondary">
          {subtitle}
        </Typography>
      </div>
      {error && <WarningPanel title="Falha ao carregar o catálogo" message={error.message} />}
      {!entities && !error && <Progress />}
      {entities?.length === 0 && (
        <Typography color="textSecondary">Nenhuma documentação do tipo “{type}”.</Typography>
      )}
      <Grid container spacing={3}>
        {entities?.map(entity => (
          <Grid item xs={12} sm={6} md={4} key={entity.metadata.uid ?? entity.metadata.name}>
            <DocCard entity={entity} linkLabel={linkLabel} />
          </Grid>
        ))}
      </Grid>
    </Content>
  );
}
