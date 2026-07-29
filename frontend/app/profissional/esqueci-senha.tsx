import { Redirect } from 'expo-router';

/** Compat: redireciona para o fluxo unificado conta/profissional. */
export default function EsqueciSenhaProfissionalRedirect() {
  return <Redirect href="/esqueci-senha" />;
}
