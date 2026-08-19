"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  updateDoc,
  doc,
  query,
  collection,
  onSnapshot,
  orderBy,
  where,
} from "firebase/firestore";
import {
  Boxes,
  ShieldCheck,
  UserCheck,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  ChevronDown,
  PackageOpen,
  Phone,
  AlertCircle,
  CreditCard,
  Copy,
  Upload,
  X,
} from "lucide-react";

interface CargoList {
  id: string;
  name: string;
  createdAt?: { toDate?: () => Date } | null;
  isClientAccount?: boolean;
  isPaymentCard?: boolean;
}

interface Cargo {
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
  paymentMethodId?: string;
  receiptUrl?: string;
  paymentVerified?: boolean;
  createdAt?: { toDate?: () => Date } | null;
}

interface PaymentMethod {
  id: string;
  bankName: string;
  cardNumber: string;
  holderName: string;
  appScheme?: string;
  createdAt?: { toDate?: () => Date } | null;
}

const STATUS_STYLES: Record<string, string> = {
  Принято: "bg-slate-100 text-slate-700 border-slate-200",
  "В пути": "bg-amber-100 text-amber-900 border-amber-200",
  "На складе": "bg-emerald-100 text-emerald-900 border-emerald-200",
  "На проверке": "bg-orange-100 text-orange-900 border-orange-200",
  Выдано: "bg-indigo-100 text-indigo-900 border-indigo-200",
};

function compressImageToBase64(file: File, maxWidth = 800, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject("SSR");
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Canvas error");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = (e.target?.result as string) || "";
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function phoneToEmail(phone: string) {
  return `${cleanPhone(phone)}@kangaroocargo.app`;
}

function emailToPhone(email: string | null) {
  if (!email) return "";
  return email.split("@")[0] || "";
}

function normalizePhoneForMatch(phone: string) {
  return phone.replace(/\D/g, "");
}

function KangarooLogo() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo.jpg"
        alt="Kangaroo Cargo"
        className="w-12 h-12 md:w-16 md:h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-md"
      />
      <div className="flex flex-col">
        <span className="text-2xl font-extrabold tracking-tight text-amber-950">
          Kangaroo Cargo
        </span>
        <span className="text-xs md:text-sm text-amber-900/80 font-medium italic mt-0.5">
          Kangaroo Cargo — скорость и качество нашей работы отличают нас от других
        </span>
      </div>
    </div>
  );
}

function PromoBanner() {
  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-lg border-b border-amber-500/30 px-4 py-4 md:py-5 shadow-lg">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-2.5 rounded-full shadow-md shadow-amber-500/30">
            <Smartphone className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <p className="text-amber-50 font-bold text-base md:text-lg leading-tight">
              Хотите такую же профессиональную и безопасную систему для управления вашим карго?
            </p>
            <p className="text-amber-200/80 text-sm mt-1">
              Свяжитесь с разработчиком: <span className="font-bold text-amber-400">Усар Дусарович</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 text-sm font-semibold whitespace-nowrap">
          <a
            href="tel:+992939000049"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl transition-colors shadow-md"
          >
            +992 93 900 0049
          </a>
          <a
            href="tel:+992900414777"
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl transition-colors shadow-md"
          >
            +992 90 041 4777
          </a>
        </div>
      </div>
    </div>
  );
}

