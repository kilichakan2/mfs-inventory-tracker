import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
const supabaseUrl = 'https://yfccjvtdsnnzajwdbnyj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY2NqdnRkc25uemFqd2RibnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDk3OTMsImV4cCI6MjA4MzI4NTc5M30.M8VM7dB5E8Ao43tQBXtvScNBt5E2vG61UdWG6HbwH-I';
const supabase = createClient(supabaseUrl, supabaseKey);

/*
 * OPTION H: MODERN DARK COLOR SCHEME
 * Background: #111827 (dark gray)
 * Header/Cards: #1f2937 (slightly lighter)
 * Primary: #14b8a6 (teal)
 * Secondary: #8b5cf6 (purple)
 * Text: #f3f4f6 (light)
 * Muted: #9ca3af (gray)
 * Border: #374151 (medium gray)
 * Error: #f87171 (red)
 */

// Sound Effects
const playSound = (type) => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  if (type === 'success') {
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1108, audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } else if (type === 'error') {
    oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } else if (type === 'delete') {
    oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  }
  
  if (navigator.vibrate) {
    if (type === 'success') navigator.vibrate(100);
    else if (type === 'error') navigator.vibrate([100, 50, 100]);
    else if (type === 'delete') navigator.vibrate(50);
  }
};

// Offline Queue Management
const OFFLINE_QUEUE_KEY = 'mfs_offline_queue';

const getOfflineQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
};

const addToOfflineQueue = (item) => {
  const queue = getOfflineQueue();
  queue.push({ ...item, queued_at: new Date().toISOString() });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

const clearOfflineQueue = () => {
  localStorage.setItem(OFFLINE_QUEUE_KEY, '[]');
};

// Barcode Parsing Functions
const parseCarcassBarcode = (barcode) => {
  const cleaned = barcode.trim().toUpperCase();
  if (cleaned.length < 15) return null;
  
  try {
    const dateStr = cleaned.substring(3, 11);
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10);
    const day = parseInt(dateStr.substring(6, 8), 10);
    const killNumber = cleaned.substring(11, 15);
    
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    
    const dateObj = new Date(year, month - 1, day);
    if (isNaN(dateObj.getTime())) return null;
    if (dateObj.getMonth() + 1 !== month || dateObj.getDate() !== day) return null;
    
    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    
    return {
      killDate: `${year}-${monthStr}-${dayStr}`,
      killDateDisplay: `${dayStr}/${monthStr}/${year}`,
      killNumber: killNumber,
      rawBarcode: cleaned
    };
  } catch (e) {
    return null;
  }
};

const parseProductBarcode = (barcode) => {
  const cleaned = barcode.trim();
  if (cleaned.length !== 13) return null;
  
  try {
    const prefix = cleaned.substring(0, 2);
    if (prefix === '26') {
      const plu = cleaned.substring(2, 6);
      const weightStr = cleaned.substring(7, 12);
      const weight = parseInt(weightStr, 10) / 1000;
      return { plu, weight, rawBarcode: cleaned };
    }
    if (prefix === '27') {
      const plu = cleaned.substring(2, 7);
      const weightStr = cleaned.substring(7, 12);
      const weight = parseInt(weightStr, 10) / 1000;
      return { plu, weight, rawBarcode: cleaned };
    }
    return null;
  } catch (e) {
    return null;
  }
};

// Notification Component
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  const bgColor = type === 'error' ? 'bg-[#f87171]' : type === 'warning' ? 'bg-[#fbbf24]' : 'bg-[#14b8a6]';
  
  return (
    <div className={`fixed top-4 left-4 right-4 mx-auto max-w-sm px-4 py-3 rounded-lg shadow-lg z-50 ${bgColor} text-white text-center`}>
      {message}
    </div>
  );
};

