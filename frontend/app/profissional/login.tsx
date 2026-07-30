import { Redirect } from 'expo-router';

/** Compat: `/employee/login` → `/login`. */
export default function ProfissionalLoginRedirect() {
  return <Redirect href="/login" />;
}
