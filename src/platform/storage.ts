import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const FINANCE_DATA_KEY = 'finance-bro.v1.data';
const PREFERENCES_KEY = 'finance-bro.v1.preferences';
const GEMINI_KEY = 'finance-bro.gemini-api-key';

export type LocalPreferences = { geminiEnabled?: boolean };

export const loadFinanceData = () => AsyncStorage.getItem(FINANCE_DATA_KEY);
export const saveFinanceData = (value: string) => AsyncStorage.setItem(FINANCE_DATA_KEY, value);
export const loadPreferences = () => AsyncStorage.getItem(PREFERENCES_KEY);
export const savePreferences = (value: LocalPreferences) => AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(value));
export const loadGeminiApiKey = () => SecureStore.getItemAsync(GEMINI_KEY);
export const saveGeminiApiKey = (value: string) => SecureStore.setItemAsync(GEMINI_KEY, value);
export const deleteGeminiApiKey = () => SecureStore.deleteItemAsync(GEMINI_KEY);
