"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface CargoList {
  id: string;
  name: string;
  createdAt: any;
}

interface Cargo {
  id: string;
  listId: string;
  stillage: string;
  name: string;
  phone: string;
  kg: string;
  kub: string;
  status?: string;
  totalPrice?: number;
  createdAt: any;
}

export default function UsersPanel() {
  const [lists, setLists] = useState<CargoList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch Lists
  useEffect(() => {
    const q = query(collection(db, "lists"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLists: CargoList[] = [];
      snapshot.forEach((doc) => {
        fetchedLists.push({ id: doc.id, ...doc.data() } as CargoList);
      });
      setLists(fetchedLists);
      
      if (fetchedLists.length > 0 && !selectedListId) {
        setSelectedListId(fetchedLists[0].id);
      } else if (fetchedLists.length === 0) {
        setSelectedListId("");
      }
    });
    return () => unsubscribe();
  }, [selectedListId]);

  // Fetch Cargo Items
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

  // Filtered Cargo Items
  const filteredCargoList = cargos.filter((item) => {
    if (item.listId !== selectedListId) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const matchName = item.name.toLowerCase().includes(q);
    const phoneStr = item.phone || "";
    const matchPhone = phoneStr.includes(q);
    return matchName || matchPhone;
  });

  const getStatusColor = (status?: string) => {
    switch(status) {
      case "Принято": return "bg-gray-200 text-gray-800";
      case "В пути": return "bg-yellow-100 text-yellow-800";
      case "На складе": return "bg-green-100 text-green-800";
      case "Выдано": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-200 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      {/* Main container */}
      <div className="w-full max-w-md bg-gray-50 min-h-screen flex flex-col gap-4 p-4">

        {/* Header */}
        <h1 className="text-center font-bold text-xl mt-4 text-gray-800">
          Users Panel
        </h1>

        {/* Login Button */}
        <button 
          className="w-full bg-blue-600 rounded-xl p-3 text-white text-center font-bold hover:bg-blue-700 transition-colors"
          onClick={() => window.location.href = '/'}
        >
          Вход в Админ панель
        </button>

        {/* Sheet Selector */}
        <div className="flex flex-col gap-2">
          <p className="font-bold text-gray-700">📁 Выберите лист:</p>
          <select 
            className="border border-gray-200 rounded-md p-2 w-full bg-white outline-none focus:border-blue-500"
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
          >
            {lists.length === 0 && <option value="">Нет листов</option>}
            {lists.map(list => (
              <option key={list.id} value={list.id}>{list.name}</option>
            ))}
          </select>
        </div>

        {/* Search Bar */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по имени или последним 4 цифрам тел."
          className="bg-white border border-gray-200 rounded-xl p-3 w-full shadow-sm outline-none focus:border-blue-500"
        />

        {/* Data Cards Container */}
        <div className="flex flex-col gap-3 mt-2">
          {filteredCargoList.length === 0 ? (
            <p className="text-center text-gray-500">Нет данных</p>
          ) : (
            filteredCargoList.map((cargo, index) => (
              <div key={cargo.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-gray-800 text-lg">{cargo.name}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md w-fit ${getStatusColor(cargo.status)}`}>
                      {cargo.status || "Принято"}
                    </span>
                  </div>
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-md">
                    Стеллаж: {cargo.stillage}
                  </span>
                </div>
                {cargo.phone && (
                  <div className="text-sm text-gray-500 font-mono mt-1">
                    📞 {cargo.phone}
                  </div>
                )}
                <div className="flex gap-4 text-sm text-gray-600 mt-1 items-center">
                  <span>⚖️ {cargo.kg} кг</span>
                  <span>📦 {cargo.kub} куб</span>
                  <span className="font-bold text-green-700">💰 {cargo.totalPrice || 0} $</span>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
