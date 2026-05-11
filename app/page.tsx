"use client";
import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, where, getDocs, updateDoc, setDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import { Settings, Trash2, Plus, Search, Download, LogOut, Edit } from "lucide-react";
import * as XLSX from "xlsx";

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
  trackCodes?: string;
  kg: string;
  kub: string;
  status?: string;
  totalPrice?: number;
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

  // Rates States
  const [ratePerKg, setRatePerKg] = useState("0");
  const [ratePerVolume, setRatePerVolume] = useState("0");

  // Cargo Form States
  const [stillage, setStillage] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [trackCodes, setTrackCodes] = useState("");
  const [kg, setKg] = useState("");
  const [kub, setKub] = useState("");
  const [totalPrice, setTotalPrice] = useState("");

  // Edit Form States
  const [editForm, setEditForm] = useState<Partial<CargoItem> | null>(null);

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

  // Fetch Rates
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubscribe = onSnapshot(doc(db, "settings", "rates"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRatePerKg(data.ratePerKg || "0");
        setRatePerVolume(data.ratePerVolume || "0");
      }
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

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
    const trackStr = item.trackCodes || "";
    const matchTrack = trackStr.toLowerCase().includes(q);
    return matchName || matchPhone || matchTrack;
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

  const calculateTotalPrice = (w: string, v: string) => {
    const weightNum = parseFloat(w) || 0;
    const volNum = parseFloat(v) || 0;
    const rKgNum = parseFloat(ratePerKg) || 0;
    const rVolNum = parseFloat(ratePerVolume) || 0;
    const sum = (weightNum * rKgNum) + (volNum * rVolNum);
    if (sum > 0) {
      setTotalPrice(sum.toFixed(2));
    } else {
      setTotalPrice("");
    }
  };

  const handleKgChange = (val: string) => {
    setKg(val);
    calculateTotalPrice(val, kub);
  };

  const handleKubChange = (val: string) => {
    setKub(val);
    calculateTotalPrice(kg, val);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "cargo", id), { status: newStatus });
    } catch (error) {
      console.error("Error updating status: ", error);
      alert("Ошибка при обновлении статуса");
    }
  };

  const saveData = async () => {
    if (!selectedListId) {
      alert("Пожалуйста, выберите или создайте лист перед сохранением");
      return;
    }
    if (!stillage || !name || !phone || !kg || !kub) {
      alert("Please fill in all required fields (Stillage, Name, Phone, Kg, Kub)");
      return;
    }

    try {
      await addDoc(collection(db, "cargo"), {
        listId: selectedListId,
        stillage,
        name,
        phone,
        trackCodes,
        kg,
        kub,
        status: "Принято",
        totalPrice: parseFloat(totalPrice) || 0,
        createdAt: new Date()
      });

      const currentStillageNum = parseInt(stillage);
      if (!isNaN(currentStillageNum)) {
        setStillage(String(currentStillageNum + 1));
      } else {
        setStillage("");
      }

      setName("");
      setPhone("");
      setTrackCodes("");
      setKg("");
      setKub("");
      setTotalPrice("");
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

  const handleEditChange = (field: keyof CargoItem, value: any) => {
    setEditForm((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };

      // Auto-calculate total price if kg or kub changed
      if (field === 'kg' || field === 'kub') {
        const w = parseFloat(field === 'kg' ? value : (updated.kg || "0")) || 0;
        const v = parseFloat(field === 'kub' ? value : (updated.kub || "0")) || 0;
        const rKg = parseFloat(ratePerKg) || 0;
        const rVol = parseFloat(ratePerVolume) || 0;
        const sum = (w * rKg) + (v * rVol);
        updated.totalPrice = sum > 0 ? parseFloat(sum.toFixed(2)) : 0;
      }
      return updated;
    });
  };

  const handleUpdateCargo = async () => {
    if (!editForm || !editForm.id) return;
    try {
      await updateDoc(doc(db, "cargo", editForm.id), {
        name: editForm.name,
        phone: editForm.phone,
        trackCodes: editForm.trackCodes || "",
        stillage: editForm.stillage,
        kg: editForm.kg,
        kub: editForm.kub,
        status: editForm.status,
        totalPrice: parseFloat(editForm.totalPrice as any) || 0
      });
      alert("Обновлено успешно!");
      setEditForm(null);
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("Ошибка при обновлении");
    }
  };

  const handleExportExcel = () => {
    if (filteredCargoList.length === 0) {
      alert("Нет данных для экспорта");
      return;
    }

    const exportData = filteredCargoList.map((item, index) => {
      let dateStr = "";
      if (item.createdAt?.toDate) {
        const d = item.createdAt.toDate();
        // Add padding to ensure DD.MM.YYYY format exactly
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        dateStr = `${day}.${month}.${year}`;
      }

      return {
        "№": index + 1,
        "Название": item.name || "",
        "Телефон / ID": item.phone || "",
        "Трек-коды": item.trackCodes || "",
        "Вес (кг)": item.kg || "",
        "Объём (куб)": item.kub || "",
        "Статус": item.status || "Принято",
        "Сумма ($)": item.totalPrice || 0,
        "Дата": dateStr,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-width for columns
    const cols = [
      { wch: 5 },  // №
      { wch: 25 }, // Название
      { wch: 20 }, // Телефон / ID
      { wch: 25 }, // Трек-коды
      { wch: 10 }, // Вес (кг)
      { wch: 15 }, // Объём (куб)
      { wch: 15 }, // Статус
      { wch: 12 }, // Сумма ($)
      { wch: 15 }, // Дата
    ];
    worksheet["!cols"] = cols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cargo List");

    const date = new Date().toLocaleDateString("ru-RU").replace(/\./g, "-");
    const filename = `Cargo_Report_${date}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  if (authChecking) {
    return <div className="min-h-screen bg-gray-50 flex justify-center items-center text-black">Загрузка...</div>;
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
              className="border border-gray-200 p-3 rounded-xl outline-none focus:border-blue-500 w-full text-black"
              required
            />
            <input
              type="password"
              placeholder="Пароль"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="border border-gray-200 p-3 rounded-xl outline-none focus:border-blue-500 w-full text-black"
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
      {/* Responsive container */}
      <div className="w-full max-w-md lg:max-w-[1400px] bg-gray-50 min-h-screen shadow-sm relative">
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
        <main className="p-4 lg:p-6 flex flex-col gap-4">
          {/* List Management */}
          <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3 border border-gray-100">
            <p className="font-bold text-gray-700">📁 Выберите лист:</p>
            <div className="flex gap-2">
              <select
                className="p-2 border border-gray-200 rounded-md flex-1 outline-none focus:border-blue-500 text-black"
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
                className="p-2 border border-gray-200 rounded-md flex-1 outline-none focus:border-blue-500 text-black"
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
              placeholder="Поиск по имени, тел, трек-коду"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-black text-sm"
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
          <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col lg:flex-row lg:items-end gap-3 border border-gray-100">
            <div className="flex flex-col gap-1 w-full lg:w-20">
              <label className="font-bold text-sm text-gray-700">Стеллаж</label>
              <input
                type="text"
                placeholder="65"
                value={stillage}
                onChange={(e) => setStillage(e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              />
            </div>

            <div className="flex flex-col gap-1 w-full lg:flex-1">
              <label className="font-bold text-sm text-gray-700">Название</label>
              <input
                type="text"
                placeholder="Имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              />
            </div>

            <div className="flex flex-col gap-1 w-full lg:flex-1">
              <label className="font-bold text-sm text-gray-700">Код (Phone)</label>
              <input
                type="text"
                placeholder="+992 00 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              />
            </div>

            <div className="flex flex-col gap-1 w-full lg:flex-1">
              <label className="font-bold text-sm text-gray-700">Трек-коды</label>
              <input
                type="text"
                placeholder="Трек-код"
                value={trackCodes}
                onChange={(e) => setTrackCodes(e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              />
            </div>

            <div className="flex gap-2 w-full lg:w-auto">
              <div className="flex flex-col gap-1 flex-1 lg:w-16">
                <label className="font-bold text-sm text-gray-700">Kg</label>
                <input
                  type="text"
                  value={kg}
                  onChange={(e) => handleKgChange(e.target.value)}
                  className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1 lg:w-16">
                <label className="font-bold text-sm text-gray-700">Kub</label>
                <input
                  type="text"
                  value={kub}
                  onChange={(e) => handleKubChange(e.target.value)}
                  className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 w-full lg:w-24">
              <label className="font-bold text-sm text-gray-700">Сумма ($)</label>
              <input
                type="number"
                placeholder="0.00"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 font-bold text-black"
              />
            </div>

            <button
              onClick={saveData}
              className="bg-blue-600 text-white p-2 lg:px-6 rounded-xl font-bold w-full lg:w-auto lg:h-[42px] hover:bg-blue-700 transition-colors"
            >
              Сохранить
            </button>
          </div>

          {/* Cargo List */}
          <div className="flex flex-col gap-3">
            <h2 className="font-bold text-gray-800 text-lg px-1">Список грузов</h2>
            {filteredCargoList.length === 0 ? (
              <p className="text-gray-500 text-sm px-1">Список пуст или не найдено</p>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-700 whitespace-nowrap">
                    <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Название</th>
                        <th className="px-4 py-3">Код (Phone)</th>
                        <th className="px-4 py-3">Трек-коды</th>
                        <th className="px-4 py-3">Стеллаж</th>
                        <th className="px-4 py-3">Kg</th>
                        <th className="px-4 py-3">Kub</th>
                        <th className="px-4 py-3">Сумма ($)</th>
                        <th className="px-4 py-3">Статус</th>
                        <th className="px-4 py-3 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCargoList.map((item, idx) => (
                        <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3">{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-black">{item.name}</td>
                          <td className="px-4 py-3 text-black">{item.phone}</td>
                          <td className="px-4 py-3 text-black max-w-[150px] truncate" title={item.trackCodes}>{item.trackCodes}</td>
                          <td className="px-4 py-3">
                            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-md">
                              {item.stillage}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-black">{item.kg}</td>
                          <td className="px-4 py-3 text-black">{item.kub}</td>
                          <td className="px-4 py-3 font-bold text-black">{item.totalPrice || 0}</td>
                          <td className="px-4 py-3">
                            <select
                              value={item.status || "Принято"}
                              onChange={(e) => handleStatusChange(item.id, e.target.value)}
                              className="text-sm p-1 border border-gray-200 rounded outline-none focus:border-blue-500 bg-transparent text-black"
                            >
                              <option value="Принято">Принято</option>
                              <option value="В пути">В пути</option>
                              <option value="На складе">На складе</option>
                              <option value="Выдано">Выдано</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-3 justify-end text-sm">
                              <button onClick={() => setEditForm(item)} className="text-blue-600 font-medium hover:underline">Изменить</button>
                              <button onClick={() => handleDeleteCargo(item.id)} className="text-red-600 font-medium hover:underline">Удалить</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden flex flex-col gap-3">
                  {filteredCargoList.map((item) => (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-black">{item.name}</span>
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-md">
                          Стеллаж: {item.stillage}
                        </span>
                      </div>
                      <div className="text-sm text-black">
                        {item.phone}
                      </div>
                      {item.trackCodes && (
                        <div className="text-sm text-black">
                          Трек: {item.trackCodes}
                        </div>
                      )}
                      <div className="flex gap-4 text-sm text-black mt-1 items-center font-medium">
                        <span>{item.kg} Kg</span>
                        <span>{item.kub} Kub</span>
                        <span className="font-bold">{item.totalPrice || 0} $</span>
                      </div>
                      <div className="mt-2 flex justify-between items-center">
                        <select
                          value={item.status || "Принято"}
                          onChange={(e) => handleStatusChange(item.id, e.target.value)}
                          className="text-sm p-1 border border-gray-200 rounded outline-none focus:border-blue-500 text-black"
                        >
                          <option value="Принято">Принято</option>
                          <option value="В пути">В пути</option>
                          <option value="На складе">На складе</option>
                          <option value="Выдано">Выдано</option>
                        </select>
                        <div className="flex gap-3 text-sm">
                          <button onClick={() => setEditForm(item)} className="text-blue-600 font-medium hover:underline">Изменить</button>
                          <button onClick={() => handleDeleteCargo(item.id)} className="text-red-600 font-medium hover:underline">Удалить</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Edit Modal */}
      {editForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800">Редактировать груз</h2>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sm text-gray-700">Название</label>
              <input
                type="text"
                value={editForm.name || ""}
                onChange={(e) => handleEditChange('name', e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sm text-gray-700">Телефон / ID</label>
              <input
                type="text"
                value={editForm.phone || ""}
                onChange={(e) => handleEditChange('phone', e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sm text-gray-700">Трек-коды</label>
              <input
                type="text"
                value={editForm.trackCodes || ""}
                onChange={(e) => handleEditChange('trackCodes', e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sm text-gray-700">Номер стеллажа</label>
              <input
                type="text"
                value={editForm.stillage || ""}
                onChange={(e) => handleEditChange('stillage', e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="font-bold text-sm text-gray-700">Кг</label>
                <input
                  type="text"
                  value={editForm.kg || ""}
                  onChange={(e) => handleEditChange('kg', e.target.value)}
                  className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="font-bold text-sm text-gray-700">Куб</label>
                <input
                  type="text"
                  value={editForm.kub || ""}
                  onChange={(e) => handleEditChange('kub', e.target.value)}
                  className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sm text-gray-700">Итоговая сумма ($)</label>
              <input
                type="number"
                value={editForm.totalPrice || ""}
                onChange={(e) => handleEditChange('totalPrice', e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 font-bold text-black"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sm text-gray-700">Статус</label>
              <select
                value={editForm.status || "Принято"}
                onChange={(e) => handleEditChange('status', e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              >
                <option value="Принято">Принято</option>
                <option value="В пути">В пути</option>
                <option value="На складе">На складе</option>
                <option value="Выдано">Выдано</option>
              </select>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setEditForm(null)}
                className="flex-1 bg-gray-200 text-gray-700 p-3 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleUpdateCargo}
                className="flex-1 bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
