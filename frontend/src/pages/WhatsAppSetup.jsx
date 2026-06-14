import React, { useEffect, useState } from "react";
import {
  Smartphone, MessageSquare, Mail, Bell, Shield, User, Clock,
  Check, CheckCheck, Wifi, Battery, Volume2, ArrowLeft, RefreshCw, SmartphoneIcon, Circle, Laptop, Send
} from "lucide-react";
import { customersApi, agentApi } from "../services/api";
import socket from "../services/socket";

export default function WhatsAppSetup() {
  const [customers, setCustomers] = useState([
    { id: "1", name: "Jane Doe", phone: "+91 98765 43210", email: "jane.doe@example.com" },
    { id: "2", name: "John Smith", phone: "+91 91234 56789", email: "john.smith@example.com" },
    { id: "3", name: "Alice Johnson", phone: "+91 99887 76655", email: "alice.j@example.com" }
  ]);
  const [activePhoneCustomer, setActivePhoneCustomer] = useState(null);
  
  // Real-time states mapped by customerId
  // Format: { [customerId]: [ { id, channel, sender, message, timestamp } ] }
  const [notifications, setNotifications] = useState({});
  const [activeBanner, setActiveBanner] = useState(null);
  const [phoneScreen, setPhoneScreen] = useState("inbox"); // inbox | chat | email | email_detail | shop_page
  const [activeEmail, setActiveEmail] = useState(null);
  const [shopMsg, setShopMsg] = useState(null); // the campaign msg that triggered shop open
  
  // Interactive Chat input states
  const [replyMessage, setReplyMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const customersRef = React.useRef(customers);
  const activePhoneCustomerRef = React.useRef(activePhoneCustomer);

  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  useEffect(() => {
    activePhoneCustomerRef.current = activePhoneCustomer;
  }, [activePhoneCustomer]);

  // Load real customers and communications from database on mount
  useEffect(() => {
    // 1. Fetch recent communications
    agentApi.getCommunications({ limit: 100 })
      .then((resComms) => {
        const comms = resComms.data || [];
        
        // Find all unique customers in these communications
        const uniqueCustomers = [];
        const customerMap = {};
        
        comms.forEach((comm) => {
          const cust = comm.customer_id;
          if (cust && !customerMap[String(cust._id)]) {
            const formattedCust = {
              id: String(cust._id),
              name: cust.name || "Unnamed Customer",
              phone: cust.phone || "+91 90000 00000",
              email: cust.email || "customer@example.com",
              status: "Online",
              battery: Math.floor(Math.random() * 30) + 70,
              device: "Simulated Smartphone",
            };
            customerMap[String(cust._id)] = formattedCust;
            uniqueCustomers.push(formattedCust);
          }
        });
        
        // Fetch general customers list so we have them, but prepended by the campaign recipients
        customersApi.list({ limit: 12 })
          .then((resCusts) => {
            const generalCusts = (resCusts.data?.customers || []).map((c, idx) => ({
              id: c._id,
              name: c.name || "Unnamed Customer",
              phone: c.phone || `+91 90000 0000${idx}`,
              email: c.email || "customer@example.com",
              status: "Online",
              battery: Math.floor(Math.random() * 30) + 70,
              device: ["iPhone 15 Pro", "Samsung S24 Ultra", "Pixel 8 Pro", "OnePlus 12"][idx % 4]
            }));
            
            // Merge uniqueCustomers (campaign recipients) and generalCusts, avoiding duplicates
            const mergedCusts = [...uniqueCustomers];
            generalCusts.forEach((c) => {
              if (!mergedCusts.some((existing) => existing.id === c.id)) {
                mergedCusts.push(c);
              }
            });
            setCustomers(mergedCusts);
          })
          .catch(() => {
            setCustomers(uniqueCustomers);
          });
        
        // 2. Pre-populate notifications map from the loaded communications
        const initialNotifications = {};
        comms.forEach((comm) => {
          const custId = comm.customer_id?._id || comm.customer_id;
          if (!custId) return;
          const targetId = String(custId);
          
          if (!initialNotifications[targetId]) {
            initialNotifications[targetId] = [];
          }
          
          // Avoid duplicates
          if (initialNotifications[targetId].some(n => n.message === comm.personalized_body)) return;
          
          initialNotifications[targetId].push({
            id: String(comm._id),
            communication_id: String(comm._id),
            campaign_id: comm.campaign_id,
            channel: comm.channel,
            sender: comm.channel === "email" ? "Zari Fashion" : "Zari CRM",
            message: comm.personalized_body,
            status: comm.status || "sent",
            timestamp: new Date(comm.sent_at || comm.created_at || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          });
        });
        
        setNotifications(initialNotifications);
      })
      .catch((err) => {
        console.error("Failed to load communications on mount:", err);
        // Fallback to loading just general customers
        customersApi.list({ limit: 12 })
          .then((r) => {
            if (r.data && r.data.customers && r.data.customers.length > 0) {
              const formatted = r.data.customers.map((c, idx) => ({
                id: c._id || String(idx),
                name: c.name || "Unnamed Customer",
                phone: c.phone || `+91 90000 0000${idx}`,
                email: c.email || "customer@example.com",
                status: "Online",
                battery: Math.floor(Math.random() * 30) + 70,
                device: ["iPhone 15 Pro", "Samsung S24 Ultra", "Pixel 8 Pro", "OnePlus 12"][idx % 4]
              }));
              setCustomers(formatted);
            }
          })
          .catch(() => {});
      });
  }, []);

  // Listen to live message events from socket
  useEffect(() => {
    const handleCommunicationUpdated = (data) => {
      console.log("[SimulationCenter] Received communication:updated", data);
      const { customer_id, communication_id, campaign_id, channel, message, event, status } = data;
      
      // Only process when message is sent or delivered, and has content
      if (message && (event === "sent" || event === "delivered")) {
        addMessageToCustomer(customer_id, {
          id: Date.now().toString() + Math.random(),
          communication_id,
          campaign_id,
          channel,
          sender: channel === "email" ? "Zari Fashion" : "Zari CRM",
          message,
          status: status || event || "sent",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
      }
    };

    const handleWhatsAppMessageSent = (data) => {
      console.log("[SimulationCenter] Received whatsapp:message_sent", data);
      const { customer_id, message, channel } = data;
      
      if (message) {
        addMessageToCustomer(customer_id, {
          id: Date.now().toString() + Math.random(),
          channel,
          sender: "AETHER_VOID Storefront",
          message,
          status: "sent",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
      }
    };

    const handleDeviceMessageAdded = (data) => {
      console.log("[SimulationCenter] Received device:message_added", data);
      const { customer_id, customer_name, phone, email, communication_id, campaign_id, channel, sender, message, timestamp } = data;
      
      if (sender !== "customer") {
        setIsTyping(false);
      }

      // If customer is new, dynamically add them to the list!
      setCustomers((prev) => {
        if (prev.some((c) => c.id === customer_id)) return prev;
        const newCust = {
          id: customer_id,
          name: customer_name || "Unnamed Customer",
          phone: phone || "+91 90000 00000",
          email: email || "customer@example.com",
          status: "Online",
          battery: Math.floor(Math.random() * 30) + 70,
          device: "Simulated Smartphone",
        };
        return [newCust, ...prev];
      });

      addMessageToCustomer(customer_id, {
        id: Date.now().toString() + Math.random(),
        communication_id,
        campaign_id,
        channel,
        sender,
        message,
        status: "sent",
        timestamp
      });
    };

    const handleCommunicationStatusUpdated = (data) => {
      console.log("[SimulationCenter] Received communication:status_updated", data);
      const { communication_id, customer_id, status } = data;
      setNotifications((prev) => {
        const customerMsgs = prev[customer_id] || [];
        const updated = customerMsgs.map((m) => {
          if (m.communication_id === communication_id) {
            return { ...m, status };
          }
          return m;
        });
        return { ...prev, [customer_id]: updated };
      });

      // Also update activeEmail if it matches the updated communication_id
      setActiveEmail((prev) => {
        if (prev && prev.communication_id === communication_id) {
          return { ...prev, status };
        }
        return prev;
      });
    };

    socket.on("communication:updated", handleCommunicationUpdated);
    socket.on("whatsapp:message_sent", handleWhatsAppMessageSent);
    socket.on("device:message_added", handleDeviceMessageAdded);
    socket.on("communication:status_updated", handleCommunicationStatusUpdated);

    return () => {
      socket.off("communication:updated", handleCommunicationUpdated);
      socket.off("whatsapp:message_sent", handleWhatsAppMessageSent);
      socket.off("device:message_added", handleDeviceMessageAdded);
      socket.off("communication:status_updated", handleCommunicationStatusUpdated);
    };
  }, []);

  const addMessageToCustomer = (customerId, notif) => {
    // Attempt to match customer by ID or phone number using ref
    let matchedCustomer = customersRef.current.find(c => c.id === customerId);
    if (!matchedCustomer && notif.phone) {
      matchedCustomer = customersRef.current.find(c => c.phone === notif.phone);
    }
    
    const targetId = matchedCustomer ? matchedCustomer.id : customerId;

    setNotifications((prev) => {
      const existing = prev[targetId] || [];
      // Prevent duplicates
      if (existing.some(m => m.message === notif.message && m.sender === notif.sender)) return prev;
      return {
        ...prev,
        [targetId]: [notif, ...existing]
      };
    });

    // Trigger visual banner if it matches the current active customer using ref
    if (activePhoneCustomerRef.current && activePhoneCustomerRef.current.id === targetId && notif.sender !== "customer") {
      setActiveBanner(notif);
      setTimeout(() => {
        setActiveBanner((current) => (current?.id === notif.id ? null : current));
      }, 5000);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !activePhoneCustomer) return;

    setIsTyping(true);

    const chatHistory = activeChatMessages
      .map(m => ({
        role: m.sender === "customer" ? "user" : "model",
        content: m.message
      }))
      .reverse();

    socket.emit("device:message_sent", {
      customer_id: activePhoneCustomer.id,
      customer_name: activePhoneCustomer.name,
      message: replyMessage.trim(),
      history: chatHistory,
      channel: "whatsapp"
    });

    setReplyMessage("");
  };

  const handleBubbleClick = (msg) => {
    if (msg.sender === "customer" || !msg.communication_id) return;

    // sent → delivered on first click
    if (msg.status === "sent") {
      socket.emit("simulation:update_status", {
        customer_id: activePhoneCustomer.id,
        communication_id: msg.communication_id,
        channel: msg.channel,
        status: "delivered"
      });
      return;
    }
    // delivered → opened on second click (opening the message)
    if (msg.status === "delivered") {
      socket.emit("simulation:update_status", {
        customer_id: activePhoneCustomer.id,
        communication_id: msg.communication_id,
        channel: msg.channel,
        status: "opened"
      });
      return;
    }
    // opened → show shop page (emit clicked when they reach the shop page)
    if (msg.status === "opened") {
      setShopMsg(msg);
      setPhoneScreen("shop_page");
      socket.emit("simulation:update_status", {
        customer_id: activePhoneCustomer.id,
        communication_id: msg.communication_id,
        channel: msg.channel,
        status: "clicked"
      });
      return;
    }
    // clicked → open shop page again for purchase
    if (msg.status === "clicked") {
      setShopMsg(msg);
      setPhoneScreen("shop_page");
    }
  };

  // Filter list of customers to only those who have received messages in this session
  const customersWithMessages = customers.filter(
    (c) => (notifications[c.id]?.length || 0) > 0
  );

  // Auto-select the first customer with messages as the active device
  useEffect(() => {
    if (customersWithMessages.length > 0) {
      if (!activePhoneCustomer || !customersWithMessages.some(c => c.id === activePhoneCustomer.id)) {
        setActivePhoneCustomer(customersWithMessages[0]);
      }
    } else {
      setActivePhoneCustomer(null);
    }
  }, [notifications, customers]);

  // Messages filtered for the active device
  const activeCustomerHistory = activePhoneCustomer ? (notifications[activePhoneCustomer.id] || []) : [];

  const activeChatMessages = activeCustomerHistory.filter(
    (msg) => msg.channel === "whatsapp" || msg.channel === "sms"
  );

  const activeEmailMessages = activeCustomerHistory.filter(
    (msg) => msg.channel === "email"
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-[32px] font-bold text-white tracking-tight flex items-center gap-2">
            <Smartphone className="text-blue-400" />
            Simulation Center
          </h1>
          <p className="text-zinc-400 mt-1">
            Real-time visual monitoring of customer smartphones. Fully synced and connected to active store purchases and campaign dispatches.
          </p>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-950/20 border border-emerald-900/40 rounded-xl">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-[13px] font-bold text-emerald-400 uppercase tracking-wider">WebSocket Connected</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel: Available Devices */}
        <div className="lg:col-span-4 space-y-4">
          <div className="premium-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Laptop size={18} className="text-blue-400" />
                Simulated Devices ({customersWithMessages.length})
              </h2>
            </div>
            
            <p className="text-xs text-zinc-400">
              Only devices that have active campaign dispatches are shown below. Select a device to view its screen.
            </p>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {customersWithMessages.map((c) => {
                const hasUnread = (notifications[c.id]?.length || 0) > 0;
                const isActive = activePhoneCustomer?.id === c.id;
                const latestMsg = notifications[c.id]?.[0]?.message || "";
                
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActivePhoneCustomer(c);
                      setActiveBanner(null);
                      setPhoneScreen("inbox");
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all duration-300 flex items-center justify-between ${
                      isActive
                        ? "bg-blue-950/20 border-blue-500/50 shadow-md shadow-blue-950/10 text-white"
                        : "bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>
                        <SmartphoneIcon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-bold flex items-center gap-1.5">
                          {c.name}
                          {hasUnread && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 truncate max-w-[170px]" title={latestMsg}>
                          {latestMsg || c.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950/30 text-emerald-400 border border-emerald-900/30">
                        {c.status || "Online"}
                      </span>
                      <span className="text-[10px] text-zinc-550">{c.battery || 82}% Batt</span>
                    </div>
                  </button>
                );
              })}
              {customersWithMessages.length === 0 && (
                <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl px-4 text-[12px] bg-zinc-950/20">
                  <RefreshCw size={24} className="mx-auto mb-2 text-zinc-700 animate-spin" />
                  Waiting for campaign launch to populate devices...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Smartphone Mockup Center */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center p-6 bg-zinc-950/20 border border-zinc-900 rounded-2xl min-h-[680px]">
          {activePhoneCustomer ? (
            <div className="flex flex-col items-center">
              {/* Active Customer Indicator Badge */}
              <div className="mb-6 text-center space-y-1">
                <span className="text-[11px] font-extrabold text-blue-400 uppercase tracking-widest bg-blue-950/40 px-3 py-1 rounded-full border border-blue-900/30">
                  {activePhoneCustomer.name}'s Device Screen
                </span>
                <p className="text-[12px] text-zinc-500 mt-1">
                  Active connection: {activePhoneCustomer.phone} • {activePhoneCustomer.email}
                </p>
              </div>

              {/* Smartphone Frame */}
              <div className="relative w-[345px] h-[690px] bg-[#111115] rounded-[50px] p-4 shadow-2xl border-4 border-zinc-800 shadow-blue-950/20 overflow-hidden transition-all duration-300">
                {/* Dynamic Island / Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-6 bg-black rounded-b-3xl z-30 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 ml-16" />
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-900 ml-auto mr-4" />
                </div>

                {/* Screen Content */}
                <div className="relative w-full h-full rounded-[38px] overflow-hidden bg-cover bg-center flex flex-col text-white select-none"
                     style={{ backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop')` }}>
                  {/* Screen Dimmer Overlay */}
                  <div className="absolute inset-0 bg-black/40 z-0" />

                  {/* Status Bar */}
                  <div className="relative h-10 px-6 flex items-center justify-between z-20 text-[11px] font-bold text-white/90">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <div className="flex items-center gap-1.5">
                      <Wifi size={12} />
                      <span className="text-[9px]">{activePhoneCustomer.battery}%</span>
                      <Battery size={15} />
                    </div>
                  </div>

                  {/* Dynamic Push Notification Banner */}
                  {activeBanner && (
                    <div className="absolute top-11 left-3 right-3 bg-black/90 border border-zinc-800/80 rounded-2xl p-3.5 shadow-xl flex items-start gap-3 z-50 animate-bounce duration-500 backdrop-blur-md">
                      <div className="w-8 h-8 rounded-lg bg-blue-650 flex items-center justify-center flex-shrink-0 shadow-md">
                        {activeBanner.channel === "whatsapp" ? <MessageSquare size={16} className="text-white" /> : 
                         activeBanner.channel === "sms" ? <Smartphone size={16} className="text-white" /> : <Mail size={16} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-[11px] font-extrabold text-white">{activeBanner.sender}</span>
                          <span className="text-[9px] text-zinc-550 font-bold">{activeBanner.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-zinc-300 truncate">{activeBanner.message}</p>
                      </div>
                    </div>
                  )}

                  {/* App Screen Container */}
                  <div className="relative flex-1 flex flex-col z-10 overflow-hidden">
                    {phoneScreen === "inbox" ? (
                      /* Device Home Screen / App Hub */
                      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
                        <div className="text-center my-6">
                          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Device Feed</p>
                          <h3 className="text-[20px] font-black text-white mt-1">{activePhoneCustomer.name}</h3>
                        </div>

                        <div className="space-y-3">
                          {/* Messages Shortcut */}
                          <button
                            onClick={() => {
                              setPhoneScreen("chat");
                              const chatMsgs = notifications[activePhoneCustomer.id] || [];
                              chatMsgs.forEach((msg) => {
                                if (msg.communication_id && msg.status === "sent") {
                                  socket.emit("simulation:update_status", {
                                    customer_id: activePhoneCustomer.id,
                                    communication_id: msg.communication_id,
                                    channel: msg.channel,
                                    status: "delivered"
                                  });
                                }
                              });
                            }}
                            className="w-full bg-black/60 border border-zinc-850 hover:bg-black/80 rounded-2xl p-4 flex items-center justify-between transition-all backdrop-blur-md"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md">
                                <MessageSquare size={20} />
                              </div>
                              <div className="text-left">
                                <h4 className="text-[14px] font-extrabold text-white">Simulated Chat</h4>
                                <p className="text-[11px] text-zinc-400 mt-0.5">WhatsApp & SMS threads</p>
                              </div>
                            </div>
                            {activeChatMessages.length > 0 && (
                              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-extrabold text-[10px] flex items-center justify-center shadow-md">
                                {activeChatMessages.length}
                              </span>
                            )}
                          </button>

                          {/* Email Shortcut */}
                          <button
                            onClick={() => {
                              setPhoneScreen("email");
                              const emailMsgs = notifications[activePhoneCustomer.id] || [];
                              emailMsgs.forEach((msg) => {
                                if (msg.communication_id && msg.status === "sent") {
                                  socket.emit("simulation:update_status", {
                                    customer_id: activePhoneCustomer.id,
                                    communication_id: msg.communication_id,
                                    channel: "email",
                                    status: "delivered"
                                  });
                                }
                              });
                            }}
                            className="w-full bg-black/60 border border-zinc-850 hover:bg-black/80 rounded-2xl p-4 flex items-center justify-between transition-all backdrop-blur-md"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-md">
                                <Mail size={20} />
                              </div>
                              <div className="text-left">
                                <h4 className="text-[14px] font-extrabold text-white">Mail Inbox</h4>
                                <p className="text-[11px] text-zinc-400 mt-0.5">{activePhoneCustomer.email}</p>
                              </div>
                            </div>
                            {activeEmailMessages.length > 0 && (
                              <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-extrabold text-[10px] flex items-center justify-center shadow-md">
                                {activeEmailMessages.length}
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Recent History Center */}
                        <div className="mt-8 space-y-2">
                          <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest px-1 mb-2">Notification History</h4>
                          
                          {activeCustomerHistory.map((notif) => (
                            <div key={notif.id} className="bg-black/55 border border-zinc-900 rounded-xl p-3.5 flex items-start gap-2.5 backdrop-blur-sm">
                              <div className="w-7 h-7 rounded bg-zinc-900 flex items-center justify-center flex-shrink-0">
                                {notif.channel === "whatsapp" && <MessageSquare size={13} className="text-emerald-450" />}
                                {notif.channel === "sms" && <Smartphone size={13} className="text-sky-400" />}
                                {notif.channel === "email" && <Mail size={13} className="text-amber-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                  <span className="text-[11.5px] font-extrabold text-zinc-200">{notif.sender === "customer" ? "You" : notif.sender}</span>
                                  <span className="text-[9px] text-zinc-500 font-semibold">{notif.timestamp}</span>
                                </div>
                                <p className="text-[11px] text-zinc-400 line-clamp-2 leading-normal">{notif.message}</p>
                              </div>
                            </div>
                          ))}
                          
                          {activeCustomerHistory.length === 0 && (
                            <p className="text-center text-zinc-550 text-[11px] py-6 italic">No recent notifications received.</p>
                          )}
                        </div>
                      </div>
                    ) : phoneScreen === "chat" ? (
                      /* Chat App Screen */
                      <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
                        {/* Chat Header */}
                        <div className="h-12 bg-zinc-900 border-b border-zinc-850 px-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setPhoneScreen("inbox")} className="text-blue-400 hover:text-blue-300">
                              <ArrowLeft size={16} />
                            </button>
                            <div className="w-7 h-7 rounded-full bg-blue-650 flex items-center justify-center font-bold text-[11px]">
                              Z
                            </div>
                            <div>
                              <h4 className="text-[12px] font-extrabold text-white">Zari Assistant</h4>
                              <p className="text-[9px] text-emerald-450 font-bold">online</p>
                            </div>
                          </div>
                        </div>

                        {/* Chat Bubbles */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
                          {/* Welcome bubble */}
                          <div className="flex flex-col items-start max-w-[85%] self-start bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-none p-3 shadow-md">
                            <span className="text-[9px] uppercase font-bold text-emerald-450 tracking-wider mb-1">SYSTEM</span>
                            <p className="text-[12px] text-zinc-200 leading-snug">
                              Connected to Simulation center. Real-time notifications and agent dispatches will arrive below:
                            </p>
                          </div>

                          {[...activeChatMessages].reverse().map((msg) => {
                            const isSelf = msg.sender === "customer";
                            const isCampaign = !isSelf && msg.communication_id;
                            const showLinkBtn = isCampaign && (msg.status === "opened" || msg.status === "clicked");
                            const isPurchased = msg.status === "converted";
                            return (
                              <div
                                key={msg.id}
                                className={`flex flex-col items-start max-w-[88%] p-3 shadow-md rounded-2xl animate-slideUp relative ${
                                  isSelf
                                    ? "self-end bg-blue-950/40 border border-blue-900/40 rounded-tr-none text-right"
                                    : "self-start bg-zinc-900 border border-zinc-850 rounded-tl-none text-left"
                                }`}
                              >
                                <span className={`text-[9px] uppercase font-bold tracking-wider mb-1 ${isSelf ? "text-blue-400" : "text-emerald-400"}`}>
                                  {isSelf ? "You" : msg.sender}
                                </span>
                                <p
                                  onClick={() => isCampaign && !showLinkBtn && handleBubbleClick(msg)}
                                  className={`text-[12px] text-zinc-205 leading-snug whitespace-pre-wrap ${isCampaign && !showLinkBtn ? "cursor-pointer" : ""}`}
                                >
                                  {msg.message}
                                </p>

                                {/* Tap-to-view offer CTA — appears when message is opened */}
                                {showLinkBtn && !isPurchased && (
                                  <button
                                    onClick={() => handleBubbleClick(msg)}
                                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700/80 hover:bg-blue-600 text-white text-[10px] font-extrabold tracking-wide border border-blue-500/50 transition-all shadow-md"
                                  >
                                    🔗 Tap to view exclusive offer →
                                  </button>
                                )}

                                {isPurchased && (
                                  <div className="mt-2 w-full text-center py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-700/40 text-[10px] font-extrabold text-emerald-400">
                                    🎉 Purchase complete!
                                  </div>
                                )}

                                <div className="flex items-center gap-1.5 self-end mt-1">
                                  <span className="text-[8.5px] text-zinc-550 font-semibold">{msg.timestamp}</span>
                                  {isCampaign && (
                                    <span className="flex items-center">
                                      {msg.status === "sent"      && <Check size={11} className="text-zinc-500" title="Sent" />}
                                      {msg.status === "delivered" && <CheckCheck size={11} className="text-zinc-500" title="Delivered" />}
                                      {msg.status === "opened"    && <CheckCheck size={11} className="text-blue-400" title="Opened" />}
                                      {msg.status === "clicked"   && (
                                        <span className="text-[8px] bg-amber-900/60 text-amber-300 font-extrabold px-1 rounded border border-amber-700/40 flex items-center gap-0.5">
                                          <CheckCheck size={10} className="text-amber-400" /> Clicked
                                        </span>
                                      )}
                                      {msg.status === "converted" && (
                                        <span className="text-[8px] bg-emerald-950 text-emerald-400 font-extrabold px-1 rounded border border-emerald-700/40 flex items-center gap-0.5 animate-pulse">
                                          🛍️ Purchased
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Typing indicator */}
                          {isTyping && (
                            <div className="flex items-center gap-1.5 self-start bg-zinc-900 border border-zinc-850 rounded-2xl rounded-tl-none p-3 shadow-md animate-pulse">
                              <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Typing</span>
                              <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce delay-75"></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce delay-150"></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce delay-225"></span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Interactive Chat Input Bar */}
                        <form onSubmit={handleSendMessage} className="h-14 bg-zinc-900 border-t border-zinc-850 px-3 flex items-center gap-2">
                          <input
                            type="text"
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder="Type a response to the AI..."
                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-full px-3.5 py-1.5 text-[12px] text-white focus:outline-none focus:border-blue-500 placeholder-zinc-500"
                          />
                          <button type="submit" disabled={!replyMessage.trim()} className="w-8 h-8 rounded-full bg-blue-650 hover:bg-blue-700 flex items-center justify-center text-white disabled:opacity-40 transition-all flex-shrink-0">
                            <Send size={13} />
                          </button>
                        </form>
                      </div>
                    ) : phoneScreen === "shop_page" && shopMsg ? (
                      /* ── Mini Shop Landing Page (opens when link clicked in chat) ── */
                      <div className="flex-1 flex flex-col bg-white overflow-hidden">
                        {/* Shop header */}
                        <div className="h-11 bg-[#1a0533] flex items-center gap-2 px-3">
                          <button
                            onClick={() => { setPhoneScreen("chat"); setShopMsg(null); }}
                            className="text-blue-300 hover:text-white"
                          >
                            <ArrowLeft size={16} />
                          </button>
                          <span className="text-[11px] font-extrabold text-white tracking-wide">🛍️ Zari Fashion — Exclusive Offer</span>
                        </div>

                        {/* Status bar strip */}
                        <div className="bg-blue-700 px-3 py-1 text-[9px] text-white font-bold uppercase tracking-widest text-center">
                          ✨ Special campaign offer — limited time
                        </div>

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto bg-gray-50">
                          {/* Hero image */}
                          <div
                            className="w-full h-28 bg-gradient-to-br from-blue-700 via-blue-900 to-black relative flex items-center justify-center"
                          >
                            <div className="absolute inset-0 bg-black/30" />
                            <div className="relative text-center z-10 px-4">
                              <p className="text-white text-[10px] font-extrabold uppercase tracking-widest opacity-80">Zari Fashion</p>
                              <h3 className="text-white text-[18px] font-black leading-tight mt-0.5">EXCLUSIVE<br/>MEMBER OFFER</h3>
                            </div>
                          </div>

                          {/* Product card */}
                          <div className="bg-white mx-2 -mt-3 rounded-xl shadow-md p-3 border border-gray-100">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[9px] uppercase font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">EXCLUSIVE DEAL</span>
                              <span className="text-[9px] text-gray-500">Valid today only</span>
                            </div>
                            <p className="text-[13px] font-black text-gray-900 leading-snug">
                              {shopMsg.message?.substring(0, 80) || "Special campaign offer just for you!"}{shopMsg.message?.length > 80 ? "…" : ""}
                            </p>
                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-[20px] font-black text-blue-700">₹999</span>
                              <span className="text-[12px] text-gray-400 line-through">₹1,999</span>
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded">50% OFF</span>
                            </div>
                          </div>

                          {/* Features list */}
                          <div className="mx-2 mt-2 bg-white rounded-xl border border-gray-100 p-3 space-y-1.5">
                            {[
                              "Free Express Delivery",
                              "Easy 30-Day Returns",
                              "Exclusive Member Price",
                              "Premium Quality Guaranteed"
                            ].map((f) => (
                              <div key={f} className="flex items-center gap-1.5">
                                <span className="text-emerald-500 text-[11px]">✓</span>
                                <span className="text-[11px] text-gray-700">{f}</span>
                              </div>
                            ))}
                          </div>

                          {/* Timer */}
                          <div className="mx-2 mt-2 bg-red-50 border border-red-100 rounded-xl p-2.5 flex items-center gap-2">
                            <span className="text-red-500 text-[14px]">⏱️</span>
                            <div>
                              <p className="text-[9px] text-red-600 font-bold uppercase">Offer Expires In</p>
                              <p className="text-[13px] font-black text-red-700">02h 47m 33s</p>
                            </div>
                          </div>
                        </div>

                        {/* Buy button */}
                        <div className="p-2.5 bg-white border-t border-gray-100">
                          {shopMsg.status === "converted" ? (
                            <div className="w-full py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                              <p className="text-[13px] font-black text-emerald-600">🎉 Order Placed!</p>
                              <p className="text-[9px] text-emerald-500">Thank you for your purchase</p>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                socket.emit("simulation:update_status", {
                                  customer_id: activePhoneCustomer.id,
                                  communication_id: shopMsg.communication_id,
                                  channel: shopMsg.channel,
                                  status: "converted"
                                });
                                // Update local shopMsg status for immediate UI
                                setShopMsg((prev) => prev ? { ...prev, status: "converted" } : prev);
                              }}
                              className="w-full py-2.5 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white rounded-xl text-[13px] font-extrabold transition-all shadow-md active:scale-95"
                            >
                              🛍️ Buy Now — ₹999
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Email Inbox Screen */
                      <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
                        {/* Header */}
                        <div className="h-12 bg-zinc-900 border-b border-zinc-850 px-4 flex items-center gap-2">
                          <button onClick={() => setPhoneScreen("inbox")} className="text-blue-400 hover:text-blue-300">
                            <ArrowLeft size={16} />
                          </button>
                          <h4 className="text-[13px] font-extrabold text-white">Mail Box ({activeEmailMessages.length})</h4>
                        </div>

                        {/* Mail List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                          {activeEmailMessages.map((mail) => (
                            <button
                              key={mail.id}
                              onClick={() => {
                                setActiveEmail(mail);
                                setPhoneScreen("email_detail");
                                if (mail.communication_id && (mail.status === "sent" || mail.status === "delivered")) {
                                  socket.emit("simulation:update_status", {
                                    customer_id: activePhoneCustomer.id,
                                    communication_id: mail.communication_id,
                                    channel: "email",
                                    status: "opened"
                                  });
                                }
                              }}
                              className="w-full text-left bg-zinc-900/60 border border-zinc-850 rounded-xl p-3 hover:bg-zinc-900 transition-all text-white"
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[11.5px] font-extrabold text-white">{mail.sender}</span>
                                <span className="text-[9px] text-zinc-550">{mail.timestamp}</span>
                              </div>
                              <h5 className="text-[11px] font-bold text-blue-450 truncate">Campaign Notification Alert</h5>
                              <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5 leading-snug">{mail.message}</p>
                            </button>
                          ))}

                          {activeEmailMessages.length === 0 && (
                            <p className="text-center text-zinc-500 text-[11px] py-12">No promotional emails received.</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Email Detail View */}
                    {phoneScreen === "email_detail" && activeEmail && (
                      <div className="absolute inset-0 bg-zinc-950 z-40 flex flex-col overflow-hidden animate-slideUp">
                        <div className="h-12 bg-zinc-900 border-b border-zinc-850 px-4 flex items-center gap-2">
                          <button onClick={() => setPhoneScreen("email")} className="text-blue-400">
                            <ArrowLeft size={16} />
                          </button>
                          <h4 className="text-[12px] font-extrabold text-white">Promotional Message</h4>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          <div>
                            <span className="text-[10px] text-zinc-550 font-bold block">FROM: {activeEmail.sender}</span>
                            <span className="text-[10px] text-zinc-550 font-bold block">TO: {activePhoneCustomer.email}</span>
                          </div>
                          <div className="border-t border-zinc-850 pt-4">
                            <p className="text-[12px] text-zinc-305 leading-relaxed whitespace-pre-wrap">{activeEmail.message}</p>
                          </div>
                          {activeEmail.communication_id && (
                            <div className="border-t border-zinc-850 pt-4 flex flex-col gap-2">
                              <div className="flex items-center justify-between text-[10.5px]">
                                <span className="text-zinc-500 font-bold">Email Campaign Status:</span>
                                <span className="font-extrabold uppercase text-xs">
                                  {activeEmail.status === "sent" && <span className="text-zinc-400">Sent</span>}
                                  {activeEmail.status === "delivered" && <span className="text-zinc-400">Delivered</span>}
                                  {activeEmail.status === "opened" && <span className="text-blue-400">Opened</span>}
                                  {activeEmail.status === "clicked" && <span className="text-blue-400">Clicked</span>}
                                  {activeEmail.status === "converted" && <span className="text-green-400">Converted</span>}
                                </span>
                              </div>
                              
                              {(activeEmail.status === "opened" || !activeEmail.status) && (
                                <button
                                  onClick={() => {
                                    socket.emit("simulation:update_status", {
                                      customer_id: activePhoneCustomer.id,
                                      communication_id: activeEmail.communication_id,
                                      channel: "email",
                                      status: "clicked"
                                    });
                                  }}
                                  className="w-full py-2 bg-blue-650 hover:bg-blue-700 text-white rounded-xl text-[12px] font-bold transition-all shadow-md"
                                >
                                  🔗 Click Promotional Link
                                </button>
                              )}
                              {activeEmail.status === "clicked" && (
                                <button
                                  onClick={() => {
                                    socket.emit("simulation:update_status", {
                                      customer_id: activePhoneCustomer.id,
                                      communication_id: activeEmail.communication_id,
                                      channel: "email",
                                      status: "converted"
                                    });
                                  }}
                                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12px] font-bold transition-all shadow-md animate-pulse"
                                >
                                  🛍️ Complete Purchase (Convert)
                                </button>
                              )}
                              {activeEmail.status === "converted" && (
                                <div className="text-center py-2 bg-emerald-950/40 border border-emerald-900/40 text-emerald-450 rounded-xl text-[11px] font-bold">
                                  🎉 Customer converted successfully!
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Home Indicator Bar */}
                  <div className="relative h-6 flex justify-center items-center z-20">
                    <button
                      onClick={() => {
                        setPhoneScreen("inbox");
                        setActiveEmail(null);
                      }}
                      className="w-32 h-1 bg-white/60 rounded-full hover:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 space-y-3">
              <SmartphoneIcon size={48} className="text-zinc-650 animate-pulse mx-auto" />
              <p className="text-zinc-500 font-semibold text-[14px]">Waiting for campaign launch...</p>
              <p className="text-zinc-600 text-xs max-w-xs mx-auto">
                Once you run a campaign using the AI chatbot, the targeted customer devices will be simulated here with their incoming messages in real-time.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
