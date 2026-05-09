"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface Cargo {
  id: string;
  stillage: string;
  name: string;
  kg: string;
  kub: string;
}

export default function UsersPanel() {
  const [cargos, setCargos] = useState<Cargo[]>([]);

  useEffect(() => {
    const q = query(collection(db, "cargo"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cargoData: Cargo[] = [];
      snapshot.forEach((doc) => {
        cargoData.push({ id: doc.id, ...doc.data() } as Cargo);
      });
      setCargos(cargoData);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      {/* Main container */}
      <div className="w-full max-w-md bg-gray-50 min-h-screen flex flex-col gap-4 p-4">

        {/* Header */}
        <h1 className="text-center font-bold text-xl mt-4 text-gray-800">
          Users Panel
        </h1>

        {/* Login Button */}
        <button className="w-full bg-blue-600 rounded-xl p-3 text-white text-center font-bold">
          Вход
        </button>

        {/* Sheet Selector */}
        <div className="flex flex-col gap-2">
          <p className="font-bold text-gray-700">📁 Выберите лист:</p>
          <select className="border rounded-md p-2 w-full bg-white outline-none">
            <option>31/07</option>
          </select>
        </div>

        {/* Search Bar */}
        <input
          type="text"
          placeholder="Поиск по имени или последним 4 циф"
          className="bg-white border rounded-xl p-3 w-full shadow-sm outline-none focus:border-blue-500"
        />

        {/* Data Cards Container */}
        <div className="flex flex-col gap-3 mt-2">
          {cargos.length === 0 ? (
            <p className="text-center text-gray-500">Нет данных</p>
          ) : (
            cargos.map((cargo, index) => (
              <div key={cargo.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-col gap-1">
                <span className="font-bold text-gray-800">#: {index + 1}</span>
                <span className="font-bold text-gray-800">Название: {cargo.name}</span>
                <span className="font-bold text-gray-800">Номер: {cargo.stillage}</span>
                <span className="font-bold text-gray-800">Kg: {cargo.kg}</span>
                <span className="font-bold text-gray-800">Kub: {cargo.kub}</span>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