function AuthForm({
  onLogin,
  onRegister,
  onForgot,
  loading,
  error,
}: {
  onLogin: (phone: string, password: string) => void;
  onRegister: (phone: string, password: string) => void;
  onForgot: () => void;
  loading: boolean;
  error: string;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) return;
    if (mode === "register" && password !== confirm) {
      alert("Пароли не совпадают");
      return;
    }
    if (mode === "login") onLogin(phone, password);
    else onRegister(phone, password);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl border border-amber-200 p-6 md:p-8 overflow-hidden">
      <div className="flex flex-col items-center gap-2 mb-6">
        <div className="bg-amber-100 p-3 rounded-2xl">
          {mode === "register" ? (
            <UserCheck className="w-10 h-10 text-amber-600" />
          ) : (
            <Boxes className="w-10 h-10 text-amber-600" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-amber-950 text-center">
          {mode === "login" ? "Вход в личный кабинет" : "Регистрация клиента"}
        </h2>
        <p className="text-sm text-amber-800 text-center">
          {mode === "login"
            ? "Войдите по номеру телефона и паролю"
            : "Создайте аккаунт по номеру телефона"}
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-700 text-sm p-3 rounded-xl border border-red-100 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-amber-950">Номер телефона</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+992 93 000 0000"
              className="w-full pl-10 pr-4 py-3 bg-amber-50 border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-amber-950 placeholder:text-amber-300"
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-amber-950">Пароль</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-11 py-3 bg-amber-50 border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-amber-950 placeholder:text-amber-300"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-700"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mode === "register" && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-amber-950">Повторите пароль</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-amber-50 border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-amber-950 placeholder:text-amber-300"
                required
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60"
        >
          {loading ? "Подождите..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-3 text-sm text-center">
        {mode === "login" && (
          <>
            <button
              type="button"
              onClick={() => setMode("register")}
              className="text-amber-700 hover:text-amber-900 font-medium"
            >
              Нет аккаунта? Зарегистрироваться
            </button>
            <button
              type="button"
              onClick={onForgot}
              className="text-amber-600 hover:text-amber-800"
            >
              Парольро фаромуш кардан?
            </button>
          </>
        )}
        {mode === "register" && (
          <button
            type="button"
            onClick={() => setMode("login")}
            className="text-amber-700 hover:text-amber-900 font-medium"
          >
            Уже есть аккаунт? Войти
          </button>
        )}
      </div>
    </div>
  );
}

function ForgotPasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-amber-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-amber-950">Восстановление пароля</h3>
          <button onClick={onClose} className="text-amber-500 hover:text-amber-700" type="button">
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-sm text-slate-700 mb-5 leading-relaxed">
          Для сброса пароля, пожалуйста, обратитесь к оператору или администратору карго по телефонам:
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="tel:+992939000049"
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors text-center"
          >
            +992 93 900 0049
          </a>
          <a
            href="tel:+992900414777"
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors text-center"
          >
            +992 90 041 4777
          </a>
        </div>

        <p className="text-xs text-slate-500 text-center mt-4">Нажмите на номер, чтобы позвонить</p>
      </div>
    </div>
  );
}

