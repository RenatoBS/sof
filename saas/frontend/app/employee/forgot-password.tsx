import { Redirect } from 'expo-router';

/** Compat: `/employee/forgot-password` → fluxo unificado. */
export default function EmployeeForgotPasswordRedirect() {
  return <Redirect href="/forgot-password" />;
}