// Delete Confirmation Modal
const DeleteConfirmModal = ({ message, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold text-[#f3f4f6] mb-2">Confirm Delete</h3>
        <p className="text-[#9ca3af] mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-[#374151] hover:bg-[#4b5563] text-[#f3f4f6] py-3 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-[#f87171] hover:bg-[#ef4444] text-white py-3 rounded-lg font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// Online Status Indicator
const OnlineStatus = ({ isOnline, queueCount }) => {
  if (isOnline && queueCount === 0) return null;
  
  return (
    <div className={`fixed bottom-4 left-4 right-4 mx-auto max-w-xs px-3 py-2 rounded-lg text-sm font-medium z-40 text-center ${
      isOnline ? 'bg-[#fbbf24] text-black' : 'bg-[#f87171] text-white'
    }`}>
      {isOnline ? `⏳ Syncing ${queueCount} items...` : `📴 Offline - ${queueCount} queued`}
    </div>
  );
};

// Login Screen Component
const LoginScreen = ({ onLogin, showNotification }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      showNotification('Please enter username and password', 'error');
      return;
    }
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase())
      .eq('password', password)
      .single();
    
    setLoading(false);
    
    if (error || !data) {
      showNotification('Invalid username or password', 'error');
      playSound('error');
      return;
    }
    
    playSound('success');
    localStorage.setItem('mfs_user', JSON.stringify(data));
    onLogin(data);
  };
  
  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src="/logo.svg" alt="MFS Logo" className="h-24 w-auto" />
          </div>
          <h1 className="text-xl font-bold text-[#14b8a6] mb-1">Inventory Tracker</h1>
          <p className="text-[#9ca3af] text-sm">Process Room Scanning System</p>
        </div>
        
        <form onSubmit={handleLogin} className="bg-[#1f2937] rounded-xl p-6 space-y-4 border border-[#374151]">
          <div>
            <label className="block text-sm text-[#9ca3af] mb-2 font-medium">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full bg-[#111827] border border-[#374151] rounded-lg px-4 py-3 text-[#f3f4f6] focus:border-[#14b8a6] focus:outline-none transition-colors"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          
          <div>
            <label className="block text-sm text-[#9ca3af] mb-2 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-[#111827] border border-[#374151] rounded-lg px-4 py-3 text-[#f3f4f6] focus:border-[#14b8a6] focus:outline-none transition-colors"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#14b8a6] hover:bg-[#0d9488] disabled:bg-[#374151] disabled:text-[#9ca3af] py-4 rounded-xl font-semibold transition-colors text-[#111827]"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Main Menu Component
const MainMenu = ({ onNavigate, user, onLogout }) => (
  <div className="min-h-screen bg-[#111827]">
    <div className="bg-[#1f2937] px-4 py-4 border-b border-[#374151]">
      <div className="max-w-lg mx-auto flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-[#14b8a6]">MFS Inventory</h1>
          <p className="text-[#9ca3af] text-sm">Process Room Scanning</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#9ca3af]">Logged in as</p>
          <p className="text-[#14b8a6] font-medium">{user.username}</p>
        </div>
      </div>
    </div>
    <div className="p-4 max-w-lg mx-auto space-y-3">
      <button
        onClick={() => onNavigate('lamb')}
        className="w-full bg-[#1f2937] hover:bg-[#374151] border border-[#374151] rounded-xl p-5 flex items-center gap-4 transition-colors"
      >
        <span className="text-4xl">🐑</span>
        <div className="text-left">
          <h3 className="text-lg font-semibold text-[#f3f4f6]">Lamb Inventory</h3>
          <p className="text-sm text-[#9ca3af]">Track lamb carcasses and products</p>
        </div>
      </button>
      
      <button
        disabled
        className="w-full bg-[#1f2937] border border-[#374151] rounded-xl p-5 flex items-center gap-4 opacity-50 cursor-not-allowed"
      >
        <span className="text-4xl">🐄</span>
        <div className="text-left flex-1">
          <h3 className="text-lg font-semibold text-[#f3f4f6]">Beef Inventory</h3>
          <p className="text-sm text-[#9ca3af]">Track beef carcasses and products</p>
        </div>
        <span className="text-xs bg-[#374151] text-[#9ca3af] px-2 py-1 rounded">Soon</span>
      </button>
      
      <button
        disabled
        className="w-full bg-[#1f2937] border border-[#374151] rounded-xl p-5 flex items-center gap-4 opacity-50 cursor-not-allowed"
      >
        <span className="text-4xl">🐔</span>
        <div className="text-left flex-1">
          <h3 className="text-lg font-semibold text-[#f3f4f6]">Poultry Inventory</h3>
          <p className="text-sm text-[#9ca3af]">Track poultry and products</p>
        </div>
        <span className="text-xs bg-[#374151] text-[#9ca3af] px-2 py-1 rounded">Soon</span>
      </button>
      
      {user.role === 'admin' && (
        <button
          onClick={() => onNavigate('admin')}
          className="w-full bg-[#1f2937] hover:bg-[#374151] border border-[#374151] rounded-xl p-5 flex items-center gap-4 transition-colors"
        >
          <span className="text-4xl">⚙️</span>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-[#f3f4f6]">Admin / Reports</h3>
            <p className="text-sm text-[#9ca3af]">View reports, manage PLU list</p>
          </div>
        </button>
      )}
      
      <button
        onClick={onLogout}
        className="w-full bg-[#1f2937] hover:bg-[#f87171]/20 border border-[#374151] hover:border-[#f87171] rounded-xl p-4 flex items-center justify-center gap-2 transition-colors text-[#9ca3af] hover:text-[#f87171]"
      >
        <span>🚪</span>
        <span>Logout</span>
      </button>
    </div>
  </div>
);

// Numpad Component
const Numpad = ({ value, onChange }) => {
  const handlePress = (key) => {
    if (key === 'delete') {
      onChange(value.slice(0, -1));
    } else if (key === '.' && value.includes('.')) {
      return;
    } else {
      onChange(value + key);
    }
  };
  
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'];
  
  return (
    <div className="grid grid-cols-3 gap-2 p-3 bg-[#111827] rounded-xl border border-[#374151]">
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => handlePress(key)}
          className={`p-4 text-xl font-semibold rounded-lg transition-colors ${
            key === 'delete' 
              ? 'bg-[#f87171] hover:bg-[#ef4444] text-white' 
              : 'bg-[#1f2937] hover:bg-[#14b8a6] hover:text-[#111827] text-[#f3f4f6] border border-[#374151]'
          }`}
        >
          {key === 'delete' ? '⌫' : key}
        </button>
      ))}
    </div>
  );
};

