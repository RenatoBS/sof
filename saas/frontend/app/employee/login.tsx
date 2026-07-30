import { Redirect } from 'expo-router';

/** Login unificado em `/login` — mantido só para links antigos. */
export default function EmployeeLoginRedirect() {
  return <Redirect href="/login" />;
}
