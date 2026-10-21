import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';
import {
  docsPortalModule,
  docsPortalTechDocsModule,
} from './modules/docsPortal';

export default createApp({
  features: [
    catalogPlugin,
    navModule,
    homeModule,
    docsPortalModule,
    docsPortalTechDocsModule,
  ],
});
