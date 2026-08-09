import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBJpH2IJBUsVQWNXeo1VOn2hSV1p1-saGQ",
  authDomain: "yo-ge-f7397.firebaseapp.com",
  projectId: "yo-ge-f7397",
  databaseURL: "https://yo-ge-f7397-default-rtdb.europe-west1.firebasedatabase.app",
  storageBucket: "yo-ge-f7397.firebasestorage.app",
  messagingSenderId: "700841347138",
  appId: "1:700841347138:web:0d26319ef818356c4805db"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
