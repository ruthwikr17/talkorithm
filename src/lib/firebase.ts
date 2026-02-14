import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBC6uhxYBQDMgW4GLDR4-i3KkvRirmciTI",
  authDomain: "talkorithm.firebaseapp.com",
  projectId: "talkorithm",
  storageBucket: "talkorithm.firebasestorage.app",
  messagingSenderId: "397525588822",
  appId: "1:397525588822:web:4a96732fa3aa913a6854f7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
