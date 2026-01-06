import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
const supabaseUrl = 'https://yfccjvtdsnnzajwdbnyj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY2NqdnRkc25uemFqd2RibnlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDk3OTMsImV4cCI6MjA4MzI4NTc5M30.M8VM7dB5E8Ao43tQBXtvScNBt5E2vG61UdWG6HbwH-I';
const supabase = createClient(supabaseUrl, supabaseKey);

// Sound Effects
const playSound = (type) => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  if (type === 'success') {
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.setValueAtTime(1108, audioContext.currentTime + 0.1); // C#6
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
  
  // Vibrate if supported
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
    const prefix = cleaned.substring(0, 3);
    const dateStr = cleaned.substring(3, 11);
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const killNumber = cleaned.substring(11, 15);
    
    const dateObj = new Date(year, month - 1, day);
    if (isNaN(dateObj.getTime())) return null;
    
    return {
      killDate: `${year}-${month}-${day}`,
      killDateDisplay: `${day}/${month}/${year}`,
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
  
  return (
    <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${
      type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'
    } text-white`}>
      {message}
    </div>
  );
};

// Online Status Indicator
const OnlineStatus = ({ isOnline, queueCount }) => {
  if (isOnline && queueCount === 0) return null;
  
  return (
    <div className={`fixed bottom-4 left-4 px-3 py-2 rounded-lg text-sm font-medium z-40 ${
      isOnline ? 'bg-amber-600' : 'bg-red-600'
    } text-white`}>
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-emerald-400 mb-2">MFS Inventory Tracker</h1>
          <p className="text-slate-400">Process Room Scanning System</p>
        </div>
        
        <form onSubmit={handleLogin} className="bg-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-400 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 py-4 rounded-xl font-semibold transition-colors"
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
  <div className="min-h-screen bg-slate-900">
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-emerald-400">MFS Inventory Tracker</h1>
          <p className="text-slate-400 text-sm">Process Room Scanning System</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Logged in as</p>
          <p className="text-emerald-400 font-medium">{user.username}</p>
        </div>
      </div>
    </div>
    <div className="p-4 space-y-3">
      <button
        onClick={() => onNavigate('lamb')}
        className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl p-5 flex items-center gap-4 transition-colors"
      >
        <span className="text-4xl">🐑</span>
        <div className="text-left">
          <h3 className="text-lg font-semibold text-white">Lamb Inventory</h3>
          <p className="text-sm text-slate-400">Track lamb carcasses and products</p>
        </div>
      </button>
      
      <button
        disabled
        className="w-full bg-slate-800/50 rounded-xl p-5 flex items-center gap-4 opacity-50 cursor-not-allowed"
      >
        <span className="text-4xl">🐄</span>
        <div className="text-left flex-1">
          <h3 className="text-lg font-semibold text-white">Beef Inventory</h3>
          <p className="text-sm text-slate-400">Track beef carcasses and products</p>
        </div>
        <span className="text-xs bg-slate-700 text-slate-400 px-2 py-1 rounded">Coming Soon</span>
      </button>
      
      <button
        disabled
        className="w-full bg-slate-800/50 rounded-xl p-5 flex items-center gap-4 opacity-50 cursor-not-allowed"
      >
        <span className="text-4xl">🐔</span>
        <div className="text-left flex-1">
          <h3 className="text-lg font-semibold text-white">Poultry Inventory</h3>
          <p className="text-sm text-slate-400">Track poultry and products</p>
        </div>
        <span className="text-xs bg-slate-700 text-slate-400 px-2 py-1 rounded">Coming Soon</span>
      </button>
      
      {user.role === 'admin' && (
        <button
          onClick={() => onNavigate('admin')}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl p-5 flex items-center gap-4 transition-colors"
        >
          <span className="text-4xl">⚙️</span>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white">Admin / Reports</h3>
            <p className="text-sm text-slate-400">View reports, manage PLU list</p>
          </div>
        </button>
      )}
      
      <button
        onClick={onLogout}
        className="w-full bg-slate-800 hover:bg-red-900/50 rounded-xl p-4 flex items-center justify-center gap-2 transition-colors text-slate-400 hover:text-red-400"
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
    <div className="grid grid-cols-3 gap-2 p-4 bg-slate-800 rounded-xl">
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => handlePress(key)}
          className={`p-4 text-xl font-semibold rounded-lg transition-colors ${
            key === 'delete' 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-slate-700 hover:bg-slate-600 text-white'
          }`}
        >
          {key === 'delete' ? '⌫' : key}
        </button>
      ))}
    </div>
  );
};

// Product Module Component (Lamb/Beef/Poultry)
const ProductModule = ({ productType, productEmoji, onBack, pluList, showNotification, user, isOnline, syncOfflineQueue }) => {
  const [activeTab, setActiveTab] = useState('goodsIn');
  const [goodsIn, setGoodsIn] = useState([]);
  const [goodsProduced, setGoodsProduced] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastEntry, setLastEntry] = useState(null);
  
  // Goods In state
  const [carcassBarcode, setCarcassBarcode] = useState('');
  const [carcassWeight, setCarcassWeight] = useState('');
  const [parsedCarcass, setParsedCarcass] = useState(null);
  const [showNumpad, setShowNumpad] = useState(false);
  
  // Goods Produced state
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
        supabase
          .from('goods_in')
          .select('*')
          .eq('product_type', productType)
          .gte('scanned_at', today.toISOString())
          .order('scanned_at', { ascending: false }),
        supabase
          .from('goods_produced')
          .select('*')
          .eq('product_type', productType)
          .gte('scanned_at', today.toISOString())
          .order('scanned_at', { ascending: false })
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
      if (parsed) {
        setShowNumpad(true);
        playSound('success');
      } else {
        playSound('error');
      }
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
        parsed.productName = pluInfo?.product_name || `Unknown Product (PLU: ${parsed.plu})`;
        parsed.category = pluInfo?.category || 'Unknown';
        setParsedProduct(parsed);
        await saveGoodsProduced(parsed);
      } else {
        setParsedProduct(null);
        playSound('error');
      }
    } else {
      setParsedProduct(null);
    }
  };

  const saveGoodsIn = async () => {
    if (!parsedCarcass || !carcassWeight) {
      showNotification('Please scan barcode and enter weight', 'error');
      playSound('error');
      return;
    }
    
    const entry = {
      product_type: productType,
      barcode: parsedCarcass.rawBarcode,
      kill_date: parsedCarcass.killDate,
      kill_number: parsedCarcass.killNumber,
      weight_kg: parseFloat(carcassWeight),
      scanned_by: user.username
    };
    
    if (isOnline) {
      const { data, error } = await supabase.from('goods_in').insert(entry).select();
      
      if (error) {
        // If online but error, queue it
        addToOfflineQueue({ type: 'goods_in', data: entry });
        showNotification('Saved offline - will sync later', 'warning');
      } else {
        setGoodsIn([data[0], ...goodsIn]);
        setLastEntry({ type: 'goods_in', data: data[0] });
        showNotification(`Added: Kill #${parsedCarcass.killNumber} - ${carcassWeight}kg`);
      }
    } else {
      // Offline - queue it
      const offlineEntry = { ...entry, id: `offline_${Date.now()}`, scanned_at: new Date().toISOString() };
      addToOfflineQueue({ type: 'goods_in', data: entry });
      setGoodsIn([offlineEntry, ...goodsIn]);
      setLastEntry({ type: 'goods_in', data: offlineEntry, offline: true });
      showNotification('Saved offline - will sync when online', 'warning');
    }
    
    playSound('success');
    
    // Reset
    setCarcassBarcode('');
    setCarcassWeight('');
    setParsedCarcass(null);
    setShowNumpad(false);
    carcassInputRef.current?.focus();
  };

  const saveGoodsProduced = async (parsed) => {
    const entry = {
      product_type: productType,
      barcode: parsed.rawBarcode,
      plu: parsed.plu,
      product_name: parsed.productName,
      category: parsed.category,
      weight_kg: parsed.weight,
      scanned_by: user.username
    };
    
    if (isOnline) {
      const { data, error } = await supabase.from('goods_produced').insert(entry).select();
      
      if (error) {
        addToOfflineQueue({ type: 'goods_produced', data: entry });
        showNotification('Saved offline - will sync later', 'warning');
      } else {
        setGoodsProduced([data[0], ...goodsProduced]);
        setLastEntry({ type: 'goods_produced', data: data[0] });
        showNotification(`Added: ${parsed.productName} - ${parsed.weight.toFixed(3)}kg`);
      }
    } else {
      const offlineEntry = { ...entry, id: `offline_${Date.now()}`, scanned_at: new Date().toISOString() };
      addToOfflineQueue({ type: 'goods_produced', data: entry });
      setGoodsProduced([offlineEntry, ...goodsProduced]);
      setLastEntry({ type: 'goods_produced', data: offlineEntry, offline: true });
      showNotification('Saved offline - will sync when online', 'warning');
    }
    
    playSound('success');
    
    setTimeout(() => {
      setProductBarcode('');
      setParsedProduct(null);
      productInputRef.current?.focus();
    }, 500);
  };

  // Undo last entry
  const undoLastEntry = async () => {
    if (!lastEntry) return;
    
    if (lastEntry.offline) {
      // Remove from offline queue
      const queue = getOfflineQueue();
      const filtered = queue.filter(item => item.queued_at !== lastEntry.data.queued_at);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
    } else {
      // Delete from database
      const table = lastEntry.type === 'goods_in' ? 'goods_in' : 'goods_produced';
      await supabase.from(table).delete().eq('id', lastEntry.data.id);
    }
    
    // Remove from local state
    if (lastEntry.type === 'goods_in') {
      setGoodsIn(goodsIn.filter(item => item.id !== lastEntry.data.id));
    } else {
      setGoodsProduced(goodsProduced.filter(item => item.id !== lastEntry.data.id));
    }
    
    playSound('delete');
    showNotification('Last entry undone');
    setLastEntry(null);
  };

  const deleteGoodsIn = async (id) => {
    if (id.toString().startsWith('offline_')) {
      setGoodsIn(goodsIn.filter(item => item.id !== id));
    } else {
      await supabase.from('goods_in').delete().eq('id', id);
      setGoodsIn(goodsIn.filter(item => item.id !== id));
    }
    playSound('delete');
    showNotification('Entry deleted');
    if (lastEntry?.data?.id === id) setLastEntry(null);
  };

  const deleteGoodsProduced = async (id) => {
    if (id.toString().startsWith('offline_')) {
      setGoodsProduced(goodsProduced.filter(item => item.id !== id));
    } else {
      await supabase.from('goods_produced').delete().eq('id', id);
      setGoodsProduced(goodsProduced.filter(item => item.id !== id));
    }
    playSound('delete');
    showNotification('Entry deleted');
    if (lastEntry?.data?.id === id) setLastEntry(null);
  };

  const goodsInTotal = goodsIn.reduce((sum, item) => sum + parseFloat(item.weight_kg), 0);
  const goodsProducedTotal = goodsProduced.reduce((sum, item) => sum + parseFloat(item.weight_kg), 0);

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <button onClick={onBack} className="text-slate-400 text-sm mb-2 flex items-center gap-1">
          ← Back to Menu
        </button>
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-emerald-400">{productEmoji} {productType.charAt(0).toUpperCase() + productType.slice(1)} Inventory</h1>
          {lastEntry && (
            <button
              onClick={undoLastEntry}
              className="bg-amber-600 hover:bg-amber-700 px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1"
            >
              ↩️ Undo
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('goodsIn')}
          className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
            activeTab === 'goodsIn' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          📥 Goods In
        </button>
        <button
          onClick={() => setActiveTab('goodsProduced')}
          className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
            activeTab === 'goodsProduced' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          📦 Goods Produced
        </button>
      </div>

      {/* Goods In Tab */}
      {activeTab === 'goodsIn' && (
        <div className="p-4 space-y-4">
          <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl p-4">
            <div className="text-emerald-400 text-sm font-medium mb-2">Today's Intake</div>
            <div className="flex gap-8">
              <div>
                <span className="text-3xl font-bold">{goodsIn.length}</span>
                <span className="text-slate-400 ml-2">carcasses</span>
              </div>
              <div>
                <span className="text-3xl font-bold">{goodsInTotal.toFixed(1)}</span>
                <span className="text-slate-400 ml-2">kg</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Scan Carcass Barcode</label>
              <input
                ref={carcassInputRef}
                type="text"
                value={carcassBarcode}
                onChange={(e) => handleCarcassBarcodeChange(e.target.value)}
                placeholder="Scan or enter barcode..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-lg focus:border-emerald-500 focus:outline-none"
                autoFocus
              />
            </div>

            {parsedCarcass && (
              <div className="bg-slate-700/50 rounded-lg p-3 grid grid-cols-2 gap-3">
                <div className="text-sm">
                  <span className="text-slate-400">Kill Date: </span>
                  <span className="text-emerald-400 font-medium">{parsedCarcass.killDateDisplay}</span>
                </div>
                <div className="text-sm">
                  <span className="text-slate-400">Kill Number: </span>
                  <span className="text-emerald-400 font-medium">{parsedCarcass.killNumber}</span>
                </div>
              </div>
            )}

            {carcassBarcode && !parsedCarcass && carcassBarcode.length >= 10 && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
                ⚠️ Could not parse barcode - check format
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-400 mb-2">Weight (kg)</label>
              <input
                type="text"
                value={carcassWeight}
                onChange={(e) => setCarcassWeight(e.target.value)}
                onFocus={() => setShowNumpad(true)}
                placeholder="Enter weight..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-lg focus:border-emerald-500 focus:outline-none"
                readOnly
              />
            </div>

            {showNumpad && (
              <Numpad value={carcassWeight} onChange={setCarcassWeight} />
            )}

            <button
              onClick={saveGoodsIn}
              disabled={!parsedCarcass || !carcassWeight}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed py-4 rounded-xl font-semibold transition-colors"
            >
              + Add Carcass
            </button>
          </div>

          <div>
            <h3 className="text-slate-400 text-sm font-medium mb-2">Today's Entries</h3>
            <div className="space-y-2">
              {goodsIn.slice(0, 10).map(item => (
                <div key={item.id} className={`bg-slate-800 rounded-lg p-3 flex justify-between items-center ${item.id.toString().startsWith('offline_') ? 'border border-amber-600/50' : ''}`}>
                  <div>
                    <div className="font-medium">
                      Kill #{item.kill_number}
                      {item.id.toString().startsWith('offline_') && <span className="ml-2 text-xs text-amber-400">⏳ Pending sync</span>}
                    </div>
                    <div className="text-sm text-slate-400">
                      {formatDate(item.kill_date)} • {item.weight_kg}kg • {formatTime(item.scanned_at)}
                    </div>
                  </div>
                  <button onClick={() => deleteGoodsIn(item.id)} className="text-red-400 hover:text-red-300 p-2">✕</button>
                </div>
              ))}
              {goodsIn.length === 0 && (
                <div className="text-slate-500 text-center py-8">No entries yet today</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Goods Produced Tab */}
      {activeTab === 'goodsProduced' && (
        <div className="p-4 space-y-4">
          <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4">
            <div className="text-blue-400 text-sm font-medium mb-2">Today's Production</div>
            <div className="flex gap-8">
              <div>
                <span className="text-3xl font-bold">{goodsProduced.length}</span>
                <span className="text-slate-400 ml-2">items</span>
              </div>
              <div>
                <span className="text-3xl font-bold">{goodsProducedTotal.toFixed(1)}</span>
                <span className="text-slate-400 ml-2">kg</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Scan Product Barcode (EAN-13)</label>
              <input
                ref={productInputRef}
                type="text"
                value={productBarcode}
                onChange={(e) => handleProductBarcodeChange(e.target.value)}
                placeholder="Scan product label..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-lg focus:border-blue-500 focus:outline-none"
                autoFocus
              />
            </div>

            {parsedProduct && (
              <div className="bg-slate-700/50 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-sm">
                    <span className="text-slate-400">PLU: </span>
                    <span className="text-blue-400 font-medium">{parsedProduct.plu}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-400">Weight: </span>
                    <span className="text-blue-400 font-medium">{parsedProduct.weight.toFixed(3)} kg</span>
                  </div>
                </div>
                <div className="text-sm">
                  <span className="text-slate-400">Product: </span>
                  <span className="text-blue-400 font-medium">{parsedProduct.productName}</span>
                </div>
              </div>
            )}

            {productBarcode && !parsedProduct && productBarcode.length >= 10 && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
                ⚠️ Could not parse barcode - ensure Avery Berkel is set to Format 14
              </div>
            )}

            <div className="bg-blue-600 py-4 rounded-xl font-semibold text-center">
              ✓ Auto-saves on scan — Ready for next item
            </div>
          </div>

          <div>
            <h3 className="text-slate-400 text-sm font-medium mb-2">Today's Entries</h3>
            <div className="space-y-2">
              {goodsProduced.slice(0, 10).map(item => (
                <div key={item.id} className={`bg-slate-800 rounded-lg p-3 flex justify-between items-center ${item.id.toString().startsWith('offline_') ? 'border border-amber-600/50' : ''}`}>
                  <div>
                    <div className="font-medium">
                      {item.product_name}
                      {item.id.toString().startsWith('offline_') && <span className="ml-2 text-xs text-amber-400">⏳ Pending sync</span>}
                    </div>
                    <div className="text-sm text-slate-400">
                      {parseFloat(item.weight_kg).toFixed(3)}kg • PLU {item.plu} • {formatTime(item.scanned_at)}
                    </div>
                  </div>
                  <button onClick={() => deleteGoodsProduced(item.id)} className="text-red-400 hover:text-red-300 p-2">✕</button>
                </div>
              ))}
              {goodsProduced.length === 0 && (
                <div className="text-slate-500 text-center py-8">No entries yet today</div>
              )}
            </div>
          </div>
        </div>
      )}
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
  
  // New user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('butcher');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
    loadUsers();
  }, [productFilter, dateFilter, customDateFrom, customDateTo]);

  const loadUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
  };

  const getDateRange = () => {
    const now = new Date();
    let from, to;
    
    switch (dateFilter) {
      case 'today':
        from = new Date(now.setHours(0, 0, 0, 0));
        to = new Date();
        break;
      case 'yesterday':
        from = new Date(now.setDate(now.getDate() - 1));
        from.setHours(0, 0, 0, 0);
        to = new Date(from);
        to.setHours(23, 59, 59, 999);
        break;
      case 'week':
        from = new Date(now.setDate(now.getDate() - 7));
        to = new Date();
        break;
      case 'month':
        from = new Date(now.setMonth(now.getMonth() - 1));
        to = new Date();
        break;
      case 'custom':
        from = customDateFrom ? new Date(customDateFrom) : new Date(0);
        to = customDateTo ? new Date(customDateTo + 'T23:59:59') : new Date();
        break;
      default:
        from = new Date(0);
        to = new Date();
    }
    
    return { from, to };
  };

  const loadData = async () => {
    setLoading(true);
    const { from, to } = getDateRange();
    
    let goodsInQuery = supabase
      .from('goods_in')
      .select('*')
      .gte('scanned_at', from.toISOString())
      .lte('scanned_at', to.toISOString())
      .order('scanned_at', { ascending: false });
    
    let goodsProducedQuery = supabase
      .from('goods_produced')
      .select('*')
      .gte('scanned_at', from.toISOString())
      .lte('scanned_at', to.toISOString())
      .order('scanned_at', { ascending: false });
    
    if (productFilter !== 'all') {
      goodsInQuery = goodsInQuery.eq('product_type', productFilter);
      goodsProducedQuery = goodsProducedQuery.eq('product_type', productFilter);
    }
    
    const [goodsInRes, goodsProducedRes] = await Promise.all([goodsInQuery, goodsProducedQuery]);
    
    if (goodsInRes.data) setGoodsIn(goodsInRes.data);
    if (goodsProducedRes.data) setGoodsProduced(goodsProducedRes.data);
    setLoading(false);
  };

  const handlePluUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    const pluIndex = headers.findIndex(h => h === 'PLU');
    const nameIndex = headers.findIndex(h => h === 'GPTA1');
    const categoryIndex = headers.findIndex(h => h === 'LGID');
    const priceIndex = headers.findIndex(h => h === 'P1');
    
    if (pluIndex === -1 || nameIndex === -1) {
      showNotification('Invalid CSV format - missing PLU or GPTA1 columns', 'error');
      return;
    }
    
    const newPluList = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      const cleanValues = values.map(v => v.replace(/"/g, '').trim());
      
      const plu = cleanValues[pluIndex];
      const productName = cleanValues[nameIndex];
      const category = categoryIndex !== -1 ? cleanValues[categoryIndex] : '';
      const price = priceIndex !== -1 ? cleanValues[priceIndex] : '';
      
      if (plu && productName) {
        let productType = 'other';
        if (category?.toLowerCase().includes('lamb')) productType = 'lamb';
        else if (category?.toLowerCase().includes('beef')) productType = 'beef';
        else if (category?.toLowerCase().includes('chicken') || category?.toLowerCase().includes('poultry')) productType = 'poultry';
        
        newPluList.push({ plu, product_name: productName, category, product_type: productType, price });
      }
    }
    
    await supabase.from('plu_list').delete().neq('plu', '');
    const { error } = await supabase.from('plu_list').insert(newPluList);
    
    if (error) {
      showNotification('Error uploading PLU list', 'error');
      return;
    }
    
    setPluList(newPluList);
    playSound('success');
    showNotification(`PLU list updated: ${newPluList.length} products loaded`);
    fileInputRef.current.value = '';
  };

  const addUser = async () => {
    if (!newUsername || !newPassword) {
      showNotification('Please enter username and password', 'error');
      return;
    }
    
    const { error } = await supabase.from('users').insert({
      username: newUsername.toLowerCase(),
      password: newPassword,
      role: newRole
    });
    
    if (error) {
      showNotification('Error creating user - username may already exist', 'error');
      return;
    }
    
    playSound('success');
    showNotification(`User ${newUsername} created`);
    setNewUsername('');
    setNewPassword('');
    loadUsers();
  };

  const deleteUser = async (id, username) => {
    if (username === 'admin') {
      showNotification('Cannot delete admin user', 'error');
      return;
    }
    if (!confirm(`Delete user ${username}?`)) return;
    
    await supabase.from('users').delete().eq('id', id);
    playSound('delete');
    showNotification(`User ${username} deleted`);
    loadUsers();
  };

  const exportGoodsIn = () => {
    const headers = ['Date', 'Time', 'Product Type', 'Barcode', 'Kill Date', 'Kill Number', 'Weight (kg)', 'Scanned By'];
    const rows = goodsIn.map(item => [
      new Date(item.scanned_at).toLocaleDateString('en-GB'),
      new Date(item.scanned_at).toLocaleTimeString('en-GB'),
      item.product_type,
      item.barcode,
      item.kill_date,
      item.kill_number,
      item.weight_kg,
      item.scanned_by || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadCSV(csv, 'mfs-goods-in.csv');
  };

  const exportGoodsProduced = () => {
    const headers = ['Date', 'Time', 'Product Type', 'Barcode', 'PLU', 'Product Name', 'Category', 'Weight (kg)', 'Scanned By'];
    const rows = goodsProduced.map(item => [
      new Date(item.scanned_at).toLocaleDateString('en-GB'),
      new Date(item.scanned_at).toLocaleTimeString('en-GB'),
      item.product_type,
      item.barcode,
      item.plu,
      `"${item.product_name}"`,
      item.category,
      item.weight_kg,
      item.scanned_by || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadCSV(csv, 'mfs-goods-produced.csv');
  };

  const downloadCSV = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAllData = async () => {
    if (!confirm('Are you sure you want to clear ALL data? This cannot be undone.')) return;
    
    await Promise.all([
      supabase.from('goods_in').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('goods_produced').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    ]);
    
    setGoodsIn([]);
    setGoodsProduced([]);
    playSound('delete');
    showNotification('All data cleared');
  };

  const goodsInTotal = goodsIn.reduce((sum, item) => sum + parseFloat(item.weight_kg), 0);
  const goodsProducedTotal = goodsProduced.reduce((sum, item) => sum + parseFloat(item.weight_kg), 0);
  const yieldPercent = goodsInTotal > 0 ? ((goodsProducedTotal / goodsInTotal) * 100).toFixed(1) : 0;

  const formatDateTime = (timestamp) => {
    const d = new Date(timestamp);
    return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <button onClick={onBack} className="text-slate-400 text-sm mb-2 flex items-center gap-1">
          ← Back to Menu
        </button>
        <h1 className="text-xl font-bold text-emerald-400">⚙️ Admin / Reports</h1>
      </div>

      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveSection('reports')}
          className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
            activeSection === 'reports' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          📊 Reports
        </button>
        <button
          onClick={() => setActiveSection('plu')}
          className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
            activeSection === 'plu' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          📋 PLU
        </button>
        <button
          onClick={() => setActiveSection('users')}
          className={`flex-1 py-3 px-4 text-center font-medium transition-colors ${
            activeSection === 'users' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          👥 Users
        </button>
      </div>

      {/* Reports Section */}
      {activeSection === 'reports' && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{goodsIn.length}</div>
              <div className="text-xs text-slate-400">Carcasses In</div>
              <div className="text-sm text-emerald-400">{goodsInTotal.toFixed(1)} kg</div>
            </div>
            <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{goodsProduced.length}</div>
              <div className="text-xs text-slate-400">Products Out</div>
              <div className="text-sm text-blue-400">{goodsProducedTotal.toFixed(1)} kg</div>
            </div>
            <div className="bg-purple-900/30 border border-purple-700 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{yieldPercent}%</div>
              <div className="text-xs text-slate-400">Yield</div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-medium text-slate-400">Filters</h3>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Products</option>
                <option value="lamb">🐑 Lamb</option>
                <option value="beef">🐄 Beef</option>
                <option value="poultry">🐔 Poultry</option>
              </select>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            
            {dateFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}
            
            <div className="flex gap-2">
              <button onClick={exportGoodsIn} className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-2 rounded-lg text-sm font-medium">
                Export Goods In
              </button>
              <button onClick={exportGoodsProduced} className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-medium">
                Export Goods Out
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : (
            <>
              <div className="bg-slate-800 rounded-xl p-4">
                <h3 className="text-emerald-400 font-medium mb-3">📥 Goods In ({goodsIn.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 text-left border-b border-slate-700">
                        <th className="pb-2">Date/Time</th>
                        <th className="pb-2">Kill #</th>
                        <th className="pb-2">Weight</th>
                        <th className="pb-2">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goodsIn.slice(0, 20).map(item => (
                        <tr key={item.id} className="border-b border-slate-700/50">
                          <td className="py-2">{formatDateTime(item.scanned_at)}</td>
                          <td className="py-2">{item.kill_number}</td>
                          <td className="py-2">{item.weight_kg} kg</td>
                          <td className="py-2 text-slate-400">{item.scanned_by || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {goodsIn.length === 0 && (
                    <div className="text-center py-4 text-slate-500">No data for selected period</div>
                  )}
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-4">
                <h3 className="text-blue-400 font-medium mb-3">📦 Goods Produced ({goodsProduced.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 text-left border-b border-slate-700">
                        <th className="pb-2">Date/Time</th>
                        <th className="pb-2">Product</th>
                        <th className="pb-2">Weight</th>
                        <th className="pb-2">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goodsProduced.slice(0, 20).map(item => (
                        <tr key={item.id} className="border-b border-slate-700/50">
                          <td className="py-2">{formatDateTime(item.scanned_at)}</td>
                          <td className="py-2">{item.product_name}</td>
                          <td className="py-2">{parseFloat(item.weight_kg).toFixed(3)} kg</td>
                          <td className="py-2 text-slate-400">{item.scanned_by || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {goodsProduced.length === 0 && (
                    <div className="text-center py-4 text-slate-500">No data for selected period</div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-red-400 font-medium mb-3">⚠️ Danger Zone</h3>
            <button
              onClick={clearAllData}
              className="bg-red-600/20 border border-red-600 text-red-400 hover:bg-red-600 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              🗑️ Clear All Data
            </button>
          </div>
        </div>
      )}

      {/* PLU Section */}
      {activeSection === 'plu' && (
        <div className="p-4 space-y-4">
          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-purple-400 font-medium mb-3">📋 PLU List Management</h3>
            <p className="text-sm text-slate-400 mb-4">
              Current: {pluList.length} products loaded
            </p>
            
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handlePluUpload}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-600 hover:border-emerald-500 rounded-xl p-8 text-center text-slate-400 hover:text-emerald-400 transition-colors"
            >
              📁 Click to upload MXi Pro CSV
            </button>
          </div>

          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-slate-400 font-medium mb-3">Current PLU List</h3>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-left border-b border-slate-700 sticky top-0 bg-slate-800">
                    <th className="pb-2">PLU</th>
                    <th className="pb-2">Product</th>
                    <th className="pb-2">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {pluList.slice(0, 50).map(item => (
                    <tr key={item.plu} className="border-b border-slate-700/50">
                      <td className="py-2 text-emerald-400">{item.plu}</td>
                      <td className="py-2">{item.product_name}</td>
                      <td className="py-2 text-slate-400">{item.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pluList.length === 0 && (
                <div className="text-center py-8 text-slate-500">No PLU list loaded</div>
              )}
              {pluList.length > 50 && (
                <div className="text-center py-4 text-slate-500">Showing first 50 of {pluList.length} products</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users Section */}
      {activeSection === 'users' && (
        <div className="p-4 space-y-4">
          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-purple-400 font-medium mb-3">➕ Add New User</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-sm"
                autoCapitalize="none"
              />
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-sm"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-sm"
              >
                <option value="butcher">Butcher</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={addUser}
                className="w-full bg-emerald-600 hover:bg-emerald-700 py-2 rounded-lg text-sm font-medium"
              >
                Add User
              </button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-slate-400 font-medium mb-3">👥 Current Users</h3>
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex justify-between items-center bg-slate-700/50 rounded-lg p-3">
                  <div>
                    <div className="font-medium">{u.username}</div>
                    <div className="text-xs text-slate-400">{u.role}</div>
                  </div>
                  {u.username !== 'admin' && (
                    <button
                      onClick={() => deleteUser(u.id, u.username)}
                      className="text-red-400 hover:text-red-300 p-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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

  // Check for saved session
  useEffect(() => {
    const savedUser = localStorage.getItem('mfs_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setCurrentScreen('menu');
    }
    loadPluList();
  }, []);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check queue periodically
    const interval = setInterval(() => {
      setOfflineQueueCount(getOfflineQueue().length);
      if (navigator.onLine && getOfflineQueue().length > 0) {
        syncOfflineQueue();
      }
    }, 5000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const syncOfflineQueue = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    
    for (const item of queue) {
      try {
        if (item.type === 'goods_in') {
          await supabase.from('goods_in').insert(item.data);
        } else if (item.type === 'goods_produced') {
          await supabase.from('goods_produced').insert(item.data);
        }
      } catch (error) {
        console.error('Error syncing:', error);
        return; // Stop if error
      }
    }
    
    clearOfflineQueue();
    setOfflineQueueCount(0);
    showNotification('Offline data synced!');
  };

  const loadPluList = async () => {
    const { data } = await supabase.from('plu_list').select('*');
    if (data) setPluList(data);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentScreen('menu');
  };

  const handleLogout = () => {
    localStorage.removeItem('mfs_user');
    setUser(null);
    setCurrentScreen('login');
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <OnlineStatus isOnline={isOnline} queueCount={offlineQueueCount} />

      {currentScreen === 'login' && (
        <LoginScreen onLogin={handleLogin} showNotification={showNotification} />
      )}

      {currentScreen === 'menu' && user && (
        <MainMenu onNavigate={setCurrentScreen} user={user} onLogout={handleLogout} />
      )}

      {currentScreen === 'lamb' && user && (
        <ProductModule
          productType="lamb"
          productEmoji="🐑"
          onBack={() => setCurrentScreen('menu')}
          pluList={pluList}
          showNotification={showNotification}
          user={user}
          isOnline={isOnline}
          syncOfflineQueue={syncOfflineQueue}
        />
      )}

      {currentScreen === 'admin' && user && (
        <AdminDashboard
          onBack={() => setCurrentScreen('menu')}
          pluList={pluList}
          setPluList={setPluList}
          showNotification={showNotification}
        />
      )}
    </div>
  );
}
