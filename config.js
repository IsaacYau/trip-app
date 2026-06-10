// Firebase Production Configuration (git-ignored for security)
export const firebaseConfig = {
  apiKey: "AIzaSyAZlzorUsDIq7jf90MVu9m_eWyeqSgXhD8",
  authDomain: "trip-app-v2.firebaseapp.com",
  projectId: "trip-app-v2",
  storageBucket: "trip-app-v2.firebasestorage.app",
  messagingSenderId: "148592264190",
  appId: "1:148592264190:web:9d2a305d6658949c5476af"
};
if (typeof window !== 'undefined') {
    window.firebaseConfig = firebaseConfig;
}
