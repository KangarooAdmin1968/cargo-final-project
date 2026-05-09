import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCpqzc2bPiGF30iqrxdzwVZ-sM8RdtJHkE",
  authDomain: "kangaroocargo1968.firebaseapp.com",
  projectId: "kangaroocargo1968",
  storageBucket: "kangaroocargo1968.firebasestorage.app",
  messagingSenderId: "441766373083",
  appId: "1:441766373083:web:64adeb7e21815338c98efe"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
