"use client";
import { useState, useEffect, useRef, ReactNode, useMemo } from "react";
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, where, getDocs, updateDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import { Settings, Trash2, Plus, Search, Package, Download, LogOut, Camera, X, CreditCard } from "lucide-react";
import * as XLSX from "xlsx";
import { Html5Qrcode } from "html5-qrcode";

interface CargoList {
  id: string;
  name: string;
  createdAt: { toDate?: () => Date } | null;
  isPaymentCard?: boolean;
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
  receivedBy?: string;
  paymentMethodId?: string;
  paymentCardNumber?: string;
  receiptUrl?: string;
  paymentVerified?: boolean;
  createdAt: { toDate?: () => Date } | null;
}

interface PaymentMethod {
  id: string;
  bankName: string;
  cardNumber: string;
  holderName: string;
  appScheme: string;
  createdAt?: { toDate?: () => Date } | null;
}

interface ClientDirectoryEntry {
  name: string;
  phone: string;
  nameKey: string;
  phoneKey: string;
  lastSeen: number;
}

function normalizeClientText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string): ReactNode {
  if (!query || !text) return text;
  const lowerQuery = query.toLowerCase();
  if (!text.toLowerCase().includes(lowerQuery)) return text;
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const pattern = new RegExp(`(${escapeRegExp(query)})`, "gi");
    const parts = line.split(pattern);
    return (
      <span key={lineIdx} className={lines.length > 1 ? "block" : undefined}>
        {parts.map((part, i) =>
          part.toLowerCase() === lowerQuery ? (
            <mark
              key={i}
              className="bg-yellow-300 text-amber-950 font-bold px-0.5 rounded"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  });
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authChecking, setAuthChecking] = useState(true);

  // List States
  const [lists, setLists] = useState<CargoList[]>([]);
  const [selectedListId, setSelectedListId] = useState("all");
  const [newListName, setNewListName] = useState("");

  // Rates States
  const [ratePerKg, setRatePerKg] = useState("0");
  const [ratePerVolume, setRatePerVolume] = useState("0");

  // Cargo Form States
  const [stillage, setStillage] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [trackCodes, setTrackCodes] = useState("");
  const [kg, setKg] = useState("");
  const [kub, setKub] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [isOtherReceivedBy, setIsOtherReceivedBy] = useState(false);
  const [customReceivedBy, setCustomReceivedBy] = useState("");

  // Edit Form States
  const [editForm, setEditForm] = useState<Partial<CargoItem> | null>(null);
  const [isEditOtherReceivedBy, setIsEditOtherReceivedBy] = useState(false);
  const [editCustomReceivedBy, setEditCustomReceivedBy] = useState("");

  // Payment Methods States
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [isCardManagerOpen, setIsCardManagerOpen] = useState(false);
  const [newCardBank, setNewCardBank] = useState("");
  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardHolder, setNewCardHolder] = useState("");
  const [addingCard, setAddingCard] = useState(false);
  const [selectedReceiptCargo, setSelectedReceiptCargo] = useState<CargoItem | null>(null);

  // Barcode Scanner States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<"add" | "edit">("add");
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [inputModeMenu, setInputModeMenu] = useState<{ show: boolean; target: "add" | "edit" } | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Cargo Data and Search
  const [cargos, setCargos] = useState<CargoItem[]>([]);
  const [clientDirectory, setClientDirectory] = useState<ClientDirectoryEntry[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTrackInput, setSearchTrackInput] = useState("");
  const [searchTrackQuery, setSearchTrackQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTrackQuery(searchTrackInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTrackInput]);

  const nextStillage = cargos.length + 1;

  // Auto-increment Stillage logic: Update state whenever the calculated nextStillage changes
  useEffect(() => {
    setStillage(String(nextStillage));
  }, [nextStillage]);

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
      snapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() } as CargoList;
        if (!data.isPaymentCard) {
          fetchedLists.push(data);
        }
      });
      setLists(fetchedLists);

      // Auto-select "all" by default as per state initialization
      if (fetchedLists.length > 0 && !selectedListId) {
        setSelectedListId("all");
      }
    });
    return () => unsubscribe();
  }, [isAuthenticated, selectedListId]);

  // Global client directory for autocomplete (all trips / all cargo)
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubscribe = onSnapshot(
      collection(db, "cargo"),
      (snapshot) => {
        const seen = new Map<string, ClientDirectoryEntry>();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Partial<CargoItem>;
          const clientName = String(data?.name ?? "").trim();
          const clientPhone = String(data?.phone ?? "").trim();
          if (!clientName) return;
          const createdAtField = data?.createdAt;
          const lastSeen =
            createdAtField && typeof createdAtField.toDate === "function"
              ? createdAtField.toDate().getTime()
              : 0;
          const nameKey = normalizeClientText(clientName);
          const phoneKey = digitsOnly(clientPhone);
          const key = `${nameKey}|${phoneKey}`;
          const existing = seen.get(key);
          if (!existing || lastSeen >= existing.lastSeen) {
            seen.set(key, {
              name: clientName,
              phone: clientPhone,
              nameKey,
              phoneKey,
              lastSeen,
            });
          }
        });
        setClientDirectory(
          Array.from(seen.values()).sort((a, b) => b.lastSeen - a.lastSeen)
        );
      },
      (error) => {
        console.error("Client directory listener error:", error);
      }
    );
    return () => unsubscribe();
  }, [isAuthenticated]);

  const selectClient = (client: { name: string; phone: string }) => {
    setName(client.name);
    setPhone(client.phone);
    setShowClientSuggestions(false);
  };

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

  // Fetch Payment Methods
  useEffect(() => {
    if (!isAuthenticated) return;
    const q = query(collection(db, "lists"), where("isPaymentCard", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const methods: PaymentMethod[] = [];
      snapshot.forEach((docSnap) => {
        methods.push({ id: docSnap.id, ...docSnap.data() } as PaymentMethod);
      });
      methods.sort((a, b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return tb - ta;
      });
      setPaymentMethods(methods);
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  // Fetch Cargo Items for Selected List - Sorted Ascending
  useEffect(() => {
    if (!isAuthenticated || !selectedListId) return;

    let q;
    if (selectedListId !== "all") {
      q = query(
        collection(db, "cargo"),
        where("listId", "==", selectedListId),
        orderBy("createdAt", "asc")
      );
    } else {
      q = query(
        collection(db, "cargo"),
        orderBy("createdAt", "asc")
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: CargoItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as CargoItem);
      });
      setCargos(items);
    });
    return () => unsubscribe();
  }, [isAuthenticated, selectedListId]);

  // Client name/phone autocomplete suggestions (global, all trips)
  const clientSuggestions = useMemo(() => {
    const q = normalizeClientText(name);
    if (!q || !showClientSuggestions) return [];
    const qDigits = digitsOnly(q);
    return clientDirectory
      .filter(
        (client) =>
          client.nameKey.includes(q) ||
          (qDigits.length > 0 && client.phoneKey.includes(qDigits))
      )
      .slice(0, 10);
  }, [clientDirectory, name, showClientSuggestions]);

  // Derived filtered cargo list
  const filteredCargoList = cargos.filter((item) => {
    if (selectedListId !== "all" && item.listId !== selectedListId) return false;
    const namePhoneQuery = searchQuery.toLowerCase();
    const trackQuery = searchTrackQuery.toLowerCase();
    const matchName = namePhoneQuery ? item.name.toLowerCase().includes(namePhoneQuery) : true;
    const phoneStr = item.phone || "";
    const matchPhone = namePhoneQuery ? phoneStr.toLowerCase().includes(namePhoneQuery) : true;
    const trackStr = item.trackCodes || "";
    const matchTrack = trackQuery ? trackStr.toLowerCase().includes(trackQuery) : true;
    return (matchName || matchPhone) && matchTrack;
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
    if (!selectedListId || selectedListId === "all") return;

    const step1 = window.confirm("Вы уверены, что хотите удалить этот лист? Все данные в нем будут безвозвратно удалены!");
    if (!step1) return;

    const step2 = window.confirm("Это действие невозможно отменить! Вы точно уверены?");
    if (!step2) return;

    try {
      const q = query(collection(db, "cargo"), where("listId", "==", selectedListId));
      const querySnapshot = await getDocs(q);

      const deletePromises = querySnapshot.docs.map(docSnapshot => deleteDoc(doc(db, "cargo", docSnapshot.id)));
      await Promise.all(deletePromises);

      await deleteDoc(doc(db, "lists", selectedListId));
      alert("Лист и все его данные успешно удалены.");
      setSelectedListId("all");
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
    let targetListId = selectedListId;

    if (!targetListId || targetListId === "all") {
      if (lists.length > 0) {
        targetListId = lists[0].id;
      } else {
        alert("Сначала создайте хотя бы один лист");
        return;
      }
    }

    // Kg and Kub are now optional
    if (!stillage || !name || !phone) {
      alert("Пожалуйста, заполните обязательные поля (Стеллаж, Название, Код/Телефон)");
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedMethod = paymentMethods.find((m) => m.id === selectedPaymentMethodId);
      const newCargoData = {
        listId: targetListId,
        stillage,
        name,
        phone,
        trackCodes,
        kg: kg || "0",
        kub: kub || "0",
        status: "Принято",
        totalPrice: parseFloat(totalPrice) || 0,
        receivedBy: isOtherReceivedBy ? customReceivedBy.trim() : receivedBy,
        paymentMethodId: selectedMethod?.id || "",
        paymentCardNumber: selectedMethod?.cardNumber || "",
        createdAt: new Date()
      };

      await addDoc(collection(db, "cargo"), newCargoData);

      // Reset form fields
      setName("");
      setPhone("");
      setTrackCodes("");
      setKg("");
      setKub("");
      setTotalPrice("");
      setReceivedBy("");
      setIsOtherReceivedBy(false);
      setCustomReceivedBy("");
      setSelectedPaymentMethodId("");
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Ошибка при сохранении данных");
    } finally {
      setIsSubmitting(false);
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

  const getAppScheme = (bankName: string) => {
    const name = bankName.trim().toLowerCase();
    if (name.includes("алиф") || name.includes("alif")) return "alifmobile://";
    if (name.includes("душанбе") || name.includes("dushanbe") || name.includes("сити") || name.includes("city")) return "dushanbecity://";
    if (name.includes("эсхата") || name.includes("eskhata")) return "eskhata://";
    return "";
  };

  const handleAddPaymentCard = async () => {
    if (!newCardBank.trim() || !newCardNumber.trim() || !newCardHolder.trim()) {
      alert("Заполните название банка, номер карты и владельца");
      return;
    }
    const bank = newCardBank.trim();
    const scheme = getAppScheme(bank);
    try {
      setAddingCard(true);
      await addDoc(collection(db, "lists"), {
        bankName: bank,
        cardNumber: newCardNumber.trim(),
        holderName: newCardHolder.trim(),
        appScheme: scheme,
        isPaymentCard: true,
        type: "payment_card",
        createdAt: new Date()
      });
      setNewCardBank("");
      setNewCardNumber("");
      setNewCardHolder("");
    } catch (error) {
      console.error("Error adding payment card:", error);
      alert("Ошибка при добавлении карты");
    } finally {
      setAddingCard(false);
    }
  };

  const handleDeletePaymentCard = async (id: string) => {
    if (!window.confirm("Удалить эту карту?")) return;
    try {
      await deleteDoc(doc(db, "lists", id));
    } catch (error) {
      console.error("Error deleting payment card:", error);
      alert("Ошибка при удалении карты");
    }
  };

  const handleConfirmPayment = async (cargo: CargoItem) => {
    try {
      await updateDoc(doc(db, "cargo", cargo.id), {
        status: "Выдано",
        paymentVerified: true
      });
      setSelectedReceiptCargo(null);
    } catch (error) {
      console.error("Error confirming payment:", error);
      alert("Ошибка при подтверждении оплаты");
    }
  };

  const handleEditChange = (field: keyof CargoItem, value: string | number | undefined) => {
    setEditForm((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };

      if (field === 'kg' || field === 'kub') {
        const w = parseFloat(field === 'kg' ? String(value) : (updated.kg || "0")) || 0;
        const v = parseFloat(field === 'kub' ? String(value) : (updated.kub || "0")) || 0;
        const rKg = parseFloat(ratePerKg) || 0;
        const rVol = parseFloat(ratePerVolume) || 0;
        const sum = (w * rKg) + (v * rVol);
        updated.totalPrice = sum > 0 ? parseFloat(sum.toFixed(2)) : 0;
      }
      return updated;
    });
  };

  const standardReceivers = ["Алиёр", "Худойберди", "Озод"];

  const openEditForm = (item: CargoItem) => {
    const isCustom = !!item.receivedBy && !standardReceivers.includes(item.receivedBy);
    setIsEditOtherReceivedBy(isCustom);
    setEditCustomReceivedBy(isCustom ? item.receivedBy! : "");
    setEditForm(isCustom ? { ...item, receivedBy: "Другой" } : item);
  };

  const handleUpdateCargo = async () => {
    if (!editForm || !editForm.id) return;
    try {
      const finalReceivedBy = isEditOtherReceivedBy
        ? editCustomReceivedBy.trim()
        : (editForm.receivedBy === "Другой" ? "" : editForm.receivedBy || "");
      const editMethod = paymentMethods.find((m) => m.id === editForm.paymentMethodId);
      await updateDoc(doc(db, "cargo", editForm.id), {
        name: editForm.name,
        phone: editForm.phone,
        trackCodes: editForm.trackCodes || "",
        stillage: editForm.stillage,
        kg: editForm.kg || "0",
        kub: editForm.kub || "0",
        status: editForm.status,
        totalPrice: parseFloat(String(editForm.totalPrice)) || 0,
        receivedBy: finalReceivedBy,
        paymentMethodId: editForm.paymentMethodId || "",
        paymentCardNumber: editMethod?.cardNumber || editForm.paymentCardNumber || ""
      });
      alert("Обновлено успешно!");
      setEditForm(null);
      setIsEditOtherReceivedBy(false);
      setEditCustomReceivedBy("");
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("Ошибка при обновлении");
    }
  };

  // Barcode Scanner Effect - Initialize and handle continuous scanning
  useEffect(() => {
    if (!isScannerOpen) return;

    const initializeScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            // Filter out Chinese routing QR garbage and short/invalid codes
            const isValidTracking = /^[a-zA-Z0-9-]{8,35}$/.test(decodedText);
            if (!isValidTracking) {
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(50);
              }
              return;
            }

            setScannedCodes((prev) => {
              if (prev.includes(decodedText)) {
                // Duplicate detected - vibrate lightly
                if (typeof navigator !== "undefined" && navigator.vibrate) {
                  navigator.vibrate(50);
                }
                return prev;
              }
              // New code - add to list and vibrate
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(100);
              }
              return [...prev, decodedText];
            });
          },
          (errorMessage) => {
            // Ignore scanning errors
          }
        );
      } catch (err) {
        console.error("Error initializing scanner:", err);
      }
    };

    initializeScanner();

    // Cleanup on unmount or when scanner closes
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch((err) => console.error("Error stopping scanner:", err));
        html5QrCodeRef.current = null;
      }
    };
  }, [isScannerOpen]);

  // Barcode Scanner Handlers
  const handleOpenInputMenu = (target: "add" | "edit") => {
    setInputModeMenu({ show: true, target });
  };

  const handleStartScanner = (target: "add" | "edit") => {
    setScannerMode(target);
    setScannedCodes([]);
    setIsScannerOpen(true);
    setInputModeMenu(null);
  };

  const handleCloseScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch((err) => console.error("Error stopping scanner:", err));
      html5QrCodeRef.current = null;
    }
    setIsScannerOpen(false);
    setScannedCodes([]);
  };

  const handleSaveScannedCodes = () => {
    const codesString = scannedCodes.join("\n");
    if (scannerMode === "add") {
      setTrackCodes((prev) => prev ? `${prev}\n${codesString}` : codesString);
    } else {
      handleEditChange('trackCodes', editForm?.trackCodes ? `${editForm.trackCodes}\n${codesString}` : codesString);
    }
    handleCloseScanner();
  };

  const handleRemoveScannedCode = (index: number) => {
    setScannedCodes((prev) => prev.filter((_, i) => i !== index));
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
        "Получил": item.receivedBy || "",
        "Сумма ($)": item.totalPrice || 0,
        "Дата": dateStr,
      };
    });

    let aliyor = 0;
    let khudoyberdi = 0;
    let ozod = 0;
    let unpaid = 0;

    filteredCargoList.forEach(item => {
      const price = item.totalPrice || 0;
      if (item.receivedBy === "Алиёр") aliyor += price;
      else if (item.receivedBy === "Худойберди") khudoyberdi += price;
      else if (item.receivedBy === "Озод") ozod += price;
      else unpaid += price;
    });

    exportData.push({} as any);
    exportData.push({} as any);

    exportData.push({ "Статус": "Всего собрал Алиёр:", "Сумма ($)": aliyor } as any);
    exportData.push({ "Статус": "Всего собрал Худойберди:", "Сумма ($)": khudoyberdi } as any);
    exportData.push({ "Статус": "Всего собрал Озод:", "Сумма ($)": ozod } as any);
    exportData.push({ "Статус": "Всего не оплачено:", "Сумма ($)": unpaid } as any);

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    const cols = [
      { wch: 5 },
      { wch: 25 },
      { wch: 20 },
      { wch: 40 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center text-black">
      <div className="w-full max-w-md lg:max-w-[1400px] bg-gray-50 min-h-screen shadow-sm relative">
        {/* Top Navigation */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.jpg" alt="Kangaroo Cargo" className="w-12 h-12 md:w-16 md:h-16 rounded-xl object-cover border border-amber-300 shadow-sm" />
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-gray-800">Kangaroo Cargo</h1>
                <span className="text-xs md:text-sm text-amber-900 font-medium italic mt-0.5">
                  Kangaroo Cargo — скорость и качество нашей работы отличают нас от других
                </span>
              </div>
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
                <option value="all">Все листы</option>
                {lists.map(list => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
              <button
                onClick={handleDeleteList}
                disabled={!selectedListId || selectedListId === "all"}
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

          {/* Payment Methods Manager */}
          <div className="bg-white rounded-xl p-4 shadow-sm flex flex-col gap-3 border border-gray-100">
            <button
              onClick={() => setIsCardManagerOpen(!isCardManagerOpen)}
              className="flex items-center justify-between w-full"
            >
              <p className="font-bold text-gray-700 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                💳 Способы оплаты
              </p>
              <span className="text-sm text-blue-600 font-medium">
                {isCardManagerOpen ? "Скрыть" : "Управлять"}
              </span>
            </button>
            {isCardManagerOpen && (
              <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
                {paymentMethods.length === 0 ? (
                  <p className="text-sm text-gray-500">Карты ещё не добавлены</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {paymentMethods.map((card) => (
                      <div key={card.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div>
                          <p className="font-bold text-black">{card.bankName}</p>
                          <p className="text-sm text-gray-600 font-mono">{card.cardNumber}</p>
                          <p className="text-xs text-gray-500">{card.holderName}</p>
                        </div>
                        <button
                          onClick={() => handleDeletePaymentCard(card.id)}
                          className="text-red-500 hover:text-red-600 p-2"
                          title="Удалить карту"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Алиф / Душанбе Сити / Эсхата"
                    value={newCardBank}
                    onChange={(e) => setNewCardBank(e.target.value)}
                    className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
                  />
                  <input
                    type="text"
                    placeholder="Номер карты"
                    value={newCardNumber}
                    onChange={(e) => setNewCardNumber(e.target.value)}
                    className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
                  />
                  <input
                    type="text"
                    placeholder="Имя владельца"
                    value={newCardHolder}
                    onChange={(e) => setNewCardHolder(e.target.value)}
                    className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
                  />
                  <button
                    onClick={handleAddPaymentCard}
                    disabled={addingCard}
                    className="bg-blue-600 text-white rounded-md px-4 py-2 font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {addingCard ? "Добавление..." : "Добавить карту"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 bg-white rounded-xl shadow-sm p-3 flex items-center gap-2 border border-gray-100">
              <Search className="text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="🔍 Поиск по имени / тел"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 bg-transparent outline-none text-black text-sm"
              />
            </div>
            <div className="flex-1 bg-white rounded-xl shadow-sm p-3 flex items-center gap-2 border border-gray-100">
              <Package className="text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="📦 Поиск по трек-коду"
                value={searchTrackInput}
                onChange={(e) => setSearchTrackInput(e.target.value)}
                className="flex-1 bg-transparent outline-none text-black text-sm"
              />
            </div>
          </div>

          {/* Data Entry Form */}
          <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col lg:flex-row lg:items-end gap-3 border border-gray-100">
            <div className="flex flex-col gap-1 w-full lg:w-24">
              <label className="font-bold text-sm text-gray-700">Стеллаж</label>
              <input
                type="text"
                placeholder="65"
                value={stillage}
                onChange={(e) => setStillage(e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              />
            </div>

            <div className="flex flex-col gap-1 w-full lg:flex-1 relative">
              <label className="font-bold text-sm text-gray-700">Название</label>
              <input
                type="text"
                placeholder="Имя"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setShowClientSuggestions(true);
                }}
                onFocus={() => setShowClientSuggestions(true)}
                onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              />
              {showClientSuggestions && clientSuggestions.length > 0 && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-[100] max-h-56 overflow-y-auto divide-y divide-slate-100"
                >
                  {clientSuggestions.map((client) => (
                    <div
                      key={`${client.nameKey}|${client.phoneKey}`}
                      onClick={() => selectClient(client)}
                      className="p-3 hover:bg-slate-50 active:bg-amber-50 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <span className="font-semibold text-slate-900 text-sm">{client.name}</span>
                      <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 border border-slate-200/60 px-2.5 py-1 rounded-lg">{client.phone}</span>
                    </div>
                  ))}
                </div>
              )}
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

            <div className="flex flex-col gap-1 w-full lg:flex-1 relative">
              <label className="font-bold text-sm text-gray-700">Трек-коды</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Трек-код"
                  value={trackCodes}
                  onChange={(e) => setTrackCodes(e.target.value)}
                  className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black pr-10"
                />
                <button
                  onClick={() => handleOpenInputMenu("add")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
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

            <div className="flex flex-col gap-1 w-full lg:w-28">
              <label className="font-bold text-sm text-gray-700">Сумма ($)</label>
              <input
                type="number"
                placeholder="0.00"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 font-bold text-black"
              />
            </div>

            <div className="flex flex-col gap-1 w-full lg:w-32">
              <label className="font-bold text-sm text-gray-700">Получил</label>
              <select
                value={isOtherReceivedBy ? "Другой" : receivedBy}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "Другой") {
                    setIsOtherReceivedBy(true);
                    setReceivedBy("");
                  } else {
                    setIsOtherReceivedBy(false);
                    setCustomReceivedBy("");
                    setReceivedBy(val);
                  }
                }}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black h-[42px]"
              >
                <option value="">—</option>
                <option value="Алиёр">Алиёр</option>
                <option value="Худойберди">Худойберди</option>
                <option value="Озод">Озод</option>
                <option value="Другой">Другой...</option>
              </select>
              {isOtherReceivedBy && (
                <input
                  type="text"
                  placeholder="Введите имя получателя"
                  value={customReceivedBy}
                  onChange={(e) => setCustomReceivedBy(e.target.value)}
                  className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black mt-1"
                />
              )}
            </div>

            <div className="flex flex-col gap-1 w-full lg:w-48">
              <label className="font-bold text-sm text-gray-700">Карта для оплаты</label>
              <select
                value={selectedPaymentMethodId}
                onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black h-[42px]"
              >
                <option value="">— Выберите карту —</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.bankName}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={saveData}
              disabled={isSubmitting}
              className="bg-blue-600 text-white p-2 lg:px-6 rounded-xl font-bold w-full lg:w-auto lg:h-[42px] hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Сохранение..." : "Сохранить"}
            </button>
          </div>

          {/* Cargo List Section */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-1">
              <h2 className="font-bold text-gray-800 text-lg">Список грузов</h2>
              <button
                onClick={handleExportExcel}
                className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-green-700 transition-colors w-full lg:w-auto"
              >
                <Download className="w-5 h-5" />
                Экспорт в Excel
              </button>
            </div>

            {filteredCargoList.length === 0 ? (
              <p className="text-gray-500 text-sm px-1">Список пуст или не найдено</p>
            ) : (
              <>
                {/* Desktop HTML Table View - Only visible on lg screens */}
                <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-700 whitespace-nowrap">
                    <thead className="text-xs text-gray-500 bg-gray-50 uppercase">
                      <tr>
                        <th className="px-4 py-3 border-b">№</th>
                        <th className="px-4 py-3 border-b">Name</th>
                        <th className="px-4 py-3 border-b">Phone</th>
                        <th className="px-4 py-3 border-b">Track Codes</th>
                        <th className="px-4 py-3 border-b">Stillage</th>
                        <th className="px-4 py-3 border-b">Weight</th>
                        <th className="px-4 py-3 border-b">Volume</th>
                        <th className="px-4 py-3 border-b">Status</th>
                        <th className="px-4 py-3 border-b">Получил</th>
                        <th className="px-4 py-3 border-b">Price</th>
                        <th className="px-4 py-3 border-b text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCargoList.map((item, idx) => (
                        <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3">{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-black">{highlightText(item.name, searchQuery)}</td>
                          <td className="px-4 py-3 text-black">{highlightText(item.phone, searchQuery)}</td>
                          <td className="px-4 py-3 text-black max-w-[200px] whitespace-pre-wrap break-words">{highlightText(item.trackCodes || "", searchTrackQuery)}</td>
                          <td className="px-4 py-3">
                            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-md">
                              {item.stillage}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-black">{item.kg}</td>
                          <td className="px-4 py-3 text-black">{item.kub}</td>
                          <td className="px-4 py-3">
                            <select
                              value={item.status || "Принято"}
                              onChange={(e) => handleStatusChange(item.id, e.target.value)}
                              className="text-sm p-1 border border-gray-200 rounded outline-none focus:border-blue-500 bg-transparent text-black"
                            >
                              <option value="Принято">Принято</option>
                              <option value="В пути">В пути</option>
                              <option value="На складе">На складе</option>
                              <option value="На проверке">На проверке</option>
                              <option value="Выдано">Выдано</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-black font-medium">{item.receivedBy || "—"}</td>
                          <td className="px-4 py-3 font-bold text-black">{item.totalPrice || 0} $</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-wrap gap-3 justify-end text-sm items-center">
                              {item.receiptUrl && !item.paymentVerified && (
                                <button
                                  onClick={() => setSelectedReceiptCargo(item)}
                                  className="bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold hover:bg-green-200 transition-colors"
                                >
                                  Посмотреть чек
                                </button>
                              )}
                              <button onClick={() => openEditForm(item)} className="text-blue-600 font-medium hover:underline">Изменить</button>
                              <button onClick={() => handleDeleteCargo(item.id)} className="text-red-600 font-medium hover:underline">Удалить</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View - Only visible on small screens */}
                <div className="lg:hidden flex flex-col gap-3">
                  {filteredCargoList.map((item) => (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-black">{highlightText(item.name, searchQuery)}</span>
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-md">
                          Стеллаж: {item.stillage}
                        </span>
                      </div>
                      <div className="text-sm text-black">
                        {highlightText(item.phone, searchQuery)}
                      </div>
                      {item.trackCodes && (
                        <div className="text-sm text-black">
                          Трек: {highlightText(item.trackCodes, searchTrackQuery)}
                        </div>
                      )}
                      <div className="flex gap-4 text-sm text-black mt-1 items-center font-medium">
                        <span>{item.kg} Kg</span>
                        <span>{item.kub} Kub</span>
                        <span className="font-bold">{item.totalPrice || 0} $</span>
                      </div>
                      <div className="mt-2 flex flex-wrap justify-between items-center gap-2">
                        <select
                          value={item.status || "Принято"}
                          onChange={(e) => handleStatusChange(item.id, e.target.value)}
                          className="text-sm p-1 border border-gray-200 rounded outline-none focus:border-blue-500 text-black"
                        >
                          <option value="Принято">Принято</option>
                          <option value="В пути">В пути</option>
                          <option value="На складе">На складе</option>
                          <option value="На проверке">На проверке</option>
                          <option value="Выдано">Выдано</option>
                        </select>
                        {item.receiptUrl && !item.paymentVerified && (
                          <button
                            onClick={() => setSelectedReceiptCargo(item)}
                            className="bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold text-xs hover:bg-green-200 transition-colors"
                          >
                            Чек
                          </button>
                        )}
                        <div className="flex gap-3 text-sm">
                          <button onClick={() => openEditForm(item)} className="text-blue-600 font-medium hover:underline">Изменить</button>
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

            <div className="flex flex-col gap-1 relative">
              <label className="font-bold text-sm text-gray-700">Трек-коды</label>
              <div className="relative">
                <textarea
                  value={editForm.trackCodes || ""}
                  onChange={(e) => handleEditChange('trackCodes', e.target.value)}
                  className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black h-32 pr-10"
                  placeholder="Сканируйте или введите трек-коды..."
                />
                <button
                  onClick={() => handleOpenInputMenu("edit")}
                  className="absolute right-2 top-8 text-gray-500 hover:text-blue-600"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
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
                <option value="На проверке">На проверке</option>
                <option value="Выдано">Выдано</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sm text-gray-700">Получил</label>
              <select
                value={isEditOtherReceivedBy ? "Другой" : (editForm.receivedBy || "")}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "Другой") {
                    setIsEditOtherReceivedBy(true);
                    handleEditChange('receivedBy', "Другой");
                  } else {
                    setIsEditOtherReceivedBy(false);
                    setEditCustomReceivedBy("");
                    handleEditChange('receivedBy', val);
                  }
                }}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              >
                <option value="">—</option>
                <option value="Алиёр">Алиёр</option>
                <option value="Худойберди">Худойберди</option>
                <option value="Озод">Озод</option>
                <option value="Другой">Другой...</option>
              </select>
              {isEditOtherReceivedBy && (
                <input
                  type="text"
                  placeholder="Введите имя получателя"
                  value={editCustomReceivedBy}
                  onChange={(e) => setEditCustomReceivedBy(e.target.value)}
                  className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black mt-1"
                />
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-bold text-sm text-gray-700">Карта для оплаты</label>
              <select
                value={editForm?.paymentMethodId || ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const method = paymentMethods.find((m) => m.id === id);
                  setEditForm((prev) => prev ? { ...prev, paymentMethodId: id, paymentCardNumber: method?.cardNumber || "" } : prev);
                }}
                className="border border-gray-200 rounded-md p-2 w-full outline-none focus:border-blue-500 text-black"
              >
                <option value="">— Выберите карту —</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.bankName}
                  </option>
                ))}
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

      {/* Receipt Modal */}
      {selectedReceiptCargo && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Чек оплаты</h2>
              <button onClick={() => setSelectedReceiptCargo(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            {selectedReceiptCargo.receiptUrl ? (
              <img src={selectedReceiptCargo.receiptUrl} alt="Чек" className="w-full rounded-lg object-contain max-h-[60vh]" />
            ) : (
              <p className="text-gray-500 text-center">Изображение чека не найдено</p>
            )}
            <button
              onClick={() => handleConfirmPayment(selectedReceiptCargo)}
              className="w-full bg-green-600 text-white p-3 rounded-xl font-bold hover:bg-green-700 transition-colors"
            >
              Подтвердить оплату
            </button>
          </div>
        </div>
      )}

      {/* Input Mode Menu */}
      {inputModeMenu && inputModeMenu.show && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center p-4 z-[60]" onClick={() => setInputModeMenu(null)}>
          <div className="bg-white rounded-xl shadow-lg p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-3 text-center">Выберите режим ввода</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setInputModeMenu(null)}
                className="bg-gray-100 text-gray-700 p-3 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Ввести вручную
              </button>
              <button
                onClick={() => handleStartScanner(inputModeMenu.target)}
                className="bg-blue-600 text-white p-3 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Сканировать камерой
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-black z-[70] flex flex-col">
          {/* Camera View - Top Half */}
          <div className="flex-1 relative bg-black">
            <div id="qr-reader" className="w-full h-full" />
            {/* Barcode Frame Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-64 h-32 border-2 border-green-500 rounded-lg">
                {/* Laser Effect */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 animate-pulse" style={{ animation: "scan 2s linear infinite" }} />
                <style jsx>{`
                  @keyframes scan {
                    0% { top: 0; }
                    50% { top: calc(100% - 2px); }
                    100% { top: 0; }
                  }
                `}</style>
              </div>
            </div>
            {/* Close Button */}
            <button
              onClick={handleCloseScanner}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scanned Codes List - Bottom Half */}
          <div className="h-1/2 bg-white flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">Отсканировано: {scannedCodes.length} шт.</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {scannedCodes.length === 0 ? (
                <p className="text-gray-500 text-center">Наведите камеру на штрих-код</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {scannedCodes.map((code, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
                    >
                      <span className="text-sm font-medium text-gray-800 truncate flex-1">{code}</span>
                      <button
                        onClick={() => handleRemoveScannedCode(index)}
                        className="ml-2 text-red-500 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Action Buttons */}
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={handleCloseScanner}
                className="flex-1 bg-gray-200 text-gray-700 p-3 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveScannedCodes}
                className="flex-1 bg-green-600 text-white p-3 rounded-xl font-bold hover:bg-green-700 transition-colors"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer Footer */}
      <footer className="mt-12 mb-6 text-center px-4 w-full">
        <p className="text-sm text-gray-500">
          Хотите такую же профессиональную систему для управления карго? Свяжитесь с разработчиком: Усар Дусарович (+992 93 900 0049, +992 90 041 4777)
        </p>
      </footer>
    </div>
  );
}
