import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCOUNT_KEY = 'sof_token';
const EMPLOYEE_KEY = 'sof_employee_token';

async function getStored(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  }
  return SecureStore.getItemAsync(key);
}

async function setStored(key: string, token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return;
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
    return;
  }
  if (token) await SecureStore.setItemAsync(key, token);
  else await SecureStore.deleteItemAsync(key);
}

export async function getToken(): Promise<string | null> {
  return getStored(ACCOUNT_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  return setStored(ACCOUNT_KEY, token);
}

export async function getEmployeeToken(): Promise<string | null> {
  return getStored(EMPLOYEE_KEY);
}

export async function setEmployeeToken(token: string | null): Promise<void> {
  return setStored(EMPLOYEE_KEY, token);
}
