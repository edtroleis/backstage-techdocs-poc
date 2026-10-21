import {
  coreExtensionData,
  createExtension,
  createFrontendModule,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { AddonBlueprint } from '@backstage/plugin-techdocs-react/alpha';
import { DocsCardsPageProps } from './DocsCardsPage';
import { DocsSubheaderAddon } from './DocsSubheaderAddon';
import { DocsHowToEmptyState } from './DocsHowToEmptyState';
import { docsPortalPaths } from './paths';

export { docsPortalPaths };

const cardsPage = (name: string, path: string, props: DocsCardsPageProps) =>
  PageBlueprint.make({
    name,
    params: {
      path,
      // A página desenha o próprio título; sem isto aparece o cabeçalho genérico "app"
      noHeader: true,
      loader: () =>
        import('./DocsCardsPage').then(m => <m.DocsCardsPage {...props} />),
    },
  });

export const docsPortalModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    cardsPage('docs-wikis', docsPortalPaths.wikis, {
      title: 'Wikis',
      subtitle: 'Consulte a documentação de arquitetura, governança, compliance e IA.',
      type: 'wiki',
      linkLabel: 'Acessar documentação',
    }),
    cardsPage('docs-golden-paths', docsPortalPaths.goldenPaths, {
      title: 'Golden Paths',
      subtitle: 'Caminhos recomendados e suportados, do zero à produção.',
      type: 'golden-path',
      linkLabel: 'Acessar golden path',
    }),
    cardsPage('docs-manuais', docsPortalPaths.manuais, {
      title: 'Manuais',
      subtitle:
        'Guias de instalação e configuração de ferramentas e ambientes de desenvolvimento.',
      type: 'manual',
      linkLabel: 'Acessar manual',
    }),
  ],
});

/** Addons do leitor do TechDocs (precisam do pluginId do techdocs). */
export const docsPortalTechDocsModule = createFrontendModule({
  pluginId: 'techdocs',
  extensions: [
    AddonBlueprint.make({
      name: 'docs-subheader',
      params: {
        name: 'DocsSubheader',
        location: 'Subheader',
        component: DocsSubheaderAddon,
      },
    }),
    // Substitui o "Missing Annotation" da aba TechDocs por um passo a passo para criar a doc
    createExtension({
      kind: 'empty-state',
      name: 'entity-content',
      attachTo: { id: 'entity-content:techdocs', input: 'emptyState' },
      output: [coreExtensionData.reactElement],
      factory: () => [coreExtensionData.reactElement(<DocsHowToEmptyState />)],
    }),
  ],
});
