export interface Config {
  app?: {
    /**
     * Mostra o botão "GitHub" na página de login. Ligado pelo app-config.github-auth.yaml,
     * carregado pelo backstage.sh quando AUTH_GITHUB_CLIENT_ID está definido.
     * @visibility frontend
     */
    githubSignIn?: boolean;
  };
}
