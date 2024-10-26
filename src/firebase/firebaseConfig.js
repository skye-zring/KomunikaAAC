import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDAZfqFgnXfikByrnUtPpkccUqDO-mI_9c",
  authDomain: "komunika-aac.firebaseapp.com",
  projectId: "komunika-aac",
  storageBucket: "komunika-aac.appspot.com",
  messagingSenderId: "399472457026",
  appId: "1:399472457026:web:d2ef7de21291e5268644db"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export { auth };