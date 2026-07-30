import { Redirect } from 'expo-router';

/** Compat: links antigos `/simulador`. */
export default function SimuladorRedirect() {
  return <Redirect href="/simulator" />;
}
