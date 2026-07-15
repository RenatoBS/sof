import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'sof_token';

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  }
  return SecureStore.getItemAsync(KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return;
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
}
