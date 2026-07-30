import { Redirect, useLocalSearchParams } from 'expo-router';

/** Compat: `/employee/set-password` → `/employee/set-password`. */
export default function ProfissionalDefinirSenhaRedirect() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  if (token) {
    return (
      <Redirect
        href={{ pathname: '/employee/set-password', params: { token: String(token) } }}
      />
    );
  }
  return <Redirect href="/employee/set-password" />;
}
