import { Redirect } from 'expo-router';

/** Login unificado em `/login` — mantido só para links antigos. */
export default function ProfissionalLoginRedirect() {
  return <Redirect href="/login" />;
}
