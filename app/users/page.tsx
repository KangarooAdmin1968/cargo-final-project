"use client";

import { useState, useEffect } from "react";
import { db } from "../../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
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
  createdAt: { toDate?: () => Date } | null;
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

const DOMAIN = "@kangaroo.com";

const STATUS_STYLES: Record<string, string> = {
  Принято: "bg-amber-100 text-amber-900 border-amber-200",
  "В пути": "bg-blue-100 text-blue-900 border-blue-200",
  "На складе": "bg-emerald-100 text-emerald-900 border-emerald-200",
  "На проверке": "bg-orange-100 text-orange-900 border-orange-200",
  Выдано: "bg-slate-100 text-slate-900 border-slate-200",
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
          h = Math.round(h * maxWidth / w);
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
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function clientId(phone: string) {
  return phone.replace(/\s+/g, "").replace(/\D/g, "");
}

function phoneToEmail(phone: string) {
  const normalized = phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  return `${normalized}${DOMAIN}`;
}

function emailToPhone(email: string | null) {
  if (!email) return "";
  return email.replace(DOMAIN, "");
}

function KangarooLogo() {
  return (
    <div className="flex items-center gap-3">
      <img src="/logo.jpg" alt="Kangaroo Cargo" className="w-12 h-12 md:w-16 md:h-16 rounded-xl object-cover border border-amber-300 shadow-sm" />
      <div className="flex flex-col">
        <span className="text-2xl font-extrabold tracking-tight text-amber-950">
          Kangaroo Cargo
        </span>
        <span className="text-xs md:text-sm text-amber-900 font-medium italic mt-0.5">
          Kangaroo Cargo — скорость и качество нашей работы отличают нас от других
        </span>
      </div>
    </div>
  );
}

function PromoBanner() {
  return (
    <div className="w-full bg-gradient-to-r from-amber-100 via-amber-50 to-white border-b-4 border-amber-400 px-4 py-5 md:py-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-2.5 rounded-full shadow-sm">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-amber-950 font-bold text-base md:text-lg leading-tight">
              Хотите такую же профессиональную и безопасную систему для управления вашим карго?
            </p>
            <p className="text-amber-800 text-sm mt-1">
              Свяжитесь с разработчиком:{" "}
              <span className="font-bold">Усар Дусарович</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 text-sm font-semibold text-amber-900 whitespace-nowrap">
          <a
            href="tel:+992939000049"
            className="bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-50 px-4 py-2 rounded-xl transition-colors"
          >
            +992 93 900 0049
          </a>
          <a
            href="tel:+992900414777"
            className="bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-50 px-4 py-2 rounded-xl transition-colors"
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
    if (!phone.trim()) return;
    if (!password) return;
    if (mode === "register" && password !== confirm) {
      alert("Пароли не совпадают");
      return;
    }
    if (mode === "login") {
      onLogin(phone, password);
    } else {
      onRegister(phone, password);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-xl border border-amber-100 p-6 md:p-8 overflow-hidden">
      <div className="flex flex-col items-center gap-2 mb-6">
        <div className="bg-amber-50 p-3 rounded-2xl">
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
          {loading
            ? "Подождите..."
            : mode === "login"
            ? "Войти"
            : "Зарегистрироваться"}
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

function SmsVerificationModal({
  phone,
  onConfirm,
  onCancel,
}: {
  phone: string;
  onConfirm: (code: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const testCode = "1111";

  return (
    <div className="fixed inset-0 bg-amber-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-amber-100">
        <div className="flex flex-col items-center gap-3 mb-5">
          <div className="bg-amber-100 p-3 rounded-full">
            <Smartphone className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="text-xl font-bold text-amber-950 text-center">Подтверждение SMS</h3>
          <p className="text-sm text-amber-800 text-center">
            Мы отправили код подтверждения на {phone}. Введите 4-значный код, чтобы завершить регистрацию.
          </p>
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2 rounded-lg text-center">
            Тестовый код для входа: <span className="font-bold">{testCode}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
            className="w-full text-center text-2xl tracking-[0.5em] py-3 bg-amber-50 border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-amber-950 placeholder:text-amber-300"
          />

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={() => {
                if (code.length !== 4) {
                  alert("Пожалуйста, введите 4-значный код");
                  return;
                }
                onConfirm(code);
              }}
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors"
            >
              Подтвердить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordResetModal({
  open,
  onClose,
  onVerifyPhone,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  onVerifyPhone: (phone: string) => Promise<void>;
  onReset: (phone: string, password: string) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const testCode = "1234";

  useEffect(() => {
    if (open) {
      setStep(1);
      setPhone("");
      setCode("");
      setNewPassword("");
      setConfirm("");
      setError("");
      setLoading(false);
      setShowPassword(false);
    }
  }, [open]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!phone.trim()) return;
    setLoading(true);
    try {
      await onVerifyPhone(phone);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Номер не найден");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (code !== testCode) {
      setError("Неверный код подтверждения");
      return;
    }
    setStep(3);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!newPassword) return;
    if (newPassword !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      await onReset(phone, newPassword);
      onClose();
    } catch (err: any) {
      setError(err.message || "Ошибка сброса пароля");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-amber-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-amber-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-amber-950">
            {step === 1 && "Восстановление пароля"}
            {step === 2 && "Код подтверждения"}
            {step === 3 && "Новый пароль"}
          </h3>
          <button
            onClick={onClose}
            className="text-amber-500 hover:text-amber-700"
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-700 text-sm p-3 rounded-xl border border-red-100 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-amber-800 text-center">
              Введите номер телефона, зарегистрированный в системе.
            </p>
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
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? "Проверка..." : "Продолжить"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-amber-800 text-center">
                Мы отправили код на {phone}. Введите 4-значный код.
              </p>
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2 rounded-lg text-center">
                Тестовый код: <span className="font-bold">{testCode}</span>
              </div>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="w-full text-center text-2xl tracking-[0.5em] py-3 bg-amber-50 border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-amber-950 placeholder:text-amber-300"
              required
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Назад
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors"
              >
                Подтвердить
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-amber-950">Новый пароль</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-amber-950">Повторите новый пароль</label>
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
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? "Сохранение..." : "Сохранить пароль"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function CargoCard({ cargo, index, onPay, paymentMethods }: { cargo: Cargo; index: number; onPay?: (cargo: Cargo) => void; paymentMethods: PaymentMethod[] }) {
  const linkedMethod = paymentMethods.find((m) => m.id === cargo.paymentMethodId);
  return (
    <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 text-amber-900 font-bold w-8 h-8 rounded-full flex items-center justify-center text-sm">
            {index + 1}
          </div>
          <div>
            <p className="font-bold text-amber-950 text-base">{cargo.name}</p>
            <p className="text-xs text-amber-700 font-medium">{cargo.phone}</p>
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
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <p className="text-xs font-semibold text-amber-800 mb-1">Трек-коды:</p>
          <p className="text-sm text-amber-900 font-mono whitespace-pre-wrap">{cargo.trackCodes}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <p className="text-xs text-slate-500 mb-0.5">Стеллаж</p>
          <p className="text-lg font-bold text-slate-800">{cargo.stillage}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <p className="text-xs text-slate-500 mb-0.5">Сумма</p>
          <p className="text-lg font-bold text-emerald-700">{cargo.totalPrice || 0} $</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <p className="text-xs text-slate-500 mb-0.5">Вес</p>
          <p className="text-base font-semibold text-slate-800">{cargo.kg} кг</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <p className="text-xs text-slate-500 mb-0.5">Объём</p>
          <p className="text-base font-semibold text-slate-800">{cargo.kub} куб</p>
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
    if (ok) {
      setCopied(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-amber-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-amber-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-amber-950">Оплата: {cargo.name}</h3>
          <button onClick={onClose} className="text-amber-500 hover:text-amber-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {method ? (
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-amber-800"><span className="font-bold">Банк:</span> {method.bankName}</p>
              <p className="text-sm text-amber-800 font-mono"><span className="font-bold">Карта:</span> {method.cardNumber}</p>
              <p className="text-sm text-amber-800"><span className="font-bold">Владелец:</span> {method.holderName}</p>
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

            <p className="text-sm text-amber-800 text-center leading-relaxed">
              Номер карты скопирован! Перейдите в мобильное приложение вашего банка, вставьте номер и переведите сумму.
            </p>
          </div>
        ) : (
          <p className="text-amber-800 text-center">Карта для оплаты не назначена. Свяжитесь с оператором.</p>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-amber-950 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Загрузить скриншот чека
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-amber-900 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-amber-100 file:text-amber-900 file:font-semibold hover:file:bg-amber-200"
          />
          {file && <p className="text-xs text-amber-700">Выбран: {file.name}</p>}
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
  const [client, setClient] = useState<{ email: string } | null>(null);
  const [clientPhone, setClientPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [pendingPhone, setPendingPhone] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  const [lists, setLists] = useState<CargoList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPayCargo, setSelectedPayCargo] = useState<Cargo | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("kc-client");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.email) {
          setClient(parsed);
        }
      } catch {
        localStorage.removeItem("kc-client");
      }
    }
  }, []);

  useEffect(() => {
    if (client) {
      localStorage.setItem("kc-client", JSON.stringify(client));
      setClientPhone(emailToPhone(client.email));
    } else {
      localStorage.removeItem("kc-client");
      setClientPhone("");
    }
  }, [client]);

  useEffect(() => {
    const q = query(
      collection(db, "lists"),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLists: CargoList[] = [];
      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as CargoList;
        if (!data.isPaymentCard) {
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
    const q = query(
      collection(db, "lists"),
      where("isPaymentCard", "==", true)
    );
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
    if (!selectedListId || !client) {
      setCargos([]);
      return;
    }

    const currentPhone = emailToPhone(client.email);
    const q = query(
      collection(db, "cargo"),
      where("listId", "==", selectedListId),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cargoData: Cargo[] = [];
      snapshot.forEach((doc) => {
        cargoData.push({ id: doc.id, ...doc.data() } as Cargo);
      });

      // Strict ownership check: only cargo where phone matches or contains the client phone
      const filtered = cargoData.filter((item) => {
        const itemPhone = (item.phone || "").replace(/\s+/g, "").replace(/[^0-9+]/g, "");
        const clientPhone = currentPhone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
        return itemPhone === clientPhone || itemPhone.includes(clientPhone) || clientPhone.includes(itemPhone);
      });

      setCargos(filtered);
    });

    return () => unsubscribe();
  }, [selectedListId, client]);

  const signInClient = (email: string) => {
    setClient({ email });
  };

  const handleLogin = async (phoneInput: string, password: string) => {
    setLoading(true);
    setError("");
    const id = clientId(phoneInput);
    try {
      const snap = await getDoc(doc(db, "clients", id));
      if (!snap.exists()) throw new Error("Неверный телефон или пароль");
      const data = snap.data() as { email?: string; password: string };
      if (data.password !== password) throw new Error("Неверный телефон или пароль");
      signInClient(data.email || phoneToEmail(phoneInput));
    } catch (err: any) {
      setError(err.message || "Неверный телефон или пароль");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (phoneInput: string, password: string) => {
    setLoading(true);
    setError("");
    const id = clientId(phoneInput);
    try {
      const existing = await getDoc(doc(db, "clients", id));
      if (existing.exists()) {
        throw new Error("Этот номер уже зарегистрирован. Пожалуйста, войдите в систему.");
      }
      setPendingPhone(phoneInput);
      setPendingPassword(password);
      setShowSmsModal(true);
    } catch (err: any) {
      setError(err.message || "Ошибка проверки номера");
    } finally {
      setLoading(false);
    }
  };

  const confirmRegistration = async (code: string) => {
    setShowSmsModal(false);
    setLoading(true);
    setError("");
    const id = clientId(pendingPhone);
    try {
      if (code !== "1111") throw new Error("Неверный код подтверждения");
      const existing = await getDoc(doc(db, "clients", id));
      if (existing.exists()) {
        throw new Error("Этот номер уже зарегистрирован. Пожалуйста, войдите в систему.");
      }
      await setDoc(doc(db, "clients", id), {
        phone: pendingPhone.trim(),
        email: phoneToEmail(pendingPhone),
        password: pendingPassword,
        createdAt: serverTimestamp(),
      });
      signInClient(phoneToEmail(pendingPhone));
    } catch (err: any) {
      setError(err.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
      setPendingPhone("");
      setPendingPassword("");
    }
  };

  const handleVerifyResetPhone = async (phoneInput: string) => {
    const id = clientId(phoneInput);
    const snap = await getDoc(doc(db, "clients", id));
    if (!snap.exists()) {
      throw new Error("Этот номер не зарегистрирован. Пожалуйста, зарегистрируйтесь.");
    }
  };

  const handleReset = async (phoneInput: string, newPassword: string) => {
    setLoading(true);
    setError("");
    const id = clientId(phoneInput);
    try {
      const clientSnap = await getDoc(doc(db, "clients", id));
      if (!clientSnap.exists()) {
        throw new Error("Номер не найден.");
      }
      const data = clientSnap.data() as { email?: string };
      await updateDoc(doc(db, "clients", id), { password: newPassword });
      signInClient(data.email || phoneToEmail(phoneInput));
    } catch (err: any) {
      setError(err.message || "Ошибка сброса пароля");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setClient(null);
    setCargos([]);
    setSelectedListId("");
  };

  const selectedList = lists.find((l) => l.id === selectedListId);

  const handleUploadReceipt = async (file: File, cargoId: string) => {
    try {
      setUploadingReceipt(true);
      const base64 = await compressImageToBase64(file);
      await updateDoc(doc(db, "cargo", cargoId), {
        receiptUrl: base64,
        status: "На проверке"
      });
      setSelectedPayCargo(null);
    } catch (err) {
      console.error("Receipt upload error:", err);
      alert("Ошибка при загрузке чека. Попробуйте более лёгкое изображение.");
    } finally {
      setUploadingReceipt(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      <PromoBanner />

      <header className="bg-white border-b border-amber-100 px-4 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <KangarooLogo />
          {client ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-bold text-amber-950">{clientPhone}</span>
                <span className="text-xs text-amber-600">Клиент</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl transition-colors"
                title="Выйти"
              >
                <LogOut className="w-5 h-5" />
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
          {!client ? (
            <AuthForm
              onLogin={handleLogin}
              onRegister={handleRegister}
              onForgot={() => setShowResetModal(true)}
              loading={loading}
              error={error}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-amber-950">Мои грузы</h1>
                  <p className="text-sm text-amber-700">Выберите последний рейс, чтобы увидеть свои посылки</p>
                </div>

                <div className="relative">
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500 pointer-events-none" />
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="appearance-none w-full sm:w-72 bg-white border border-amber-200 text-amber-950 font-semibold rounded-xl py-3 pl-4 pr-10 outline-none focus:ring-2 focus:ring-amber-500"
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
                  <p className="text-amber-900 font-semibold">Пока нет доступных рейсов</p>
                  <p className="text-sm text-amber-600">Загляните позже или свяжитесь с оператором</p>
                </div>
              )}

              {selectedListId && cargos.length === 0 && (
                <div className="bg-white rounded-3xl border border-amber-100 p-8 md:p-10 shadow-sm">
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="bg-amber-100 p-4 rounded-full">
                      <PackageOpen className="w-10 h-10 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-amber-950 mb-2">
                        Бори шумо дар ин рейс нест
                      </h3>
                      <p className="text-amber-800">
                        Интизори рейси навбатӣ бошед!
                      </p>
                    </div>
                    <div className="w-full h-px bg-amber-100 my-2" />
                    <div>
                      <h3 className="text-xl font-bold text-amber-950 mb-2">
                        Ушбу рейсда юкингиз мавжуд эмас
                      </h3>
                      <p className="text-amber-800">
                        Илтимос навбатдаги рейсгача кутинг.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {cargos.length > 0 && (
                <>
                  <div className="flex flex-col gap-3 md:hidden">
                    {cargos.map((cargo, idx) => (
                      <CargoCard key={cargo.id} cargo={cargo} index={idx} onPay={() => setSelectedPayCargo(cargo)} paymentMethods={paymentMethods} />
                    ))}
                  </div>

                  <div className="hidden md:block bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-amber-100 text-amber-900 text-sm uppercase font-bold">
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
                      <tbody className="divide-y divide-amber-50">
                        {cargos.map((cargo, idx) => (
                          <tr key={cargo.id} className="hover:bg-amber-50/50 transition-colors">
                            <td className="p-4 text-sm text-amber-700">{idx + 1}</td>
                            <td className="p-4 font-bold text-amber-950">{cargo.name}</td>
                            <td className="p-4 text-sm text-amber-800 font-mono">{cargo.phone}</td>
                            <td className="p-4 text-sm text-amber-900 font-mono whitespace-pre-wrap max-w-xs">
                              {cargo.trackCodes || "—"}
                            </td>
                            <td className="p-4 text-center">
                              <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
                                {cargo.stillage}
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
                            <td className="p-4 text-right text-sm text-amber-800">
                              {cargo.kg} кг / {cargo.kub} куб
                            </td>
                            <td className="p-4 text-center">
                              {cargo.status !== "Выдано" && (
                                <button
                                  onClick={() => setSelectedPayCargo(cargo)}
                                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  Оплатить
                                </button>
                              )}
                            </td>
                            <td className="p-4 text-right font-bold text-emerald-700">
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

      {showSmsModal && (
        <SmsVerificationModal
          phone={pendingPhone}
          onConfirm={confirmRegistration}
          onCancel={() => {
            setShowSmsModal(false);
            setPendingPhone("");
            setPendingPassword("");
          }}
        />
      )}

      {showResetModal && (
        <PasswordResetModal
          open={showResetModal}
          onClose={() => setShowResetModal(false)}
          onVerifyPhone={handleVerifyResetPhone}
          onReset={handleReset}
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

      <footer className="bg-amber-950 text-amber-100 px-4 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5" />
            <span className="font-bold">Kangaroo Cargo</span>
          </div>
          <p className="text-amber-300 text-center">
            Разработчик: <span className="font-bold text-white">Усар Дусарович</span>
          </p>
          <div className="flex gap-4">
            <a href="tel:+992939000049" className="hover:text-white transition-colors">
              +992 93 900 0049
            </a>
            <a href="tel:+992900414777" className="hover:text-white transition-colors">
              +992 90 041 4777
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
