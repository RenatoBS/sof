import { Redirect } from 'expo-router';

/** Compat: links antigos `/esqueci-senha`. */
export default function EsqueciSenhaRedirect() {
  return <Redirect href="/forgot-password" />;
}
