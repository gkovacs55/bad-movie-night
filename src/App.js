import React, { useState, useEffect } from 'react';
import { Star, Film, LogIn, LogOut, Edit, Save, X, Upload, Menu, Users, Trophy, Plus, Trash2, Database, Heart, Calendar, Send } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
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

// ALL MEMBERS ARE NOW ADMINS
const EMAIL_TO_MEMBER_ID = {
  'mattdernlan@gmail.com': 'matt',  // Fixed email
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
  const [showJoinRequest, setShowJoinRequest] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [editingFilm, setEditingFilm] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [editingVote, setEditingVote] = useState(null);
  const [newFilm, setNewFilm] = useState({
    title: '', subtitle: '', image: '', rtScore: '', bmnScore: 50, 
    date: '', emoji: '🎬', type: 'bmn', attendees: []
  });
  const [joinRequest, setJoinRequest] = useState({
    name: '', email: '', message: '', favoriteMovie: ''
  });
  const [joinRequests, setJoinRequests] = useState([]);
  const [userVote, setUserVote] = useState({ score: 50, text: '', thumbs: 'neutral' });
  const [filmVotes, setFilmVotes] = useState([]);
  const [buzzFeed, setBuzzFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  // ALL members are admins now
  const isAdmin = user && EMAIL_TO_MEMBER_ID[user.email];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const memberId = EMAIL_TO_MEMBER_ID[u.email];
        if (memberId) {
          const memberDoc = await getDoc(doc(db, 'members', memberId));
          if (memberDoc.exists()) {
            setUserProfile({ id: memberId, ...memberDoc.data() });
          } else {
            setUserProfile({ id: memberId, email: u.email, name: memberId });
          }
        } else {
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
    });
    loadData();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedFilm) {
      loadFilmVotes(selectedFilm.id);
    }
  }, [selectedFilm]);

  const loadFilmVotes = async (filmId) => {
    try {
      const votesSnap = await getDocs(collection(db, 'films', filmId, 'votes'));
      const votesData = votesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFilmVotes(votesData);
    } catch (err) {
      console.error('Error loading votes:', err);
      setFilmVotes([]);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const filmsSnap = await getDocs(collection(db, 'films'));
      let filmsData = filmsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (filmsData.length === 0) {
        filmsData = getInitialFilms();
      }
      
      // Sort by date (most recent first)
      filmsData.sort((a, b) => new Date(b.date) - new Date(a.date));
      setFilms(filmsData);

      const membersSnap = await getDocs(collection(db, 'members'));
      const membersData = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMembers(membersData.length > 0 ? membersData : getInitialMembers());

      // Load join requests
      const requestsSnap = await getDocs(collection(db, 'joinRequests'));
      const requestsData = requestsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setJoinRequests(requestsData);

      // Load buzz feed (all activity)
      await loadBuzzFeed();
    } catch (err) {
      console.error('Load error:', err);
      setFilms(getInitialFilms().sort((a, b) => new Date(b.date) - new Date(a.date)));
      setMembers(getInitialMembers());
    }
    setLoading(false);
  };

  const loadBuzzFeed = async () => {
    try {
      const allActivity = [];
      const filmsSnap = await getDocs(collection(db, 'films'));
      
      for (const filmDoc of filmsSnap.docs) {
        const votesSnap = await getDocs(collection(db, 'films', filmDoc.id, 'votes'));
        votesSnap.docs.forEach(voteDoc => {
          const vote = voteDoc.data();
          allActivity.push({
            type: 'vote',
            ...vote,
            filmTitle: filmDoc.data().title,
            filmId: filmDoc.id
          });
        });
      }
      
      // Sort by most recent
      allActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setBuzzFeed(allActivity);
    } catch (err) {
      console.error('Error loading buzz feed:', err);
    }
  };

  const seedDatabase = async () => {
    if (!isAdmin) return;
    if (!window.confirm('This will add all initial films and members to the database. Continue?')) return;
    
    try {
      const initialFilms = getInitialFilms();
      const initialMembers = getInitialMembers();
      
      for (const film of initialFilms) {
        await setDoc(doc(db, 'films', film.id), film);
      }
      
      for (const member of initialMembers) {
        await setDoc(doc(db, 'members', member.id), member);
      }
      
      alert('Database seeded successfully!');
      loadData();
    } catch (err) {
      alert('Error seeding database: ' + err.message);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowLogin(false);
      setEmail('');
      setPassword('');
      alert('Welcome to Bad Movie Night!');
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      alert('Please enter your email address');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      alert('Password reset email sent! Check your inbox.');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleJoinRequest = async () => {
    if (!joinRequest.name || !joinRequest.email) {
      alert('Please fill in name and email');
      return;
    }
    try {
      const requestId = Date.now().toString();
      await setDoc(doc(db, 'joinRequests', requestId), {
        ...joinRequest,
        timestamp: new Date().toISOString(),
        status: 'pending'
      });
      alert('Request submitted! We\'ll be in touch soon.');
      setShowJoinRequest(false);
      setJoinRequest({ name: '', email: '', message: '', favoriteMovie: '' });
      loadData();
    } catch (err) {
      alert('Error submitting request: ' + err.message);
    }
  };

  const handleVote = async () => {
    if (!user || !selectedFilm || !userProfile) {
      alert('You must be logged in to vote!');
      return;
    }
    
    try {
      const voteData = {
        authUserId: user.uid,
        authUserEmail: user.email,
        memberId: userProfile.id,
        memberName: userProfile.name,
        score: userVote.score,
        text: userVote.text,
        thumbs: userVote.thumbs,
        timestamp: new Date().toISOString(),
        filmId: selectedFilm.id,
        filmTitle: selectedFilm.title,
        likes: []
      };
      
      await setDoc(doc(db, 'films', selectedFilm.id, 'votes', userProfile.id), voteData);
      
      // Recalculate BMN score from all votes
      const votesSnap = await getDocs(collection(db, 'films', selectedFilm.id, 'votes'));
      const votes = votesSnap.docs.map(d => d.data());
      const avgScore = votes.length > 0 
        ? Math.round(votes.reduce((sum, v) => sum + v.score, 0) / votes.length)
        : userVote.score;
      
      await updateDoc(doc(db, 'films', selectedFilm.id), { bmnScore: avgScore });
      
      alert(`Vote ${editingVote ? 'updated' : 'submitted'} successfully! New BMN Score: ${avgScore}`);
      
      setEditingVote(null);
      await loadData();
      await loadFilmVotes(selectedFilm.id);
      await loadBuzzFeed();
      
      const updatedFilm = { ...selectedFilm, bmnScore: avgScore };
      setSelectedFilm(updatedFilm);
      setUserVote({ score: 50, text: '', thumbs: 'neutral' });
    } catch (err) {
      console.error('Vote error:', err);
      alert('Error submitting vote: ' + err.message);
    }
  };

  const handleLikeVote = async (filmId, voteId, currentLikes = []) => {
    if (!user || !userProfile) return;
    
    try {
      const hasLiked = currentLikes.includes(userProfile.id);
      const newLikes = hasLiked 
        ? currentLikes.filter(id => id !== userProfile.id)
        : [...currentLikes, userProfile.id];
      
      await updateDoc(doc(db, 'films', filmId, 'votes', voteId), { likes: newLikes });
      await loadFilmVotes(filmId);
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleDeleteVote = async (filmId, voteId) => {
    if (!isAdmin) return;
    if (!window.confirm('Delete this review?')) return;
    
    try {
      await deleteDoc(doc(db, 'films', filmId, 'votes', voteId));
      alert('Review deleted!');
      await loadFilmVotes(filmId);
      await loadBuzzFeed();
      
      // Recalculate BMN score
      const votesSnap = await getDocs(collection(db, 'films', filmId, 'votes'));
      const votes = votesSnap.docs.map(d => d.data());
      const avgScore = votes.length > 0 
        ? Math.round(votes.reduce((sum, v) => sum + v.score, 0) / votes.length)
        : 50;
      await updateDoc(doc(db, 'films', filmId), { bmnScore: avgScore });
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  const saveFilm = async () => {
    if (!editingFilm) return;
    
    try {
      await setDoc(doc(db, 'films', editingFilm.id), editingFilm);
      alert('Film saved successfully!');
      setEditingFilm(null);
      await loadData();
      if (selectedFilm && selectedFilm.id === editingFilm.id) {
        setSelectedFilm(editingFilm);
      }
    } catch (err) {
      alert('Error saving film: ' + err.message);
    }
  };

  const addNewFilm = async () => {
    if (!isAdmin || !newFilm.title) {
      alert('Please fill in at least the title');
      return;
    }
    
    try {
      const filmId = newFilm.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const filmData = { 
        ...newFilm, 
        id: filmId,
        bmnScore: parseInt(newFilm.bmnScore) || 50,
        rtScore: newFilm.rtScore ? parseInt(newFilm.rtScore) : null
      };
      
      await setDoc(doc(db, 'films', filmId), filmData);
      alert('Film added successfully!');
      setShowAddFilm(false);
      setNewFilm({
        title: '', subtitle: '', image: '', rtScore: '', bmnScore: 50,
        date: '', emoji: '🎬', type: 'bmn', attendees: []
      });
      await loadData();
    } catch (err) {
      alert('Error adding film: ' + err.message);
    }
  };

  const deleteFilm = async (filmId) => {
    if (!isAdmin) return;
    if (!window.confirm('Delete this film and all its votes?')) return;
    
    try {
      await deleteDoc(doc(db, 'films', filmId));
      alert('Film deleted!');
      setSelectedFilm(null);
      setPage('home');
      await loadData();
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  const saveProfile = async () => {
    if (!editingProfile) return;
    
    try {
      await setDoc(doc(db, 'members', editingProfile.id), editingProfile);
      alert('Profile saved!');
      setEditingProfile(null);
      await loadData();
      if (userProfile && editingProfile.id === userProfile.id) {
        setUserProfile(editingProfile);
      }
      if (selectedMember && editingProfile.id === selectedMember.id) {
        setSelectedMember(editingProfile);
      }
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  };

  const uploadImage = async (file, type, id) => {
    if (!file) return null;
    try {
      const storageRef = ref(storage, `${type}/${id}/${file.name}`);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (err) {
      alert('Upload failed: ' + err.message);
      return null;
    }
  };

  const getFilmByEmoji = (emoji) => {
    return films.find(f => f.emoji === emoji);
  };

  const FilmCard = ({ film }) => (
    <div onClick={() => { setSelectedFilm(film); setPage('detail'); }} 
         className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 group relative">
      <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 aspect-[2/3]">
        <img src={film.image} alt={film.title} className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
        {/* Date on hover */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-70 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="text-white text-center p-4">
            <Calendar className="w-8 h-8 mx-auto mb-2" />
            <p className="font-semibold">{new Date(film.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
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

  // Calculate leaderboard stats
  const memberStats = members.map(m => {
    const voteCount = buzzFeed.filter(b => b.memberId === m.id).length;
    const reviewCount = buzzFeed.filter(b => b.memberId === m.id && b.text).length;
    return {
      ...m,
      voteCount,
      reviewCount,
      badgeCount: m.emojis?.length || 0
    };
  });

  // AUTH GATE - Must be logged in to see anything
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-2xl inline-block mb-4">
              <Film className="w-16 h-16 text-white" />
            </div>
            <h1 className="text-6xl font-bold mb-4 text-white">Bad Movie Night</h1>
            <p className="text-2xl text-blue-200 mb-6">Where Terrible Movies Become Legendary</p>
            <div className="bg-yellow-500/20 border-2 border-yellow-500 rounded-xl p-6 mb-8">
              <p className="text-yellow-200 text-lg font-semibold mb-2">🎬 EXCLUSIVE • INVITE ONLY • MEMBERS ONLY 🎬</p>
              <p className="text-white">This is a private screening club for the most discerning bad movie enthusiasts.</p>
            </div>
          </div>

          {showLogin ? (
            <div className="bg-white rounded-2xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Member Login</h2>
                <button onClick={() => setShowLogin(false)} className="text-gray-500 hover:text-gray-700"><X /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" 
                         placeholder="your@email.com" 
                         onKeyPress={e => e.key === 'Enter' && handleLogin()} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" 
                         placeholder="••••••••"
                         onKeyPress={e => e.key === 'Enter' && handleLogin()} />
                </div>
                <button onClick={handleLogin} 
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition shadow-lg">
                  Sign In
                </button>
                <button onClick={() => setShowForgotPassword(true)} 
                        className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Forgot Password?
                </button>
              </div>
            </div>
          ) : showForgotPassword ? (
            <div className="bg-white rounded-2xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Reset Password</h2>
                <button onClick={() => setShowForgotPassword(false)} className="text-gray-500 hover:text-gray-700"><X /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Email</label>
                  <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" 
                         placeholder="your@email.com" />
                </div>
                <button onClick={handleForgotPassword} 
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition shadow-lg">
                  Send Reset Link
                </button>
                <button onClick={() => setShowForgotPassword(false)} 
                        className="w-full text-gray-600 hover:text-gray-800 text-sm">
                  Back to Login
                </button>
              </div>
            </div>
          ) : showJoinRequest ? (
            <div className="bg-white rounded-2xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Request to Join</h2>
                <button onClick={() => setShowJoinRequest(false)} className="text-gray-500 hover:text-gray-700"><X /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Name *</label>
                  <input type="text" value={joinRequest.name} onChange={e => setJoinRequest({...joinRequest, name: e.target.value})} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Email *</label>
                  <input type="email" value={joinRequest.email} onChange={e => setJoinRequest({...joinRequest, email: e.target.value})} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Favorite Bad Movie</label>
                  <input type="text" value={joinRequest.favoriteMovie} onChange={e => setJoinRequest({...joinRequest, favoriteMovie: e.target.value})} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" 
                         placeholder="e.g., The Room, Birdemic..." />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Why do you want to join?</label>
                  <textarea value={joinRequest.message} onChange={e => setJoinRequest({...joinRequest, message: e.target.value})} 
                            className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" 
                            rows="4" placeholder="Tell us why you love bad movies..." />
                </div>
                <button onClick={handleJoinRequest} 
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition shadow-lg flex items-center justify-center gap-2">
                  <Send className="w-5 h-5" />Submit Request
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button onClick={() => setShowLogin(true)} 
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-600 hover:to-purple-700 transition shadow-lg flex items-center justify-center gap-2">
                <LogIn className="w-6 h-6" />Member Login
              </button>
              <button onClick={() => setShowJoinRequest(true)} 
                      className="w-full bg-white text-blue-600 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition shadow-lg border-2 border-blue-500">
                Request to Join
              </button>
            </div>
          )}

          <div className="mt-8 text-center">
            <p className="text-blue-200 text-sm">Since 2023 • 13 Screenings • 5 Offsite Films</p>
          </div>
        </div>
      </div>
    );
  }

  // REST OF APP (only shown when logged in)
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
              <button onClick={() => setPage('buzz')} className="hover:text-blue-300 transition font-medium">The Buzz</button>
              {isAdmin && <button onClick={() => setPage('requests')} className="hover:text-blue-300 transition font-medium">Requests</button>}
              <button onClick={() => setPage('profile')} className="hover:text-blue-300 transition font-medium">Profile</button>
              {isAdmin && <button onClick={() => setPage('admin')} className="hover:text-blue-300 transition font-medium">Admin</button>}
              <div className="flex items-center gap-3">
                {userProfile && <span className="text-sm text-blue-200">Hi, {userProfile.name}!</span>}
                <button onClick={() => signOut(auth)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 rounded-lg hover:from-red-600 hover:to-red-700 transition shadow-lg font-medium">
                  <LogOut className="w-4 h-4" />Logout
                </button>
              </div>
            </div>
          </div>

          {showMobileMenu && (
            <div className="md:hidden mt-4 space-y-2 pb-4 border-t border-white/10 pt-4">
              {userProfile && <div className="text-sm text-blue-200 py-2">Hi, {userProfile.name}!</div>}
              <button onClick={() => { setPage('home'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-blue-300 font-medium">Home</button>
              <button onClick={() => { setPage('members'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-blue-300 font-medium">Members</button>
              <button onClick={() => { setPage('leaderboard'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-blue-300 font-medium">Leaderboard</button>
              <button onClick={() => { setPage('buzz'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-blue-300 font-medium">The Buzz</button>
              {isAdmin && <button onClick={() => { setPage('requests'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-blue-300 font-medium">Requests</button>}
              <button onClick={() => { setPage('profile'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-blue-300 font-medium">Profile</button>
              {isAdmin && <button onClick={() => { setPage('admin'); setShowMobileMenu(false); }} className="block w-full text-left py-2 hover:text-blue-300 font-medium">Admin</button>}
              <button onClick={() => { signOut(auth); setShowMobileMenu(false); }} className="w-full text-left py-2 text-red-400 font-medium">Logout</button>
            </div>
          )}
        </div>
      </nav>

      {/* MODALS */}
      {showAddFilm && isAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full my-8 shadow-2xl">
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
                  <input type="number" value={newFilm.rtScore} onChange={e => setNewFilm({ ...newFilm, rtScore: e.target.value })} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Emoji</label>
                  <input type="text" value={newFilm.emoji} onChange={e => setNewFilm({ ...newFilm, emoji: e.target.value })} 
                         className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition text-3xl" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Date *</label>
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
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full my-8 shadow-2xl">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">RT Score</label>
                  <input type="number" value={editingFilm.rtScore || ''} onChange={e => setEditingFilm({ ...editingFilm, rtScore: e.target.value ? parseInt(e.target.value) : null })} 
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
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Type</label>
                <select value={editingFilm.type || 'bmn'} onChange={e => setEditingFilm({ ...editingFilm, type: e.target.value })} 
                        className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition">
                  <option value="bmn">BMN Screening</option>
                  <option value="offsite-film">Offsite Film</option>
                </select>
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
              {isAdmin && (
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Emojis (comma separated)</label>
                  <input type="text" value={editingProfile.emojis?.join(',') || ''} 
                         onChange={e => setEditingProfile({ ...editingProfile, emojis: e.target.value.split(',').map(s => s.trim()).filter(s => s) })} 
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
          {/* HOME PAGE */}
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

          {/* FILM DETAIL PAGE */}
          {page === 'detail' && selectedFilm && (
            <div className="min-h-screen">
              <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex gap-4 mb-6 flex-wrap">
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
                      <p className="text-gray-500 mb-8 text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        {new Date(selectedFilm.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <div className="flex gap-8 mb-8 items-center flex-wrap">
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
                          <div className="text-xs text-gray-500 mt-1">{filmVotes.length} {filmVotes.length === 1 ? 'vote' : 'votes'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {userProfile && (
                    <div className="border-t-2 border-gray-100 pt-8 mb-8">
                      <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {editingVote ? 'Edit Your Vote' : 'Cast Your Vote'}
                      </h2>
                      <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-2xl border border-blue-100">
                        <div className="mb-6">
                          <label className="block text-sm font-semibold mb-3 text-gray-700">Score (0-100): <span className="text-blue-600 text-xl">{userVote.score}</span></label>
                          <input type="range" min="0" max="100" value={userVote.score} 
                                 onChange={e => setUserVote({ ...userVote, score: parseInt(e.target.value) })} 
                                 className="w-full h-3 bg-gradient-to-r from-blue-200 to-purple-200 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div className="mb-6">
                          <label className="block text-sm font-semibold mb-2 text-gray-700">Review (optional)</label>
                          <textarea value={userVote.text} onChange={e => setUserVote({ ...userVote, text: e.target.value })} 
                                    className="w-full p-4 border-2 border-blue-200 rounded-xl bg-white focus:border-blue-500 focus:outline-none transition" 
                                    rows="3" placeholder="What made this movie terrible?" />
                        </div>
                        <div className="mb-6">
                          <label className="block text-sm font-semibold mb-3 text-gray-700">Rating</label>
                          <div className="grid grid-cols-3 gap-3">
                            <button onClick={() => setUserVote({ ...userVote, thumbs: 'neutral' })} 
                                    className={`px-4 py-3 rounded-xl border-2 font-medium transition ${userVote.thumbs === 'neutral' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600 hover:border-blue-300'}`}>
                              👍 Neutral
                            </button>
                            <button onClick={() => setUserVote({ ...userVote, thumbs: 'down' })} 
                                    className={`px-4 py-3 rounded-xl border-2 font-medium transition ${userVote.thumbs === 'down' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-300 bg-white text-gray-600 hover:border-orange-300'}`}>
                              👎 Down
                            </button>
                            <button onClick={() => setUserVote({ ...userVote, thumbs: 'double-down' })} 
                                    className={`px-4 py-3 rounded-xl border-2 font-medium transition ${userVote.thumbs === 'double-down' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 bg-white text-gray-600 hover:border-red-300'}`}>
                              👎👎 Double Down
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={handleVote} 
                                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-600 hover:to-purple-700 transition shadow-lg">
                            {editingVote ? 'Update Vote' : 'Submit Vote'}
                          </button>
                          {editingVote && (
                            <button onClick={() => { setEditingVote(null); setUserVote({ score: 50, text: '', thumbs: 'neutral' }); }} 
                                    className="px-6 py-4 bg-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-400 transition">
                              Cancel
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 text-center mt-3">
                          Voting as <span className="font-semibold text-blue-600">{userProfile.name}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {filmVotes.length > 0 && (
                    <div className="border-t-2 border-gray-100 pt-8">
                      <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Member Reviews ({filmVotes.length})
                      </h3>
                      <div className="space-y-3">
                        {filmVotes.map(vote => (
                          <div key={vote.id} className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-100">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-semibold text-gray-800">{vote.memberName}</div>
                                <div className="text-xs text-gray-500">{new Date(vote.timestamp).toLocaleDateString()}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button onClick={() => handleLikeVote(selectedFilm.id, vote.id, vote.likes || [])}
                                        className={`flex items-center gap-1 px-3 py-1 rounded-lg transition ${(vote.likes || []).includes(userProfile?.id) ? 'bg-red-100 text-red-600' : 'bg-white text-gray-600 hover:bg-red-50'}`}>
                                  <Heart className={`w-4 h-4 ${(vote.likes || []).includes(userProfile?.id) ? 'fill-red-600' : ''}`} />
                                  <span className="text-sm font-semibold">{(vote.likes || []).length}</span>
                                </button>
                                <span className="text-2xl">{vote.thumbs === 'neutral' ? '👍' : vote.thumbs === 'down' ? '👎' : '👎👎'}</span>
                                <span className="text-xl font-bold text-blue-700">{vote.score}</span>
                                {(isAdmin || userProfile?.id === vote.memberId) && (
                                  <div className="flex gap-2">
                                    <button onClick={() => {
                                      setEditingVote(vote);
                                      setUserVote({ score: vote.score, text: vote.text, thumbs: vote.thumbs });
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }} className="text-blue-600 hover:text-blue-700 text-sm"><Edit className="w-4 h-4" /></button>
                                    {isAdmin && (
                                      <button onClick={() => handleDeleteVote(selectedFilm.id, vote.id)} className="text-red-600 hover:text-red-700 text-sm"><Trash2 className="w-4 h-4" /></button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            {vote.text && <p className="text-gray-700 text-sm italic">"{vote.text}"</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MEMBERS PAGE */}
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
                        {(m.emojis || []).slice(0, 6).map((e, i) => {
                          const film = getFilmByEmoji(e);
                          return (
                            <span key={i} 
                                  className="text-2xl cursor-pointer hover:scale-125 transition-transform" 
                                  title={film?.title || 'Badge'}>
                              {e}
                            </span>
                          );
                        })}
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

          {/* MEMBER DETAIL PAGE */}
          {page === 'member-detail' && selectedMember && (
            <div className="min-h-screen">
              <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex gap-4 mb-6">
                  <button onClick={() => setPage('members')} 
                          className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md hover:shadow-lg transition">
                    ← Back
                  </button>
                  {(isAdmin || userProfile?.id === selectedMember.id) && (
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
                      <p className="text-xl text-gray-600 mb-2">{selectedMember.title}</p>
                      <p className="text-sm text-gray-500 mb-6">Member ID: {selectedMember.id}</p>
                      <p className="text-gray-700 leading-relaxed">{selectedMember.bio}</p>
                    </div>
                  </div>
                  <div className="border-t-2 border-gray-100 pt-8">
                    <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Badge Collection ({selectedMember.emojis?.length || 0})
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {(selectedMember.emojis || []).map((e, i) => {
                        const film = getFilmByEmoji(e);
                        return (
                          <div key={i} 
                               onClick={() => {
                                 if (film) {
                                   setSelectedFilm(film);
                                   setPage('detail');
                                 }
                               }}
                               className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-2xl shadow-md hover:shadow-lg transition cursor-pointer group relative">
                            <span className="text-5xl">{e}</span>
                            {film && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                                {film.title}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PROFILE PAGE */}
          {page === 'profile' && userProfile && (
            <div className="min-h-screen">
              <div className="max-w-4xl mx-auto px-4 py-12">
                <h2 className="text-5xl font-bold mb-12 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">My Profile</h2>
                <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                  <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
                    <div className="flex gap-8 flex-wrap">
                      <img src={userProfile.image} alt={userProfile.name} className="w-32 h-32 rounded-2xl object-cover shadow-lg" />
                      <div>
                        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{userProfile.name}</h1>
                        <p className="text-xl text-gray-600 mb-2">{userProfile.title}</p>
                        <p className="text-sm text-gray-500 mb-4">Member ID: {userProfile.id} | Email: {user.email}</p>
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
                      {(userProfile.emojis || []).map((e, i) => {
                        const film = getFilmByEmoji(e);
                        return (
                          <div key={i} 
                               onClick={() => {
                                 if (film) {
                                   setSelectedFilm(film);
                                   setPage('detail');
                                 }
                               }}
                               className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-2xl shadow-md hover:shadow-lg transition cursor-pointer group relative">
                            <span className="text-5xl">{e}</span>
                            {film && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                                {film.title}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LEADERBOARD PAGE */}
          {page === 'leaderboard' && (
            <div className="min-h-screen">
              <div className="max-w-5xl mx-auto px-4 py-12">
                <h2 className="text-5xl font-bold mb-3 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Leaderboard</h2>
                <p className="text-center text-gray-600 mb-12 text-xl">Who's the baddest?</p>
                
                {/* Badges Leaderboard */}
                <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100 mb-8">
                  <h3 className="text-2xl font-bold mb-6 text-gray-800">🏅 Most Badges</h3>
                  <div className="space-y-4">
                    {[...memberStats].sort((a, b) => b.badgeCount - a.badgeCount).map((m, i) => (
                      <div key={m.id} 
                           onClick={() => { setSelectedMember(m); setPage('member-detail'); }} 
                           className="flex items-center gap-6 bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl cursor-pointer hover:from-blue-100 hover:to-purple-100 transition shadow-md hover:shadow-lg border border-blue-100">
                        <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent w-16 text-center">
                          {i === 0 && '🥇'}{i === 1 && '🥈'}{i === 2 && '🥉'}{i > 2 && `#${i + 1}`}
                        </div>
                        <img src={m.image} alt={m.name} className="w-20 h-20 rounded-2xl object-cover shadow-md" />
                        <div className="flex-1">
                          <div className="font-bold text-xl text-gray-800">{m.name}</div>
                          <div className="text-sm text-gray-600">{m.title}</div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(m.emojis || []).slice(0, 5).map((e, idx) => <span key={idx} className="text-2xl">{e}</span>)}
                        </div>
                        <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                          {m.badgeCount}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reviews Leaderboard */}
                <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                  <h3 className="text-2xl font-bold mb-6 text-gray-800">📝 Most Reviews</h3>
                  <div className="space-y-4">
                    {[...memberStats].sort((a, b) => b.reviewCount - a.reviewCount).map((m, i) => (
                      <div key={m.id} 
                           onClick={() => { setSelectedMember(m); setPage('member-detail'); }} 
                           className="flex items-center gap-6 bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-2xl cursor-pointer hover:from-green-100 hover:to-blue-100 transition shadow-md hover:shadow-lg border border-green-100">
                        <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent w-16 text-center">
                          #{i + 1}
                        </div>
                        <img src={m.image} alt={m.name} className="w-20 h-20 rounded-2xl object-cover shadow-md" />
                        <div className="flex-1">
                          <div className="font-bold text-xl text-gray-800">{m.name}</div>
                          <div className="text-sm text-gray-600">{m.reviewCount} reviews</div>
                        </div>
                        <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                          {m.reviewCount}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* THE BUZZ PAGE */}
          {page === 'buzz' && (
            <div className="min-h-screen">
              <div className="max-w-4xl mx-auto px-4 py-12">
                <h2 className="text-5xl font-bold mb-3 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">The Buzz</h2>
                <p className="text-center text-gray-600 mb-12 text-xl">Latest activity from Bad Movie Night</p>
                <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                  {buzzFeed.length === 0 ? (
                    <p className="text-gray-500 text-center">No activity yet!</p>
                  ) : (
                    <div className="space-y-4">
                      {buzzFeed.map((activity, i) => (
                        <div key={i} 
                             onClick={() => {
                               const film = films.find(f => f.id === activity.filmId);
                               if (film) {
                                 setSelectedFilm(film);
                                 setPage('detail');
                               }
                             }}
                             className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl border border-blue-100 cursor-pointer hover:shadow-lg transition">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">{activity.thumbs === 'neutral' ? '👍' : activity.thumbs === 'down' ? '👎' : '👎👎'}</span>
                              <div>
                                <div className="font-bold text-gray-800">{activity.memberName}</div>
                                <div className="text-sm text-gray-600">reviewed <span className="font-semibold text-blue-600">{activity.filmTitle}</span></div>
                                <div className="text-xs text-gray-500">{new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                              <span className="text-xl font-bold text-blue-700">{activity.score}</span>
                            </div>
                          </div>
                          {activity.text && (
                            <div className="mt-3 pl-12">
                              <p className="text-gray-700 italic">"{activity.text}"</p>
                            </div>
                          )}
                          {(activity.likes || []).length > 0 && (
                            <div className="mt-2 pl-12 flex items-center gap-1 text-sm text-red-600">
                              <Heart className="w-4 h-4 fill-red-600" />
                              <span>{(activity.likes || []).length}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* JOIN REQUESTS PAGE */}
          {page === 'requests' && isAdmin && (
            <div className="min-h-screen">
              <div className="max-w-4xl mx-auto px-4 py-12">
                <h2 className="text-5xl font-bold mb-12 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Join Requests</h2>
                <div className="space-y-4">
                  {joinRequests.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
                      <p className="text-gray-500">No pending requests</p>
                    </div>
                  ) : (
                    joinRequests.map(req => (
                      <div key={req.id} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-gray-800">{req.name}</h3>
                            <p className="text-gray-600">{req.email}</p>
                            <p className="text-sm text-gray-500">{new Date(req.timestamp).toLocaleDateString()}</p>
                          </div>
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">{req.status}</span>
                        </div>
                        {req.favoriteMovie && (
                          <p className="text-gray-700 mb-2"><strong>Favorite Bad Movie:</strong> {req.favoriteMovie}</p>
                        )}
                        {req.message && (
                          <p className="text-gray-700 italic">"{req.message}"</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ADMIN PAGE */}
          {page === 'admin' && isAdmin && (
            <div className="min-h-screen">
              <div className="max-w-6xl mx-auto px-4 py-12">
                <h2 className="text-5xl font-bold mb-12 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Admin Panel</h2>
                <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                  <h3 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <button onClick={() => setShowAddFilm(true)} 
                            className="p-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:from-blue-600 hover:to-purple-700 transition shadow-lg font-bold text-lg flex items-center justify-center gap-3">
                      <Plus className="w-6 h-6" />Add New Film
                    </button>
                    <button onClick={() => setPage('members')} 
                            className="p-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:from-blue-600 hover:to-purple-700 transition shadow-lg font-bold text-lg flex items-center justify-center gap-3">
                      <Users className="w-6 h-6" />Manage Members
                    </button>
                    <button onClick={seedDatabase} 
                            className="p-8 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl hover:from-green-600 hover:to-green-700 transition shadow-lg font-bold text-lg flex items-center justify-center gap-3">
                      <Database className="w-6 h-6" />Seed Database
                    </button>
                  </div>
                  
                  <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-6">
                    <h4 className="font-bold text-lg mb-3 text-blue-900">✨ All Members Are Admins</h4>
                    <p className="text-gray-700">Every member has full admin access to manage films, profiles, and reviews!</p>
                  </div>

                  <div className="bg-purple-50 rounded-xl border border-purple-200 p-6">
                    <h4 className="font-bold text-lg mb-3 text-purple-900">🔗 Member Accounts</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {Object.entries(EMAIL_TO_MEMBER_ID).map(([email, memberId]) => (
                        <div key={email} className="bg-white p-2 rounded flex justify-between">
                          <span className="text-gray-700">{email}</span>
                          <span className="font-semibold text-purple-700">→ {memberId}</span>
                        </div>
                      ))}
                    </div>
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

