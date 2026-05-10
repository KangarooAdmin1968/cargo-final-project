"use client";
import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from "firebase/firestore";

interface CargoItem {
  id: string;
  stillage: string;
  name: string;
  kg: string;
  kub: string;
  createdAt: any;
}
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import { Settings, Trash2, Plus, Search, Download, User, LogOut } from "lucide-react";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authChecking, setAuthChecking] = useState(true);

  const [stillage, setStillage] = useState("");
  const [name, setName] = useState("");
  const [kg, setKg] = useState("");
  const [kub, setKub] = useState("");
  const [cargoList, setCargoList] = useState<CargoItem[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const q = query(collection(db, "cargo"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const items: CargoItem[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as CargoItem);
      });
      setCargoList(items);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  const handleDelete = async (id: string) => {
    if (window.confirm("Вы уверены, что хотите удалить эту запись?")) {
      try {
        await deleteDoc(doc(db, "cargo", id));
      } catch (error) {
        console.error("Error deleting document: ", error);
        alert("Ошибка при удалении");
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error) {
      console.error(error);
      alert("Неверный email или пароль");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
  };

  const saveData = async () => {
    if (!stillage || !name || !kg || !kub) {
      alert("Please fill in all fields");
      return;
    }

    try {
      await addDoc(collection(db, "cargo"), {
        stillage,
        name,
        kg,
        kub,
        createdAt: new Date()
      });
      alert("Saved successfully!");
      setStillage("");
      setName("");
      setKg("");
      setKub("");
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Error saving data");
    }
  };

  if (authChecking) {
    return <div className="min-h-screen bg-gray-50 flex justify-center items-center">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-center mb-6">
            <Settings className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-8 text-gray-800">Вход в Админ панель</h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="border border-gray-200 p-3 rounded-xl outline-none focus:border-blue-500 w-full"
              required
            />
            <input
              type="password"
              placeholder="Пароль"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="border border-gray-200 p-3 rounded-xl outline-none focus:border-blue-500 w-full"
              required
            />
            <button type="submit" className="bg-blue-600 text-white font-bold p-3 rounded-xl w-full mt-2 hover:bg-blue-700 transition-colors">
              Войти
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      {/* Mobile-sized container */}
      <div className="w-full max-w-md bg-gray-50 min-h-screen shadow-sm relative">
        {/* Top Navigation */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-800">Админ панель</h1>
            </div>
            <button onClick={handleLogout} className="text-red-500 flex items-center gap-1 hover:text-red-600">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-6 flex flex-col gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3 border border-gray-100">
            <p className="font-bold text-gray-700">📁 Выберите лист:</p>
            <select className="p-2 border border-gray-200 rounded-md w-full outline-none focus:border-blue-500">
              <option>31/07</option>
            </select>
            <button className="bg-red-500 rounded-md p-2 flex justify-center w-full hover:bg-red-600 transition-colors">
              <Trash2 className="text-white w-5 h-5" />
            </button>
            <input
              placeholder="➕ Новый лист"
              className="p-2 border border-gray-200 rounded-md w-full outline-none focus:border-blue-500"
            />
            <button className="bg-blue-600 rounded-md p-2 text-white flex justify-center items-center gap-2 w-full hover:bg-blue-700 transition-colors">
              <Plus className="w-5 h-5" />
              Добавить
            </button>
          </div>

          {/* Search Bar */}
          <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-2 border border-gray-100">
            <Search className="text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Поиск по имени или последним 4 цифрам"
              className="flex-1 bg-transparent outline-none text-gray-700"
            />
          </div>

          {/* Export Button */}
          <button className="w-full bg-green-600 text-white p-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-green-700 transition-colors">
            <Download className="w-5 h-5" />
            Экспорт в Excel
          </button>

          {/* Data Entry Form */}
          <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-4 border border-gray-100">
            {/* Field 1 */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-sm text-gray-700">№ Номер стеллажа</label>
              <input
                type="text"
                placeholder="65"
                value={stillage}
                onChange={(e) => setStillage(e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500"
              />
            </div>

            {/* Field 2 */}
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1 font-bold text-sm text-gray-700">
                <User size={16} />
                Название
              </label>
              <input
                type="text"
                placeholder="Введите имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500"
              />
            </div>

            {/* Field 3 */}
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="font-bold text-sm text-gray-700">Кг</label>
                <input
                  type="text"
                  value={kg}
                  onChange={(e) => setKg(e.target.value)}
                  className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="font-bold text-sm text-gray-700">Куб</label>
                <input
                  type="text"
                  value={kub}
                  onChange={(e) => setKub(e.target.value)}
                  className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={saveData}
              className="bg-blue-600 text-white p-3 rounded-xl font-bold mt-2 w-full hover:bg-blue-700 transition-colors"
            >
              Сохранить данные
            </button>
          </div>

          {/* Cargo List */}
          <div className="flex flex-col gap-3">
            <h2 className="font-bold text-gray-800 text-lg px-1">Список грузов</h2>
            {cargoList.length === 0 ? (
              <p className="text-gray-500 text-sm px-1">Список пуст</p>
            ) : (
              cargoList.map((item) => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex justify-between items-center gap-4">
                  <div className="flex flex-col flex-1 gap-1">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-gray-800">{item.name}</span>
                      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-md">
                        Стеллаж: {item.stillage}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-600 mt-1">
                      <span>⚖️ {item.kg} кг</span>
                      <span>📦 {item.kub} куб</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
