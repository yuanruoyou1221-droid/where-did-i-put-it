import { useEffect, useMemo, useRef, useState } from "react";
import { pinyin } from "pinyin-pro";
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  CameraIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ImageSquareIcon,
  LeafIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MicrophoneIcon,
  NotePencilIcon,
  PackageIcon,
  PencilSimpleIcon,
  TrashIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";

const STORAGE_KEY = "wo-fang-na-le:items:v1";

const seedItems = [
  {
    id: "passport",
    name: "护照",
    location: "卧室衣柜上层蓝色盒子",
    note: "和签证材料放在一起",
    image: `${import.meta.env.BASE_URL}assets/passport-blue-box.png`,
    updatedAt: Date.now() - 24 * 60 * 1000,
  },
  {
    id: "spare-keys",
    name: "备用钥匙",
    location: "玄关抽屉第二格",
    note: "黑色钥匙扣，一共两把",
    image: `${import.meta.env.BASE_URL}assets/keys-entry-drawer.png`,
    updatedAt: Date.now() - 2 * 60 * 60 * 1000,
  },
];

const emptyDraft = { name: "", location: "", note: "", image: "" };

function loadItems() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : seedItems;
  } catch {
    return seedItems;
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  if (sameDay) return `今天 ${time}`;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s·•，。、“”‘’：:；;（）()\-_/\\]/g, "");
}

function phoneticForms(value) {
  const syllables = pinyin(String(value || ""), { toneType: "none", type: "array" });
  return {
    full: normalizeText(syllables.join("")),
    initials: normalizeText(syllables.map((part) => part[0] || "").join("")),
  };
}

