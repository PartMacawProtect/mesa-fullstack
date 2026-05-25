import React, { useState, useRef, useEffect } from "react";
import { Language, Message, Contact } from "../types";
import { translations } from "../locales";
import { generateKeyPair, encryptMessage, decryptMessage } from "../utils/crypto";
import { 
  MessageSquare, 
  Users, 
  Settings as SettingsIcon, 
  Info, 
  Plus, 
  LogOut, 
  Send, 
  Smile, 
  Search, 
  X,
  Check,
  MoreVertical,
  Pin,
  Trash2,
  Edit3,
  Lock
} from "lucide-react";

interface ToggleProps {
  active: boolean;
  onChange: (val: boolean) => void;
}

const Toggle = ({ active, onChange }: ToggleProps) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        active ? "bg-[#1D1B84]" : "bg-slate-200 dark:bg-slate-700"
      }`}
    >
      <span
        className={`pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
          active ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
};

const renderAvatar = (name: string, avatarUrl?: string, sizeClass: string = "w-12 h-12 text-sm") => {
  const isCustomAvatar = avatarUrl && avatarUrl.startsWith("data:");
  if (isCustomAvatar) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover border border-[#E2E8F0] dark:border-slate-800`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Generate initials
  const trimmed = (name || "?").trim();
  const parts = trimmed.split(/\s+/);
  let initials = "";
  if (parts.length > 0) {
    if (parts.length === 1) {
      initials = parts[0].substring(0, Math.min(2, parts[0].length));
    } else {
      initials = (parts[0][0] || "") + (parts[1] && parts[1][0] ? parts[1][0] : "");
    }
  }
  initials = initials.toUpperCase();

  return (
    <div className={`${sizeClass} rounded-full bg-slate-250 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold tracking-tight select-none shrink-0 uppercase border border-slate-300 dark:border-slate-700`}>
      {initials || "?"}
    </div>
  );
};

const formatTimeByLang = (dateStrOrDate: string | Date, lang: Language): string => {
  if (typeof dateStrOrDate === "string") {
    const match = dateStrOrDate.match(/(\d+):(\d+)(?:\s*(AM|PM))?/i);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2];
      const ampm = match[3];
      
      if (lang === "RU") {
        if (ampm) {
          if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
          if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
        }
        return `${String(hours).padStart(2, '0')}:${minutes}`;
      } else {
        if (!ampm) {
          const suffix = hours >= 12 ? " PM" : " AM";
          const displayHours = hours % 12 === 0 ? 12 : hours % 12;
          return `${displayHours}:${minutes}${suffix}`;
        }
        return `${hours}:${minutes} ${ampm.toUpperCase()}`;
      }
    }
    return dateStrOrDate;
  }
  
  const hours = dateStrOrDate.getHours();
  const minutes = String(dateStrOrDate.getMinutes()).padStart(2, '0');
  if (lang === "RU") {
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  } else {
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutes} ${ampm}`;
  }
};

interface ChatViewProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  userEmail: string;
  userName: string;
  onLogout: () => void;
  setUserName: (name: string) => void;
}

export default function ChatView({ 
  language, 
  onLanguageChange, 
  userEmail, 
  userName, 
  onLogout,
  setUserName 
}: ChatViewProps) {
  const t = translations[language];

  // Tab State: "chats" | "contacts" | "settings"
  const [currentTab, setCurrentTab] = useState<"chats" | "contacts" | "settings">("chats");
  
  // Settings view submenu category
  const [activeSettingsCategory, setActiveSettingsCategory] = useState<"profile" | "language" | "notifications">("profile");

  // Local settings options states
  const [silentMode, setSilentMode] = useState(false);
  const [hideBadges, setHideBadges] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState(userName || "Alex Rivera");

  // New settings states based on mockup
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [privacyEnabled, setPrivacyEnabled] = useState(false);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    language === "EN" ? "Focused" : "В фокусе"
  );

  // Real User Bio state
  const [userBio, setUserBio] = useState(() => 
    localStorage.getItem("mesa_user_bio") || 
    (language === "EN" ? "In search of absolute calm." : "В поиске абсолютного спокойствия.")
  );

  // Real Avatar state
  const [userAvatar, setUserAvatar] = useState(
    localStorage.getItem("mesa_user_avatar") || ""
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Context menus & interaction states
  const [activeChatOptionContactId, setActiveChatOptionContactId] = useState<string | null>(null);
  const [chatOptionPosition, setChatOptionPosition] = useState<{ x: number; y: number } | null>(null);

  const [contextedMessage, setContextedMessage] = useState<Message | null>(null);
  const [messageContextMenuPos, setMessageContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const [renameContactId, setRenameContactId] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState("");

  const [deleteChatContactId, setDeleteChatContactId] = useState<string | null>(null);
  const [deleteChatForEveryone, setDeleteChatForEveryone] = useState(false);

  const [deleteMessageObj, setDeleteMessageObj] = useState<Message | null>(null);
  const [deleteMsgForEveryone, setDeleteMsgForEveryone] = useState(false);

  // Synchronize dynamic message seen counts for unread badge metrics
  const [lastSeenCount, setLastSeenCount] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("mesa_last_seen_count");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [userKeyPair, setUserKeyPair] = useState<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | null>(null);

  useEffect(() => {
    if (!userEmail) return;
    const fetchOrCreateKeys = async () => {
      const storageKey = `mesa_e2e_keys_${userEmail.toLowerCase().trim()}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setUserKeyPair(JSON.parse(saved));
          return;
        } catch (e) {
          console.error("Failed to parse saved keys", e);
        }
      }

      // Generate new E2EE RSA key pair
      try {
        const keys = await generateKeyPair();
        const keyObj = { publicKey: keys.publicKeyJwk, privateKey: keys.privateKeyJwk };
        localStorage.setItem(storageKey, JSON.stringify(keyObj));
        setUserKeyPair(keyObj);
      } catch (err) {
        console.error("Error generating key pair", err);
      }
    };
    fetchOrCreateKeys();
  }, [userEmail]);

  // Sync Dark Theme class with system or user preference
  useEffect(() => {
    const isDarkSaved = localStorage.getItem("mesa_dark_mode") === "true";
    setDarkModeEnabled(isDarkSaved);
    document.documentElement.classList.toggle("dark", isDarkSaved);

    const handleGlobalClick = () => {
      setActiveChatOptionContactId(null);
      setChatOptionPosition(null);
      setContextedMessage(null);
      setMessageContextMenuPos(null);
    };
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("contextmenu", handleGlobalContextMenu);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("contextmenu", handleGlobalContextMenu);
    };
  }, []);

  const handleToggleDarkMode = (val: boolean) => {
    setDarkModeEnabled(val);
    document.documentElement.classList.toggle("dark", val);
    localStorage.setItem("mesa_dark_mode", String(val));
    showChatToast(val 
      ? (language === "EN" ? "Dark theme enabled!" : "Темная тема включена!") 
      : (language === "EN" ? "Light theme enabled!" : "Светлая тема включена!")
    );
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setUserAvatar(reader.result);
          localStorage.setItem("mesa_user_avatar", reader.result);
          showChatToast(language === "EN" ? "Avatar successfully updated!" : "Аватар успешно обновлен!");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Update profile input if parent name changes
  useEffect(() => {
    if (userName) {
      setProfileNameInput(userName);
    } else {
      setProfileNameInput("Alex Rivera");
    }
  }, [userName]);

  // Toast status inside ChatView
  const [chatToast, setChatToast] = useState("");
  const showChatToast = (msg: string) => {
    setChatToast(msg);
    setTimeout(() => {
      setChatToast("");
    }, 3000);
  };

  // Contacts loaded dynamically and updated via sync endpoint
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Dynamic Contact Bios Map updated via sync
  const [contactBios, setContactBios] = useState<Record<string, { email: string; phone: string; bio: string }>>({});

  // Current Active Contact in chats view
  const [activeContactId, setActiveContactId] = useState<string | null>(null);

  // Selected Contact for details screen on Contacts tab
  const [selectedContactDetailedId, setSelectedContactDetailedId] = useState<string | null>(null);

  // In-messenger messages map per contact id
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});

  // Real-time synchronization of contacts and messages from backend
  useEffect(() => {
    if (!userEmail) return;

    let isMounted = true;

    const syncMetadata = async () => {
      try {
        // 0. Heartbeat pulse to report online status and save profile details
        await fetch("/api/users/pulse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userEmail,
            username: userName,
            avatar: userAvatar,
            statusMessage: statusMessage,
            bio: userBio,
            publicKey: userKeyPair ? JSON.stringify(userKeyPair.publicKey) : undefined
          })
        }).catch(err => console.error("Pulse heartbeat error:", err));

        // 1. Fetch contacts
        const contactsRes = await fetch(`/api/users/contacts?email=${encodeURIComponent(userEmail)}`);
        if (!contactsRes.ok) return;
        const contactsData = await contactsRes.json();
        
        if (contactsData.success && isMounted) {
          const fetchedContacts: Contact[] = contactsData.contacts;
          setContacts(fetchedContacts);

          // Auto-select first contact if activeContactId is null but we have contacts
          if (fetchedContacts.length > 0) {
            setActiveContactId(prev => prev || fetchedContacts[0].id);
            setSelectedContactDetailedId(prev => prev || fetchedContacts[0].id);
          }

          // Build/update bios for contact detailed cards gracefully using dynamic server bio
          const updatedBios: Record<string, { email: string; phone: string; bio: string }> = {};
          fetchedContacts.forEach(c => {
            const bioEmail = c.email || c.id;
            updatedBios[c.id] = {
              email: bioEmail,
              phone: "—",
              bio: c.bio || (bioEmail === "elena@mesa.com"
                ? (language === "EN" ? "Your personal serene AI helper in Mesa." : "Ваш персональный ИИ помощник спокойствия.")
                : (language === "EN" ? "A serene registered user on Mesa." : "Участник мессенджера цифрового умиротворения Mesa."))
            };
          });
          setContactBios(updatedBios);
        }

        // 2. Fetch messages and map them
        const messagesRes = await fetch(`/api/messages/sync?email=${encodeURIComponent(userEmail)}`);
        if (!messagesRes.ok) return;
        const messagesData = await messagesRes.json();

        if (messagesData.success && isMounted) {
          const serverMsgs = messagesData.messages;
          const decryptedMsgs = await Promise.all(
            serverMsgs.map(async (m: any) => {
              if (m.isEncrypted && userKeyPair) {
                try {
                  const isMe = m.sender.toLowerCase() === userEmail.toLowerCase();
                  const encKey = isMe ? m.encryptedKeyForSender : m.encryptedKeyForRecipient;
                  if (encKey && m.iv) {
                    const decryptedText = await decryptMessage(m.text, m.iv, encKey, userKeyPair.privateKey);
                    return { ...m, text: decryptedText };
                  }
                } catch (e) {
                  console.error("Failed to decrypt message ID:", m.id, e);
                  return { ...m, text: language === "EN" ? "🔑 Encrypted (unreadable, key mismatch)" : "🔑 Зашифровано (невозможно прочитать, несовпадение ключей)" };
                }
              }
              return m;
            })
          );

          const mapped: Record<string, Message[]> = {};

          decryptedMsgs.forEach((m: any) => {
            const isMe = m.sender.toLowerCase() === userEmail.toLowerCase();
            const threadKey = isMe ? m.recipient.toLowerCase() : m.sender.toLowerCase();

            if (!mapped[threadKey]) {
              mapped[threadKey] = [];
            }
            mapped[threadKey].push({
              id: m.id,
              sender: isMe ? "user" : threadKey,
              text: m.text,
              time: m.time,
              isPinned: m.isPinned,
              isEncrypted: m.isEncrypted
            });
          });

          // Seed/initialize lastSeenCount for newly synced threads so old messages aren't marked as unread
          setLastSeenCount(prev => {
            let changed = false;
            const updated = { ...prev };
            Object.keys(mapped).forEach(contactId => {
              if (updated[contactId] === undefined) {
                updated[contactId] = mapped[contactId].length;
                changed = true;
              }
            });
            if (changed) {
              localStorage.setItem("mesa_last_seen_count", JSON.stringify(updated));
              return updated;
            }
            return prev;
          });

          setMessagesMap(mapped);
        }
      } catch (err) {
        console.error("Networking err during sync:", err);
      }
    };

    syncMetadata();
    const intervalId = setInterval(syncMetadata, 1500);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [userEmail, language, userName, userAvatar, statusMessage, userBio, activeContactId, userKeyPair]);

  // Read message count observer to clear unread badge instantly
  useEffect(() => {
    if (activeContactId) {
      const currentCount = messagesMap[activeContactId]?.length || 0;
      setLastSeenCount(prev => {
        if (prev[activeContactId] !== currentCount) {
          const updated = { ...prev, [activeContactId]: currentCount };
          localStorage.setItem("mesa_last_seen_count", JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }
  }, [activeContactId, messagesMap]);

  // Send disconnect offline signal on window close, logout, or component destruction
  useEffect(() => {
    const handleUnloadDisconnect = () => {
      if (userEmail) {
        navigator.sendBeacon("/api/users/disconnect", JSON.stringify({ email: userEmail }));
      }
    };

    window.addEventListener("beforeunload", handleUnloadDisconnect);
    return () => {
      window.removeEventListener("beforeunload", handleUnloadDisconnect);
      fetch("/api/users/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail })
      }).catch(err => {});
    };
  }, [userEmail]);

  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");

  // Modal Dialog UI to Add dynamic new Custom Contacts
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (currentTab === "chats") {
      scrollToBottom();
    }
  }, [messagesMap, isTyping, currentTab, activeContactId]);

  // Current active messages thread list
  const activeMessages = activeContactId ? (messagesMap[activeContactId] || []) : [];
  const pinnedMessages = activeMessages.filter(m => m.isPinned);

  // Context actions execution methods
  const handlePinMessage = async (msg: Message) => {
    try {
      const response = await fetch("/api/messages/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: msg.id,
          isPinned: !msg.isPinned
        })
      });
      const data = await response.json();
      if (data.success) {
        setChatToast(
          language === "EN" 
            ? (!msg.isPinned ? "Message pinned successfully!" : "Message unpinned successfully!")
            : (!msg.isPinned ? "Сообщение успешно закреплено!" : "Сообщение успешно откреплено!")
        );
        setTimeout(() => setChatToast(""), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMessage = async (msg: Message, forEveryone: boolean) => {
    try {
      const response = await fetch("/api/messages/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: msg.id,
          userEmail: userEmail,
          deleteForEveryone: forEveryone
        })
      });
      const data = await response.json();
      if (data.success) {
        setChatToast(
          language === "EN" 
            ? "Message deleted successfully." 
            : "Сообщение успешно удалено."
        );
        setTimeout(() => setChatToast(""), 3000);
        // Instantly force local thread update
        setMessagesMap(prev => {
          const thread = prev[activeContactId!] || [];
          return {
            ...prev,
            [activeContactId!]: thread.filter(m => m.id !== msg.id)
          };
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteMessageObj(null);
    }
  };

  const handleRenameChat = async (contactId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      const response = await fetch("/api/users/contacts/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: userEmail,
          contactEmail: contactId,
          newName: newName.trim()
        })
      });
      const data = await response.json();
      if (data.success) {
        setChatToast(
          language === "EN" ? "Chat renamed successfully!" : "Чат успешно переименован!"
        );
        setTimeout(() => setChatToast(""), 3000);
        
        // Update contact name locally
        setContacts(prev => prev.map(c => {
          if (c.id === contactId) {
            return { ...c, name: newName.trim() };
          }
          return c;
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRenameContactId(null);
      setRenameInputValue("");
    }
  };

  const handleDeleteChat = async (contactId: string, forEveryone: boolean) => {
    try {
      const response = await fetch("/api/chats/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: userEmail,
          contactEmail: contactId,
          deleteForEveryone: forEveryone
        })
      });
      const data = await response.json();
      if (data.success) {
        setChatToast(
          language === "EN" ? "Chat deleted successfully." : "Чат успешно удален."
        );
        setTimeout(() => setChatToast(""), 3000);
        
        setContacts(prev => prev.filter(c => c.id !== contactId));
        setMessagesMap(prev => {
          const updated = { ...prev };
          delete updated[contactId];
          return updated;
        });
        
        if (activeContactId === contactId) {
          setActiveContactId(null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteChatContactId(null);
    }
  };

  // Submit new message to respective contact
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeContactId || !userEmail) return;

    const messageText = inputText.trim();
    setInputText("");

    const currentContactObj = contacts.find(c => c.id === activeContactId);
    const hasRecipientPublicKey = !!(currentContactObj && currentContactObj.publicKey);

    // Optimistically push the message to local state map so UI acts with zero delay!
    const localUserMsg: Message = {
      id: `optimistic-${Date.now()}`,
      sender: "user",
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEncrypted: hasRecipientPublicKey && !!userKeyPair
    };

    setMessagesMap(prev => {
      const existing = prev[activeContactId] || [];
      return {
        ...prev,
        [activeContactId]: [...existing, localUserMsg]
      };
    });

    // If it's the AI assistant, turn on typing indicator while waiting
    if (activeContactId === "elena@mesa.com" || activeContactId.endsWith("@ai")) {
      setIsTyping(true);
    }

    try {
      // Determine if encryption parameters should be active
      let requestPayload: any = {
        sender: userEmail,
        recipient: activeContactId,
        text: messageText
      };

      if (hasRecipientPublicKey && userKeyPair && currentContactObj?.publicKey) {
        try {
          const recipientPubKeyJwk = JSON.parse(currentContactObj.publicKey);
          const encrypted = await encryptMessage(messageText, recipientPubKeyJwk, userKeyPair.publicKey);
          requestPayload = {
            sender: userEmail,
            recipient: activeContactId,
            text: encrypted.ciphertext,
            isEncrypted: true,
            encryptedKeyForRecipient: encrypted.encryptedKeyForRecipient,
            encryptedKeyForSender: encrypted.encryptedKeyForSender,
            iv: encrypted.iv
          };
        } catch (encErr) {
          console.error("Encryption failed, sending as cleartext fallback:", encErr);
        }
      }

      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        console.error("Failed to persist message on server");
      }

      // Hide typing indicator after a brief simulated offset
      if (activeContactId === "elena@mesa.com" || activeContactId.endsWith("@ai")) {
        setTimeout(() => setIsTyping(false), 1200);
      }
    } catch (err) {
      console.error("Networking error sending message:", err);
      setIsTyping(false);
    }
  };

  // Create customized contact
  const handleAddContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactEmail.trim() || !userEmail) return;

    const targetEmail = newContactEmail.trim().toLowerCase();

    try {
      const response = await fetch("/api/users/contacts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: userEmail,
          contactEmail: targetEmail
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        showChatToast(data.error || (language === "EN" ? "User with this email is not registered." : "Пользователь с таким email не зарегистрирован."));
        return;
      }

      const freshContact: Contact = data.contact;

      setContacts(prev => {
        if (prev.find(c => c.id === freshContact.id)) return prev;
        return [...prev, freshContact];
      });

      showChatToast(language === "EN" ? "Contact added successfully!" : "Контакт успешно добавлен!");
      setNewContactEmail("");
      setNewContactName("");
      setIsAddContactOpen(false);
      setSelectedContactDetailedId(freshContact.id);
      setActiveContactId(freshContact.id);
      setCurrentTab("chats");
    } catch (err) {
      console.error("Error adding contact via API:", err);
      showChatToast(language === "EN" ? "Server connection issue." : "Ошибка соединения с сервером.");
    }
  };

  // Find active chat target contact attributes safely
  const currentChatContact = activeContactId ? contacts.find(c => c.id === activeContactId) : undefined;

  // Selected contact for detail pane safely
  const detailedContact = selectedContactDetailedId ? contacts.find(c => c.id === selectedContactDetailedId) : undefined;
  const detailedBio = detailedContact ? (contactBios[detailedContact.id] || {
    email: `${detailedContact.id}@mesa.com`,
    phone: "—",
    bio: "—"
  }) : null;

  // Filter contacts by search query
  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(contactSearchQuery.toLowerCase())
  );

  const firstLetter = userName ? userName.charAt(0).toUpperCase() : "M";

  return (
    <div className="flex h-screen w-screen bg-background text-on-background overflow-hidden font-sans">
      
      {/* 1. TOAST NOTIFIER FOR INTERNAL DIALOG ACTIONS */}
      {chatToast && (
        <div className="fixed top-6 right-6 md:right-8 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs px-5 py-3.5 rounded-2xl shadow-2xl z-[9999] border border-slate-700/20 dark:border-white/20">
          {chatToast}
        </div>
      )}

      {/* 2. SIDEBAR UTILITY NAVIGATION DRAWER */}
      <aside className="w-24 bg-[#F8FAFC] dark:bg-[#0c111d] border-r border-[#E2E8F0] dark:border-slate-800/80 flex flex-col items-center py-8 justify-between shrink-0 h-full select-none">
        
        {/* Mesa Logo Brand */}
        <div className="flex flex-col items-center w-full">
          <div className="text-[#1D1B84] dark:text-indigo-400 font-extrabold text-2xl tracking-wider mb-10 select-none">
            Mesa
          </div>

          {/* Navigation Items (Chats, Contacts, Settings) */}
          <nav className="flex flex-col gap-5 items-center w-full">
            
            {/* Chats Icon Box */}
            <button 
              type="button"
              onClick={() => setCurrentTab("chats")}
              className={`relative w-full py-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer group bg-transparent border-none transition-all ${
                currentTab === "chats" 
                  ? "text-[#1D1B84] dark:text-indigo-400 font-semibold" 
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {currentTab === "chats" && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1D1B84] dark:bg-indigo-400 rounded-r-lg"></div>
              )}
              <MessageSquare className={`w-6 h-6 transition-transform group-hover:scale-105 duration-200`} />
              <span className="text-[11px] tracking-wide mt-0.5">
                {language === "EN" ? "Chats" : "Чаты"}
              </span>
            </button>

            {/* Contacts Icon Box */}
            <button 
              type="button"
              onClick={() => setCurrentTab("contacts")}
              className={`relative w-full py-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer group bg-transparent border-none transition-all ${
                currentTab === "contacts" 
                  ? "text-[#1D1B84] dark:text-indigo-400 font-semibold" 
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {currentTab === "contacts" && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1D1B84] dark:bg-indigo-400 rounded-r-lg"></div>
              )}
              <Users className={`w-6 h-6 transition-transform group-hover:scale-105 duration-200`} />
              <span className="text-[11px] tracking-wide mt-0.5">
                {language === "EN" ? "Contacts" : "Контакты"}
              </span>
            </button>

            {/* Settings Icon Box */}
            <button 
              type="button"
              onClick={() => setCurrentTab("settings")}
              className={`relative w-full py-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer group bg-transparent border-none transition-all ${
                currentTab === "settings" 
                  ? "text-[#1D1B84] dark:text-indigo-400 font-semibold" 
                  : "text-slate-400 dark:text-slate-500 hover:text-[#1D1B84] dark:hover:text-indigo-400"
              }`}
            >
              {currentTab === "settings" && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1D1B84] dark:bg-indigo-400 rounded-r-lg"></div>
              )}
              <SettingsIcon className={`w-6 h-6 transition-transform group-hover:scale-105 duration-200`} />
              <span className="text-[11px] tracking-wide mt-0.5">
                {language === "EN" ? "Settings" : "Настройки"}
              </span>
            </button>

          </nav>
        </div>

        {/* Quiet Version Label */}
        <div className="text-[10px] text-slate-300 dark:text-slate-500 font-medium tracking-wider">
          v1.0
        </div>
      </aside>

      {/* 3. MULTI-TABS RENDER ENGINE */}

      {/* ======================= CHATS TAB ======================= */}
      {currentTab === "chats" && (
        <>
          {/* Chats left panel */}
          <section className="w-[300px] border-r border-[#E2E8F0] dark:border-slate-800/80 bg-surface-container-lowest flex flex-col h-full shrink-0 animate-fade-in select-none">
            <div className="p-6 pb-4 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold tracking-tight text-on-surface font-sans">
                  {t.activeChats}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsAddContactOpen(true)}
                  className="p-1.5 bg-[#1D1B84] text-white hover:opacity-95 rounded-xl transition-all shadow-md cursor-pointer border-none flex items-center justify-center"
                  title={language === "EN" ? "Add Contact" : "Добавить контакт"}
                >
                  <Plus className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* List of active chat rooms */}
            <div className="flex-grow overflow-y-auto px-1">
              <div className="flex flex-col">
                {contacts.map((c) => {
                  const isActive = activeContactId === c.id;
                  const threadMessages = messagesMap[c.id] || [];
                  const lastMessage = threadMessages[threadMessages.length - 1];
                  const lastText = lastMessage ? lastMessage.text : (language === "EN" ? "No messages yet." : "Сообщений нет.");
                  
                  // Compute dynamic unread counts based on seen count
                  const currentCount = threadMessages.length;
                  const seenCount = lastSeenCount[c.id] ?? 0;
                  const unreadCount = activeContactId === c.id ? 0 : Math.max(0, currentCount - seenCount);
                  
                  return (
                    <div 
                      key={c.id}
                      onClick={() => setActiveContactId(c.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setChatOptionPosition({ x: e.clientX, y: e.clientY });
                        setActiveChatOptionContactId(c.id);
                      }}
                      className={`flex items-center gap-3 py-4 px-6 mx-2 my-1 rounded-2xl cursor-pointer transition-all border-l-4 ${
                        isActive 
                          ? "bg-primary-fixed/30 hover:bg-primary-fixed/35 border-primary" 
                          : "hover:bg-surface-container/30 border-transparent"
                      }`}
                    >
                      <div className="relative shrink-0">
                        {renderAvatar(c.name, c.avatar, "w-12 h-12 text-sm")}
                        {c.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-surface-container-lowest rounded-full animate-pulse"></span>
                        )}
                      </div>

                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className={`font-bold text-sm truncate block font-sans ${isActive ? "text-primary" : "text-on-surface"}`}>
                            {c.name}
                          </span>
                          <span className="text-[10px] font-sans font-medium text-primary-fixed-variant whitespace-nowrap">
                            {lastMessage ? formatTimeByLang(lastMessage.time, language) : ""}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-on-surface-variant font-medium font-sans block truncate max-w-[140px]">
                            {lastText}
                          </span>
                          {!hideBadges && unreadCount > 0 && (
                            <span className="text-[10px] bg-[#1D1B84] text-white rounded-full px-1.5 min-w-[20px] h-5 flex items-center justify-center font-bold">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Conversation view on the right */}
          <section className="flex-1 flex flex-col h-full bg-background relative animate-fade-in">
            {!currentChatContact ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-[#090d16]/30">
                <div className="w-20 h-20 rounded-full bg-primary/5 dark:bg-indigo-400/5 flex items-center justify-center text-[#1D1B84] dark:text-indigo-400 mb-6 border border-slate-100 dark:border-slate-800">
                  <MessageSquare className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-bold text-slate-850 dark:text-slate-100 tracking-tight mb-2">
                  {language === "EN" ? "Welcome to Mesa Serenity" : "Добро пожаловать в Mesa"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[340px] leading-relaxed mb-6 font-medium">
                  {language === "EN" 
                    ? "Add a contact using the button above or pick a user from your contacts tab to experience stress-free, serene conversations."
                    : "Добавьте новый контакт с помощью кнопки вверху или выберите собеседника для начала спокойного и уединенного диалога."}
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddContactOpen(true)}
                  className="px-6 py-3 bg-[#1D1B84] text-white hover:opacity-95 font-bold text-xs rounded-2xl shadow-md cursor-pointer transition-all border-none flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 text-white" />
                  {language === "EN" ? "Add First Contact" : "Добавить первый контакт"}
                </button>
              </div>
            ) : (
              <>
                <header className="h-[72px] border-b border-outline-variant/20 bg-surface-container-lowest px-6 flex justify-between items-center shrink-0 z-10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {renderAvatar(currentChatContact.name, currentChatContact.avatar, "w-10 h-10 text-xs")}
                    </div>
                    <div>
                      <h1 className="font-bold text-sm text-on-surface font-sans">
                        {currentChatContact.name}
                      </h1>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-sans text-on-surface-variant flex items-center gap-1 font-semibold">
                          <span className={`w-1.5 h-1.5 rounded-full inline-block ${currentChatContact.isOnline ? "bg-emerald-500" : "bg-outline"}`}></span>
                          {currentChatContact.isOnline 
                            ? t.chatStatusOnline 
                            : (language === "EN" ? "Offline" : "Не в сети")}
                        </span>
                        {currentChatContact.publicKey && userKeyPair && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/5 px-1.5 py-0.5 rounded-md font-sans font-semibold flex items-center gap-0.5" title={language === "EN" ? "End-to-End Encrypted" : "Зашифровано сквозным шифрованием"}>
                            <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            E2E
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setSelectedContactDetailedId(currentChatContact.id);
                        setCurrentTab("contacts");
                      }}
                      className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                      title={language === "EN" ? "User Information" : "Информация о пользователе"}
                    >
                      <Info className="w-5 h-5 text-slate-500" />
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setChatOptionPosition({ x: rect.left - 140, y: rect.bottom + 8 });
                        setActiveChatOptionContactId(currentChatContact.id);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setChatOptionPosition({ x: e.clientX, y: e.clientY });
                        setActiveChatOptionContactId(currentChatContact.id);
                      }}
                      className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                      title={language === "EN" ? "Chat Options" : "Опции чата"}
                    >
                      <MoreVertical className="w-5 h-5 text-slate-500" />
                    </button>
                  </div>
                </header>

                {/* Pinned Messages Banner */}
                {pinnedMessages.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-900 border-b border-outline-variant/10 px-6 py-2 flex items-center justify-between shrink-0 z-10 text-xs text-slate-600 dark:text-slate-300 shadow-sm animate-scale-in">
                    <div className="flex items-center gap-2 truncate">
                      <Pin className="w-3.5 h-3.5 text-indigo-500 shrink-0 fill-indigo-500 rotate-45" />
                      <span className="font-bold uppercase tracking-wider text-[9px] text-[#1D1B84] dark:text-indigo-400 shrink-0">
                        {language === "EN" ? "Pinned:" : "Закреплено:"}
                      </span>
                      <span className="truncate font-medium">
                        {pinnedMessages[pinnedMessages.length - 1].text}
                      </span>
                    </div>
                    <button
                      onClick={() => handlePinMessage(pinnedMessages[pinnedMessages.length - 1])}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer flex items-center justify-center transition-all"
                      title={language === "EN" ? "Unpin Message" : "Открепить"}
                    >
                      <X className="w-3.5 h-3.5 animate-spin-once" />
                    </button>
                  </div>
                )}

                {/* Messaging scroll pane */}
                <div className="flex-grow overflow-y-auto px-6 py-6 flex flex-col gap-5 bg-background">
                  <div className="text-center my-2 select-none">
                    <span className="text-[11px] font-sans font-bold bg-surface-container-high text-on-surface-variant px-3 py-1 rounded-full uppercase tracking-wider">
                      {t.today}
                    </span>
                  </div>

                  {activeMessages.map((msg) => {
                    const isUser = msg.sender === "user";
                    return (
                      <div
                        key={msg.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextedMessage(msg);
                          setMessageContextMenuPos({ x: e.clientX, y: e.clientY });
                        }}
                        className={`flex w-full items-end gap-2.5 cursor-context-menu select-text group ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        {!isUser && (
                          <div className="hidden sm:block select-none">
                            {renderAvatar(currentChatContact.name, currentChatContact.avatar, "w-8 h-8 text-[10px]")}
                          </div>
                        )}

                        <div className="flex flex-col max-w-[70%] sm:max-w-[60%] gap-1">
                          <div
                            className={`px-5 py-3.5 text-sm md:text-base leading-relaxed relative ${
                              isUser
                                ? "bg-primary text-on-primary rounded-[20px] rounded-br-[4px] shadow-sm selection:bg-white selection:text-primary"
                                : "bg-surface-container-lowest text-on-surface rounded-[20px] rounded-bl-[4px] shadow-[0_2px_8px_rgba(45,50,130,0.02)] selection:bg-primary-fixed selection:text-on-primary-fixed border border-outline-variant/20"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          </div>
                          
                          <div className={`flex items-center gap-1.5 ${isUser ? "justify-end" : "justify-start"}`}>
                            {msg.isEncrypted && (
                              <span className="text-emerald-500 flex items-center shrink-0" title={language === "EN" ? "End-to-End Encrypted" : "Зашифровано сквозным шифрованием"}>
                                <Lock className="w-3 h-3 text-emerald-500" />
                              </span>
                            )}
                            <span className="text-[10px] text-on-surface-variant/70 font-sans tracking-wide px-1.5 font-semibold">
                              {formatTimeByLang(msg.time, language)}
                            </span>
                            {msg.isPinned && (
                              <span className="text-indigo-600 dark:text-indigo-400 flex items-center shrink-0" title={language === "EN" ? "Pinned" : "Закреплено"}>
                                <Pin className="w-3 h-3 fill-indigo-600 dark:fill-indigo-400 rotate-45" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Typing indicator */}
                  {isTyping && (
                    <div className="flex w-full items-end gap-2.5 justify-start animate-pulse">
                      <div className="hidden sm:block select-none">
                        {renderAvatar(currentChatContact.name, currentChatContact.avatar, "w-8 h-8 text-[10px]")}
                      </div>
                      <div className="flex flex-col">
                        <div className="bg-surface-container-lowest text-on-surface px-5 py-3.5 rounded-[20px] rounded-bl-[4px] border border-outline-variant/20 flex items-center gap-1.5 shadow-[0_2px_8px_rgba(45,50,130,0.02)]">
                          <div className="w-2 h-2 bg-on-surface-variant/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                          <div className="w-2 h-2 bg-on-surface-variant/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                          <div className="w-2 h-2 bg-on-surface-variant/60 rounded-full animate-bounce" style={{ animationDelay: "300ms animate-duration-1000" }}></div>
                        </div>
                        <span className="text-[10px] text-on-surface-variant/50 font-sans px-1 mt-1 font-semibold">
                          {language === "EN" 
                            ? `${currentChatContact.name} is typing...` 
                            : `${currentChatContact.name} печатает...`}
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/*composer footer */}
                <footer className="p-4 bg-surface-container-lowest border-t border-outline-variant/20 shrink-0 select-none z-10">
                  <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
                    <button 
                      type="button" 
                      className="p-3 bg-surface-container-low hover:bg-surface-container text-on-surface-variant rounded-full transition-colors flex items-center justify-center cursor-pointer border-none"
                    >
                      <Plus className="w-5 h-5 text-slate-500" />
                    </button>

                    <div className="flex-grow flex items-center bg-surface-container-low border border-outline-variant/10 rounded-full pl-5 pr-2 focus-within:ring-1 focus-within:ring-primary focus-within:bg-surface-container-lowest transition-all group duration-200">
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={t.chatInputPlaceholder}
                        className="flex-grow bg-transparent text-sm md:text-base text-on-surface py-3.5 focus:outline-none placeholder:text-on-surface-variant/40 outline-none"
                      />
                      <button 
                        type="button" 
                        className="p-2 text-on-surface-variant/70 hover:text-on-surface transition-colors flex items-center justify-center cursor-pointer border-none bg-transparent"
                      >
                        <Smile className="w-5 h-5 text-slate-500" />
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={!inputText.trim() || isTyping}
                      className="p-3.5 bg-[#1D1B84] text-white hover:opacity-95 disabled:opacity-40 rounded-full transition-all flex items-center justify-center shadow-md active:scale-95 duration-100 cursor-pointer shrink-0 border-none"
                    >
                      <Send className="w-[18px] h-[18px] text-white" />
                    </button>
                  </form>
                </footer>
              </>
            )}
          </section>
        </>
      )}

      {/* ======================= CONTACTS TAB ======================= */}
      {currentTab === "contacts" && (
        <>
          {/* Contacts Left Panel */}
          <section className="w-[300px] border-r border-outline-variant/30 bg-surface-container-lowest flex flex-col h-full shrink-0 animate-fade-in select-none">
            <div className="p-6 pb-4 flex flex-col gap-4">
              <h2 className="text-xl font-bold tracking-tight text-on-surface font-sans">
                {language === "EN" ? "Contacts" : "Контакты"}
              </h2>

              {/* Serene small search bar */}
              <div className="relative flex items-center bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-1.5">
                <Search className="w-4 h-4 text-slate-400 mr-2 select-none shrink-0" />
                <input
                  type="text"
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  placeholder={language === "EN" ? "Search contacts..." : "Поиск контактов..."}
                  className="w-full bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none"
                />
              </div>
            </div>

            {/* List scroll */}
            <div className="flex-grow overflow-y-auto px-1">
              <div className="flex flex-col gap-1">
                {filteredContacts.map((c) => {
                  const isActive = selectedContactDetailedId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedContactDetailedId(c.id)}
                      className={`flex items-center gap-3 py-3 px-5 mx-2 my-0.5 rounded-2xl cursor-pointer transition-all border-l-4 ${
                        isActive 
                          ? "bg-primary-fixed/30 border-primary" 
                          : "hover:bg-surface-container/20 border-transparent"
                      }`}
                    >
                      <div className="relative shrink-0">
                        {renderAvatar(c.name, c.avatar, "w-10 h-10 text-xs")}
                        {c.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-surface-container-lowest rounded-full"></span>
                        )}
                      </div>

                      <div className="min-w-0 flex-grow">
                        <p className={`font-bold text-xs truncate ${isActive ? "text-primary" : "text-on-surface"}`}>
                          {c.name}
                        </p>
                        <p className="text-[10px] text-on-surface-variant/80 truncate">
                          {c.isOnline 
                            ? (language === "EN" ? "Online" : "В сети") 
                            : (language === "EN" ? "Offline" : "Не в сети")}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {filteredContacts.length === 0 && (
                  <p className="text-center text-[11px] text-on-surface-variant/65 mt-8 px-4 leading-normal">
                    {language === "EN" ? "No matches found." : "Совпадений не найдено."}
                  </p>
                )}
              </div>
            </div>

            {/* Add contact trigger */}
            <div className="p-4 bg-[#F8FAFC] dark:bg-[#0c111d] border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsAddContactOpen(true)}
                className="w-full h-11 flex items-center justify-center gap-1.5 bg-[#1D1B84] dark:bg-indigo-600 text-white hover:opacity-95 rounded-xl text-xs font-bold font-sans transition-all shadow-md cursor-pointer border-none"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>{language === "EN" ? "Add Contact" : "Добавить контакт"}</span>
              </button>
            </div>
          </section>

          {/* Contact detailed profile pane */}
          <section className="flex-1 flex flex-col h-full bg-background relative animate-fade-in select-none">
            <header className="h-[72px] border-b border-outline-variant/20 bg-surface-container-lowest px-6 flex justify-between items-center shrink-0 z-10 shadow-sm">
              <h1 className="font-bold text-sm text-on-surface font-sans">
                {language === "EN" ? "Detailed Contact Bio" : "Карточка контакта"}
              </h1>
            </header>

            {!detailedContact || !detailedBio ? (
              <div className="flex-grow flex flex-col items-center justify-center p-8 text-center bg-transparent">
                <div className="w-20 h-20 rounded-full bg-primary/5 dark:bg-indigo-400/5 flex items-center justify-center text-[#1D1B84] dark:text-indigo-400 mb-6 border border-slate-100 dark:border-slate-800">
                  <Users className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-bold text-slate-850 dark:text-slate-100 tracking-tight mb-2">
                  {language === "EN" ? "Select a Contact" : "Выберите контакт"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[340px] leading-relaxed mb-6 font-medium">
                  {language === "EN" 
                    ? "Add or select a user from the left pane to view their comprehensive directory details."
                    : "Выберите или добавьте контакт из левой панели для просмотра подробной информации."}
                </p>
              </div>
            ) : (
              <div className="flex-grow overflow-y-auto p-8 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
                <div className="text-center flex flex-col items-center w-full max-w-sm">
                  
                  {/* Visual Circle Photo */}
                  <div className="relative mb-5">
                    {renderAvatar(detailedContact.name, detailedContact.avatar, "w-24 h-24 text-2xl")}
                    {detailedContact.isOnline && (
                      <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-background rounded-full"></span>
                    )}
                  </div>

                  <h2 className="text-2xl font-bold text-on-surface mb-1 font-sans">
                    {detailedContact.name}
                  </h2>
                  
                  <div className="mb-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-tight ${
                      detailedContact.isOnline ? "bg-emerald-500/10 text-emerald-600 animate-pulse" : "bg-zinc-200/50 text-zinc-600"
                    }`}>
                      {detailedContact.isOnline 
                        ? (language === "EN" ? "Online" : "В сети") 
                        : (language === "EN" ? "Offline" : "Не в сети")}
                    </span>
                  </div>

                  {/* Info parameters */}
                  <div className="bg-surface-container-lowest border border-outline-variant/25 rounded-3xl p-5 w-full text-left shadow-sm flex flex-col gap-3.5 mb-6">
                    <div>
                      <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest block mb-0.5">
                        Email
                      </span>
                      <span className="text-sm font-medium text-on-surface whitespace-nowrap block truncate">
                        {detailedBio.email}
                      </span>
                    </div>
                    <div className="border-t border-outline-variant/10 pt-3">
                      <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest block mb-0.5">
                        {language === "EN" ? "Mindful Bio" : "О себе"}
                      </span>
                      <p className="text-xs text-on-surface-variant/90 leading-relaxed font-sans mt-0.5 whitespace-normal">
                        {detailedBio.bio}
                      </p>
                    </div>
                  </div>

                  {/* Launch thread action */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveContactId(detailedContact.id);
                      setCurrentTab("chats");
                    }}
                    className="h-12 w-full bg-[#1D1B84] text-white hover:opacity-95 rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95 duration-100 flex items-center justify-center gap-1.5 cursor-pointer border-none"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{language === "EN" ? "Send Message" : "Начать диалог"}</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
      {currentTab === "settings" && (
        <section className="flex-grow flex flex-col h-full bg-[#f8fafc] dark:bg-[#090d16] overflow-y-auto animate-fade-in relative">
          
          {/* Centered Configuration Container */}
          <div className="max-w-2xl w-full mx-auto py-10 px-6 md:px-8 flex flex-col gap-8 select-none">
            
            {/* Main Header */}
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {language === "EN" ? "Profile Settings" : "Настройки профиля"}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">
                {language === "EN" 
                  ? "Manage your identity and app preferences." 
                  : "Управление вашим профилем и настройками приложения."}
              </p>
            </div>

            {/* Profile Card */}
            <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-8 shadow-sm flex flex-col gap-6 items-center">
              
              {/* Centered Avatar Image Selector */}
              <div className="flex flex-col items-center gap-4">
                <div 
                  onClick={handleAvatarClick}
                  className="relative group cursor-pointer active:scale-95 transition-all duration-200"
                  title={language === "EN" ? "Upload avatar image" : "Загрузить свой аватар"}
                >
                  {renderAvatar(userName, userAvatar, "w-24 h-24 text-2xl border-4 border-slate-100 dark:border-slate-800 shadow-sm")}
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="text-xs text-white font-bold tracking-wide uppercase">
                      {language === "EN" ? "Change" : "Изм."}
                    </span>
                  </div>
                </div>

                {/* Hidden File Input */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="image/*" 
                />
              </div>

              {/* Input Fields */}
              <div className="w-full flex flex-col gap-5 mt-2">
                
                {/* Display Name Field */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                    {language === "EN" ? "Display Name" : "Отображаемое имя"}
                  </label>
                  <input
                    type="text"
                    value={profileNameInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProfileNameInput(val);
                      setUserName(val);
                    }}
                    placeholder="Alex Rivera"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-[#1D1B84] dark:focus:border-indigo-400 transition-all outline-none"
                  />
                </div>

                {/* Mindful Bio (О себе) Field */}
                <div className="flex flex-col gap-1.5 w-full">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                    {language === "EN" ? "Mindful Bio" : "О себе"}
                  </label>
                  <textarea
                    rows={3}
                    value={userBio}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUserBio(val);
                      localStorage.setItem("mesa_user_bio", val);
                    }}
                    placeholder={language === "EN" ? "Something quiet about yourself..." : "Что-нибудь спокойное о себе..."}
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-[#1D1B84] dark:focus:border-indigo-400 transition-all outline-none resize-none font-sans"
                  />
                </div>

              </div>
            </div>

            {/* Preferences Card */}
            <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/60 dark:border-slate-800/80 p-8 shadow-sm flex flex-col gap-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                {language === "EN" ? "Preferences" : "Предпочтения"}
              </h2>

              <div className="flex flex-col">
                
                {/* 1. Notifications Toggle Option */}
                <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-850/60">
                  <div className="flex flex-col max-w-[70%]">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      {language === "EN" ? "Notifications" : "Оповещения"}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      {language === "EN" 
                        ? "Receive alerts for new messages" 
                        : "Получать звуковые оповещения и пуш-уведомления"}
                    </span>
                  </div>
                  <Toggle active={notificationsEnabled} onChange={setNotificationsEnabled} />
                </div>

                {/* 2. Privacy Toggle Option */}
                <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-855/60">
                  <div className="flex flex-col max-w-[70%]">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      {language === "EN" ? "Privacy" : "Конфиденциальность"}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      {language === "EN" 
                        ? "Show read receipts" 
                        : "Показывать статус прочтения собеседнику"}
                    </span>
                  </div>
                  <Toggle active={privacyEnabled} onChange={setPrivacyEnabled} />
                </div>

                {/* 3. Language Segmented Control Option */}
                <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-855/60">
                  <div className="flex flex-col max-w-[50%]">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      {language === "EN" ? "Language" : "Язык интерфейса"}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      {language === "EN" 
                        ? "Choose interface language" 
                        : "Выберите предпочтительный язык интерфейса"}
                    </span>
                  </div>
                  <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => onLanguageChange("RU")}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-all font-sans cursor-pointer border-none ${
                        language === "RU"
                          ? "bg-[#1D1B84] dark:bg-indigo-600 text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-transparent"
                      }`}
                    >
                      Русский
                    </button>
                    <button
                      type="button"
                      onClick={() => onLanguageChange("EN")}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-all font-sans cursor-pointer border-none ${
                        language === "EN"
                          ? "bg-[#1D1B84] dark:bg-indigo-600 text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-transparent"
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* 4. Dark Mode Toggle Option */}
                <div className="flex items-center justify-between py-4">
                  <div className="flex flex-col max-w-[70%]">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      {language === "EN" ? "Dark Mode" : "Темная тема"}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      {language === "EN" 
                        ? "Switch to a darker theme" 
                        : "Включить темную тему для интерфейса приложения"}
                    </span>
                  </div>
                  <Toggle active={darkModeEnabled} onChange={handleToggleDarkMode} />
                </div>

              </div>
            </div>

            {/* Logout Trigger Link */}
            <div className="flex justify-start items-center mt-2 px-1">
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-2 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 font-bold text-sm tracking-wide bg-transparent border-none outline-none cursor-pointer p-0 transition-colors"
              >
                <LogOut className="w-5 h-5 text-red-600 dark:text-red-500" />
                <span>{t.logoutButton}</span>
              </button>
            </div>

          </div>
        </section>
      )}

      {/* ======================= ADD CONTACT MODAL DIALOG ======================= */}
      {isAddContactOpen && (
        <div 
          onClick={() => setIsAddContactOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50 select-none"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-container-lowest rounded-3xl p-6 max-w-sm w-full border border-outline-variant/30 shadow-2xl relative"
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold text-on-surface font-sans">
                {language === "EN" ? "Add New Contact" : "Добавить новый контакт"}
              </h3>
              <button 
                type="button"
                onClick={() => setIsAddContactOpen(false)}
                className="p-1 px-1.5 hover:bg-slate-100 text-slate-500 rounded-full transition-colors font-sans hover:text-slate-800 cursor-pointer border-none bg-transparent flex items-center justify-center"
              >
                <X className="w-[18px] h-[18px] text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleAddContactSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal mb-2">
                  {language === "EN" 
                    ? "Enter the email of a registered Mesa user to add them to your contacts list immediately." 
                    : "Введите email зарегистрированного пользователя Mesa, чтобы сразу добавить его в контакты."}
                </p>
                <label className="text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-widest font-sans">
                  {language === "EN" ? "Email Address" : "Email-адрес"}
                </label>
                <input
                  type="email"
                  required
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="user@mesa.com"
                  className="w-full h-11 bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full h-11 mt-2 bg-primary text-on-primary hover:bg-on-primary-fixed-variant rounded-xl text-xs font-bold tracking-wider uppercase shadow-md transition-all active:scale-95 cursor-pointer border-none"
              >
                {language === "EN" ? "Add Contact" : "Добавить в контакты"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================= ABSOLUTE FLOATING PORTALS & CONTEXT MENUS ======================= */}

      {/* Chat Options Context Menu (Left/Right click on contact or triple dot) */}
      {activeChatOptionContactId && chatOptionPosition && (
        <div 
          style={{ top: `${chatOptionPosition.y}px`, left: `${chatOptionPosition.x}px` }}
          className="fixed bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-2xl py-2 w-48 z-[9999] select-none animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const currentName = contacts.find(c => c.id === activeChatOptionContactId)?.name || "";
              setRenameContactId(activeChatOptionContactId);
              setRenameInputValue(currentName);
              setActiveChatOptionContactId(null);
              setChatOptionPosition(null);
            }}
            className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
          >
            <Edit3 className="w-4 h-4 text-indigo-500" />
            {language === "EN" ? "Rename Chat" : "Переименовать"}
          </button>
          
          <button
            onClick={() => {
              setDeleteChatContactId(activeChatOptionContactId);
              setDeleteChatForEveryone(false);
              setActiveChatOptionContactId(null);
              setChatOptionPosition(null);
            }}
            className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {language === "EN" ? "Delete Chat" : "Удалить чат"}
          </button>
        </div>
      )}

      {/* Message Context Options (Right click on message bubble) */}
      {contextedMessage && messageContextMenuPos && (
        <div 
          style={{ top: `${messageContextMenuPos.y}px`, left: `${messageContextMenuPos.x}px` }}
          className="fixed bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-2xl py-2 w-48 z-[9999] select-none animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handlePinMessage(contextedMessage);
              setContextedMessage(null);
              setMessageContextMenuPos(null);
            }}
            className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
          >
            <Pin className="w-4 h-4 text-orange-500 rotate-45" />
            {contextedMessage.isPinned 
              ? (language === "EN" ? "Unpin Message" : "Открепить") 
              : (language === "EN" ? "Pin Message" : "Закрепить")}
          </button>
          
          <button
            onClick={() => {
              setDeleteMessageObj(contextedMessage);
              setDeleteMsgForEveryone(false);
              setContextedMessage(null);
              setMessageContextMenuPos(null);
            }}
            className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 border-none bg-transparent cursor-pointer transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {language === "EN" ? "Delete Message" : "Удалить сообщение"}
          </button>
        </div>
      )}

      {/* Rename Chat Interactive Prompt Modal */}
      {renameContactId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 select-none">
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2 font-sans">
              {language === "EN" ? "Rename Chat" : "Переименовать"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-sans leading-relaxed">
              {language === "EN" ? "Enter a new custom name for this conversation:" : "Введите новое имя для этой беседы:"}
            </p>
            <input
              type="text"
              value={renameInputValue}
              onChange={(e) => setRenameInputValue(e.target.value)}
              placeholder="e.g. Elena Support"
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 text-sm text-slate-800 dark:text-white rounded-xl px-4 py-3 mb-5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-[#1D1B84] dark:focus:border-indigo-400 transition-all font-sans"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setRenameContactId(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border-none cursor-pointer"
              >
                {language === "EN" ? "Cancel" : "Отмена"}
              </button>
              <button
                type="button"
                onClick={() => handleRenameChat(renameContactId, renameInputValue)}
                className="px-4 py-2.5 bg-[#1D1B84] text-white hover:opacity-90 rounded-xl text-xs font-bold transition-all border-none cursor-pointer shadow-md"
              >
                {language === "EN" ? "Save" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Chat Confirmation Dialog Modal */}
      {deleteChatContactId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 select-none">
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2 font-sans">
              {language === "EN" ? "Delete Chat" : "Удалить чат"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 font-sans leading-relaxed">
              {language === "EN" 
                ? "Are you sure you want to delete this chat room? This cannot be undone." 
                : "Вы уверены, что хотите удалить этот чат? Все сообщения будут очищены."}
            </p>
            
            {/* Custom Checkbox */}
            <div className="flex items-center gap-2.5 mb-6 cursor-pointer" onClick={() => setDeleteChatForEveryone(!deleteChatForEveryone)}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${deleteChatForEveryone ? "bg-rose-600 border-rose-600 text-white font-bold" : "border-slate-300 dark:border-slate-750 bg-transparent"}`}>
                {deleteChatForEveryone && <span className="text-[10px] leading-none mb-0.5">✓</span>}
              </div>
              <span className="text-xs font-medium text-slate-650 dark:text-slate-300 select-none">
                {language === "EN" ? "Also delete for other participant" : "Удалить также и у собеседника"}
              </span>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteChatContactId(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border-none cursor-pointer"
              >
                {language === "EN" ? "Cancel" : "Отмена"}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteChat(deleteChatContactId, deleteChatForEveryone)}
                className="px-4 py-2.5 bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-xs font-bold transition-all border-none cursor-pointer shadow-md"
              >
                {language === "EN" ? "Delete" : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Message Dialog Modal */}
      {deleteMessageObj && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 select-none">
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2 font-sans">
              {language === "EN" ? "Delete Message" : "Удалить сообщение"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 font-sans leading-relaxed">
              {language === "EN" 
                ? "How do you want to delete this message?" 
                : "Как вы хотите удалить это сообщение?"}
            </p>
            
            <div className="flex flex-col gap-2.5 w-full">
              <button
                type="button"
                onClick={() => handleDeleteMessage(deleteMessageObj, false)}
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition-all border-none cursor-pointer"
              >
                {language === "EN" ? "Delete only for me" : "Удалить только у себя"}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteMessage(deleteMessageObj, true)}
                className="w-full py-3 bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-xs font-bold transition-all border-none cursor-pointer shadow-md"
              >
                {language === "EN" ? "Delete for everyone" : "Удалить у всех"}
              </button>
              
              <button
                type="button"
                onClick={() => setDeleteMessageObj(null)}
                className="w-full py-2.5 mt-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl text-xs font-bold transition-all border-none bg-transparent cursor-pointer"
              >
                {language === "EN" ? "Cancel" : "Отмена"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