function CargoCard({
  cargo,
  index,
  onPay,
  paymentMethods,
}: {
  cargo: Cargo;
  index: number;
  onPay?: (cargo: Cargo) => void;
  paymentMethods: PaymentMethod[];
}) {
  const linkedMethod = paymentMethods.find((m) => m.id === cargo.paymentMethodId);
  const [copied, setCopied] = useState(false);

  const copyTrackCodes = async () => {
    if (!cargo.trackCodes) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(cargo.trackCodes);
      } else {
        const ta = document.createElement("textarea");
        ta.value = cargo.trackCodes;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-amber-100/60 shadow-md p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 text-amber-900 font-bold w-8 h-8 rounded-full flex items-center justify-center text-sm">
            {index + 1}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-base">{cargo.name}</p>
            <p className="text-xs text-slate-500 font-medium">{cargo.phone}</p>
          </div>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
            STATUS_STYLES[cargo.status || "Принято"] || STATUS_STYLES["Принято"]
          }`}
        >
          {cargo.status || "Принято"}
        </span>
      </div>

      {cargo.trackCodes && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-600">Трек-коды:</p>
            <button
              type="button"
              onClick={copyTrackCodes}
              className="text-amber-600 hover:text-amber-800 p-1 rounded-md hover:bg-amber-50 transition-colors"
              title="Скопировать"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {copied && (
            <p className="text-xs text-emerald-600 font-semibold mb-1">✅ Скопировано!</p>
          )}
          <p className="text-sm text-slate-800 font-mono whitespace-pre-wrap">{cargo.trackCodes}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col items-start">
          <p className="text-xs text-slate-500 mb-0.5">Стеллаж</p>
          <p className="text-lg font-bold text-slate-800">{cargo.stillage || "—"}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col items-start">
          <p className="text-xs text-slate-500 mb-0.5">Сумма</p>
          <p className="text-lg font-bold text-emerald-600">{cargo.totalPrice || 0} $</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col items-start">
          <p className="text-xs text-slate-500 mb-0.5">Вес</p>
          <p className="text-base font-semibold text-slate-800">{cargo.kg} кг</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col items-start">
          <p className="text-xs text-slate-500 mb-0.5">Объём</p>
          <p className="text-base font-semibold text-slate-800">{cargo.kub} м³</p>
        </div>
      </div>

      {cargo.status !== "Выдано" && onPay && (
        <button
          onClick={() => onPay(cargo)}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          {linkedMethod ? `Оплатить (${linkedMethod.bankName})` : "Оплатить (Душанбе Сити / Алиф / Эсхата)"}
        </button>
      )}
    </div>
  );
}

function PayModal({
  cargo,
  method,
  onClose,
  onUpload,
  uploading,
}: {
  cargo: Cargo;
  method?: PaymentMethod;
  onClose: () => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(t);
  }, [copied]);

  const copyCardNumber = async () => {
    if (!method) return;
    const text = method.cardNumber;
    let ok = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      } else if (typeof document !== "undefined") {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch (err) {
      console.error("Copy failed", err);
    }
    if (ok) setCopied(true);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-amber-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Оплата: {cargo.name}</h3>
          <button onClick={onClose} className="text-amber-500 hover:text-amber-700" type="button">
            <X className="w-6 h-6" />
          </button>
        </div>

        {method ? (
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col gap-3">
            <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-slate-500 font-medium">Банк</span>
                <span className="text-slate-900 font-semibold text-right">{method.bankName}</span>
                <span className="text-slate-500 font-medium">Карта</span>
                <span className="text-slate-900 font-mono text-right">{method.cardNumber}</span>
                <span className="text-slate-500 font-medium">Владелец</span>
                <span className="text-slate-900 font-semibold text-right">{method.holderName}</span>
              </div>
            </div>

            {copied && (
              <div className="bg-green-100 text-green-800 px-3 py-2 rounded-xl text-sm font-bold text-center">
                ✅ Номер карты скопирован в буфер обмена!
              </div>
            )}

            <button
              onClick={copyCardNumber}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              📋 Скопировать номер карты
            </button>

            <p className="text-sm text-slate-600 text-center leading-relaxed">
              Номер карты скопирован! Перейдите в мобильное приложение вашего банка, вставьте номер и переведите сумму.
            </p>
          </div>
        ) : (
          <p className="text-amber-800 text-center">Карта для оплаты не назначена. Свяжитесь с оператором.</p>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Загрузить скриншот чека
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-amber-100 file:text-amber-900 file:font-semibold hover:file:bg-amber-200"
          />
          {file && <p className="text-xs text-slate-500">Выбран: {file.name}</p>}
          <button
            onClick={() => file && onUpload(file)}
            disabled={!file || uploading}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {uploading ? "Отправка..." : "Отправить чек"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientPortal() {
  const [clientPhone, setClientPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);

  const [lists, setLists] = useState<CargoList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPayCargo, setSelectedPayCargo] = useState<Cargo | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.email?.endsWith("@kangaroocargo.app")) {
        const phone = emailToPhone(user.email);
        setClientPhone(phone);
        localStorage.setItem("kc-client", phone);
      } else {
        setClientPhone("");
        localStorage.removeItem("kc-client");
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "lists"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLists: CargoList[] = [];
      snapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() } as CargoList;
        if (!data.isClientAccount && !data.isPaymentCard) {
          fetchedLists.push(data);
        }
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

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!selectedListId || !clientPhone) {
      setCargos([]);
      return;
    }

    const currentClean = normalizePhoneForMatch(clientPhone);
    const q = query(collection(db, "cargo"), where("listId", "==", selectedListId), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cargoData: Cargo[] = [];
      snapshot.forEach((docSnap) => {
        cargoData.push({ id: docSnap.id, ...docSnap.data() } as Cargo);
      });

      const filtered = cargoData.filter((item) => {
        const itemPhone = normalizePhoneForMatch(item.phone || "");
        return itemPhone === currentClean || itemPhone.includes(currentClean) || currentClean.includes(itemPhone);
      });

      setCargos(filtered);
    });

    return () => unsubscribe();
  }, [selectedListId, clientPhone]);

  const handleLogin = async (phoneInput: string, password: string) => {
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, phoneToEmail(phoneInput), password);
    } catch (err: any) {
      const code = err.code || "";
      if (["auth/user-not-found", "auth/wrong-password", "auth/invalid-credential"].includes(code)) {
        setError("Неверный номер телефона или пароль.");
      } else {
        setError(err.message || "Ошибка входа");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (phoneInput: string, password: string) => {
    setLoading(true);
    setError("");
    try {
      await createUserWithEmailAndPassword(auth, phoneToEmail(phoneInput), password);
      const clean = cleanPhone(phoneInput);
      localStorage.setItem("kc-client", clean);
    } catch (err: any) {
      const code = err.code || "";
      if (code === "auth/email-already-in-use") {
        setError("Этот номер уже зарегистрирован. Пожалуйста, войдите в систему.");
      } else if (code === "auth/weak-password") {
        setError("Пароль должен содержать минимум 6 символов.");
      } else {
        setError(err.message || "Ошибка регистрации");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error("Logout error:", err);
    }
    setClientPhone("");
    setCargos([]);
    setSelectedListId("");
    setSelectedPayCargo(null);
    localStorage.removeItem("kc-client");
  };

  const selectedList = lists.find((l) => l.id === selectedListId);

  const handleUploadReceipt = async (file: File, cargoId: string) => {
    try {
      setUploadingReceipt(true);
      const base64 = await compressImageToBase64(file);
      await updateDoc(doc(db, "cargo", cargoId), {
        receiptUrl: base64,
        status: "На проверке",
      });
      setSelectedPayCargo(null);
    } catch (err) {
      console.error("Receipt upload error:", err);
      alert("Ошибка при загрузке чека. Попробуйте более лёгкое изображение.");
    } finally {
      setUploadingReceipt(false);
    }
  };

  const isLoggedIn = Boolean(clientPhone);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <PromoBanner />

      <header className="bg-white border-b border-amber-200/60 px-4 py-5 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <KangarooLogo />
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-bold text-slate-900">+{clientPhone}</span>
                <span className="text-xs text-amber-600 font-semibold">Клиент</span>
              </div>
              <span className="sm:hidden inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                Клиент
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors text-sm font-semibold"
                title="Выйти"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Выйти</span>
              </button>
            </div>
          ) : (
            <a
              href="/"
              className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-amber-700 hover:text-amber-900"
            >
              <ShieldCheck className="w-4 h-4" />
              Админ панель
            </a>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-6 md:py-8">
        <div className="max-w-5xl mx-auto">
          {!isLoggedIn ? (
            <AuthForm
              onLogin={handleLogin}
              onRegister={handleRegister}
              onForgot={() => setShowResetModal(true)}
              loading={loading}
              error={error}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="bg-white rounded-2xl border border-amber-200/60 p-4 md:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Мои грузы</h1>
                  <p className="text-sm text-slate-500">Выберите рейс, чтобы увидеть свои посылки</p>
                </div>

                <div className="relative">
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500 pointer-events-none" />
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="appearance-none w-full sm:w-72 bg-slate-50 border border-amber-200 text-slate-900 font-semibold rounded-xl py-3 pl-4 pr-10 outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {lists.length === 0 && <option value="">Нет рейсов</option>}
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!selectedListId && lists.length === 0 && (
                <div className="bg-white rounded-3xl border border-amber-100 p-10 text-center shadow-sm">
                  <PackageOpen className="w-14 h-14 text-amber-300 mx-auto mb-3" />
                  <p className="text-slate-900 font-semibold">Пока нет доступных рейсов</p>
                  <p className="text-sm text-slate-500">Загляните позже или свяжитесь с оператором</p>
                </div>
              )}

              {selectedListId && cargos.length === 0 && (
                <div className="bg-white rounded-3xl border border-amber-100 p-8 md:p-10 shadow-sm">
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="bg-amber-100 p-4 rounded-full">
                      <PackageOpen className="w-10 h-10 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">
                        Бори шумо дар ин рейс нест
                      </h3>
                      <p className="text-slate-600">Интизори рейси навбатӣ бошед!</p>
                    </div>
                    <div className="w-full h-px bg-amber-100 my-2" />
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">
                        Ушбу рейсда юкингиз мавжуд эмас
                      </h3>
                      <p className="text-slate-600">Илтимос навбатдаги рейсгача кутинг.</p>
                    </div>
                  </div>
                </div>
              )}

              {cargos.length > 0 && (
                <>
                  <div className="flex flex-col gap-4 md:hidden">
                    {cargos.map((cargo, idx) => (
                      <CargoCard
                        key={cargo.id}
                        cargo={cargo}
                        index={idx}
                        onPay={() => setSelectedPayCargo(cargo)}
                        paymentMethods={paymentMethods}
                      />
                    ))}
                  </div>

                  <div className="hidden md:block bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-900 text-sm uppercase font-bold">
                        <tr>
                          <th className="p-4">№</th>
                          <th className="p-4">Название</th>
                          <th className="p-4">Телефон</th>
                          <th className="p-4">Трек-коды</th>
                          <th className="p-4 text-center">Стеллаж</th>
                          <th className="p-4 text-center">Статус</th>
                          <th className="p-4 text-right">Вес / Объём</th>
                          <th className="p-4 text-center">Оплата</th>
                          <th className="p-4 text-right">Сумма</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cargos.map((cargo, idx) => (
                          <tr key={cargo.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-sm text-slate-500">{idx + 1}</td>
                            <td className="p-4 font-bold text-slate-900">{cargo.name}</td>
                            <td className="p-4 text-sm text-slate-600 font-mono">{cargo.phone}</td>
                            <td className="p-4 text-sm text-slate-700 font-mono whitespace-pre-wrap max-w-xs">
                              {cargo.trackCodes || "—"}
                            </td>
                            <td className="p-4 text-center">
                              <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
                                {cargo.stillage || "—"}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                  STATUS_STYLES[cargo.status || "Принято"] || STATUS_STYLES["Принято"]
                                }`}
                              >
                                {cargo.status || "Принято"}
                              </span>
                            </td>
                            <td className="p-4 text-right text-sm text-slate-600">
                              {cargo.kg} кг / {cargo.kub} м³
                            </td>
                            <td className="p-4 text-center">
                              {cargo.status !== "Выдано" && (
                                <button
                                  onClick={() => setSelectedPayCargo(cargo)}
                                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
                                  type="button"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  Оплатить
                                </button>
                              )}
                            </td>
                            <td className="p-4 text-right font-bold text-emerald-600">
                              {cargo.totalPrice || 0} $
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {showResetModal && (
        <ForgotPasswordModal
          open={showResetModal}
          onClose={() => setShowResetModal(false)}
        />
      )}

      {selectedPayCargo && (
        <PayModal
          cargo={selectedPayCargo}
          method={paymentMethods.find((m) => m.id === selectedPayCargo.paymentMethodId)}
          onClose={() => setSelectedPayCargo(null)}
          onUpload={(file) => handleUploadReceipt(file, selectedPayCargo.id)}
          uploading={uploadingReceipt}
        />
      )}

      <footer className="bg-slate-900 text-slate-200 px-4 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-white">Kangaroo Cargo</span>
          </div>
          <p className="text-amber-200/80 text-center">
            Разработчик: <span className="font-bold text-amber-400">Усар Дусарович</span>
          </p>
          <div className="flex gap-4">
            <a href="tel:+992939000049" className="hover:text-amber-400 transition-colors">
              +992 93 900 0049
            </a>
            <a href="tel:+992900414777" className="hover:text-amber-400 transition-colors">
              +992 90 041 4777
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
