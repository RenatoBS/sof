import { Redirect } from 'expo-router';

/** Compat: `/forgot-password` → `/forgot-password`. */
export default function ProfissionalEsqueciSenhaRedirect() {
  return <Redirect href="/forgot-password" />;
}
