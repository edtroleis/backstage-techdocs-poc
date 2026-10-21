import { createFrontendModule, configApiRef, githubAuthApiRef, useApi } from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint, SignInPageProps } from '@backstage/plugin-app-react';
import { SignInPage } from '@backstage/core-components';

const githubProvider = {
  id: 'github-auth-provider',
  title: 'GitHub',
  message: 'Entre com sua conta do GitHub',
  apiRef: githubAuthApiRef,
};

/** Login: GitHub (quando configurado) e guest. Substitui a página padrão, que só tem guest. */
const AppSignInPage = (props: SignInPageProps) => {
  const config = useApi(configApiRef);
  const github = config.getOptionalBoolean('app.githubSignIn') ?? false;
  return <SignInPage {...props} providers={github ? [githubProvider, 'guest'] : ['guest']} />;
};

export const signInModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    SignInPageBlueprint.make({
      params: { loader: async () => AppSignInPage },
    }),
  ],
});