// Product Module Component
const ProductModule = ({ productType, productEmoji, onBack, pluList, showNotification, user, isOnline }) => {
  const [activeTab, setActiveTab] = useState('goodsIn');
  const [goodsIn, setGoodsIn] = useState([]);
  const [goodsProduced, setGoodsProduced] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastEntry, setLastEntry] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const [carcassBarcode, setCarcassBarcode] = useState('');
  const [carcassWeight, setCarcassWeight] = useState('');
  const [parsedCarcass, setParsedCarcass] = useState(null);
  const [showNumpad, setShowNumpad] = useState(false);
  
  const [productBarcode, setProductBarcode] = useState('');
  const [parsedProduct, setParsedProduct] = useState(null);
  
  const carcassInputRef = useRef(null);
  const productInputRef = useRef(null);

  useEffect(() => {
    loadTodaysData();
  }, [productType]);

  const loadTodaysData = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
      const [goodsInRes, goodsProducedRes] = await Promise.all([
        supabase.from('goods_in').select('*').eq('product_type', productType).gte('scanned_at', today.toISOString()).order('scanned_at', { ascending: false }),
        supabase.from('goods_produced').select('*').eq('product_type', productType).gte('scanned_at', today.toISOString()).order('scanned_at', { ascending: false })
      ]);
      
      if (goodsInRes.data) setGoodsIn(goodsInRes.data);
      if (goodsProducedRes.data) setGoodsProduced(goodsProducedRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const handleCarcassBarcodeChange = (value) => {
    setCarcassBarcode(value);
    if (value.length >= 15) {
      const parsed = parseCarcassBarcode(value);
      setParsedCarcass(parsed);
      if (parsed) { setShowNumpad(true); playSound('success'); } 
      else { playSound('error'); }
    } else {
      setParsedCarcass(null);
    }
  };

  const handleProductBarcodeChange = async (value) => {
    setProductBarcode(value);
    if (value.length === 13) {
      const parsed = parseProductBarcode(value);
      if (parsed) {
        const pluInfo = pluList.find(p => p.plu === parsed.plu);
        parsed.productName = pluInfo?.product_name || `Unknown (PLU: ${parsed.plu})`;
        parsed.category = pluInfo?.category || 'Unknown';
        setParsedProduct(parsed);
        await saveGoodsProduced(parsed);
      } else { setParsedProduct(null); playSound('error'); }
    } else { setParsedProduct(null); }
  };

  const saveGoodsIn = async () => {
    if (!parsedCarcass || !carcassWeight) { showNotification('Please scan barcode and enter weight', 'error'); playSound('error'); return; }
    
    const entry = { product_type: productType, barcode: parsedCarcass.rawBarcode, kill_date: parsedCarcass.killDate, kill_number: parsedCarcass.killNumber, weight_kg: parseFloat(carcassWeight), scanned_by: user.username };
    
    if (isOnline) {
      const { data, error } = await supabase.from('goods_in').insert(entry).select();
      if (error) { addToOfflineQueue({ type: 'goods_in', data: entry }); showNotification('Saved offline', 'warning'); }
      else { setGoodsIn([data[0], ...goodsIn]); setLastEntry({ type: 'goods_in', data: data[0] }); showNotification(`Added: Kill #${parsedCarcass.killNumber} - ${carcassWeight}kg`); }
    } else {
      const offlineEntry = { ...entry, id: `offline_${Date.now()}`, scanned_at: new Date().toISOString() };
      addToOfflineQueue({ type: 'goods_in', data: entry });
      setGoodsIn([offlineEntry, ...goodsIn]);
      setLastEntry({ type: 'goods_in', data: offlineEntry, offline: true });
      showNotification('Saved offline', 'warning');
    }
    
    playSound('success');
    setCarcassBarcode(''); setCarcassWeight(''); setParsedCarcass(null); setShowNumpad(false);
    carcassInputRef.current?.focus();
  };

  const saveGoodsProduced = async (parsed) => {
    const entry = { product_type: productType, barcode: parsed.rawBarcode, plu: parsed.plu, product_name: parsed.productName, category: parsed.category, weight_kg: parsed.weight, scanned_by: user.username };
    
    if (isOnline) {
      const { data, error } = await supabase.from('goods_produced').insert(entry).select();
      if (error) { addToOfflineQueue({ type: 'goods_produced', data: entry }); showNotification('Saved offline', 'warning'); }
      else { setGoodsProduced([data[0], ...goodsProduced]); setLastEntry({ type: 'goods_produced', data: data[0] }); showNotification(`Added: ${parsed.productName} - ${parsed.weight.toFixed(3)}kg`); }
    } else {
      const offlineEntry = { ...entry, id: `offline_${Date.now()}`, scanned_at: new Date().toISOString() };
      addToOfflineQueue({ type: 'goods_produced', data: entry });
      setGoodsProduced([offlineEntry, ...goodsProduced]);
      setLastEntry({ type: 'goods_produced', data: offlineEntry, offline: true });
      showNotification('Saved offline', 'warning');
    }
    
    playSound('success');
    setTimeout(() => { setProductBarcode(''); setParsedProduct(null); productInputRef.current?.focus(); }, 500);
  };

  const undoLastEntry = async () => {
    if (!lastEntry) return;
    if (lastEntry.offline) { const queue = getOfflineQueue(); const filtered = queue.filter(item => item.queued_at !== lastEntry.data.queued_at); localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered)); }
    else { const table = lastEntry.type === 'goods_in' ? 'goods_in' : 'goods_produced'; await supabase.from(table).delete().eq('id', lastEntry.data.id); }
    
    if (lastEntry.type === 'goods_in') { setGoodsIn(goodsIn.filter(item => item.id !== lastEntry.data.id)); }
    else { setGoodsProduced(goodsProduced.filter(item => item.id !== lastEntry.data.id)); }
    
    playSound('delete'); showNotification('Last entry undone'); setLastEntry(null);
  };

  const confirmDeleteGoodsIn = (item) => {
    setDeleteConfirm({
      type: 'goodsIn',
      id: item.id,
      message: `Delete Kill #${item.kill_number} (${item.weight_kg}kg)?`
    });
  };

  const confirmDeleteGoodsProduced = (item) => {
    setDeleteConfirm({
      type: 'goodsProduced',
      id: item.id,
      message: `Delete ${item.product_name} (${parseFloat(item.weight_kg).toFixed(3)}kg)?`
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    
    if (deleteConfirm.type === 'goodsIn') {
      if (deleteConfirm.id.toString().startsWith('offline_')) { setGoodsIn(goodsIn.filter(item => item.id !== deleteConfirm.id)); }
      else { await supabase.from('goods_in').delete().eq('id', deleteConfirm.id); setGoodsIn(goodsIn.filter(item => item.id !== deleteConfirm.id)); }
      if (lastEntry?.data?.id === deleteConfirm.id) setLastEntry(null);
    } else {
      if (deleteConfirm.id.toString().startsWith('offline_')) { setGoodsProduced(goodsProduced.filter(item => item.id !== deleteConfirm.id)); }
      else { await supabase.from('goods_produced').delete().eq('id', deleteConfirm.id); setGoodsProduced(goodsProduced.filter(item => item.id !== deleteConfirm.id)); }
      if (lastEntry?.data?.id === deleteConfirm.id) setLastEntry(null);
    }
    
    playSound('delete');
    showNotification('Entry deleted');
    setDeleteConfirm(null);
  };

  const deleteGoodsIn = async (id) => {
    if (id.toString().startsWith('offline_')) { setGoodsIn(goodsIn.filter(item => item.id !== id)); }
    else { await supabase.from('goods_in').delete().eq('id', id); setGoodsIn(goodsIn.filter(item => item.id !== id)); }
    playSound('delete'); showNotification('Entry deleted'); if (lastEntry?.data?.id === id) setLastEntry(null);
  };

  const deleteGoodsProduced = async (id) => {
    if (id.toString().startsWith('offline_')) { setGoodsProduced(goodsProduced.filter(item => item.id !== id)); }
    else { await supabase.from('goods_produced').delete().eq('id', id); setGoodsProduced(goodsProduced.filter(item => item.id !== id)); }
    playSound('delete'); showNotification('Entry deleted'); if (lastEntry?.data?.id === id) setLastEntry(null);
  };

  const goodsInTotal = goodsIn.reduce((sum, item) => sum + parseFloat(item.weight_kg), 0);
  const goodsProducedTotal = goodsProduced.reduce((sum, item) => sum + parseFloat(item.weight_kg), 0);
  const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (dateStr) => { if (!dateStr) return ''; const [year, month, day] = dateStr.split('-'); return `${day}/${month}/${year}`; };

  if (loading) return <div className="min-h-screen bg-[#111827] flex items-center justify-center"><div className="text-[#14b8a6] text-xl font-medium">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-[#111827] text-[#f3f4f6] pb-20">
      {deleteConfirm && (
        <DeleteConfirmModal
          message={deleteConfirm.message}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
      <div className="bg-[#1f2937] px-4 py-3 border-b border-[#374151]">
        <div className="max-w-lg mx-auto">
          <button onClick={onBack} className="text-[#9ca3af] text-sm mb-2 flex items-center gap-1 hover:text-[#14b8a6]">← Back</button>
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-[#14b8a6]">{productEmoji} {productType.charAt(0).toUpperCase() + productType.slice(1)}</h1>
            {lastEntry && <button onClick={undoLastEntry} className="bg-[#374151] hover:bg-[#4b5563] px-3 py-1 rounded-lg text-sm font-medium">↩️ Undo</button>}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab('goodsIn')} className={`flex-1 py-3 px-4 text-center font-medium rounded-lg border ${activeTab === 'goodsIn' ? 'bg-[#14b8a6] text-[#111827] border-[#14b8a6]' : 'bg-[#1f2937] text-[#9ca3af] border-[#374151]'}`}>📥 Goods In</button>
          <button onClick={() => setActiveTab('goodsProduced')} className={`flex-1 py-3 px-4 text-center font-medium rounded-lg border ${activeTab === 'goodsProduced' ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]' : 'bg-[#1f2937] text-[#9ca3af] border-[#374151]'}`}>📦 Produced</button>
        </div>

        {activeTab === 'goodsIn' && (
          <div className="space-y-4">
            <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4">
              <div className="text-[#14b8a6] text-xs font-semibold mb-2 uppercase">Today's Intake</div>
              <div className="flex gap-8">
                <div><span className="text-3xl font-bold">{goodsIn.length}</span><span className="text-[#9ca3af] ml-2">carcasses</span></div>
                <div><span className="text-3xl font-bold">{goodsInTotal.toFixed(1)}</span><span className="text-[#9ca3af] ml-2">kg</span></div>
              </div>
            </div>

            <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-sm text-[#9ca3af] mb-2">Scan Carcass Barcode</label>
                <input ref={carcassInputRef} type="text" value={carcassBarcode} onChange={(e) => handleCarcassBarcodeChange(e.target.value)} placeholder="Scan or enter barcode..." className="w-full bg-[#111827] border border-[#374151] rounded-lg px-4 py-3 text-lg focus:border-[#14b8a6] focus:outline-none" autoFocus />
              </div>
              {parsedCarcass && (
                <div className="bg-[#111827] rounded-lg p-3 grid grid-cols-2 gap-3 border border-[#374151]">
                  <div className="text-sm"><span className="text-[#9ca3af]">Kill Date: </span><span className="text-[#14b8a6] font-semibold">{parsedCarcass.killDateDisplay}</span></div>
                  <div className="text-sm"><span className="text-[#9ca3af]">Kill #: </span><span className="text-[#14b8a6] font-semibold">{parsedCarcass.killNumber}</span></div>
                </div>
              )}
              {carcassBarcode && !parsedCarcass && carcassBarcode.length >= 10 && <div className="bg-[#f87171]/10 border border-[#f87171] rounded-lg p-3 text-[#f87171] text-sm">⚠️ Could not parse barcode</div>}
              <div>
                <label className="block text-sm text-[#9ca3af] mb-2">Weight (kg)</label>
                <input type="text" value={carcassWeight} onChange={(e) => setCarcassWeight(e.target.value)} onFocus={() => setShowNumpad(true)} placeholder="Enter weight..." className="w-full bg-[#111827] border border-[#374151] rounded-lg px-4 py-3 text-lg focus:border-[#14b8a6] focus:outline-none" readOnly />
              </div>
              {showNumpad && <Numpad value={carcassWeight} onChange={setCarcassWeight} />}
              <button onClick={saveGoodsIn} disabled={!parsedCarcass || !carcassWeight} className="w-full bg-[#14b8a6] hover:bg-[#0d9488] disabled:bg-[#374151] disabled:text-[#9ca3af] py-4 rounded-xl font-semibold text-[#111827]">+ Add Carcass</button>
            </div>

            <div>
              <h3 className="text-[#9ca3af] text-xs font-semibold mb-3 uppercase">Today's Entries</h3>
              <div className="space-y-2">
                {goodsIn.slice(0, 10).map(item => (
                  <div key={item.id} className={`bg-[#1f2937] border border-[#374151] rounded-lg p-3 flex justify-between items-center ${item.id.toString().startsWith('offline_') ? 'border-l-2 border-l-[#fbbf24]' : ''}`}>
                    <div>
                      <div className="font-semibold">Kill #{item.kill_number}{item.id.toString().startsWith('offline_') && <span className="ml-2 text-xs text-[#fbbf24]">⏳</span>}</div>
                      <div className="text-sm text-[#9ca3af]">{formatDate(item.kill_date)} • {item.weight_kg}kg • {formatTime(item.scanned_at)}</div>
                    </div>
                    <button onClick={() => confirmDeleteGoodsIn(item)} className="text-[#f87171] hover:text-[#ef4444] p-2">✕</button>
                  </div>
                ))}
                {goodsIn.length === 0 && <div className="text-[#9ca3af] text-center py-8 bg-[#1f2937] border border-[#374151] rounded-lg">No entries yet today</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'goodsProduced' && (
          <div className="space-y-4">
            <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4">
              <div className="text-[#8b5cf6] text-xs font-semibold mb-2 uppercase">Today's Production</div>
              <div className="flex gap-8">
                <div><span className="text-3xl font-bold">{goodsProduced.length}</span><span className="text-[#9ca3af] ml-2">items</span></div>
                <div><span className="text-3xl font-bold">{goodsProducedTotal.toFixed(1)}</span><span className="text-[#9ca3af] ml-2">kg</span></div>
              </div>
            </div>

            <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-sm text-[#9ca3af] mb-2">Scan Product Barcode (EAN-13)</label>
                <input ref={productInputRef} type="text" value={productBarcode} onChange={(e) => handleProductBarcodeChange(e.target.value)} placeholder="Scan product label..." className="w-full bg-[#111827] border border-[#374151] rounded-lg px-4 py-3 text-lg focus:border-[#8b5cf6] focus:outline-none" autoFocus />
              </div>
              {parsedProduct && (
                <div className="bg-[#111827] rounded-lg p-3 space-y-2 border border-[#374151]">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-sm"><span className="text-[#9ca3af]">PLU: </span><span className="text-[#8b5cf6] font-semibold">{parsedProduct.plu}</span></div>
                    <div className="text-sm"><span className="text-[#9ca3af]">Weight: </span><span className="text-[#8b5cf6] font-semibold">{parsedProduct.weight.toFixed(3)} kg</span></div>
                  </div>
                  <div className="text-sm"><span className="text-[#9ca3af]">Product: </span><span className="text-[#8b5cf6] font-semibold">{parsedProduct.productName}</span></div>
                </div>
              )}
              {productBarcode && !parsedProduct && productBarcode.length >= 10 && <div className="bg-[#f87171]/10 border border-[#f87171] rounded-lg p-3 text-[#f87171] text-sm">⚠️ Could not parse - use Format 14</div>}
              <div className="bg-[#8b5cf6] py-4 rounded-xl font-semibold text-center text-white">✓ Auto-saves on scan</div>
            </div>

            <div>
              <h3 className="text-[#9ca3af] text-xs font-semibold mb-3 uppercase">Today's Entries</h3>
              <div className="space-y-2">
                {goodsProduced.slice(0, 10).map(item => (
                  <div key={item.id} className={`bg-[#1f2937] border border-[#374151] rounded-lg p-3 flex justify-between items-center ${item.id.toString().startsWith('offline_') ? 'border-l-2 border-l-[#fbbf24]' : ''}`}>
                    <div>
                      <div className="font-semibold">{item.product_name}{item.id.toString().startsWith('offline_') && <span className="ml-2 text-xs text-[#fbbf24]">⏳</span>}</div>
                      <div className="text-sm text-[#9ca3af]">{parseFloat(item.weight_kg).toFixed(3)}kg • PLU {item.plu} • {formatTime(item.scanned_at)}</div>
                    </div>
                    <button onClick={() => confirmDeleteGoodsProduced(item)} className="text-[#f87171] hover:text-[#ef4444] p-2">✕</button>
                  </div>
                ))}
                {goodsProduced.length === 0 && <div className="text-[#9ca3af] text-center py-8 bg-[#1f2937] border border-[#374151] rounded-lg">No entries yet today</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Admin Dashboard Component
const AdminDashboard = ({ onBack, pluList, setPluList, showNotification }) => {
  const [activeSection, setActiveSection] = useState('reports');
  const [goodsIn, setGoodsIn] = useState([]);
  const [goodsProduced, setGoodsProduced] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('butcher');
  const fileInputRef = useRef(null);

  useEffect(() => { loadData(); loadUsers(); }, [productFilter, dateFilter, customDateFrom, customDateTo]);

  const loadUsers = async () => { const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false }); if (data) setUsers(data); };

  const getDateRange = () => {
    const now = new Date();
    let from, to;
    switch (dateFilter) {
      case 'today': from = new Date(now.setHours(0, 0, 0, 0)); to = new Date(); break;
      case 'yesterday': from = new Date(now.setDate(now.getDate() - 1)); from.setHours(0, 0, 0, 0); to = new Date(from); to.setHours(23, 59, 59, 999); break;
      case 'week': from = new Date(now.setDate(now.getDate() - 7)); to = new Date(); break;
      case 'month': from = new Date(now.setMonth(now.getMonth() - 1)); to = new Date(); break;
      case 'custom': from = customDateFrom ? new Date(customDateFrom) : new Date(0); to = customDateTo ? new Date(customDateTo + 'T23:59:59') : new Date(); break;
      default: from = new Date(0); to = new Date();
    }
    return { from, to };
  };

  const loadData = async () => {
    setLoading(true);
    const { from, to } = getDateRange();
    let goodsInQuery = supabase.from('goods_in').select('*').gte('scanned_at', from.toISOString()).lte('scanned_at', to.toISOString()).order('scanned_at', { ascending: false });
    let goodsProducedQuery = supabase.from('goods_produced').select('*').gte('scanned_at', from.toISOString()).lte('scanned_at', to.toISOString()).order('scanned_at', { ascending: false });
    if (productFilter !== 'all') { goodsInQuery = goodsInQuery.eq('product_type', productFilter); goodsProducedQuery = goodsProducedQuery.eq('product_type', productFilter); }
    const [goodsInRes, goodsProducedRes] = await Promise.all([goodsInQuery, goodsProducedQuery]);
    if (goodsInRes.data) setGoodsIn(goodsInRes.data);
    if (goodsProducedRes.data) setGoodsProduced(goodsProducedRes.data);
    setLoading(false);
  };

  const handlePluUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const pluIndex = headers.findIndex(h => h === 'PLU');
    const nameIndex = headers.findIndex(h => h === 'GPTA1');
    const categoryIndex = headers.findIndex(h => h === 'LGID');
    if (pluIndex === -1 || nameIndex === -1) { showNotification('Invalid CSV format', 'error'); return; }
    const newPluList = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      const cleanValues = values.map(v => v.replace(/"/g, '').trim());
      const plu = cleanValues[pluIndex];
      const productName = cleanValues[nameIndex];
      const category = categoryIndex !== -1 ? cleanValues[categoryIndex] : '';
      if (plu && productName) {
        let productType = 'other';
        if (category?.toLowerCase().includes('lamb')) productType = 'lamb';
        else if (category?.toLowerCase().includes('beef')) productType = 'beef';
        else if (category?.toLowerCase().includes('chicken') || category?.toLowerCase().includes('poultry')) productType = 'poultry';
        newPluList.push({ plu, product_name: productName, category, product_type: productType });
      }
    }
    await supabase.from('plu_list').delete().neq('plu', '');
    const { error } = await supabase.from('plu_list').insert(newPluList);
    if (error) { showNotification('Error uploading PLU list', 'error'); return; }
    setPluList(newPluList); playSound('success'); showNotification(`PLU list updated: ${newPluList.length} products`);
    fileInputRef.current.value = '';
  };

  const addUser = async () => {
    if (!newUsername || !newPassword) { showNotification('Please enter username and password', 'error'); return; }
    const { error } = await supabase.from('users').insert({ username: newUsername.toLowerCase(), password: newPassword, role: newRole });
    if (error) { showNotification('Error creating user', 'error'); return; }
    playSound('success'); showNotification(`User ${newUsername} created`);
    setNewUsername(''); setNewPassword(''); loadUsers();
  };

  const deleteUser = async (id, username) => {
    if (username === 'admin') { showNotification('Cannot delete admin', 'error'); return; }
    if (!confirm(`Delete user ${username}?`)) return;
    await supabase.from('users').delete().eq('id', id);
    playSound('delete'); showNotification(`User ${username} deleted`); loadUsers();
  };

  const exportGoodsIn = () => {
    const headers = ['Date', 'Time', 'Type', 'Barcode', 'Kill Date', 'Kill #', 'Weight', 'By'];
    const rows = goodsIn.map(item => [new Date(item.scanned_at).toLocaleDateString('en-GB'), new Date(item.scanned_at).toLocaleTimeString('en-GB'), item.product_type, item.barcode, item.kill_date, item.kill_number, item.weight_kg, item.scanned_by || '']);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadCSV(csv, 'mfs-goods-in.csv');
  };

  const exportGoodsProduced = () => {
    const headers = ['Date', 'Time', 'Type', 'Barcode', 'PLU', 'Product', 'Category', 'Weight', 'By'];
    const rows = goodsProduced.map(item => [new Date(item.scanned_at).toLocaleDateString('en-GB'), new Date(item.scanned_at).toLocaleTimeString('en-GB'), item.product_type, item.barcode, item.plu, `"${item.product_name}"`, item.category, item.weight_kg, item.scanned_by || '']);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadCSV(csv, 'mfs-goods-produced.csv');
  };

  const downloadCSV = (content, filename) => { const blob = new Blob([content], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); };

  const clearAllData = async () => {
    if (!confirm('Clear ALL data? This cannot be undone.')) return;
    await Promise.all([supabase.from('goods_in').delete().neq('id', '00000000-0000-0000-0000-000000000000'), supabase.from('goods_produced').delete().neq('id', '00000000-0000-0000-0000-000000000000')]);
    setGoodsIn([]); setGoodsProduced([]); playSound('delete'); showNotification('All data cleared');
  };

  const goodsInTotal = goodsIn.reduce((sum, item) => sum + parseFloat(item.weight_kg), 0);
  const goodsProducedTotal = goodsProduced.reduce((sum, item) => sum + parseFloat(item.weight_kg), 0);
  const yieldPercent = goodsInTotal > 0 ? ((goodsProducedTotal / goodsInTotal) * 100).toFixed(1) : 0;
  const formatDateTime = (ts) => { const d = new Date(ts); return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`; };

  return (
    <div className="min-h-screen bg-[#111827] text-[#f3f4f6]">
      <div className="bg-[#1f2937] px-4 py-3 border-b border-[#374151]">
        <div className="max-w-lg mx-auto">
          <button onClick={onBack} className="text-[#9ca3af] text-sm mb-2 flex items-center gap-1 hover:text-[#14b8a6]">← Back</button>
          <h1 className="text-xl font-bold text-[#14b8a6]">⚙️ Admin / Reports</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveSection('reports')} className={`flex-1 py-2 px-3 text-center font-medium rounded-lg border text-sm ${activeSection === 'reports' ? 'bg-[#14b8a6] text-[#111827] border-[#14b8a6]' : 'bg-[#1f2937] text-[#9ca3af] border-[#374151]'}`}>📊 Reports</button>
          <button onClick={() => setActiveSection('plu')} className={`flex-1 py-2 px-3 text-center font-medium rounded-lg border text-sm ${activeSection === 'plu' ? 'bg-[#14b8a6] text-[#111827] border-[#14b8a6]' : 'bg-[#1f2937] text-[#9ca3af] border-[#374151]'}`}>📋 PLU</button>
          <button onClick={() => setActiveSection('users')} className={`flex-1 py-2 px-3 text-center font-medium rounded-lg border text-sm ${activeSection === 'users' ? 'bg-[#14b8a6] text-[#111827] border-[#14b8a6]' : 'bg-[#1f2937] text-[#9ca3af] border-[#374151]'}`}>👥 Users</button>
        </div>

        {activeSection === 'reports' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-3 text-center"><div className="text-2xl font-bold text-[#14b8a6]">{goodsIn.length}</div><div className="text-xs text-[#9ca3af]">In</div><div className="text-sm text-[#14b8a6]">{goodsInTotal.toFixed(1)}kg</div></div>
              <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-3 text-center"><div className="text-2xl font-bold text-[#8b5cf6]">{goodsProduced.length}</div><div className="text-xs text-[#9ca3af]">Out</div><div className="text-sm text-[#8b5cf6]">{goodsProducedTotal.toFixed(1)}kg</div></div>
              <div className="bg-[#14b8a6] rounded-xl p-3 text-center"><div className="text-2xl font-bold text-[#111827]">{yieldPercent}%</div><div className="text-xs text-[#111827]/70">Yield</div></div>
            </div>

            <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-[#9ca3af] uppercase">Filters</h3>
              <div className="grid grid-cols-2 gap-3">
                <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm"><option value="all">All</option><option value="lamb">🐑 Lamb</option><option value="beef">🐄 Beef</option><option value="poultry">🐔 Poultry</option></select>
                <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm"><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">7 Days</option><option value="month">30 Days</option><option value="custom">Custom</option></select>
              </div>
              {dateFilter === 'custom' && <div className="grid grid-cols-2 gap-3"><input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} className="bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm" /><input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} className="bg-[#111827] border border-[#374151] rounded-lg px-3 py-2 text-sm" /></div>}
              <div className="flex gap-2">
                <button onClick={exportGoodsIn} className="flex-1 bg-[#14b8a6] hover:bg-[#0d9488] py-2 rounded-lg text-sm font-medium text-[#111827]">Export In</button>
                <button onClick={exportGoodsProduced} className="flex-1 bg-[#8b5cf6] hover:bg-[#7c3aed] py-2 rounded-lg text-sm font-medium text-white">Export Out</button>
              </div>
            </div>

            {loading ? <div className="text-center py-8 text-[#9ca3af]">Loading...</div> : (
              <>
                <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4">
                  <h3 className="text-[#14b8a6] font-semibold mb-3">📥 Goods In ({goodsIn.length})</h3>
                  <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-[#9ca3af] text-left border-b border-[#374151]"><th className="pb-2">Date</th><th className="pb-2">Kill #</th><th className="pb-2">Weight</th></tr></thead><tbody>{goodsIn.slice(0, 10).map(item => <tr key={item.id} className="border-b border-[#374151]/50"><td className="py-2">{formatDateTime(item.scanned_at)}</td><td className="py-2">{item.kill_number}</td><td className="py-2">{item.weight_kg}kg</td></tr>)}</tbody></table>{goodsIn.length === 0 && <div className="text-center py-4 text-[#9ca3af]">No data</div>}</div>
                </div>
                <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4">
                  <h3 className="text-[#8b5cf6] font-semibold mb-3">📦 Produced ({goodsProduced.length})</h3>
                  <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-[#9ca3af] text-left border-b border-[#374151]"><th className="pb-2">Date</th><th className="pb-2">Product</th><th className="pb-2">Weight</th></tr></thead><tbody>{goodsProduced.slice(0, 10).map(item => <tr key={item.id} className="border-b border-[#374151]/50"><td className="py-2">{formatDateTime(item.scanned_at)}</td><td className="py-2">{item.product_name}</td><td className="py-2">{parseFloat(item.weight_kg).toFixed(3)}kg</td></tr>)}</tbody></table>{goodsProduced.length === 0 && <div className="text-center py-4 text-[#9ca3af]">No data</div>}</div>
                </div>
              </>
            )}

            <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-[#f87171] font-semibold mb-3">⚠️ Danger Zone</h3>
              <button onClick={clearAllData} className="bg-transparent border border-[#f87171] text-[#f87171] hover:bg-[#f87171] hover:text-white px-4 py-2 rounded-lg text-sm">🗑️ Clear All Data</button>
            </div>
          </div>
        )}

        {activeSection === 'plu' && (
          <div className="space-y-4">
            <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-[#14b8a6] font-semibold mb-3">📋 PLU List</h3>
              <p className="text-sm text-[#9ca3af] mb-4">{pluList.length} products loaded</p>
              <input type="file" ref={fileInputRef} accept=".csv" onChange={handlePluUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-[#374151] hover:border-[#14b8a6] rounded-xl p-8 text-center text-[#9ca3af] hover:text-[#14b8a6]">📁 Upload MXi Pro CSV</button>
            </div>
            <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-[#9ca3af] font-semibold mb-3">Current PLU List</h3>
              <div className="max-h-96 overflow-y-auto"><table className="w-full text-sm"><thead><tr className="text-[#9ca3af] text-left border-b border-[#374151] sticky top-0 bg-[#1f2937]"><th className="pb-2">PLU</th><th className="pb-2">Product</th></tr></thead><tbody>{pluList.slice(0, 50).map(item => <tr key={item.plu} className="border-b border-[#374151]/50"><td className="py-2 text-[#14b8a6]">{item.plu}</td><td className="py-2">{item.product_name}</td></tr>)}</tbody></table>{pluList.length === 0 && <div className="text-center py-8 text-[#9ca3af]">No PLU list</div>}{pluList.length > 50 && <div className="text-center py-4 text-[#9ca3af]">Showing 50 of {pluList.length}</div>}</div>
            </div>
          </div>
        )}

        {activeSection === 'users' && (
          <div className="space-y-4">
            <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-[#14b8a6] font-semibold mb-3">➕ Add User</h3>
              <div className="space-y-3">
                <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Username" className="w-full bg-[#111827] border border-[#374151] rounded-lg px-4 py-2 text-sm" autoCapitalize="none" />
                <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password" className="w-full bg-[#111827] border border-[#374151] rounded-lg px-4 py-2 text-sm" />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full bg-[#111827] border border-[#374151] rounded-lg px-4 py-2 text-sm"><option value="butcher">Butcher</option><option value="admin">Admin</option></select>
                <button onClick={addUser} className="w-full bg-[#14b8a6] hover:bg-[#0d9488] py-2 rounded-lg text-sm font-medium text-[#111827]">Add User</button>
              </div>
            </div>
            <div className="bg-[#1f2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-[#9ca3af] font-semibold mb-3">👥 Users</h3>
              <div className="space-y-2">{users.map(u => <div key={u.id} className="flex justify-between items-center bg-[#111827] border border-[#374151] rounded-lg p-3"><div><div className="font-medium">{u.username}</div><div className="text-xs text-[#9ca3af]">{u.role}</div></div>{u.username !== 'admin' && <button onClick={() => deleteUser(u.id, u.username)} className="text-[#f87171] hover:text-[#ef4444] p-2">✕</button>}</div>)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main App Component
export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [pluList, setPluList] = useState([]);
  const [notification, setNotification] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  useEffect(() => { const savedUser = localStorage.getItem('mfs_user'); if (savedUser) { setUser(JSON.parse(savedUser)); setCurrentScreen('menu'); } loadPluList(); }, []);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); syncOfflineQueue(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const interval = setInterval(() => { setOfflineQueueCount(getOfflineQueue().length); if (navigator.onLine && getOfflineQueue().length > 0) { syncOfflineQueue(); } }, 5000);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); clearInterval(interval); };
  }, []);

  const syncOfflineQueue = async () => {
    const queue = getOfflineQueue(); if (queue.length === 0) return;
    for (const item of queue) { try { if (item.type === 'goods_in') { await supabase.from('goods_in').insert(item.data); } else if (item.type === 'goods_produced') { await supabase.from('goods_produced').insert(item.data); } } catch (error) { console.error('Sync error:', error); return; } }
    clearOfflineQueue(); setOfflineQueueCount(0); showNotification('Offline data synced!');
  };

  const loadPluList = async () => { const { data } = await supabase.from('plu_list').select('*'); if (data) setPluList(data); };
  const showNotification = (message, type = 'success') => { setNotification({ message, type }); };
  const handleLogin = (userData) => { setUser(userData); setCurrentScreen('menu'); };
  const handleLogout = () => { localStorage.removeItem('mfs_user'); setUser(null); setCurrentScreen('login'); };

  return (
    <div className="min-h-screen bg-[#111827]">
      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
      <OnlineStatus isOnline={isOnline} queueCount={offlineQueueCount} />
      {currentScreen === 'login' && <LoginScreen onLogin={handleLogin} showNotification={showNotification} />}
      {currentScreen === 'menu' && user && <MainMenu onNavigate={setCurrentScreen} user={user} onLogout={handleLogout} />}
      {currentScreen === 'lamb' && user && <ProductModule productType="lamb" productEmoji="🐑" onBack={() => setCurrentScreen('menu')} pluList={pluList} showNotification={showNotification} user={user} isOnline={isOnline} />}
      {currentScreen === 'admin' && user && <AdminDashboard onBack={() => setCurrentScreen('menu')} pluList={pluList} setPluList={setPluList} showNotification={showNotification} />}
    </div>
  );
}
