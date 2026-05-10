"use client";
import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, where, getDocs } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import { Settings, Trash2, Plus, Search, Download, User, LogOut, Phone } from "lucide-react";

interface CargoList {
  id: string;
  name: string;
  createdAt: any;
}

interface CargoItem {
  id: string;
  listId: string;
  stillage: string;
  name: string;
  phone: string;
  kg: string;
  kub: string;
  createdAt: any;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authChecking, setAuthChecking] = useState(true);

  // List States
  const [lists, setLists] = useState<CargoList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [newListName, setNewListName] = useState("");

  // Cargo Form States
  const [stillage, setStillage] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [kg, setKg] = useState("");
  const [kub, setKub] = useState("");

  // Cargo Data and Search
  const [cargoList, setCargoList] = useState<CargoItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Auth Effect
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

  // Fetch Lists
  useEffect(() => {
    if (!isAuthenticated) return;
    const q = query(collection(db, "lists"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLists: CargoList[] = [];
      snapshot.forEach((doc) => {
        fetchedLists.push({ id: doc.id, ...doc.data() } as CargoList);
      });
      setLists(fetchedLists);

      // Auto-select first list if nothing selected
      if (fetchedLists.length > 0 && !selectedListId) {
        setSelectedListId(fetchedLists[0].id);
      } else if (fetchedLists.length === 0) {
        setSelectedListId("");
      }
    });
    return () => unsubscribe();
  }, [isAuthenticated, selectedListId]);

  // Fetch Cargo Items for Selected List
  useEffect(() => {
    if (!isAuthenticated || !selectedListId) {
      setCargoList([]);
      return;
    }
    const q = query(
      collection(db, "cargo"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: CargoItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as CargoItem);
      });
      setCargoList(items);
    });
    return () => unsubscribe();
  }, [isAuthenticated, selectedListId]);

  // Derived filtered cargo list
  const filteredCargoList = cargoList.filter((item) => {
    if (item.listId !== selectedListId) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const matchName = item.name.toLowerCase().includes(q);
    const phoneStr = item.phone || "";
    const matchPhone = phoneStr.includes(q);
    return matchName || matchPhone;
  });

  // Handlers
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

  const handleAddList = async () => {
    if (!newListName.trim()) {
      alert("Введите название листа");
      return;
    }
    try {
      const docRef = await addDoc(collection(db, "lists"), {
        name: newListName,
        createdAt: new Date()
      });
      setNewListName("");
      setSelectedListId(docRef.id);
    } catch (error) {
      console.error("Error adding list:", error);
      alert("Ошибка при создании листа");
    }
  };

  const handleDeleteList = async () => {
    if (!selectedListId) return;

    // Step 1 Confirmation
    const step1 = window.confirm("Вы уверены, что хотите удалить этот лист? Все данные в нем будут безвозвратно удалены!");
    if (!step1) return;

    // Step 2 Confirmation
    const step2 = window.confirm("Это действие невозможно отменить! Вы точно уверены?");
    if (!step2) return;

    try {
      // Find all cargo items associated with this list
      const q = query(collection(db, "cargo"), where("listId", "==", selectedListId));
      const querySnapshot = await getDocs(q);

      // Delete each cargo item
      const deletePromises = querySnapshot.docs.map(docSnapshot => deleteDoc(doc(db, "cargo", docSnapshot.id)));
      await Promise.all(deletePromises);

      // Delete the list itself
      await deleteDoc(doc(db, "lists", selectedListId));
      alert("Лист и все его данные успешно удалены.");
    } catch (error) {
      console.error("Error deleting list:", error);
      alert("Ошибка при удалении листа");
    }
  };

  const saveData = async () => {
    if (!selectedListId) {
      alert("Пожалуйста, выберите или создайте лист перед сохранением");
      return;
    }
    if (!stillage || !name || !phone || !kg || !kub) {
      alert("Please fill in all fields");
      return;
    }

    try {
      await addDoc(collection(db, "cargo"), {
        listId: selectedListId,
        stillage,
        name,
        phone,
        kg,
        kub,
        createdAt: new Date()
      });
      alert("Saved successfully!");
      setStillage("");
      setName("");
      setPhone("");
      setKg("");
      setKub("");
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Error saving data");
    }
  };

  const handleDeleteCargo = async (id: string) => {
    if (window.confirm("Вы уверены, что хотите удалить эту запись?")) {
      try {
        await deleteDoc(doc(db, "cargo", id));
      } catch (error) {
        console.error("Error deleting document: ", error);
        alert("Ошибка при удалении");
      }
    }
  };

  const handleExportExcel = () => {
    if (filteredCargoList.length === 0) {
      alert("Нет данных для экспорта");
      return;
    }

    const headers = ["№", "Name", "Phone", "Weight", "Volume", "Date"];
    const rows = filteredCargoList.map((item, index) => {
      const dateStr = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : "";
      return [
        index + 1,
        `"${item.name || ""}"`,
        `"${item.phone || ""}"`,
        `"${item.kg || ""}"`,
        `"${item.kub || ""}"`,
        `"${dateStr}"`
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "CargoExport.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          {/* List Management */}
          <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3 border border-gray-100">
            <p className="font-bold text-gray-700">📁 Выберите лист:</p>
            <div className="flex gap-2">
              <select
                className="p-2 border border-gray-200 rounded-md flex-1 outline-none focus:border-blue-500"
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
              >
                {lists.length === 0 && <option value="">Нет листов</option>}
                {lists.map(list => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
              <button
                onClick={handleDeleteList}
                disabled={!selectedListId}
                className="bg-red-500 rounded-md p-2 flex justify-center disabled:opacity-50 hover:bg-red-600 transition-colors"
                title="Удалить выбранный лист"
              >
                <Trash2 className="text-white w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <input
                placeholder="➕ Новый лист"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="p-2 border border-gray-200 rounded-md flex-1 outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddList}
                className="bg-blue-600 rounded-md px-4 py-2 text-white flex justify-center items-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-2 border border-gray-100">
            <Search className="text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Поиск по имени или последним 4 цифрам тел."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
            />
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportExcel}
            className="w-full bg-green-600 text-white p-3 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-green-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            Экспорт в Excel
          </button>

          {/* Data Entry Form */}
          <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-4 border border-gray-100">
            {/* Field 1: Stillage */}
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

            {/* Field 2: Name */}
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

            {/* Field 3: Phone */}
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1 font-bold text-sm text-gray-700">
                <Phone size={16} />
                Phone Number / Client ID
              </label>
              <input
                type="text"
                placeholder="+992 00 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500"
              />
            </div>

            {/* Field 4: Weight and Volume */}
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
            {filteredCargoList.length === 0 ? (
              <p className="text-gray-500 text-sm px-1">Список пуст или не найдено</p>
            ) : (
              filteredCargoList.map((item) => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex justify-between items-center gap-4">
                  <div className="flex flex-col flex-1 gap-1">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-gray-800">{item.name}</span>
                      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-md">
                        Стеллаж: {item.stillage}
                      </span>
                    </div>
                    {item.phone && (
                      <div className="text-sm text-gray-500 font-mono">
                        📞 {item.phone}
                      </div>
                    )}
                    <div className="flex gap-4 text-sm text-gray-600 mt-1">
                      <span>⚖️ {item.kg} кг</span>
                      <span>📦 {item.kub} куб</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCargo(item.id)}
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
