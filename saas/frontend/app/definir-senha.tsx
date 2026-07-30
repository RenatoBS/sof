import { Redirect, useLocalSearchParams } from 'expo-router';

/** Compat: links antigos `/definir-senha?token=`. */
export default function DefinirSenhaRedirect() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  if (token) {
    return (
      <Redirect href={{ pathname: '/set-password', params: { token: String(token) } }} />
    );
  }
  return <Redirect href="/set-password" />;
}
