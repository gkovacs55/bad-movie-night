import React, { useState, useEffect } from 'react';
import { Star, Film, LogIn, LogOut, Edit, Save, X, Upload, Menu, Users, Trophy, Plus, Trash2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyC3-64R8gqBK4rTTfrX8ziKnY90YoWCJAU",
  authDomain: "bad-movie-night-835d5.firebaseapp.com",
  projectId: "bad-movie-night-835d5",
  storageBucket: "bad-movie-night-835d5.firebasestorage.app",
  messagingSenderId: "154194917027",
  appId: "1:154194917027:web:157f4416ff5b026ea7f116"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const ADMIN_EMAILS = ['mdernlan@gmail.com', 'gkovacs55@gmail.com', 'ryanpfleiderer12@gmail.com'];

// Map email to member ID
const EMAIL_TO_MEMBER_ID = {
  'mdernlan@gmail.com': 'matt',
  'colinjsherman@gmail.com': 'colin',
  'gkovacs55@gmail.com': 'gabe',
  'ryanpfleiderer12@gmail.com': 'ryan',
  'hrising64@gmail.com': 'hunter',
  'maximillian.stenstrom@gmail.com': 'max',
  'jamesaburg@gmail.com': 'james'
};

function App() {
  const [page, setPage] = useState('home');
  const [films, setFilms] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAddFilm, setShowAddFilm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [editingFilm, setEditingFilm] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [newFilm, setNewFilm] = useState({
    title: '', subtitle: '', image: '', rtScore: '', bmnScore: 50, 
    date: '', emoji: '🎬', type: 'bmn', attendees: []
  });
  const [userVote, setUserVote] = useState({ score: 50, text: '', thumbs: 'neutral' });
  const [loading, setLoading] = useState(true);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const memberId = EMAIL_TO_MEMBER_ID[u.email];
        if (memberId) {
          const memberDoc = await getDoc(doc(db, 'members', memberId));
          if (memberDoc.exists()) {
            setUserProfile({ id: memberId, ...memberDoc.data() });
          }
        }
      } else {
        setUserProfile(null);
      }
    });
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const filmsSnap = await getDocs(collection(db, 'films'));
      const filmsData = filmsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFilms(filmsData.length > 0 ? filmsData : getInitialFilms());

      const membersSnap = await getDocs(collection(db, 'members'));
      const membersData = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMembers(membersData.length > 0 ? membersData : getInitialMembers());
    } catch (err) {
      console.error('Load error:', err);
      setFilms(getInitialFilms());
      setMembers(getInitialMembers());
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowLogin(false);
      alert('Login successful!');
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleVote = async () => {
    if (!user || !selectedFilm) return;
    try {
      const voteData = {
        userId: user.uid,
        userName: userProfile?.name || user.email,
        score: userVote.score,
        text: userVote.text,
        thumbs: userVote.thumbs,
        timestamp: new Date().toISOString()
      };
      await setDoc(doc(db, 'films', selectedFilm.id, 'votes', user.uid), voteData);
      
      const votesSnap = await getDocs(collection(db, 'films', selectedFilm.id, 'votes'));
      const votes = votesSnap.docs.map(d => d.data());
      const avgScore = Math.round(votes.reduce((sum, v) => sum + v.score, 0) / votes.length);
      
      await updateDoc(doc(db, 'films', selectedFilm.id), { bmnScore: avgScore });
      
      alert('Vote submitted!');
      loadData();
      setSelectedFilm({ ...selectedFilm, bmnScore: avgScore });
    } catch (err) {
      alert('Error submitting vote: ' + err.message);
    }
  };

  const saveFilm = async () => {
    if (!editingFilm) return;
    try {
      await setDoc(doc(db, 'films', editingFilm.id), editingFilm);
      alert('Film saved!');
      setEditingFilm(null);
      loadData();
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  };

  const addNewFilm = async () => {
    if (!isAdmin || !newFilm.title) {
      alert('Please fill in at least the title');
      return;
    }
    try {
      const filmId = newFilm.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
      await setDoc(doc(db, 'films', filmId), { ...newFilm, id: filmId });
      alert('Film added successfully!');
      setShowAddFilm(false);
      setNewFilm({
        title: '', subtitle: '', image: '', rtScore: '', bmnScore: 50,
        date: '', emoji: '🎬', type: 'bmn', attendees: []
      });
      loadData();
    } catch (err) {
      alert('Error adding film: ' + err.message);
    }
  };

  const deleteFilm = async (filmId) => {
    if (!isAdmin) return;
    if (window.confirm('Are you sure you want to delete this film?')) {
      try {
        await deleteDoc(doc(db, 'films', filmId));
        alert('Film deleted!');
        setPage('home');
        loadData();
      } catch (err) {
        alert('Error deleting: ' + err.message);
      }
    }
  };

  const saveProfile = async () => {
    if (!editingProfile) return;
    try {
      await setDoc(doc(db, 'members', editingProfile.id), editingProfile);
      alert('Profile saved!');
      setEditingProfile(null);
      loadData();
      if (userProfile && editingProfile.id === userProfile.id) {
        setUserProfile(editingProfile);
      }
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  };

  const uploadImage = async (file, type, id) => {
    try {
      const storageRef = ref(storage, `${type}/${id}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (err) {
      alert('Upload failed: ' + err.message);
      return null;
    }
  };

  const FilmCard = ({ film }) => (
    <div onClick={() => { setSelectedFilm(film); setPage('detail'); }} 
         className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
      <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 aspect-[2/3]">
        <img src={film.image} alt={film.title} className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
      </div>
      <div className="p-4 bg-gradient-to-b from-white to-gray-50">
        <h3 className="font-bold text-sm mb-2 truncate text-gray-800">{film.title}</h3>
        <div className="flex gap-3 justify-center items-center">
          <span className="text-3xl">{film.emoji}</span>
          <div className="flex gap-3">
            {film.rtScore && (
              <div className="text-center bg-red-50 px-2 py-1 rounded-lg">
                <div className="text-[10px] text-red-600 font-semibold">RT</div>
                <div className="font-bold text-red-700 text-sm">{film.rtScore}%</div>
              </div>
            )}
            <div className="text-center bg-blue-50 px-2 py-1 rounded-lg">
              <div className="text-[10px] text-blue-600 font-semibold">BMN</div>
              <div className="font-bold text-blue-700 text-sm">{film.bmnScore}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const bmn = films.filter(f => f.type === 'bmn');
  const off = films.filter(f => f.type === 'offsite-film');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <nav className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white shadow-2xl sticky top-0 z-50 backdrop-blur-lg bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setPage('home'); setShowMobileMenu(false); }}>
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl group-hover:scale-110 transition-transform">
                <Film className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent">Bad Movie Night</h1>
            </div>
            
            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="md:hidden hover:bg-white/10 p-2 rounded-lg transition">
              <Menu className="w-6 h-6" />
            </button>

            <div className="hidden md:flex gap-6 items-center">
              <button onClick={() => setPage('home')} className="hover:text-blue-300 transition font-medium">Home</button>
              <button onClick={() => setPage('members')} className="hover:text-blue-300 transition flex items-center gap-2 font-medium">
                <Users className="w-4 h-4" />Members
              </button>
              <button onClick={() => setPage('leaderboard')} className="hover:text-blue-300 transition flex items-center gap-2 font-medium">
                <Trophy className="w-4 h-4" />Leaderboard
              </button>
              {user && <button onClick={() => setPage('profile')} className="hover:text-blue-300 transition font-medium">Profile</button>}
              {isAdmin && <button onClick={() => setPage('admin')} className="hover:text-blue-300 transition font-medium">Admin</button>}
              {user ? (
                <button onClick={() => signOut(auth)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 rounded-lg hover:from-red-600 hover:to-red-700 transition shadow-lg font-medium">
                  <LogOut className="w-4 h-4" />Logout
                </button>
              ) : (
                <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg hover:from-blue-600 hover:to-purple-700 transition shadow-lg font-medium">
                  <LogIn className="w-4 h-4" />Login
                </button>
              )}
            </div>
          </div>

          {showMobileMenu && (
            <div className="md:hidden mt-4 space-y-2 pb-4 border-t border-white/10 pt-4">
              <button onClick={() => { setPage('home'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-blue-300 font-medium">Home</button>
              <button onClick={() => { setPage('members'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-blue-300 font-medium">Members</button>
              <button onClick={() => { setPage('leaderboard'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-blue-300 font-medium">Leaderboard</button>
              {user && <button onClick={() => { setPage('profile'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-blue-300 font-medium">Profile</button>}
              {isAdmin && <button onClick={() => { setPage('admin'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-blue-300 font-medium">Admin</button>}
              {user ? (
                <button onClick={() => { signOut(auth); setShowMobileMenu(false); }} className="w-full text-left py-2 text-red-400 font-medium">Logout</button>
              ) : (
                <button onClick={() => { setShowLogin(true); setShowMobileMenu(false); }} className="w-full text-left py-2 text-blue-400 font-medium">Login</button>
              )}
            </div>
          )}
        </div>
      </nav>

      {showLogin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowLogin(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-3xl font-bold text-gray-900 mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Member Login</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" 
                       placeholder="your@email.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" 
                       placeholder="••••••••" />
              </div>
              <button onClick={handleLogin} 
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition shadow-lg">
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddFilm && isAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Add New Film</h2>
              <button onClick={() => setShowAddFilm(false)} className="hover:bg-gray-100 p-2 rounded-lg transition"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Title *</label>
                <input type="text" value={newFilm.title} onChange={e => setNewFilm({ ...newFilm, title: e.target.value })} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Subtitle</label>
                <input type="text" value={newFilm.subtitle} onChange={e => setNewFilm({ ...newFilm, subtitle: e.target.value })} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Image URL</label>
                <input type="text" value={newFilm.image} onChange={e => setNewFilm({ ...newFilm, image: e.target.value })} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">RT Score</label>
                  <input type="number" value={newFilm.rtScore} onChange={e => setNewFilm({ ...newFilm, rtScore: parseInt(e.target.value) })} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Emoji</label>
                  <input type="text" value={newFilm.emoji} onChange={e => setNewFilm({ ...newFilm, emoji: e.target.value })} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition text-3xl" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Date</label>
                <input type="date" value={newFilm.date} onChange={e => setNewFilm({ ...newFilm, date: e.target.value })} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Type</label>
                <select value={newFilm.type} onChange={e => setNewFilm({ ...newFilm, type: e.target.value })} 
                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition">
                  <option value="bmn">BMN Screening</option>
                  <option value="offsite-film">Offsite Film</option>
                </select>
              </div>
              <button onClick={addNewFilm} 
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition shadow-lg flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" />Add Film
              </button>
            </div>
          </div>
        </div>
      )}

      {editingFilm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Edit Film</h2>
              <button onClick={() => setEditingFilm(null)} className="hover:bg-gray-100 p-2 rounded-lg transition"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Title</label>
                <input type="text" value={editingFilm.title} onChange={e => setEditingFilm({ ...editingFilm, title: e.target.value })} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Subtitle</label>
                <input type="text" value={editingFilm.subtitle || ''} onChange={e => setEditingFilm({ ...editingFilm, subtitle: e.target.value })} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Image URL</label>
                <input type="text" value={editingFilm.image} onChange={e => setEditingFilm({ ...editingFilm, image: e.target.value })} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Or Upload Image</label>
                <input type="file" accept="image/*" onChange={async e => { const url = await uploadImage(e.target.files[0], 'films', editingFilm.id); if (url) setEditingFilm({ ...editingFilm, image: url }); }} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">RT Score</label>
                  <input type="number" value={editingFilm.rtScore || ''} onChange={e => setEditingFilm({ ...editingFilm, rtScore: parseInt(e.target.value) })} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Emoji</label>
                  <input type="text" value={editingFilm.emoji} onChange={e => setEditingFilm({ ...editingFilm, emoji: e.target.value })} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition text-3xl" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Date</label>
                <input type="date" value={editingFilm.date} onChange={e => setEditingFilm({ ...editingFilm, date: e.target.value })} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              <button onClick={saveFilm} 
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition shadow-lg flex items-center justify-center gap-2">
                <Save className="w-5 h-5" />Save Film
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full my-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Edit Profile</h2>
              <button onClick={() => setEditingProfile(null)} className="hover:bg-gray-100 p-2 rounded-lg transition"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Name</label>
                <input type="text" value={editingProfile.name} onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Title</label>
                <input type="text" value={editingProfile.title} onChange={e => setEditingProfile({ ...editingProfile, title: e.target.value })} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Bio</label>
                <textarea value={editingProfile.bio} onChange={e => setEditingProfile({ ...editingProfile, bio: e.target.value })} 
                          className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" rows="4" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Profile Image URL</label>
                <input type="text" value={editingProfile.image} onChange={e => setEditingProfile({ ...editingProfile, image: e.target.value })} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Or Upload Photo</label>
                <input type="file" accept="image/*" onChange={async e => { const url = await uploadImage(e.target.files[0], 'members', editingProfile.id); if (url) setEditingProfile({ ...editingProfile, image: url }); }} 
                       className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Emojis (comma separated)</label>
                  <input type="text" value={editingProfile.emojis?.join(',') || ''} 
                         onChange={e => setEditingProfile({ ...editingProfile, emojis: e.target.value.split(',').map(s => s.trim()) })} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" 
                         placeholder="🏐,🦈,❄️" />
                </div>
              )}
              <button onClick={saveProfile} 
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition shadow-lg flex items-center justify-center gap-2">
                <Save className="w-5 h-5" />Save Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Loading...</div>
        </div>
      ) : (
        <>
          {page === 'home' && (
            <div className="min-h-screen">
              <div className="max-w-7xl mx-auto px-4 py-12">
                <div className="text-center mb-16">
                  <h2 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">Bad Movie Night</h2>
                  <p className="text-2xl text-gray-600 mb-2">Where terrible movies become legendary</p>
                  <p className="text-sm text-gray-500">Since 2023 • {bmn.length} Screenings • {off.length} Offsite Films</p>
                </div>

                <section className="mb-16">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Screenings</h3>
                    {isAdmin && (
                      <button onClick={() => { setNewFilm({ ...newFilm, type: 'bmn' }); setShowAddFilm(true); }} 
                              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition shadow-lg font-medium">
                        <Plus className="w-4 h-4" />Add Screening
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {bmn.map(f => <FilmCard key={f.id} film={f} />)}
                  </div>
                </section>

                <section>
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Offsite Films</h3>
                    {isAdmin && (
                      <button onClick={() => { setNewFilm({ ...newFilm, type: 'offsite-film' }); setShowAddFilm(true); }} 
                              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition shadow-lg font-medium">
                        <Plus className="w-4 h-4" />Add Offsite Film
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {off.map(f => <FilmCard key={f.id} film={f} />)}
                  </div>
                </section>
              </div>
            </div>
          )}

          {page === 'detail' && selectedFilm && (
            <div className="min-h-screen">
              <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex gap-4 mb-6">
                  <button onClick={() => setPage('home')} 
                          className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md hover:shadow-lg transition">
                    ← Back
                  </button>
                  {isAdmin && (
                    <>
                      <button onClick={() => setEditingFilm(selectedFilm)} 
                              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition shadow-lg flex items-center gap-2 font-medium">
                        <Edit className="w-4 h-4" />Edit
                      </button>
                      <button onClick={() => deleteFilm(selectedFilm.id)} 
                              className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition shadow-lg flex items-center gap-2 font-medium">
                        <Trash2 className="w-4 h-4" />Delete
                      </button>
                    </>
                  )}
                </div>
                <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                  <div className="grid md:grid-cols-2 gap-8 mb-8">
                    <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl aspect-[2/3] overflow-hidden shadow-lg">
                      <img src={selectedFilm.image} alt={selectedFilm.title} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{selectedFilm.title}</h1>
                      {selectedFilm.subtitle && <p className="text-2xl text-gray-600 mb-6">{selectedFilm.subtitle}</p>}
                      <p className="text-gray-500 mb-8 text-lg">{new Date(selectedFilm.date).toLocaleDateString()}</p>
                      <div className="flex gap-8 mb-8 items-center">
                        <div className="text-7xl">{selectedFilm.emoji}</div>
                        {selectedFilm.rtScore && (
                          <div className="text-center bg-gradient-to-br from-red-50 to-red-100 px-6 py-4 rounded-2xl shadow-md">
                            <div className="text-sm text-red-600 font-semibold mb-2">Rotten Tomatoes</div>
                            <div className="flex items-center gap-2">
                              <span className="text-4xl">🍅</span>
                              <span className="text-4xl font-bold text-red-700">{selectedFilm.rtScore}%</span>
                            </div>
                          </div>
                        )}
                        <div className="text-center bg-gradient-to-br from-blue-50 to-purple-100 px-6 py-4 rounded-2xl shadow-md">
                          <div className="text-sm text-blue-600 font-semibold mb-2">BMN Score</div>
                          <div className="flex items-center gap-2">
                            <Star className="w-10 h-10 fill-blue-500 text-blue-500" />
                            <span className="text-4xl font-bold text-blue-700">{selectedFilm.bmnScore}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {user && (
                    <div className="border-t-2 border-gray-100 pt-8 mb-8">
                      <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Cast Your Vote</h2>
                      <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-2xl border border-blue-100">
                        <div className="mb-6">
                          <label className="block text-sm font-semibold mb-3 text-gray-700">Score (0-100): <span className="text-blue-600 text-xl">{userVote.score}</span></label>
                          <input type="range" min="0" max="100" value={userVote.score} 
                                 onChange={e => setUserVote({ ...userVote, score: parseInt(e.target.value) })} 
                                 className="w-full h-3 bg-gradient-to-r from-blue-200 to-purple-200 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div className="mb-6">
                          <label className="block text-sm font-semibold mb-2 text-gray-700">Review</label>
                          <textarea value={userVote.text} onChange={e => setUserVote({ ...userVote, text: e.target.value })} 
                                    className="w-full p-4 border-2 border-blue-200 rounded-xl bg-white focus:border-blue-500 focus:outline-none transition" 
                                    rows="3" placeholder="What made this movie terrible?" />
                        </div>
                        <div className="mb-6">
                          <label className="block text-sm font-semibold mb-3 text-gray-700">Rating</label>
                          <div className="flex gap-3">
                            <button onClick={() => setUserVote({ ...userVote, thumbs: 'neutral' })} 
                                    className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition ${userVote.thumbs === 'neutral' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600 hover:border-blue-300'}`}>
                              👍 Neutral
                            </button>
                            <button onClick={() => setUserVote({ ...userVote, thumbs: 'down' })} 
                                    className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition ${userVote.thumbs === 'down' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-300 bg-white text-gray-600 hover:border-orange-300'}`}>
                              👎 Down
                            </button>
                            <button onClick={() => setUserVote({ ...userVote, thumbs: 'double-down' })} 
                                    className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition ${userVote.thumbs === 'double-down' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 bg-white text-gray-600 hover:border-red-300'}`}>
                              👎👎 Double Down
                            </button>
                          </div>
                        </div>
                        <button onClick={handleVote} 
                                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-600 hover:to-purple-700 transition shadow-lg">
                          Submit Vote
                        </button>
                      </div>
                    </div>
                  )}
                  {!user && (
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 p-6 rounded-xl shadow-md">
                      <p className="text-yellow-800 font-semibold text-lg">Please login to vote!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {page === 'members' && (
            <div className="min-h-screen">
              <div className="max-w-7xl mx-auto px-4 py-12">
                <h2 className="text-5xl font-bold mb-12 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Member Directory</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {members.map(m => (
                    <div key={m.id} onClick={() => { setSelectedMember(m); setPage('member-detail'); }} 
                         className="bg-white rounded-2xl shadow-lg p-6 cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
                      <img src={m.image} alt={m.name} className="w-full aspect-square object-cover rounded-xl mb-4 shadow-md" />
                      <h3 className="font-bold text-center text-lg text-gray-800 mb-1">{m.name}</h3>
                      <p className="text-sm text-gray-500 text-center mb-3">{m.title}</p>
                      <div className="flex flex-wrap justify-center gap-1 mb-2">
                        {(m.emojis || []).slice(0, 6).map((e, i) => (
                          <span key={i} className="text-2xl">{e}</span>
                        ))}
                      </div>
                      <div className="text-center">
                        <span className="inline-block px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-semibold rounded-full">
                          {m.emojis?.length || 0} badges
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {page === 'member-detail' && selectedMember && (
            <div className="min-h-screen">
              <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex gap-4 mb-6">
                  <button onClick={() => setPage('members')} 
                          className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md hover:shadow-lg transition">
                    ← Back
                  </button>
                  {(isAdmin || user?.uid === selectedMember.id || userProfile?.id === selectedMember.id) && (
                    <button onClick={() => setEditingProfile(selectedMember)} 
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition shadow-lg flex items-center gap-2 font-medium">
                      <Edit className="w-4 h-4" />Edit Profile
                    </button>
                  )}
                </div>
                <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                  <div className="flex flex-col md:flex-row gap-8 mb-8">
                    <img src={selectedMember.image} alt={selectedMember.name} className="w-48 h-48 rounded-2xl shadow-xl object-cover" />
                    <div className="flex-1">
                      <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{selectedMember.name}</h1>
                      <p className="text-xl text-gray-600 mb-6">{selectedMember.title}</p>
                      <p className="text-gray-700 leading-relaxed">{selectedMember.bio}</p>
                    </div>
                  </div>
                  <div className="border-t-2 border-gray-100 pt-8">
                    <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Badge Collection ({selectedMember.emojis?.length || 0})
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {(selectedMember.emojis || []).map((e, i) => (
                        <div key={i} className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-2xl shadow-md hover:shadow-lg transition">
                          <span className="text-5xl">{e}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {page === 'profile' && user && (
            <div className="min-h-screen">
              <div className="max-w-4xl mx-auto px-4 py-12">
                <h2 className="text-5xl font-bold mb-12 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">My Profile</h2>
                {userProfile ? (
                  <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex gap-8">
                        <img src={userProfile.image} alt={userProfile.name} className="w-32 h-32 rounded-2xl object-cover shadow-lg" />
                        <div>
                          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{userProfile.name}</h1>
                          <p className="text-xl text-gray-600 mb-4">{userProfile.title}</p>
                          <p className="text-gray-700">{userProfile.bio}</p>
                        </div>
                      </div>
                      <button onClick={() => setEditingProfile(userProfile)} 
                              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition shadow-lg flex items-center gap-2 font-medium">
                        <Edit className="w-4 h-4" />Edit
                      </button>
                    </div>
                    <div className="border-t-2 border-gray-100 pt-8">
                      <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Badges ({userProfile.emojis?.length || 0})
                      </h3>
                      <div className="flex flex-wrap gap-4">
                        {(userProfile.emojis || []).map((e, i) => (
                          <div key={i} className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-2xl shadow-md hover:shadow-lg transition">
                            <span className="text-5xl">{e}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-2xl p-12 text-center border border-gray-100">
                    <p className="text-gray-600 text-lg">Profile not found. Contact admin to set up your profile.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {page === 'admin' && isAdmin && (
            <div className="min-h-screen">
              <div className="max-w-6xl mx-auto px-4 py-12">
                <h2 className="text-5xl font-bold mb-12 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Admin Panel</h2>
                <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                  <h3 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button onClick={() => setShowAddFilm(true)} 
                            className="p-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:from-blue-600 hover:to-purple-700 transition shadow-lg font-bold text-lg flex items-center justify-center gap-3">
                      <Plus className="w-6 h-6" />Add New Film
                    </button>
                    <button onClick={() => setPage('members')} 
                            className="p-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:from-blue-600 hover:to-purple-700 transition shadow-lg font-bold text-lg flex items-center justify-center gap-3">
                      <Users className="w-6 h-6" />Manage Members
                    </button>
                  </div>
                  <p className="text-gray-600 mt-8 text-center text-lg">Use the edit buttons on films and profiles to make changes.</p>
                </div>
              </div>
            </div>
          )}

          {page === 'leaderboard' && (
            <div className="min-h-screen">
              <div className="max-w-5xl mx-auto px-4 py-12">
                <h2 className="text-5xl font-bold mb-3 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Leaderboard</h2>
                <p className="text-center text-gray-600 mb-12 text-xl">Who's the baddest?</p>
                <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                  <div className="space-y-4">
                    {[...members].sort((a, b) => (b.emojis?.length || 0) - (a.emojis?.length || 0)).map((m, i) => (
                      <div key={m.id} 
                           onClick={() => { setSelectedMember(m); setPage('member-detail'); }} 
                           className="flex items-center gap-6 bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl cursor-pointer hover:from-blue-100 hover:to-purple-100 transition shadow-md hover:shadow-lg border border-blue-100">
                        <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent w-16 text-center">
                          {i === 0 && '🥇'}
                          {i === 1 && '🥈'}
                          {i === 2 && '🥉'}
                          {i > 2 && `#${i + 1}`}
                        </div>
                        <img src={m.image} alt={m.name} className="w-20 h-20 rounded-2xl object-cover shadow-md" />
                        <div className="flex-1">
                          <div className="font-bold text-xl text-gray-800">{m.name}</div>
                          <div className="text-sm text-gray-600">{m.title}</div>
                        </div>
                        <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          {m.emojis?.length || 0} badges
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getInitialFilms() {
  return [
    {id: '1', title: "Beach Kings", type: "bmn", subtitle: "Beach Kings", image: "https://m.media-amazon.com/images/I/91AqeB8kZTL._UF350,350_QL50_.jpg", rtScore: 45, bmnScore: 72, date: "2023-08-31", attendees: ["Matt", "Ryan", "Gabe", "James", "Colin"], emoji: "🏐"},
    {id: '2', title: "Toxic Shark", type: "bmn", subtitle: "Toxic Shark", image: "https://m.media-amazon.com/images/M/MV5BMmEwNWU5OTEtOWE1Ny00YTE1LWFhY2YtNTYyMDYwNjdjYTQyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg", rtScore: 31, bmnScore: 78, date: "2023-09-26", attendees: ["Matt", "Ryan", "Gabe", "James", "Colin"], emoji: "🦈"},
    {id: '3', title: "Snowmageddon", type: "bmn", subtitle: "Merry Crisis", image: "https://m.media-amazon.com/images/M/MV5BMjQ4NjM0MDQ3NV5BMl5BanBnXkFtZTgwMzU5ODcwMzE@._V1_.jpg", rtScore: 25, bmnScore: 81, date: "2023-12-01", attendees: ["Matt", "Ryan", "Gabe", "James", "Colin"], emoji: "❄️"},
    {id: '4', title: "The Mean One", type: "bmn", subtitle: "Merry Crisis", image: "https://m.media-amazon.com/images/M/MV5BN2RlYzUyNjktMTM0OS00NjY5LThhODItNDBlODAyMDliMDlkXkEyXkFqcGc@._V1_.jpg", rtScore: 38, bmnScore: 85, date: "2023-12-01", attendees: ["Matt", "Hunter"], emoji: "🎄"},
    {id: '5', title: "Debug", type: "bmn", subtitle: "Reboot", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSc3xkOmzfhbsJrts1P4WR0HNmEOu161jonKg&s", rtScore: 15, bmnScore: 68, date: "2024-01-19", attendees: ["Matt", "Ryan", "Hunter", "Gabe"], emoji: "🤖"},
    {id: '6', title: "Miss Meadows", type: "bmn", subtitle: "One Not To Miss", image: "https://cdn11.bigcommerce.com/s-yzgoj/images/stencil/1280x1280/products/373204/4472014/api8j1xri__64799.1625621486.jpg?c=2", rtScore: 62, bmnScore: 71, date: "2024-04-19", attendees: ["Matt", "Hunter", "Colin"], emoji: "👩"},
    {id: '7', title: "Meteor Moon", type: "bmn", subtitle: "Summer Blockbuster", image: "https://m.media-amazon.com/images/M/MV5BZjQ1ZGM3MjgtOTI5MC00ZmZhLWJlNDQtMjhjZTc5ZTgyOTMzXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg", rtScore: 18, bmnScore: 83, date: "2024-08-01", attendees: ["Matt", "Ryan", "Gabe", "James", "Colin"], emoji: "☄️"},
    {id: '8', title: "Dinosaur Prison", type: "bmn", subtitle: "A Prison Like No Other", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1ooD06Jtf6cWYEk87cCdm8M_3uvGmpdUZlA&s", rtScore: 22, bmnScore: 91, date: "2024-09-27", attendees: ["Matt", "Ryan", "Hunter", "James", "Colin", "Max"], emoji: "🦖"},
    {id: '9', title: "Ground Rules", type: "bmn", subtitle: "Even the Score", image: "https://m.media-amazon.com/images/I/51ADQ1glv0L._UF350,350_QL50_.jpg", rtScore: 28, bmnScore: 76, date: "2024-12-06", attendees: ["Matt", "Ryan", "Hunter", "Colin", "James"], emoji: "🏀"},
    {id: '10', title: "Metal Tornado", type: "bmn", subtitle: "Vortex in Paris", image: "https://m.media-amazon.com/images/I/618EYyWPqOL._UF1000,1000_QL80_.jpg", rtScore: 33, bmnScore: 79, date: "2025-02-20", attendees: ["Matt", "Ryan", "Hunter", "Gabe", "James", "Colin", "Max"], emoji: "🌪️"},
    {id: '11', title: "Planet Dune", type: "bmn", subtitle: "Doomed to Fail", image: "https://m.media-amazon.com/images/M/MV5BOTI3ZDZjMzAtZTkyYi00YTc4LWEyNDctYzNlOTc2ODIwMWNhXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg", rtScore: 12, bmnScore: 88, date: "2025-04-25", attendees: ["Matt", "Ryan", "Hunter", "James", "Colin", "Max"], emoji: "🪐"},
    {id: '12', title: "Jurassic Shark", type: "bmn", subtitle: "From The Deep", image: "https://m.media-amazon.com/images/M/MV5BZTdhMDk5ODctZGEwNy00MDNjLWE2YzktZDE4ZjhiMjNhYTY0XkEyXkFqcGc@._V1_.jpg", rtScore: 8, bmnScore: 94, date: "2025-06-12", attendees: ["Matt", "Ryan", "Hunter", "Gabe", "Colin", "Max"], emoji: "🦕"},
    {id: '13', title: "Paintball", type: "bmn", subtitle: "Play to Survive", image: "https://m.media-amazon.com/images/I/91zatIF4IvL._SL1500_.jpg", rtScore: 41, bmnScore: 82, date: "2025-09-25", attendees: ["Matt", "Ryan", "Hunter", "Gabe", "James", "Colin", "Max"], emoji: "🎯"},
    {id: '14', title: "Madame Web", type: "offsite-film", image: "https://m.media-amazon.com/images/M/MV5BODViOTZiOTQtOTc4ZC00ZjUxLWEzMjItY2ExMmNlNDliNjE4XkEyXkFqcGc@._V1_.jpg", rtScore: 11, bmnScore: 89, date: "2024-02-18", attendees: ["Matt", "Ryan", "Hunter", "James"], emoji: "🕷️"},
    {id: '15', title: "Borderlands", type: "offsite-film", image: "https://m.media-amazon.com/images/I/81YSKAxNiDL.jpg", rtScore: 9, bmnScore: 86, date: "2024-08-10", attendees: ["Matt", "Gabe", "Colin"], emoji: "🎮"},
    {id: '16', title: "Red One", type: "offsite-film", image: "https://m.media-amazon.com/images/M/MV5BZmFkMjE4NjQtZTVmZS00MDZjLWE2ZmEtZTkzODljNjhlNWUxXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg", rtScore: 32, bmnScore: 74, date: "2024-11-15", attendees: ["Matt", "Ryan", "Hunter", "James", "Colin"], emoji: "🎅"},
    {id: '17', title: "Kraven the Hunter", type: "offsite-film", image: "https://www.movieposters.com/cdn/shop/files/kraven-the-hunter_4ed9pbow_480x.progressive.jpg?v=1726587613", rtScore: 15, bmnScore: 77, date: "2024-12-19", attendees: ["Colin", "Gabe", "James"], emoji: "🦁"},
    {id: '18', title: "Screamboat", type: "offsite-film", image: "https://m.media-amazon.com/images/M/MV5BMDg3NjJkOTktZWM0NC00MWI3LWEwNTYtYTQ2YWIwNWI3ZmM2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg", rtScore: 42, bmnScore: 69, date: "2025-04-03", attendees: ["Matt", "Hunter", "Colin", "Max"], emoji: "🚢"}
  ];
}

function getInitialMembers() {
  return [
    {id: 'matt', name: "Matt Dernlan", username: "Matt", title: "District Manager of Video", image: "https://i.pravatar.cc/150?img=33", bio: "Founding member and curator of cinematic disasters.", emojis: ["🏐", "🦈", "❄️", "🎄", "🤖", "👩", "☄️", "🦖", "🏀", "🌪️", "🪐", "🦕", "🎯", "🕷️", "🎮", "🎅", "🚢"]},
    {id: 'hunter', name: "Hunter Rising", username: "Hunter", title: "Senior VP of Boardology", image: "https://i.pravatar.cc/150?img=12", bio: "Expert in identifying plot holes.", emojis: ["🏐", "🦈", "❄️", "🎄", "🤖", "👩", "☄️", "🏀", "🌪️", "🪐", "🦕", "🎯", "🕷️", "🎅", "🚢"]},
    {id: 'ryan', name: "Ryan Pfleiderer", username: "Ryan", title: "Anime Lead", image: "https://i.pravatar.cc/150?img=8", bio: "Brings anime-level dramatic commentary.", emojis: ["🏐", "🦈", "❄️", "🤖", "☄️", "🦖", "🏀", "🌪️", "🪐", "🦕", "🎯", "🕷️", "🎅"]},
    {id: 'gabe', name: "Gabe Kovacs", username: "Gabe", title: "Laughs Engineer", image: "https://i.pravatar.cc/150?img=13", bio: "Engineered precision laughter.", emojis: ["🏐", "🦈", "❄️", "🤖", "☄️", "🦖", "🌪️", "🪐", "🦕", "🎯", "🎮", "🦁"]},
    {id: 'james', name: "James Burg", username: "James", title: "Quips Lead", image: "https://i.pravatar.cc/150?img=68", bio: "Delivers perfectly timed one-liners.", emojis: ["🏐", "🦈", "❄️", "☄️", "🦖", "🏀", "🌪️", "🪐", "🎯", "🕷️", "🎅", "🦁"]},
    {id: 'colin', name: "Colin Sherman", username: "Colin", title: "Chief Research Officer", image: "https://i.pravatar.cc/150?img=52", bio: "Researches every disaster film.", emojis: ["🏐", "🦈", "❄️", "👩", "☄️", "🦖", "🏀", "🌪️", "🪐", "🦕", "🎯", "🎮", "🎅", "🦁", "🚢"]},
    {id: 'max', name: "Max Stenstrom", username: "Max", title: "Viticulture Team Lead", image: "https://i.pravatar.cc/150?img=59", bio: "Pairs wine with terrible movies.", emojis: ["🌪️", "🪐", "🦕", "🎯", "🚢"]}
  ];
}

export default App;
