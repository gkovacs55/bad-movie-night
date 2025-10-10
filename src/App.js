import React, { useState, useEffect } from 'react';
import { Star, Film, LogIn, LogOut, Edit, Save, X, Upload, Menu, Users, Trophy, Plus } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
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

const ADMIN_EMAILS = ['matt@badmovienight.com', 'gabe@badmovienight.com', 'ryan@badmovienight.com'];

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [editingFilm, setEditingFilm] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [userVote, setUserVote] = useState({ score: 50, text: '', thumbs: 'neutral' });
  const [loading, setLoading] = useState(true);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const memberDoc = await getDoc(doc(db, 'members', u.uid));
        if (memberDoc.exists()) {
          setUserProfile({ id: u.uid, ...memberDoc.data() });
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
    if (!isAdmin || !editingFilm) return;
    try {
      await setDoc(doc(db, 'films', editingFilm.id), editingFilm);
      alert('Film saved!');
      setEditingFilm(null);
      loadData();
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  };

  const saveProfile = async () => {
    if (!editingProfile) return;
    try {
      await setDoc(doc(db, 'members', editingProfile.id), editingProfile);
      alert('Profile saved!');
      setEditingProfile(null);
      loadData();
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
    <div onClick={() => { setSelectedFilm(film); setPage('detail'); }} className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer hover:shadow-2xl transition transform hover:-translate-y-1">
      <div className="relative bg-gray-200 aspect-[2/3]">
        <img src={film.image} alt={film.title} className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
      </div>
      <div className="p-3">
        <h3 className="font-bold text-sm mb-1 truncate">{film.title}</h3>
        <div className="flex gap-2 justify-center items-center text-xs">
          <span className="text-2xl">{film.emoji}</span>
          {film.rtScore && <div className="text-center"><div className="text-xs text-gray-500">RT</div><div className="font-bold">{film.rtScore}%</div></div>}
          <div className="text-center"><div className="text-xs text-gray-500">BMN</div><div className="font-bold text-blue-700">{film.bmnScore}</div></div>
        </div>
      </div>
    </div>
  );

  const bmn = films.filter(f => f.type === 'bmn');
  const off = films.filter(f => f.type === 'offsite-film');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setPage('home'); setShowMobileMenu(false); }}>
              <Film className="w-8 h-8 text-red-500" />
              <h1 className="text-xl font-bold">Bad Movie Night</h1>
            </div>
            
            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="md:hidden">
              <Menu className="w-6 h-6" />
            </button>

            <div className="hidden md:flex gap-6 items-center">
              <button onClick={() => setPage('home')} className="hover:text-red-500 transition">Home</button>
              <button onClick={() => setPage('members')} className="hover:text-red-500 transition flex items-center gap-1"><Users className="w-4 h-4" />Members</button>
              <button onClick={() => setPage('leaderboard')} className="hover:text-red-500 transition flex items-center gap-1"><Trophy className="w-4 h-4" />Leaderboard</button>
              {user && <button onClick={() => setPage('profile')} className="hover:text-red-500 transition">Profile</button>}
              {isAdmin && <button onClick={() => setPage('admin')} className="hover:text-red-500 transition">Admin</button>}
              {user ? (
                <button onClick={() => signOut(auth)} className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700">
                  <LogOut className="w-4 h-4" />Logout
                </button>
              ) : (
                <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700">
                  <LogIn className="w-4 h-4" />Login
                </button>
              )}
            </div>
          </div>

          {showMobileMenu && (
            <div className="md:hidden mt-4 space-y-2 pb-4">
              <button onClick={() => { setPage('home'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-red-500">Home</button>
              <button onClick={() => { setPage('members'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-red-500">Members</button>
              <button onClick={() => { setPage('leaderboard'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-red-500">Leaderboard</button>
              {user && <button onClick={() => { setPage('profile'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-red-500">Profile</button>}
              {isAdmin && <button onClick={() => { setPage('admin'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-red-500">Admin</button>}
              {user ? (
                <button onClick={() => { signOut(auth); setShowMobileMenu(false); }} className="w-full text-left py-2 text-red-500">Logout</button>
              ) : (
                <button onClick={() => { setShowLogin(true); setShowMobileMenu(false); }} className="w-full text-left py-2 text-red-500">Login</button>
              )}
            </div>
          )}
        </div>
      </nav>

      {showLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowLogin(false)}>
          <div className="bg-white rounded-lg p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Member Login</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="your@email.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="••••••••" />
              </div>
              <button onClick={handleLogin} className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700">Sign In</button>
            </div>
          </div>
        </div>
      )}

      {editingFilm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full my-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Edit Film</h2>
              <button onClick={() => setEditingFilm(null)}><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm font-semibold mb-2">Title</label><input type="text" value={editingFilm.title} onChange={e => setEditingFilm({ ...editingFilm, title: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-2">Subtitle</label><input type="text" value={editingFilm.subtitle || ''} onChange={e => setEditingFilm({ ...editingFilm, subtitle: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-2">Image URL</label><input type="text" value={editingFilm.image} onChange={e => setEditingFilm({ ...editingFilm, image: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-2">Or Upload Image</label><input type="file" accept="image/*" onChange={async e => { const url = await uploadImage(e.target.files[0], 'films', editingFilm.id); if (url) setEditingFilm({ ...editingFilm, image: url }); }} className="w-full p-3 border rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold mb-2">RT Score</label><input type="number" value={editingFilm.rtScore || ''} onChange={e => setEditingFilm({ ...editingFilm, rtScore: parseInt(e.target.value) })} className="w-full p-3 border rounded-lg" /></div>
                <div><label className="block text-sm font-semibold mb-2">Emoji</label><input type="text" value={editingFilm.emoji} onChange={e => setEditingFilm({ ...editingFilm, emoji: e.target.value })} className="w-full p-3 border rounded-lg text-3xl" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-2">Date</label><input type="date" value={editingFilm.date} onChange={e => setEditingFilm({ ...editingFilm, date: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <button onClick={saveFilm} className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 flex items-center justify-center gap-2"><Save className="w-5 h-5" />Save Film</button>
            </div>
          </div>
        </div>
      )}

      {editingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Edit Profile</h2>
              <button onClick={() => setEditingProfile(null)}><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm font-semibold mb-2">Name</label><input type="text" value={editingProfile.name} onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-2">Title</label><input type="text" value={editingProfile.title} onChange={e => setEditingProfile({ ...editingProfile, title: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-2">Bio</label><textarea value={editingProfile.bio} onChange={e => setEditingProfile({ ...editingProfile, bio: e.target.value })} className="w-full p-3 border rounded-lg" rows="4" /></div>
              <div><label className="block text-sm font-semibold mb-2">Profile Image URL</label><input type="text" value={editingProfile.image} onChange={e => setEditingProfile({ ...editingProfile, image: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-2">Or Upload Photo</label><input type="file" accept="image/*" onChange={async e => { const url = await uploadImage(e.target.files[0], 'members', editingProfile.id); if (url) setEditingProfile({ ...editingProfile, image: url }); }} className="w-full p-3 border rounded-lg" /></div>
              <button onClick={saveProfile} className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 flex items-center justify-center gap-2"><Save className="w-5 h-5" />Save Profile</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-screen"><div className="text-2xl font-bold text-gray-600">Loading...</div></div>
      ) : (
        <>
          {page === 'home' && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
              <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="text-center mb-12">
                  <h2 className="text-5xl font-bold mb-3">Bad Movie Night</h2>
                  <p className="text-xl text-gray-300">Where terrible movies become legendary</p>
                  <p className="text-sm text-gray-400 mt-3">Since 2023 • {bmn.length} Screenings • {off.length} Offsite Films</p>
                </div>
                <section className="mb-12">
                  <h3 className="text-3xl font-bold mb-6 text-red-500">Screenings</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">{bmn.map(f => <FilmCard key={f.id} film={f} />)}</div>
                </section>
                <section>
                  <h3 className="text-3xl font-bold mb-6 text-red-500">Offsite Films</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">{off.map(f => <FilmCard key={f.id} film={f} />)}</div>
                </section>
              </div>
            </div>
          )}

          {page === 'detail' && selectedFilm && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
              <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex gap-4 mb-6">
                  <button onClick={() => setPage('home')} className="text-red-500 hover:text-red-400 font-semibold">← Back</button>
                  {isAdmin && <button onClick={() => setEditingFilm(selectedFilm)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"><Edit className="w-4 h-4" />Edit</button>}
                </div>
                <div className="bg-gray-800 rounded-lg shadow-2xl p-8">
                  <div className="grid md:grid-cols-2 gap-8 mb-8">
                    <div className="bg-gray-700 rounded-lg aspect-[2/3]"><img src={selectedFilm.image} alt={selectedFilm.title} className="w-full h-full object-cover rounded-lg" /></div>
                    <div>
                      <h1 className="text-4xl font-bold mb-2">{selectedFilm.title}</h1>
                      {selectedFilm.subtitle && <p className="text-xl text-gray-400 mb-4">{selectedFilm.subtitle}</p>}
                      <p className="text-gray-400 mb-6">{new Date(selectedFilm.date).toLocaleDateString()}</p>
                      <div className="flex gap-8 mb-8 items-center">
                        <div className="text-6xl">{selectedFilm.emoji}</div>
                        {selectedFilm.rtScore && <div className="text-center"><div className="text-sm text-gray-400 mb-2">Rotten Tomatoes</div><div className="flex items-center gap-2"><span className="text-4xl">🍅</span><span className="text-3xl font-bold">{selectedFilm.rtScore}%</span></div></div>}
                        <div className="text-center"><div className="text-sm text-gray-400 mb-2">BMN Score</div><div className="flex items-center gap-2"><Star className="w-10 h-10 fill-yellow-500 text-yellow-500" /><span className="text-3xl font-bold">{selectedFilm.bmnScore}</span></div></div>
                      </div>
                    </div>
                  </div>
                  {user && (
                    <div className="border-t border-gray-700 pt-8 mb-8">
                      <h2 className="text-2xl font-bold mb-4">Cast Your Vote</h2>
                      <div className="bg-gray-700 p-6 rounded-lg">
                        <div className="mb-4"><label className="block text-sm font-semibold mb-2">Score (0-100): {userVote.score}</label><input type="range" min="0" max="100" value={userVote.score} onChange={e => setUserVote({ ...userVote, score: parseInt(e.target.value) })} className="w-full" /></div>
                        <div className="mb-4"><label className="block text-sm font-semibold mb-2">Review</label><textarea value={userVote.text} onChange={e => setUserVote({ ...userVote, text: e.target.value })} className="w-full p-3 border rounded-lg bg-gray-800 text-white" rows="3" placeholder="What made this movie terrible?" /></div>
                        <div className="mb-4"><label className="block text-sm font-semibold mb-2">Rating</label><div className="flex gap-4"><button onClick={() => setUserVote({ ...userVote, thumbs: 'neutral' })} className={`px-4 py-2 rounded-lg border-2 ${userVote.thumbs === 'neutral' ? 'border-gray-400 bg-gray-600' : 'border-gray-600'}`}>👍 Neutral</button><button onClick={() => setUserVote({ ...userVote, thumbs: 'down' })} className={`px-4 py-2 rounded-lg border-2 ${userVote.thumbs === 'down' ? 'border-orange-500 bg-orange-900' : 'border-gray-600'}`}>👎 Down</button><button onClick={() => setUserVote({ ...userVote, thumbs: 'double-down' })} className={`px-4 py-2 rounded-lg border-2 ${userVote.thumbs === 'double-down' ? 'border-red-500 bg-red-900' : 'border-gray-600'}`}>👎👎 Double Down</button></div></div>
                        <button onClick={handleVote} className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700">Submit Vote</button>
                      </div>
                    </div>
                  )}
                  {!user && <div className="bg-yellow-900 border-l-4 border-yellow-500 p-4 mb-8"><p className="text-yellow-200">Please login to vote!</p></div>}
                </div>
              </div>
            </div>
          )}

          {page === 'members' && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
              <div className="max-w-7xl mx-auto px-4 py-8">
                <h2 className="text-4xl font-bold mb-8 text-center">Member Directory</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {members.map(m => (
                    <div key={m.id} onClick={() => { setSelectedMember(m); setPage('member-detail'); }} className="bg-gray-800 rounded-lg shadow-lg p-4 cursor-pointer hover:shadow-2xl transition">
                      <img src={m.image} alt={m.name} className="w-full aspect-square object-cover rounded-lg mb-3" />
                      <h3 className="font-bold text-center">{m.name}</h3>
                      <p className="text-sm text-gray-400 text-center">{m.title}</p>
                      <div className="text-center mt-2 text-xs text-red-500">{m.emojis?.length || 0} badges</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {page === 'member-detail' && selectedMember && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
              <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex gap-4 mb-6">
                  <button onClick={() => setPage('members')} className="text-red-500 hover:text-red-400 font-semibold">← Back</button>
                  {(isAdmin || user?.uid === selectedMember.id) && <button onClick={() => setEditingProfile(selectedMember)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"><Edit className="w-4 h-4" />Edit Profile</button>}
                </div>
                <div className="bg-gray-800 rounded-lg shadow-2xl p-8">
                  <div className="flex flex-col md:flex-row gap-8 mb-8">
                    <img src={selectedMember.image} alt={selectedMember.name} className="w-48 h-48 rounded-lg shadow-lg object-cover" />
                    <div className="flex-1">
                      <h1 className="text-3xl font-bold mb-2">{selectedMember.name}</h1>
                      <p className="text-lg text-gray-400 mb-4">{selectedMember.title}</p>
                      <p className="text-gray-300 mb-6">{selectedMember.bio}</p>
                    </div>
                  </div>
                  <div><h3 className="text-xl font-bold mb-4 text-red-500">Badge Collection ({selectedMember.emojis?.length || 0})</h3><div className="flex flex-wrap gap-3">{(selectedMember.emojis || []).map((e, i) => <span key={i} className="text-5xl">{e}</span>)}</div></div>
                </div>
              </div>
            </div>
          )}

          {page === 'profile' && user && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
              <div className="max-w-4xl mx-auto px-4 py-8">
                <h2 className="text-4xl font-bold mb-8 text-center">My Profile</h2>
                {userProfile ? (
                  <div className="bg-gray-800 rounded-lg shadow-2xl p-8">
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex gap-8">
                        <img src={userProfile.image} alt={userProfile.name} className="w-32 h-32 rounded-lg object-cover" />
                        <div>
                          <h1 className="text-3xl font-bold mb-2">{userProfile.name}</h1>
                          <p className="text-lg text-gray-400 mb-4">{userProfile.title}</p>
                          <p className="text-gray-300">{userProfile.bio}</p>
                        </div>
                      </div>
                      <button onClick={() => setEditingProfile(userProfile)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"><Edit className="w-4 h-4" />Edit</button>
                    </div>
                    <div><h3 className="text-xl font-bold mb-4 text-red-500">Badges ({userProfile.emojis?.length || 0})</h3><div className="flex flex-wrap gap-3">{(userProfile.emojis || []).map((e, i) => <span key={i} className="text-5xl">{e}</span>)}</div></div>
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-lg shadow-2xl p-8 text-center"><p className="text-gray-400">Profile not found. Contact admin to set up your profile.</p></div>
                )}
              </div>
            </div>
          )}

          {page === 'admin' && isAdmin && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
              <div className="max-w-6xl mx-auto px-4 py-8">
                <h2 className="text-4xl font-bold mb-8 text-center">Admin Panel</h2>
                <div className="bg-gray-800 rounded-lg shadow-2xl p-8">
                  <h3 className="text-2xl font-bold mb-4 text-red-500">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => alert('Coming soon!')} className="p-6 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center justify-center gap-2"><Plus className="w-5 h-5" />Add New Film</button>
                    <button onClick={() => setPage('members')} className="p-6 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center justify-center gap-2"><Users className="w-5 h-5" />Manage Members</button>
                  </div>
                  <p className="text-gray-400 mt-6 text-center">Use the edit buttons on films and profiles to make changes.</p>
                </div>
              </div>
            </div>
          )}

          {page === 'leaderboard' && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
              <div className="max-w-5xl mx-auto px-4 py-8">
                <h2 className="text-4xl font-bold mb-2 text-center">Leaderboard</h2>
                <p className="text-center text-gray-400 mb-8">Who's the baddest?</p>
                <div className="bg-gray-800 rounded-lg shadow-lg p-6">
                  <div className="space-y-4">
                    {[...members].sort((a, b) => (b.emojis?.length || 0) - (a.emojis?.length || 0)).map((m, i) => (
                      <div key={m.id} className="flex items-center gap-4 bg-gray-700 p-4 rounded-lg cursor-pointer hover:bg-gray-600" onClick={() => { setSelectedMember(m); setPage('member-detail'); }}>
                        <div className="text-3xl font-bold text-red-500 w-12 text-center">{i === 0 && '🥇'}{i === 1 && '🥈'}{i === 2 && '🥉'}{i > 2 && `#${i + 1}`}</div>
                        <img src={m.image} alt={m.name} className="w-16 h-16 rounded-full object-cover" />
                        <div className="flex-1">
                          <div className="font-bold text-lg">{m.name}</div>
                          <div className="text-sm text-gray-400">{m.title}</div>
                        </div>
                        <div className="text-2xl font-bold text-red-500">{m.emojis?.length || 0} badges</div>
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

export default App;import React, { useState, useEffect } from 'react';
import { Star, Film, LogIn, LogOut, Edit, Save, X, Upload, Menu, Users, Trophy, Plus } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
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

const ADMIN_EMAILS = ['matt@badmovienight.com', 'gabe@badmovienight.com', 'ryan@badmovienight.com'];

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [editingFilm, setEditingFilm] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [userVote, setUserVote] = useState({ score: 50, text: '', thumbs: 'neutral' });
  const [loading, setLoading] = useState(true);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const memberDoc = await getDoc(doc(db, 'members', u.uid));
        if (memberDoc.exists()) {
          setUserProfile({ id: u.uid, ...memberDoc.data() });
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
    if (!isAdmin || !editingFilm) return;
    try {
      await setDoc(doc(db, 'films', editingFilm.id), editingFilm);
      alert('Film saved!');
      setEditingFilm(null);
      loadData();
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  };

  const saveProfile = async () => {
    if (!editingProfile) return;
    try {
      await setDoc(doc(db, 'members', editingProfile.id), editingProfile);
      alert('Profile saved!');
      setEditingProfile(null);
      loadData();
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
    <div onClick={() => { setSelectedFilm(film); setPage('detail'); }} className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer hover:shadow-2xl transition transform hover:-translate-y-1">
      <div className="relative bg-gray-200 aspect-[2/3]">
        <img src={film.image} alt={film.title} className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
      </div>
      <div className="p-3">
        <h3 className="font-bold text-sm mb-1 truncate">{film.title}</h3>
        <div className="flex gap-2 justify-center items-center text-xs">
          <span className="text-2xl">{film.emoji}</span>
          {film.rtScore && <div className="text-center"><div className="text-xs text-gray-500">RT</div><div className="font-bold">{film.rtScore}%</div></div>}
          <div className="text-center"><div className="text-xs text-gray-500">BMN</div><div className="font-bold text-blue-700">{film.bmnScore}</div></div>
        </div>
      </div>
    </div>
  );

  const bmn = films.filter(f => f.type === 'bmn');
  const off = films.filter(f => f.type === 'offsite-film');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setPage('home'); setShowMobileMenu(false); }}>
              <Film className="w-8 h-8 text-red-500" />
              <h1 className="text-xl font-bold">Bad Movie Night</h1>
            </div>
            
            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="md:hidden">
              <Menu className="w-6 h-6" />
            </button>

            <div className="hidden md:flex gap-6 items-center">
              <button onClick={() => setPage('home')} className="hover:text-red-500 transition">Home</button>
              <button onClick={() => setPage('members')} className="hover:text-red-500 transition flex items-center gap-1"><Users className="w-4 h-4" />Members</button>
              <button onClick={() => setPage('leaderboard')} className="hover:text-red-500 transition flex items-center gap-1"><Trophy className="w-4 h-4" />Leaderboard</button>
              {user && <button onClick={() => setPage('profile')} className="hover:text-red-500 transition">Profile</button>}
              {isAdmin && <button onClick={() => setPage('admin')} className="hover:text-red-500 transition">Admin</button>}
              {user ? (
                <button onClick={() => signOut(auth)} className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700">
                  <LogOut className="w-4 h-4" />Logout
                </button>
              ) : (
                <button onClick={() => setShowLogin(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700">
                  <LogIn className="w-4 h-4" />Login
                </button>
              )}
            </div>
          </div>

          {showMobileMenu && (
            <div className="md:hidden mt-4 space-y-2 pb-4">
              <button onClick={() => { setPage('home'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-red-500">Home</button>
              <button onClick={() => { setPage('members'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-red-500">Members</button>
              <button onClick={() => { setPage('leaderboard'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-red-500">Leaderboard</button>
              {user && <button onClick={() => { setPage('profile'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-red-500">Profile</button>}
              {isAdmin && <button onClick={() => { setPage('admin'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-red-500">Admin</button>}
              {user ? (
                <button onClick={() => { signOut(auth); setShowMobileMenu(false); }} className="w-full text-left py-2 text-red-500">Logout</button>
              ) : (
                <button onClick={() => { setShowLogin(true); setShowMobileMenu(false); }} className="w-full text-left py-2 text-red-500">Login</button>
              )}
            </div>
          )}
        </div>
      </nav>

      {showLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowLogin(false)}>
          <div className="bg-white rounded-lg p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Member Login</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="your@email.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border rounded-lg" placeholder="••••••••" />
              </div>
              <button onClick={handleLogin} className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700">Sign In</button>
            </div>
          </div>
        </div>
      )}

      {editingFilm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full my-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Edit Film</h2>
              <button onClick={() => setEditingFilm(null)}><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm font-semibold mb-2">Title</label><input type="text" value={editingFilm.title} onChange={e => setEditingFilm({ ...editingFilm, title: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-2">Subtitle</label><input type="text" value={editingFilm.subtitle || ''} onChange={e => setEditingFilm({ ...editingFilm, subtitle: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-2">Image URL</label><input type="text" value={editingFilm.image} onChange={e => setEditingFilm({ ...editingFilm, image: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-2">Or Upload Image</label><input type="file" accept="image/*" onChange={async e => { const url = await uploadImage(e.target.files[0], 'films', editingFilm.id); if (url) setEditingFilm({ ...editingFilm, image: url }); }} className="w-full p-3 border rounded-lg" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold mb-2">RT Score</label><input type="number" value={editingFilm.rtScore || ''} onChange={e => setEditingFilm({ ...editingFilm, rtScore: parseInt(e.target.value) })} className="w-full p-3 border rounded-lg" /></div>
                <div><label className="block text-sm font-semibold mb-2">Emoji</label><input type="text" value={editingFilm.emoji} onChange={e => setEditingFilm({ ...editingFilm, emoji: e.target.value })} className="w-full p-3 border rounded-lg text-3xl" /></div>
              </div>
              <div><label className="block text-sm font-semibold mb-2">Date</label><input type="date" value={editingFilm.date} onChange={e => setEditingFilm({ ...editingFilm, date: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <button onClick={saveFilm} className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 flex items-center justify-center gap-2"><Save className="w-5 h-5" />Save Film</button>
            </div>
          </div>
        </div>
      )}

      {editingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Edit Profile</h2>
              <button onClick={() => setEditingProfile(null)}><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm font-semibold mb-2">Name</label><input type="text" value={editingProfile.name} onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-2">Title</label><input type="text" value={editingProfile.title} onChange={e => setEditingProfile({ ...editingProfile, title: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-2">Bio</label><textarea value={editingProfile.bio} onChange={e => setEditingProfile({ ...editingProfile, bio: e.target.value })} className="w-full p-3 border rounded-lg" rows="4" /></div>
              <div><label className="block text-sm font-semibold mb-2">Profile Image URL</label><input type="text" value={editingProfile.image} onChange={e => setEditingProfile({ ...editingProfile, image: e.target.value })} className="w-full p-3 border rounded-lg" /></div>
              <div><label className="block text-sm font-semibold mb-2">Or Upload Photo</label><input type="file" accept="image/*" onChange={async e => { const url = await uploadImage(e.target.files[0], 'members', editingProfile.id); if (url) setEditingProfile({ ...editingProfile, image: url }); }} className="w-full p-3 border rounded-lg" /></div>
              <button onClick={saveProfile} className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 flex items-center justify-center gap-2"><Save className="w-5 h-5" />Save Profile</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-screen"><div className="text-2xl font-bold text-gray-600">Loading...</div></div>
      ) : (
        <>
          {page === 'home' && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
              <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="text-center mb-12">
                  <h2 className="text-5xl font-bold mb-3">Bad Movie Night</h2>
                  <p className="text-xl text-gray-300">Where terrible movies become legendary</p>
                  <p className="text-sm text-gray-400 mt-3">Since 2023 • {bmn.length} Screenings • {off.length} Offsite Films</p>
                </div>
                <section className="mb-12">
                  <h3 className="text-3xl font-bold mb-6 text-red-500">Screenings</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">{bmn.map(f => <FilmCard key={f.id} film={f} />)}</div>
                </section>
                <section>
                  <h3 className="text-3xl font-bold mb-6 text-red-500">Offsite Films</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">{off.map(f => <FilmCard key={f.id} film={f} />)}</div>
                </section>
              </div>
            </div>
          )}

          {page === 'detail' && selectedFilm && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
              <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex gap-4 mb-6">
                  <button onClick={() => setPage('home')} className="text-red-500 hover:text-red-400 font-semibold">← Back</button>
                  {isAdmin && <button onClick={() => setEditingFilm(selectedFilm)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"><Edit className="w-4 h-4" />Edit</button>}
                </div>
                <div className="bg-gray-800 rounded-lg shadow-2xl p-8">
                  <div className="grid md:grid-cols-2 gap-8 mb-8">
                    <div className="bg-gray-700 rounded-lg aspect-[2/3]"><img src={selectedFilm.image} alt={selectedFilm.title} className="w-full h-full object-cover rounded-lg" /></div>
                    <div>
                      <h1 className="text-4xl font-bold mb-2">{selectedFilm.title}</h1>
                      {selectedFilm.subtitle && <p className="text-xl text-gray-400 mb-4">{selectedFilm.subtitle}</p>}
                      <p className="text-gray-400 mb-6">{new Date(selectedFilm.date).toLocaleDateString()}</p>
                      <div className="flex gap-8 mb-8 items-center">
                        <div className="text-6xl">{selectedFilm.emoji}</div>
                        {selectedFilm.rtScore && <div className="text-center"><div className="text-sm text-gray-400 mb-2">Rotten Tomatoes</div><div className="flex items-center gap-2"><span className="text-4xl">🍅</span><span className="text-3xl font-bold">{selectedFilm.rtScore}%</span></div></div>}
                        <div className="text-center"><div className="text-sm text-gray-400 mb-2">BMN Score</div><div className="flex items-center gap-2"><Star className="w-10 h-10 fill-yellow-500 text-yellow-500" /><span className="text-3xl font-bold">{selectedFilm.bmnScore}</span></div></div>
                      </div>
                    </div>
                  </div>
                  {user && (
                    <div className="border-t border-gray-700 pt-8 mb-8">
                      <h2 className="text-2xl font-bold mb-4">Cast Your Vote</h2>
                      <div className="bg-gray-700 p-6 rounded-lg">
                        <div className="mb-4"><label className="block text-sm font-semibold mb-2">Score (0-100): {userVote.score}</label><input type="range" min="0" max="100" value={userVote.score} onChange={e => setUserVote({ ...userVote, score: parseInt(e.target.value) })} className="w-full" /></div>
                        <div className="mb-4"><label className="block text-sm font-semibold mb-2">Review</label><textarea value={userVote.text} onChange={e => setUserVote({ ...userVote, text: e.target.value })} className="w-full p-3 border rounded-lg bg-gray-800 text-white" rows="3" placeholder="What made this movie terrible?" /></div>
                        <div className="mb-4"><label className="block text-sm font-semibold mb-2">Rating</label><div className="flex gap-4"><button onClick={() => setUserVote({ ...userVote, thumbs: 'neutral' })} className={`px-4 py-2 rounded-lg border-2 ${userVote.thumbs === 'neutral' ? 'border-gray-400 bg-gray-600' : 'border-gray-600'}`}>👍 Neutral</button><button onClick={() => setUserVote({ ...userVote, thumbs: 'down' })} className={`px-4 py-2 rounded-lg border-2 ${userVote.thumbs === 'down' ? 'border-orange-500 bg-orange-900' : 'border-gray-600'}`}>👎 Down</button><button onClick={() => setUserVote({ ...userVote, thumbs: 'double-down' })} className={`px-4 py-2 rounded-lg border-2 ${userVote.thumbs === 'double-down' ? 'border-red-500 bg-red-900' : 'border-gray-600'}`}>👎👎 Double Down</button></div></div>
                        <button onClick={handleVote} className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700">Submit Vote</button>
                      </div>
                    </div>
                  )}
                  {!user && <div className="bg-yellow-900 border-l-4 border-yellow-500 p-4 mb-8"><p className="text-yellow-200">Please login to vote!</p></div>}
                </div>
              </div>
            </div>
          )}

          {page === 'members' && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
              <div className="max-w-7xl mx-auto px-4 py-8">
                <h2 className="text-4xl font-bold mb-8 text-center">Member Directory</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {members.map(m => (
                    <div key={m.id} onClick={() => { setSelectedMember(m); setPage('member-detail'); }} className="bg-gray-800 rounded-lg shadow-lg p-4 cursor-pointer hover:shadow-2xl transition">
                      <img src={m.image} alt={m.name} className="w-full aspect-square object-cover rounded-lg mb-3" />
                      <h3 className="font-bold text-center">{m.name}</h3>
                      <p className="text-sm text-gray-400 text-center">{m.title}</p>
                      <div className="text-center mt-2 text-xs text-red-500">{m.emojis?.length || 0} badges</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {page === 'member-detail' && selectedMember && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
              <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex gap-4 mb-6">
                  <button onClick={() => setPage('members')} className="text-red-500 hover:text-red-400 font-semibold">← Back</button>
                  {(isAdmin || user?.uid === selectedMember.id) && <button onClick={() => setEditingProfile(selectedMember)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"><Edit className="w-4 h-4" />Edit Profile</button>}
                </div>
                <div className="bg-gray-800 rounded-lg shadow-2xl p-8">
                  <div className="flex flex-col md:flex-row gap-8 mb-8">
                    <img src={selectedMember.image} alt={selectedMember.name} className="w-48 h-48 rounded-lg shadow-lg object-cover" />
                    <div className="flex-1">
                      <h1 className="text-3xl font-bold mb-2">{selectedMember.name}</h1>
                      <p className="text-lg text-gray-400 mb-4">{selectedMember.title}</p>
                      <p className="text-gray-300 mb-6">{selectedMember.bio}</p>
                    </div>
                  </div>
                  <div><h3 className="text-xl font-bold mb-4 text-red-500">Badge Collection ({selectedMember.emojis?.length || 0})</h3><div className="flex flex-wrap gap-3">{(selectedMember.emojis || []).map((e, i) => <span key={i} className="text-5xl">{e}</span>)}</div></div>
                </div>
              </div>
            </div>
          )}

          {page === 'profile' && user && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
              <div className="max-w-4xl mx-auto px-4 py-8">
                <h2 className="text-4xl font-bold mb-8 text-center">My Profile</h2>
                {userProfile ? (
                  <div className="bg-gray-800 rounded-lg shadow-2xl p-8">
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex gap-8">
                        <img src={userProfile.image} alt={userProfile.name} className="w-32 h-32 rounded-lg object-cover" />
                        <div>
                          <h1 className="text-3xl font-bold mb-2">{userProfile.name}</h1>
                          <p className="text-lg text-gray-400 mb-4">{userProfile.title}</p>
                          <p className="text-gray-300">{userProfile.bio}</p>
                        </div>
                      </div>
                      <button onClick={() => setEditingProfile(userProfile)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"><Edit className="w-4 h-4" />Edit</button>
                    </div>
                    <div><h3 className="text-xl font-bold mb-4 text-red-500">Badges ({userProfile.emojis?.length || 0})</h3><div className="flex flex-wrap gap-3">{(userProfile.emojis || []).map((e, i) => <span key={i} className="text-5xl">{e}</span>)}</div></div>
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-lg shadow-2xl p-8 text-center"><p className="text-gray-400">Profile not found. Contact admin to set up your profile.</p></div>
                )}
              </div>
            </div>
          )}

          {page === 'admin' && isAdmin && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
              <div className="max-w-6xl mx-auto px-4 py-8">
                <h2 className="text-4xl font-bold mb-8 text-center">Admin Panel</h2>
                <div className="bg-gray-800 rounded-lg shadow-2xl p-8">
                  <h3 className="text-2xl font-bold mb-4 text-red-500">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => alert('Coming soon!')} className="p-6 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center justify-center gap-2"><Plus className="w-5 h-5" />Add New Film</button>
                    <button onClick={() => setPage('members')} className="p-6 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center justify-center gap-2"><Users className="w-5 h-5" />Manage Members</button>
                  </div>
                  <p className="text-gray-400 mt-6 text-center">Use the edit buttons on films and profiles to make changes.</p>
                </div>
              </div>
            </div>
          )}

          {page === 'leaderboard' && (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
              <div className="max-w-5xl mx-auto px-4 py-8">
                <h2 className="text-4xl font-bold mb-2 text-center">Leaderboard</h2>
                <p className="text-center text-gray-400 mb-8">Who's the baddest?</p>
                <div className="bg-gray-800 rounded-lg shadow-lg p-6">
                  <div className="space-y-4">
                    {[...members].sort((a, b) => (b.emojis?.length || 0) - (a.emojis?.length || 0)).map((m, i) => (
                      <div key={m.id} className="flex items-center gap-4 bg-gray-700 p-4 rounded-lg cursor-pointer hover:bg-gray-600" onClick={() => { setSelectedMember(m); setPage('member-detail'); }}>
                        <div className="text-3xl font-bold text-red-500 w-12 text-center">{i === 0 && '🥇'}{i === 1 && '🥈'}{i === 2 && '🥉'}{i > 2 && `#${i + 1}`}</div>
                        <img src={m.image} alt={m.name} className="w-16 h-16 rounded-full object-cover" />
                        <div className="flex-1">
                          <div className="font-bold text-lg">{m.name}</div>
                          <div className="text-sm text-gray-400">{m.title}</div>
                        </div>
                        <div className="text-2xl font-bold text-red-500">{m.emojis?.length || 0} badges</div>
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
