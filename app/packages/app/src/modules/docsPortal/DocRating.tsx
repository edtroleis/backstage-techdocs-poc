import { useCallback, useEffect, useState } from 'react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/frontend-plugin-api';
import { AsyncEntityProvider } from '@backstage/plugin-catalog-react';
import { TechDocsEntityMetadata } from '@backstage/plugin-techdocs-react';
import {
  entityFeedbackApiRef,
  StarredRatingButtons,
} from '@backstage-community/plugin-entity-feedback';
import { Typography, makeStyles } from '@material-ui/core';
import StarIcon from '@material-ui/icons/Star';

// Respostas sugeridas no diálogo aberto quando a nota é ≤ 2
const LOW_RATING_RESPONSES = [
  { id: 'desatualizada', label: 'Está desatualizada' },
  { id: 'incompleta', label: 'Está incompleta' },
  { id: 'confusa', label: 'Difícil de entender' },
  { id: 'erro', label: 'Tem informação errada' },
  { id: 'outro', label: 'Outro motivo' },
];

const useStyles = makeStyles(theme => ({
  root: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing(1) },
  summary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    whiteSpace: 'nowrap',
  },
  star: { color: '#f59e0b' },
}));

/** Média e quantidade a partir de { "5": 3, "4": 1 }. */
function summarize(aggregates: Record<string, number>) {
  let count = 0;
  let total = 0;
  for (const [rating, n] of Object.entries(aggregates)) {
    count += n;
    total += Number(rating) * n;
  }
  return { count, average: count ? total / count : 0 };
}

/** Estrelas de 1 a 5 (plugin entity-feedback) com a média de avaliações da doc. */
export const DocRating = ({ entity }: { entity?: TechDocsEntityMetadata }) => {
  const classes = useStyles();
  const feedbackApi = useApi(entityFeedbackApiRef);
  const [summary, setSummary] = useState<{ count: number; average: number }>();

  const refresh = useCallback(() => {
    if (!entity) return;
    feedbackApi
      .getRatingAggregates(stringifyEntityRef(entity))
      .then(a => setSummary(summarize(a as Record<string, number>)))
      .catch(() => setSummary(undefined));
  }, [entity, feedbackApi]);

  useEffect(refresh, [refresh]);

  if (!entity) {
    return null;
  }
  return (
    <div
      className={classes.root}
      // O componente do plugin não avisa quando a nota é gravada; atualiza a média logo depois do clique
      onClickCapture={() => setTimeout(refresh, 1000)}
    >
      <AsyncEntityProvider entity={entity} loading={false}>
        <StarredRatingButtons
          feedbackDialogTitle="O que podemos melhorar nesta documentação?"
          feedbackDialogResponses={LOW_RATING_RESPONSES}
        />
      </AsyncEntityProvider>
      {summary && (
        <Typography variant="body2" color="textSecondary" className={classes.summary}>
          {summary.count ? (
            <>
              <StarIcon fontSize="small" className={classes.star} />
              {`${summary.average.toFixed(1).replace('.', ',')} · ${summary.count} ${
                summary.count === 1 ? 'avaliação' : 'avaliações'
              }`}
            </>
          ) : (
            'Seja o primeiro a avaliar'
          )}
        </Typography>
      )}
    </div>
  );
};