function editDistance(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function isSubsequence(needle, haystack) {
  if (!needle) return true;
  let index = 0;
  for (const char of haystack) {
    if (char === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

function fieldMatches(value, rawToken) {
  const token = normalizeText(rawToken);
  if (!token) return true;
  const text = normalizeText(value);
  const { full, initials } = phoneticForms(value);
  if (text.includes(token) || full.includes(token) || initials.includes(token)) return true;
  if (token.length >= 3 && (isSubsequence(token, text) || isSubsequence(token, full))) return true;
  const distanceLimit = token.length >= 6 ? 2 : 1;
  return [text, full]
    .filter((candidate) => Math.abs(candidate.length - token.length) <= distanceLimit)
    .some((candidate) => editDistance(candidate, token) <= distanceLimit);
}

function itemMatches(item, query) {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const fields = [item.name, item.location, item.note];
  return tokens.every((token) => fields.some((field) => fieldMatches(field, token)));
}

function HighlightText({ text, query }) {
  const raw = String(text || "");
  const keyword = query.trim();
  if (!keyword) return raw;
  const index = raw.toLowerCase().indexOf(keyword.toLowerCase());
  if (index < 0) return raw;
  return (
    <>
      {raw.slice(0, index)}
      <mark>{raw.slice(index, index + keyword.length)}</mark>
      {raw.slice(index + keyword.length)}
    </>
  );
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function ItemVisual({ item, large = false }) {
  if (item.image) {
    return <img className={large ? "detail-photo" : "item-photo"} src={item.image} alt={large ? item.name : ""} />;
  }
  return (
    <span className={large ? "detail-placeholder" : "item-placeholder"} aria-label={`${item.name}暂未添加照片`}>
      <PackageIcon size={large ? 58 : 34} weight="duotone" aria-hidden="true" />
      {large ? <small>暂未添加照片</small> : <strong>{item.name.slice(0, 1)}</strong>}
    </span>
  );
}

function ItemRow({ item, onClick, query = "" }) {
  return (
    <button className="item-row" type="button" onClick={() => onClick(item)}>
      <ItemVisual item={item} />
      <span className="item-copy">
        <span className="item-title-line">
          <strong><HighlightText text={item.name} query={query} /></strong>
          <small>{formatTime(item.updatedAt)}</small>
        </span>
        <span className="item-location"><HighlightText text={item.location} query={query} /></span>
      </span>
      <CaretRightIcon className="row-caret" size={20} weight="bold" aria-hidden="true" />
    </button>
  );
}

function Sheet({ children, onClose, label, tall = false }) {
  return (
    <div className="sheet-layer" role="presentation" onMouseDown={onClose}>
      <section
        className={`sheet ${tall ? "sheet-tall" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        {children}
      </section>
    </div>
  );
}

export function App() {
  const [items, setItems] = useState(loadItems);
  const [query, setQuery] = useState("");
  const [activeSheet, setActiveSheet] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [listening, setListening] = useState(false);
  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const locationInputRef = useRef(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      setToast({ message: "照片较大，暂时无法保存到本机", duration: 2600 });
    }
  }, [items]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => {
      if (toast.kind === "undo-delete") setPendingDelete(null);
      setToast(null);
    }, toast.duration || 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!activeSheet) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setActiveSheet(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeSheet]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter((item) => itemMatches(item, query));
  }, [items, query]);

  const recentLocations = useMemo(() => {
    const unique = [];
    for (const item of [...items].sort((a, b) => b.updatedAt - a.updatedAt)) {
      const location = item.location?.trim();
      if (location && !unique.includes(location)) unique.push(location);
      if (unique.length === 4) break;
    }
    return unique;
  }, [items]);

  function showToast(message, options = {}) {
    if (pendingDelete && options.kind !== "undo-delete") setPendingDelete(null);
    setToast({ message, duration: options.duration || 2200, kind: options.kind || "status" });
  }

  function startSpeech(mode = "search") {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("当前浏览器暂不支持语音输入");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => showToast("没听清，再说一次试试");
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.replace(/[。！]/g, "");
      if (mode === "record") {
        setDraft((current) => ({ ...current, name: text }));
        setErrors((current) => ({ ...current, name: "" }));
      } else {
        setQuery(text);
      }
    };
    recognition.start();
  }

  function openRecord(item = null, useVoice = false) {
    setEditingId(item?.id || null);
    setDraft(item ? {
      name: item.name,
      location: item.location,
      note: item.note || "",
      image: item.image || "",
    } : emptyDraft);
    setErrors({});
    setActiveSheet("form");
    if (useVoice) window.setTimeout(() => startSpeech("record"), 250);
  }

  function saveRecord(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!draft.name.trim()) nextErrors.name = "请填写要记录的物品名称";
    if (!draft.location.trim()) nextErrors.location = "请填写具体存放位置";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      window.requestAnimationFrame(() => {
        const target = nextErrors.name ? nameInputRef.current : locationInputRef.current;
        target?.focus();
        target?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }

    if (editingId) {
      setItems((current) => current.map((item) => item.id === editingId ? {
        ...item,
        ...draft,
        name: draft.name.trim(),
        location: draft.location.trim(),
        updatedAt: Date.now(),
      } : item));
      showToast("位置已经更新");
    } else {
      setItems((current) => [{
        id: window.crypto?.randomUUID?.() || String(Date.now()),
        ...draft,
        name: draft.name.trim(),
        location: draft.location.trim(),
        updatedAt: Date.now(),
      }, ...current]);
      showToast("已经替你记住了");
    }
    setActiveSheet(null);
    setEditingId(null);
    setDraft(emptyDraft);
    setErrors({});
  }

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const image = await compressImage(file);
      setDraft((current) => ({ ...current, image }));
    } catch {
      showToast("这张照片暂时无法读取");
    }
    event.target.value = "";
  }

  function openDetail(item) {
    setSelectedItem(item);
    setActiveSheet("detail");
  }

  function deleteRecord() {
    if (!selectedItem) return;
    const index = items.findIndex((item) => item.id === selectedItem.id);
    setPendingDelete({ item: selectedItem, index: Math.max(index, 0) });
    setItems((current) => current.filter((item) => item.id !== selectedItem.id));
    setSelectedItem(null);
    setActiveSheet(null);
    setToast({ message: "记录已删除", duration: 5000, kind: "undo-delete" });
  }

  function undoDelete() {
    if (!pendingDelete) return;
    setItems((current) => {
      const next = [...current];
      next.splice(Math.min(pendingDelete.index, next.length), 0, pendingDelete.item);
      return next;
    });
    setPendingDelete(null);
    setToast({ message: "记录已恢复", duration: 2200, kind: "status" });
  }

  const homeItems = query.trim() ? filteredItems : items.slice(0, 2);

  return (
    <div className="app-stage">
      <main className="mobile-prototype">
        <header className="hero">
          <img src={`${import.meta.env.BASE_URL}assets/warm-home-header.png`} alt="" className="hero-image" />
          <div className="hero-copy">
            <h1>我放哪了</h1>
            <p className="hero-kicker"><LeafIcon size={18} weight="duotone" aria-hidden="true" />温暖生活搭子</p>
            <p className="hero-description">
              随手记下物品位置，轻松找到不着急。<br />
              记录只需<span>3秒</span>，找到大约<span>10秒</span>。
            </p>
          </div>
        </header>

        <section className="home-content">
          <label className={`search-box ${listening ? "is-listening" : ""}`}>
            <MagnifyingGlassIcon size={29} weight="regular" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="物品、位置或拼音都能找"
              aria-label="搜索物品"
            />
            {query ? (
              <button className="icon-button" type="button" onClick={() => setQuery("")} aria-label="清空搜索">
                <XIcon size={22} weight="bold" />
              </button>
            ) : (
              <button className="icon-button" type="button" onClick={() => startSpeech("search")} aria-label="语音搜索">
                <MicrophoneIcon size={28} weight="regular" />
              </button>
            )}
          </label>

          <div className="record-actions">
            <button className="record-main" type="button" onClick={() => openRecord()}>
              <CameraIcon size={31} weight="regular" aria-hidden="true" />
              <span>记一下放哪了</span>
            </button>
            <button className="record-voice" type="button" onClick={() => openRecord(null, true)} aria-label="用语音记录">
              <MicrophoneIcon size={29} weight="regular" />
            </button>
          </div>

          <section className="recent-section" aria-live="polite">
            <div className="section-heading">
              <h2>
                <ClockIcon size={24} weight="regular" aria-hidden="true" />
                {query.trim() ? `模糊找到 ${filteredItems.length} 条` : "最近记下"}
              </h2>
              {!query.trim() && (
                <button type="button" onClick={() => setActiveSheet("all")}>查看全部 <CaretRightIcon size={17} weight="bold" /></button>
              )}
            </div>

            <div className="item-list">
              {homeItems.length ? homeItems.map((item) => (
                <ItemRow key={item.id} item={item} onClick={openDetail} query={query} />
              )) : (
                <div className="empty-state">
                  <MagnifyingGlassIcon size={30} />
                  <strong>还没有找到相关记录</strong>
                  <span>试试物品名、位置、拼音或少输入一个字</span>
                </div>
              )}
            </div>
          </section>
        </section>

        {activeSheet === "form" && (
          <Sheet onClose={() => setActiveSheet(null)} label={editingId ? "修改物品记录" : "新增物品记录"} tall>
            <div className="sheet-header">
              <button className="sheet-close" type="button" onClick={() => setActiveSheet(null)} aria-label="返回"><ArrowLeftIcon size={24} weight="bold" /></button>
              <div><small>{editingId ? "更新位置" : "三秒记一下"}</small><h2>{editingId ? "修改这条记录" : "刚刚把什么放下了？"}</h2></div>
            </div>
            <form className="record-form" onSubmit={saveRecord} noValidate>
              <button className="photo-picker" type="button" onClick={() => fileInputRef.current?.click()}>
                {draft.image ? <img src={draft.image} alt="物品照片预览" /> : <><ImageSquareIcon size={31} weight="regular" /><span>拍张照片，更容易找（可选）</span></>}
              </button>
              <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={handlePhoto} />

              <label className={`field ${errors.name ? "has-error" : ""}`}>
                <span>物品名称</span>
                <div className="field-input has-action">
                  <input
                    ref={nameInputRef}
                    autoFocus
                    value={draft.name}
                    onChange={(event) => { setDraft({ ...draft, name: event.target.value }); setErrors({ ...errors, name: "" }); }}
                    placeholder="例如：护照"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "name-error" : undefined}
                  />
                  <button type="button" onClick={() => startSpeech("record")} aria-label="语音输入物品名称"><MicrophoneIcon size={22} /></button>
                </div>
                {errors.name && <small className="field-error" id="name-error" role="alert"><WarningCircleIcon size={16} weight="fill" />{errors.name}</small>}
              </label>

              <label className={`field ${errors.location ? "has-error" : ""}`}>
                <span>放在哪里</span>
                <div className="field-input">
                  <MapPinIcon size={21} />
                  <input
                    ref={locationInputRef}
                    value={draft.location}
                    onChange={(event) => { setDraft({ ...draft, location: event.target.value }); setErrors({ ...errors, location: "" }); }}
                    placeholder="房间、柜子、抽屉或盒子"
                    aria-invalid={Boolean(errors.location)}
                    aria-describedby={errors.location ? "location-error" : undefined}
                  />
                </div>
                {errors.location && <small className="field-error" id="location-error" role="alert"><WarningCircleIcon size={16} weight="fill" />{errors.location}</small>}
              </label>

              {recentLocations.length > 0 && (
                <div className="recent-locations" aria-label="最近使用的位置">
                  <span>最近用过</span>
                  <div>
                    {recentLocations.map((location) => (
                      <button
                        key={location}
                        type="button"
                        onClick={() => { setDraft({ ...draft, location }); setErrors({ ...errors, location: "" }); }}
                      >
                        {location}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="field">
                <span>补充一句</span>
                <div className="field-input"><NotePencilIcon size={21} /><input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="可选，例如：和签证材料放一起" /></div>
              </label>

              <button className="save-button" type="submit"><CheckCircleIcon size={24} weight="fill" />{editingId ? "保存新位置" : "帮我记住"}</button>
            </form>
          </Sheet>
        )}

        {activeSheet === "detail" && selectedItem && (
          <Sheet onClose={() => setActiveSheet(null)} label={`${selectedItem.name}的存放位置`}>
            <div className="detail-visual">
              <ItemVisual item={selectedItem} large />
              <button className="sheet-close detail-close" type="button" onClick={() => setActiveSheet(null)} aria-label="关闭"><XIcon size={22} weight="bold" /></button>
            </div>
            <div className="detail-body">
              <small>上次记在 · {formatTime(selectedItem.updatedAt)}</small>
              <h2>{selectedItem.name}</h2>
              <p className="detail-location"><MapPinIcon size={24} weight="fill" />{selectedItem.location}</p>
              {selectedItem.note && <p className="detail-note">“{selectedItem.note}”</p>}
              <div className="detail-actions">
                <button type="button" onClick={() => openRecord(selectedItem)}><PencilSimpleIcon size={21} /> 修改位置</button>
                <button className="danger-button" type="button" onClick={deleteRecord}><TrashIcon size={21} /> 删除</button>
              </div>
            </div>
          </Sheet>
        )}

        {activeSheet === "all" && (
          <Sheet onClose={() => setActiveSheet(null)} label="全部物品记录" tall>
            <div className="sheet-header all-header">
              <button className="sheet-close" type="button" onClick={() => setActiveSheet(null)} aria-label="返回"><ArrowLeftIcon size={24} weight="bold" /></button>
              <div><small>一共记住了 {items.length} 件</small><h2>全部物品</h2></div>
            </div>
            <div className="all-items">{items.map((item) => <ItemRow key={item.id} item={item} onClick={openDetail} />)}</div>
          </Sheet>
        )}

        {toast && (
          <div className={`toast ${toast.kind === "undo-delete" ? "toast-with-action" : ""}`} role="status" aria-live="polite">
            <span>{toast.message}</span>
            {toast.kind === "undo-delete" && pendingDelete && (
              <button type="button" onClick={undoDelete}><ArrowCounterClockwiseIcon size={18} weight="bold" />撤销</button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
