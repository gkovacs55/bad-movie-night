import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Film, LogIn, LogOut, Edit, Save, X, Upload, Plus, ThumbsUp, ThumbsDown, Trash2, Menu, ChevronLeft, Search } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, orderBy, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
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

const TMDB_API_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxMTQwMWQ5YzM1YzY5YjA4YmE0MGQyZTg4YTA1N2M0MSIsIm5iZiI6MTc2MDM5NjI3MS44MzYsInN1YiI6IjY4ZWQ4M2VmOTYwMmUzNDQ2NDlkZjFjNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.UQRRhgCKTHGM008164D9UPyR2Sj6avJx_IpI6-AjTTc';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const EMAIL_TO_MEMBER_ID = {
  'mattdernlan@gmail.com': 'matt',
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
  const [submissions, setSubmissions] = useState([]);
  const [submissionComments, setSubmissionComments] = useState({});
  const [buzzFeed, setBuzzFeed] = useState([]);
  const [selectedFilm, setSelectedFilm] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showLogin, setShowLogin] = useState(true);
  const [showAddFilm, setShowAddFilm] = useState(false);
  const [showSubmitMovie, setShowSubmitMovie] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotPassword, setForgotPassword] = useState(false);
  const [editingFilm, setEditingFilm] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [newFilm, setNewFilm] = useState({
    title: '', subtitle: '', image: '', bmnPoster: '', eventPoster: '', rtScore: '', popcornScore: '',
    bmnScore: 50, date: '', emoji: '🎬', type: 'bmn', trailer: ''
  });
  const [newSubmission, setNewSubmission] = useState({
    title: '', image: '', youtubeLink: '', description: ''
  });
  const [userVote, setUserVote] = useState({ score: 50, text: '', thumbs: 'neutral' });
  const [replyText, setReplyText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [commentingOn, setCommentingOn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingVotes, setPendingVotes] = useState([]);
  const [tmdbData, setTmdbData] = useState(null);
  const [searchingTmdb, setSearchingTmdb] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [tmdbSearchResults, setTmdbSearchResults] = useState([]);
  const [showTmdbSearch, setShowTmdbSearch] = useState(false);
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');

  const isAdmin = user && Object.keys(EMAIL_TO_MEMBER_ID).includes(user.email);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
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
        setShowLogin(true);
      }
    });
    loadData();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userProfile) {
      checkPendingVotes();
    }
  }, [userProfile, submissions]);

  useEffect(() => {
    if (selectedFilm && selectedFilm.title) {
      setTmdbData(null);
      searchTMDB(selectedFilm.title);
    }
  }, [selectedFilm]);

  const checkPendingVotes = () => {
    const pending = submissions.filter(sub => 
      !sub.votes || !sub.votes[userProfile.id]
    );
    setPendingVotes(pending);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const filmsSnap = await getDocs(collection(db, 'films'));
      const filmsData = filmsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFilms(filmsData.length > 0 ? filmsData.sort((a, b) => new Date(b.date) - new Date(a.date)) : getInitialFilms());

      const membersSnap = await getDocs(collection(db, 'members'));
      const membersData = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMembers(membersData.length > 0 ? membersData : getInitialMembers());

      const submissionsSnap = await getDocs(collection(db, 'submissions'));
      const submissionsData = submissionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubmissions(submissionsData);

      const commentsData = {};
      for (const sub of submissionsData) {
        const commentsSnap = await getDocs(query(collection(db, 'submissions', sub.id, 'comments'), orderBy('timestamp', 'asc')));
        commentsData[sub.id] = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      setSubmissionComments(commentsData);

      const buzzSnap = await getDocs(query(collection(db, 'buzzFeed'), orderBy('timestamp', 'desc')));
      const buzzData = buzzSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBuzzFeed(buzzData);
    } catch (err) {
      console.error('Load error:', err);
      setFilms(getInitialFilms());
      setMembers(getInitialMembers());
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowLogin(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent! Check your inbox.');
      setForgotPassword(false);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowLogin(true);
    setPage('home');
  };

  const handleImageUpload = async (e, type, target = 'default') => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `${type}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      if (type === 'members' && editingProfile) {
        setEditingProfile({ ...editingProfile, image: url });
      } else if (type === 'films' && editingFilm) {
        if (target === 'eventPoster') {
          setEditingFilm({ ...editingFilm, eventPoster: url });
        } else if (target === 'bmnPoster') {
          setEditingFilm({ ...editingFilm, bmnPoster: url });
        } else {
          setEditingFilm({ ...editingFilm, image: url });
        }
      } else if (type === 'submissions') {
        setNewSubmission({ ...newSubmission, image: url });
      } else if (type === 'newfilm') {
        if (target === 'eventPoster') {
          setNewFilm({ ...newFilm, eventPoster: url });
        } else if (target === 'bmnPoster') {
          setNewFilm({ ...newFilm, bmnPoster: url });
        } else {
          setNewFilm({ ...newFilm, image: url });
        }
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
    setUploadingImage(false);
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    try {
      await updateDoc(doc(db, 'members', editingProfile.id), {
        name: editingProfile.name,
        title: editingProfile.title,
        bio: editingProfile.bio,
        image: editingProfile.image
      });
      await loadData();
      setEditingProfile(null);
      alert('Profile updated!');
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  };

  const handleSaveFilm = async () => {
    if (!editingFilm) return;
    try {
      await updateDoc(doc(db, 'films', editingFilm.id), editingFilm);
      await loadData();
      setEditingFilm(null);
      setSelectedFilm(null);
      alert('Film updated!');
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  };

  const handleDeleteFilm = async (filmId) => {
    if (!isAdmin) return;
    if (!window.confirm('Are you sure you want to delete this film?')) return;
    try {
      await deleteDoc(doc(db, 'films', filmId));
      await loadData();
      setPage('home');
      alert('Film deleted!');
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleDeleteBuzzItem = async (itemId) => {
    if (!isAdmin) return;
    if (!window.confirm('Are you sure you want to delete this?')) return;
    try {
      await deleteDoc(doc(db, 'buzzFeed', itemId));
      await loadData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleVoteSubmit = async (filmId) => {
    if (!userProfile) return;
    
    const voteData = {
      authUserId: user.uid,
      authUserEmail: user.email,
      memberId: userProfile.id,
      memberName: userProfile.name,
      score: userVote.score,
      text: userVote.text,
      thumbs: userVote.thumbs,
      timestamp: new Date().toISOString(),
      filmId: filmId,
      filmTitle: selectedFilm.title,
      likes: []
    };

    await setDoc(doc(db, 'films', filmId, 'votes', userProfile.id), voteData);
    
    await addDoc(collection(db, 'buzzFeed'), {
      ...voteData,
      type: 'review',
      timestamp: serverTimestamp()
    });

    await loadData();
    setUserVote({ score: 50, text: '', thumbs: 'neutral' });
  };

  const handleLikeBuzzItem = async (itemId, likes) => {
    if (!userProfile) return;
    
    const isLiked = likes && likes.includes(userProfile.id);
    await updateDoc(doc(db, 'buzzFeed', itemId), {
      likes: isLiked ? arrayRemove(userProfile.id) : arrayUnion(userProfile.id)
    });
    await loadData();
  };

  const handleReplyToBuzz = async (itemId) => {
    if (!userProfile || !replyText.trim()) return;
    
    await addDoc(collection(db, 'buzzFeed'), {
      type: 'reply',
      replyTo: itemId,
      text: replyText,
      memberName: userProfile.name,
      memberId: userProfile.id,
      timestamp: serverTimestamp()
    });
    
    setReplyText('');
    setReplyingTo(null);
    await loadData();
  };

  const handleCommentOnSubmission = async (submissionId) => {
    if (!userProfile || !commentText.trim()) return;
    
    await addDoc(collection(db, 'submissions', submissionId, 'comments'), {
      text: commentText,
      memberName: userProfile.name,
      memberId: userProfile.id,
      timestamp: serverTimestamp()
    });
    
    setCommentText('');
    setCommentingOn(null);
    await loadData();
  };

  const handleSubmitMovie = async (e) => {
    e.preventDefault();
    if (!userProfile) return;

    const submissionData = {
      ...newSubmission,
      submittedBy: userProfile.name,
      submitterId: userProfile.id,
      timestamp: new Date().toISOString(),
      votes: {},
      status: 'pending'
    };

    await addDoc(collection(db, 'submissions'), submissionData);
    setNewSubmission({ title: '', image: '', youtubeLink: '', description: '' });
    setShowSubmitMovie(false);
    setShowTmdbSearch(false);
    setTmdbSearchResults([]);
    await loadData();
  };

  const handleVoteOnSubmission = async (submissionId, vote) => {
    if (!userProfile) return;
    await updateDoc(doc(db, 'submissions', submissionId), {
      [`votes.${userProfile.id}`]: vote
    });
    await loadData();
  };

  const handleAddFilm = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      await addDoc(collection(db, 'films'), {
        ...newFilm,
        rtScore: parseInt(newFilm.rtScore),
        popcornScore: parseInt(newFilm.popcornScore || 0),
        bmnScore: parseInt(newFilm.bmnScore)
      });
      setNewFilm({
        title: '', subtitle: '', image: '', bmnPoster: '', eventPoster: '', rtScore: '', popcornScore: '',
        bmnScore: 50, date: '', emoji: '🎬', type: 'bmn', trailer: ''
      });
      setShowAddFilm(false);
      await loadData();
      alert('Film added!');
    } catch (err) {
      alert('Add failed: ' + err.message);
    }
  };

  const seedDatabase = async () => {
    if (!isAdmin) return;
    if (!window.confirm('This will seed the database with initial data. Continue?')) return;
    
    try {
      const initialFilms = getInitialFilms();
      const initialMembers = getInitialMembers();
      
      for (const film of initialFilms) {
        await setDoc(doc(db, 'films', film.id), film);
      }
      
      for (const member of initialMembers) {
        await setDoc(doc(db, 'members', member.id), member);
      }
      
      await loadData();
      alert('Database seeded successfully!');
    } catch (err) {
      alert('Seeding failed: ' + err.message);
    }
  };

  const searchTMDB = async (title) => {
    setSearchingTmdb(true);
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(title)}`,
        {
          headers: {
            'Authorization': `Bearer ${TMDB_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        await fetchTMDBDetails(data.results[0].id);
      }
    } catch (err) {
      console.error('TMDB search error:', err);
    }
    setSearchingTmdb(false);
  };

  const handleTmdbSearch = async () => {
    if (!tmdbSearchQuery.trim()) return;
    setSearchingTmdb(true);
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(tmdbSearchQuery)}`,
        {
          headers: {
            'Authorization': `Bearer ${TMDB_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const data = await response.json();
      setTmdbSearchResults(data.results || []);
    } catch (err) {
      console.error('TMDB search error:', err);
    }
    setSearchingTmdb(false);
  };

  const selectTmdbMovie = (movie) => {
    setNewSubmission({
      ...newSubmission,
      title: movie.title,
      image: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
      description: movie.overview || ''
    });
    setShowTmdbSearch(false);
    setTmdbSearchResults([]);
    setTmdbSearchQuery('');
  };

  const fetchTMDBDetails = async (movieId) => {
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/movie/${movieId}`,
        {
          headers: {
            'Authorization': `Bearer ${TMDB_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const data = await response.json();
      setTmdbData(data);
    } catch (err) {
      console.error('TMDB details error:', err);
    }
  };

  const getRTIcon = (score) => {
    return score >= 50 
      ? "https://www.clipartmax.com/png/small/50-503753_rotten-tomatoes-logo-png.png"
      : "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2F8-85807_rotten-tomatoes%C2%AE-score-wikimedia-commons.png?alt=media&token=4a975032-aed9-4f51-9809-beeff10084b0";
  };

  const getPopcornIcon = (score) => {
    return score >= 50
      ? "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2F158-1588548_open-popcorn-icon-rotten-tomatoes.png?alt=media&token=31b871a7-d2ba-4bd3-a408-b286bf07d16d"
      : "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2F158-1588925_rotten-tomatoes-negative-audience-rotten-tomatoes-green-splat.png?alt=media&token=6b444b2a-dc46-443f-b3ed-6fd88c814b2a";
  };

  const extractYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const navigateTo = (newPage, data = null) => {
    if (data) {
      if (newPage === 'film') setSelectedFilm(data);
      if (newPage === 'profile') setSelectedMember(data);
    }
    setPage(newPage);
    setShowMobileMenu(false);
  };

  const goBack = () => {
    if (page === 'film' || page === 'profile') {
      setPage('home');
    } else {
      setPage('home');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-2xl" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (showLogin || !user) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center relative"
        style={{
          backgroundImage: 'url(https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2FSPLASH%20SCREEN%20001.png?alt=media&token=0ad0ed4d-8c85-4d4a-87bd-4f133dbb94e8)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        <div className="bg-white p-8 rounded-lg shadow-2xl w-96 relative z-10">
          <h1 className="text-4xl mb-2 text-center" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
            Bad Movie Night
          </h1>
          <p className="text-center text-sm mb-1 text-gray-600" style={{ fontStyle: 'italic' }}>
            Where Terrible Movies Become Legendary
          </p>
          <div className="text-center text-xs mb-6 font-semibold" style={{ color: '#009384' }}>
            🎬 EXCLUSIVE • INVITE ONLY • MEMBERS ONLY 🎬
          </div>
          <p className="text-center text-xs mb-6 text-gray-500">
            This is a private screening club for the most discerning bad movie enthusiasts.
          </p>
          
          {!forgotPassword ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: '#31394d' }}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: '#31394d' }}
                required
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg text-white font-semibold hover:opacity-90"
                style={{ backgroundColor: '#31394d' }}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setForgotPassword(true)}
                className="w-full text-sm hover:underline"
                style={{ color: '#009384' }}
              >
                Forgot Password?
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: '#31394d' }}
                required
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg text-white font-semibold"
                style={{ backgroundColor: '#31394d' }}
              >
                Send Reset Link
              </button>
              <button
                type="button"
                onClick={() => setForgotPassword(false)}
                className="w-full text-sm hover:underline"
                style={{ color: '#009384' }}
              >
                Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (pendingVotes.length > 0 && page === 'home') {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-3xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
            🎬 You Have Movies to Vote On!
          </h2>
          <p className="mb-6 text-gray-700">Please vote on these submitted movies before continuing:</p>
          
          {pendingVotes.map(sub => {
            const youtubeId = extractYouTubeId(sub.youtubeLink);
            return (
              <div key={sub.id} className="mb-6 p-4 border rounded-lg" style={{ borderColor: '#31394d' }}>
                <div className="flex flex-col md:flex-row gap-4">
                  {sub.image && <img src={sub.image} alt={sub.title} className="w-full md:w-40 h-60 object-cover rounded" />}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2" style={{ color: '#31394d' }}>{sub.title}</h3>
                    <p className="text-gray-600 mb-2">Submitted by: {sub.submittedBy}</p>
                    {sub.description && <p className="text-gray-700 mb-4">{sub.description}</p>}
                    {youtubeId && (
                      <div className="mb-4 aspect-video">
                        <iframe
                          width="100%"
                          height="100%"
                          src={`https://www.youtube.com/embed/${youtubeId}`}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="rounded"
                        />
                      </div>
                    )}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleVoteOnSubmission(sub.id, 'yes')}
                        className="px-6 py-2 rounded-lg text-white font-semibold"
                        style={{ backgroundColor: '#009384' }}
                      >
                        <ThumbsUp className="inline mr-2" size={16} />
                        Yes
                      </button>
                      <button
                        onClick={() => handleVoteOnSubmission(sub.id, 'no')}
                        className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
                      >
                        <ThumbsDown className="inline mr-2" size={16} />
                        No
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="shadow-md" style={{ backgroundColor: '#31394d' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => navigateTo('home')} className="flex items-center gap-3 hover:opacity-80">
              <Film size={32} style={{ color: '#009384' }} />
              <h1 className="text-2xl md:text-3xl text-white" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold' }}>
                Bad Movie Night
              </h1>
            </button>
          </div>
          
          <button 
            onClick={() => setShowMobileMenu(!showMobileMenu)} 
            className="md:hidden text-white"
          >
            <Menu size={28} />
          </button>

          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => navigateTo('home')} className="text-white hover:opacity-80" style={{ fontWeight: page === 'home' ? 'bold' : 'normal' }}>Home</button>
            <button onClick={() => navigateTo('leaderboard')} className="text-white hover:opacity-80">Leaderboard</button>
            <button onClick={() => navigateTo('members')} className="text-white hover:opacity-80">Members</button>
            <button onClick={() => navigateTo('buzz')} className="text-white hover:opacity-80">The Buzz</button>
            <button onClick={() => navigateTo('upnext')} className="text-white hover:opacity-80">Up Next</button>
            <button onClick={() => navigateTo('profile', userProfile)} className="text-white hover:opacity-80">Profile</button>
            {isAdmin && <button onClick={() => navigateTo('admin')} className="text-white hover:opacity-80">Admin</button>}
            <button onClick={handleLogout} className="text-white hover:opacity-80"><LogOut size={20} /></button>
          </nav>
        </div>

        {showMobileMenu && (
          <div className="md:hidden bg-white border-t" style={{ borderColor: '#31394d' }}>
            <nav className="flex flex-col">
              <button onClick={() => navigateTo('home')} className="px-4 py-3 text-left hover:bg-gray-100" style={{ color: '#31394d', fontWeight: page === 'home' ? 'bold' : 'normal' }}>Home</button>
              <button onClick={() => navigateTo('leaderboard')} className="px-4 py-3 text-left hover:bg-gray-100" style={{ color: '#31394d' }}>Leaderboard</button>
              <button onClick={() => navigateTo('members')} className="px-4 py-3 text-left hover:bg-gray-100" style={{ color: '#31394d' }}>Members</button>
              <button onClick={() => navigateTo('buzz')} className="px-4 py-3 text-left hover:bg-gray-100" style={{ color: '#31394d' }}>The Buzz</button>
              <button onClick={() => navigateTo('upnext')} className="px-4 py-3 text-left hover:bg-gray-100" style={{ color: '#31394d' }}>Up Next</button>
              <button onClick={() => navigateTo('profile', userProfile)} className="px-4 py-3 text-left hover:bg-gray-100" style={{ color: '#31394d' }}>Profile</button>
              {isAdmin && <button onClick={() => navigateTo('admin')} className="px-4 py-3 text-left hover:bg-gray-100" style={{ color: '#31394d' }}>Admin</button>}
              <button onClick={handleLogout} className="px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-2" style={{ color: '#31394d' }}><LogOut size={20} />Logout</button>
            </nav>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {page !== 'home' && (
          <button 
            onClick={goBack} 
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>
        )}

        {/* HOME PAGE STARTS HERE - PASTE PART 2 AFTER THIS LINE */}{/* HOME PAGE */}
        {page === 'home' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl md:text-4xl" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>BMN Screenings</h2>
              {isAdmin && (
                <button onClick={() => setShowAddFilm(true)} className="px-4 py-2 rounded-lg text-white font-semibold flex items-center gap-2" style={{ backgroundColor: '#009384' }}>
                  <Plus size={20} />Add Film
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12">
              {films.filter(f => f.type === 'bmn').map(film => (
                <div key={film.id} onClick={() => navigateTo('film', film)} className="bg-white rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow overflow-hidden">
                  <div className="relative" style={{ paddingBottom: '150%' }}>
                    <img src={film.image} alt={film.title} className="absolute inset-0 w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-bold text-center mb-1 line-clamp-2" style={{ color: '#31394d' }}>{film.title}</h3>
                    <p className="text-xs text-gray-600 text-center mb-2">{new Date(film.date).toLocaleDateString()}</p>
                    <div className="flex justify-around items-center">
                      <div className="text-center">
                        <img src={getRTIcon(film.rtScore)} alt="RT" className="w-5 h-5 mx-auto mb-1" />
                        <p className="text-xs font-semibold">{film.rtScore}%</p>
                      </div>
                      {film.popcornScore && (
                        <div className="text-center">
                          <img src={getPopcornIcon(film.popcornScore)} alt="Popcorn" className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-xs font-semibold">{film.popcornScore}%</p>
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-xs font-semibold" style={{ color: '#009384' }}>{film.bmnScore}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <h2 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Offsite Films</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {films.filter(f => f.type === 'offsite-film').map(film => (
                <div key={film.id} onClick={() => navigateTo('film', film)} className="bg-white rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow overflow-hidden">
                  <div className="relative" style={{ paddingBottom: '150%' }}>
                    <img src={film.image} alt={film.title} className="absolute inset-0 w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-bold text-center mb-1 line-clamp-2" style={{ color: '#31394d' }}>{film.title}</h3>
                    <p className="text-xs text-gray-600 text-center mb-2">{new Date(film.date).toLocaleDateString()}</p>
                    <div className="flex justify-around items-center">
                      <div className="text-center">
                        <img src={getRTIcon(film.rtScore)} alt="RT" className="w-5 h-5 mx-auto mb-1" />
                        <p className="text-xs font-semibold">{film.rtScore}%</p>
                      </div>
                      {film.popcornScore && (
                        <div className="text-center">
                          <img src={getPopcornIcon(film.popcornScore)} alt="Popcorn" className="w-5 h-5 mx-auto mb-1" />
                          <p className="text-xs font-semibold">{film.popcornScore}%</p>
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-xs font-semibold" style={{ color: '#009384' }}>{film.bmnScore}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MEMBERS PAGE */}
        {page === 'members' && (
          <div>
            <h2 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Members</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {members.map(member => (
                <div key={member.id} onClick={() => navigateTo('profile', member)} className="bg-white rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow text-center">
                  <img src={member.image} alt={member.name} className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />
                  <h3 className="text-xl font-bold mb-2" style={{ color: '#31394d' }}>{member.name}</h3>
                  <p className="text-sm mb-2" style={{ color: '#009384' }}>{member.title}</p>
                  <div className="flex justify-center gap-1 flex-wrap">
                    {member.emojis?.slice(0, 10).map((emoji, i) => <span key={i} className="text-2xl">{emoji}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROFILE PAGE */}
        {page === 'profile' && selectedMember && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            {editingProfile && editingProfile.id === selectedMember.id ? (
              <div className="space-y-4">
                <h2 className="text-3xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Edit Profile</h2>
                <div>
                  <label className="block mb-2 font-semibold">Profile Image</label>
                  <img src={editingProfile.image} alt="Profile" className="w-32 h-32 rounded-full object-cover mb-2" />
                  <div className="space-y-2">
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'members')} className="block" />
                    <div className="text-sm text-gray-500">or</div>
                    <input 
                      type="url" 
                      placeholder="Image URL" 
                      value={editingProfile.image} 
                      onChange={(e) => setEditingProfile({...editingProfile, image: e.target.value})} 
                      className="w-full px-4 py-2 border rounded-lg" 
                      style={{ borderColor: '#31394d' }} 
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Name</label>
                  <input type="text" value={editingProfile.name} onChange={(e) => setEditingProfile({...editingProfile, name: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Title</label>
                  <input type="text" value={editingProfile.title} onChange={(e) => setEditingProfile({...editingProfile, title: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Bio</label>
                  <textarea value={editingProfile.bio} onChange={(e) => setEditingProfile({...editingProfile, bio: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} rows="4" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveProfile} className="px-4 py-2 rounded-lg text-white font-semibold" style={{ backgroundColor: '#009384' }} disabled={uploadingImage}>
                    <Save size={16} className="inline mr-2" />{uploadingImage ? 'Uploading...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingProfile(null)} className="px-4 py-2 bg-gray-300 rounded-lg font-semibold">
                    <X size={16} className="inline mr-2" />Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row gap-8 mb-8">
                  <img src={selectedMember.image} alt={selectedMember.name} className="w-48 h-48 rounded-full object-cover mx-auto md:mx-0" />
                  <div className="flex-1">
                    <h2 className="text-3xl md:text-4xl mb-2" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>{selectedMember.name}</h2>
                    <p className="text-xl mb-4" style={{ color: '#009384' }}>{selectedMember.title}</p>
                    <p className="text-gray-700 mb-4">{selectedMember.bio}</p>
                    <div className="flex gap-2 flex-wrap mb-4">
                      {selectedMember.emojis?.map((emoji, i) => <span key={i} className="text-3xl cursor-pointer" title={`Badge ${i + 1}`}>{emoji}</span>)}
                    </div>
                    {isAdmin && (
                      <button onClick={() => setEditingProfile(selectedMember)} className="px-4 py-2 rounded-lg text-white font-semibold" style={{ backgroundColor: '#31394d' }}>
                        <Edit size={16} className="inline mr-2" />Edit Profile
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Recent Reviews (Last 10)</h3>
                <div className="space-y-4">
                  {buzzFeed.filter(item => item.memberId === selectedMember.id && item.type === 'review').slice(0, 10).map(review => (
                    <div key={review.id} className="border rounded-lg p-4" style={{ borderColor: '#31394d' }}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold" style={{ color: '#31394d' }}>{review.filmTitle}</h4>
                        <span className="text-sm text-gray-500">{review.timestamp?.toDate ? new Date(review.timestamp.toDate()).toLocaleDateString() : ''}</span>
                      </div>
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-2xl font-bold" style={{ color: '#009384' }}>{review.score}</span>
                        <span className="text-2xl">{review.thumbs === 'down' ? '👎' : review.thumbs === 'double-down' ? '👎👎' : '👍'}</span>
                      </div>
                      <p className="text-gray-700">{review.text}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* BUZZ PAGE */}
        {page === 'buzz' && (
          <div>
            <h2 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>The Buzz</h2>
            <div className="space-y-4">
              {buzzFeed.map(item => (
                <div key={item.id} className="bg-white rounded-lg shadow-lg p-6">
                  {item.type === 'review' && (
                    <>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold" style={{ color: '#31394d' }}>{item.memberName} reviewed {item.filmTitle}</h3>
                          <p className="text-sm text-gray-500">{item.timestamp?.toDate ? new Date(item.timestamp.toDate()).toLocaleDateString() : ''}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-bold" style={{ color: '#009384' }}>{item.score}</span>
                          <span className="text-2xl">{item.thumbs === 'down' ? '👎' : item.thumbs === 'double-down' ? '👎👎' : '👍'}</span>
                          {isAdmin && (
                            <button onClick={() => handleDeleteBuzzItem(item.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-700 mb-4">{item.text}</p>
                      <div className="flex gap-4">
                        <button onClick={() => handleLikeBuzzItem(item.id, item.likes || [])} className="flex items-center gap-2 text-gray-600 hover:text-red-500">
                          <Heart size={20} fill={(item.likes || []).includes(userProfile?.id) ? 'red' : 'none'} color={(item.likes || []).includes(userProfile?.id) ? 'red' : 'currentColor'} />
                          <span>{(item.likes || []).length}</span>
                        </button>
                        <button onClick={() => setReplyingTo(replyingTo === item.id ? null : item.id)} className="flex items-center gap-2 text-gray-600 hover:opacity-70" style={{ color: '#009384' }}>
                          <MessageCircle size={20} />Reply
                        </button>
                      </div>
                      {replyingTo === item.id && (
                        <div className="mt-4 flex gap-2">
                          <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." className="flex-1 px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                          <button onClick={() => handleReplyToBuzz(item.id)} className="px-4 py-2 rounded-lg text-white font-semibold" style={{ backgroundColor: '#009384' }}>Send</button>
                        </div>
                      )}
                      {buzzFeed.filter(reply => reply.type === 'reply' && reply.replyTo === item.id).map(reply => (
                        <div key={reply.id} className="ml-8 mt-4 p-4 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-semibold" style={{ color: '#31394d' }}>{reply.memberName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">{reply.timestamp?.toDate ? new Date(reply.timestamp.toDate()).toLocaleDateString() : ''}</span>
                              {isAdmin && (
                                <button onClick={() => handleDeleteBuzzItem(reply.id)} className="text-red-500 hover:text-red-700">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-gray-700">{reply.text}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* UP NEXT PAGE */}
        {page === 'upnext' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl md:text-4xl" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Up Next</h2>
              <button onClick={() => setShowSubmitMovie(true)} className="px-4 py-2 rounded-lg text-white font-semibold flex items-center gap-2" style={{ backgroundColor: '#009384' }}>
                <Plus size={20} />Submit Movie
              </button>
            </div>
            <div className="space-y-6">
              {submissions.map(sub => {
                const yesVotes = Object.values(sub.votes || {}).filter(v => v === 'yes').length;
                const noVotes = Object.values(sub.votes || {}).filter(v => v === 'no').length;
                const totalVotes = yesVotes + noVotes;
                const youtubeId = extractYouTubeId(sub.youtubeLink);
                const comments = submissionComments[sub.id] || [];
                
                return (
                  <div key={sub.id} className="bg-white rounded-lg shadow-lg p-6">
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        {sub.image && <img src={sub.image} alt={sub.title} className="w-full h-auto object-cover rounded mb-4" />}
                        <h3 className="text-xl font-bold mb-2" style={{ color: '#31394d' }}>{sub.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">Submitted by: {sub.submittedBy}</p>
                        {sub.description && <p className="text-gray-700 mb-4">{sub.description}</p>}
                      </div>
                      <div>
                        {youtubeId && (
                          <div className="mb-4 aspect-video">
                            <iframe
                              width="100%"
                              height="100%"
                              src={`https://www.youtube.com/embed/${youtubeId}`}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="rounded"
                            />
                          </div>
                        )}
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span style={{ color: '#009384' }}>👍 Yes: {yesVotes}</span>
                            <span className="text-red-500">👎 No: {noVotes}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="h-2 rounded-full" style={{ width: `${totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0}%`, backgroundColor: '#009384' }} />
                          </div>
                        </div>
                        {!sub.votes?.[userProfile?.id] && (
                          <div className="flex gap-2 mt-4">
                            <button onClick={() => handleVoteOnSubmission(sub.id, 'yes')} className="flex-1 px-4 py-2 rounded-lg text-white font-semibold" style={{ backgroundColor: '#009384' }}>Yes</button>
                            <button onClick={() => handleVoteOnSubmission(sub.id, 'no')} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600">No</button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t" style={{ borderColor: '#31394d' }}>
                      <h4 className="font-bold mb-4" style={{ color: '#31394d' }}>Comments ({comments.length})</h4>
                      <div className="space-y-3 mb-4">
                        {comments.map(comment => (
                          <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-semibold text-sm" style={{ color: '#31394d' }}>{comment.memberName}</span>
                              <span className="text-xs text-gray-500">{comment.timestamp?.toDate ? new Date(comment.timestamp.toDate()).toLocaleDateString() : ''}</span>
                            </div>
                            <p className="text-gray-700 text-sm">{comment.text}</p>
                          </div>
                        ))}
                      </div>
                      {commentingOn === sub.id ? (
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={commentText} 
                            onChange={(e) => setCommentText(e.target.value)} 
                            placeholder="Add a comment..." 
                            className="flex-1 px-4 py-2 border rounded-lg" 
                            style={{ borderColor: '#31394d' }} 
                          />
                          <button onClick={() => handleCommentOnSubmission(sub.id)} className="px-4 py-2 rounded-lg text-white font-semibold" style={{ backgroundColor: '#009384' }}>Send</button>
                          <button onClick={() => setCommentingOn(null)} className="px-4 py-2 bg-gray-300 rounded-lg font-semibold">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setCommentingOn(sub.id)} className="text-sm flex items-center gap-2" style={{ color: '#009384' }}>
                          <MessageCircle size={16} />Add comment
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LEADERBOARD PAGE */}
        {page === 'leaderboard' && (
          <div>
            <h2 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Leaderboards</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-4xl">🏅</div>
                  <h3 className="text-2xl font-bold" style={{ color: '#009384' }}>Most Badges</h3>
                </div>
                <div className="space-y-3">
                  {members.sort((a, b) => (b.emojis?.length || 0) - (a.emojis?.length || 0)).map((member, i) => (
                    <div key={member.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-2xl font-bold w-8" style={{ color: i < 3 ? '#FFD700' : '#31394d' }}>#{i + 1}</span>
                        <img src={member.image} alt={member.name} className="w-12 h-12 rounded-full object-cover" />
                        <span className="font-semibold">{member.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold" style={{ color: '#009384' }}>{member.emojis?.length || 0}</span>
                        <div className="flex">
                          {member.emojis?.slice(0, 3).map((emoji, j) => <span key={j} className="text-lg">{emoji}</span>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-4xl">📝</div>
                  <h3 className="text-2xl font-bold" style={{ color: '#009384' }}>Most Reviews</h3>
                </div>
                <div className="space-y-3">
                  {members.map(member => ({ ...member, reviewCount: buzzFeed.filter(item => item.memberId === member.id && item.type === 'review').length })).sort((a, b) => b.reviewCount - a.reviewCount).map((member, i) => (
                    <div key={member.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-2xl font-bold w-8" style={{ color: i < 3 ? '#FFD700' : '#31394d' }}>#{i + 1}</span>
                        <img src={member.image} alt={member.name} className="w-12 h-12 rounded-full object-cover" />
                        <span className="font-semibold">{member.name}</span>
                      </div>
                      <span className="text-2xl font-bold" style={{ color: '#009384' }}>{member.reviewCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FILM PAGE - Continue in next message due to length */}{/* FILM PAGE */}
        {page === 'film' && selectedFilm && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            {editingFilm && editingFilm.id === selectedFilm.id ? (
              <div className="space-y-4">
                <h2 className="text-3xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Edit Film</h2>
                <div>
                  <label className="block mb-2 font-semibold">Title</label>
                  <input type="text" value={editingFilm.title} onChange={(e) => setEditingFilm({...editingFilm, title: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Movie Poster Image</label>
                  {editingFilm.image && <img src={editingFilm.image} alt="Poster" className="w-32 h-48 object-cover mb-2 rounded" />}
                  <div className="space-y-2">
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'films', 'default')} className="block" />
                    <div className="text-sm text-gray-500">or</div>
                    <input type="url" placeholder="Image URL" value={editingFilm.image} onChange={(e) => setEditingFilm({...editingFilm, image: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 font-semibold">BMN Poster</label>
                  {editingFilm.bmnPoster && <img src={editingFilm.bmnPoster} alt="BMN Poster" className="w-32 h-48 object-cover mb-2 rounded" />}
                  <div className="space-y-2">
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'films', 'bmnPoster')} className="block" />
                    <div className="text-sm text-gray-500">or</div>
                    <input type="url" placeholder="BMN Poster URL" value={editingFilm.bmnPoster || ''} onChange={(e) => setEditingFilm({...editingFilm, bmnPoster: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Event Poster</label>
                  {editingFilm.eventPoster && <img src={editingFilm.eventPoster} alt="Event Poster" className="w-32 h-48 object-cover mb-2 rounded" />}
                  <div className="space-y-2">
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'films', 'eventPoster')} className="block" />
                    <div className="text-sm text-gray-500">or</div>
                    <input type="url" placeholder="Event Poster URL" value={editingFilm.eventPoster || ''} onChange={(e) => setEditingFilm({...editingFilm, eventPoster: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 font-semibold">RT Score</label>
                  <input type="number" value={editingFilm.rtScore} onChange={(e) => setEditingFilm({...editingFilm, rtScore: parseInt(e.target.value)})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Popcornmeter Score</label>
                  <input type="number" value={editingFilm.popcornScore || ''} onChange={(e) => setEditingFilm({...editingFilm, popcornScore: parseInt(e.target.value)})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Trailer URL (YouTube)</label>
                  <input type="url" value={editingFilm.trailer || ''} onChange={(e) => setEditingFilm({...editingFilm, trailer: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveFilm} className="px-4 py-2 rounded-lg text-white font-semibold" style={{ backgroundColor: '#009384' }}>
                    <Save size={16} className="inline mr-2" />Save
                  </button>
                  <button onClick={() => setEditingFilm(null)} className="px-4 py-2 bg-gray-300 rounded-lg font-semibold">
                    <X size={16} className="inline mr-2" />Cancel
                  </button>
                  <button onClick={() => handleDeleteFilm(editingFilm.id)} className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600">
                    <Trash2 size={16} className="inline mr-2" />Delete Film
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-4">
                    <div className="relative" style={{ paddingBottom: '150%' }}>
                      <img src={selectedFilm.image} alt={selectedFilm.title} className="absolute inset-0 w-full h-full object-cover rounded-lg shadow-lg" />
                    </div>
                    {selectedFilm.bmnPoster && (
                      <div className="relative" style={{ paddingBottom: '150%' }}>
                        <img src={selectedFilm.bmnPoster} alt="BMN Poster" className="absolute inset-0 w-full h-full object-cover rounded-lg shadow-lg" />
                      </div>
                    )}
                    {selectedFilm.eventPoster && (
                      <div className="relative" style={{ paddingBottom: '150%' }}>
                        <img src={selectedFilm.eventPoster} alt="Event Poster" className="absolute inset-0 w-full h-full object-cover rounded-lg shadow-lg" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-3xl md:text-4xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>{selectedFilm.title}</h2>
                    {selectedFilm.subtitle && <p className="text-xl mb-4 text-gray-600">{selectedFilm.subtitle}</p>}
                    <p className="text-gray-600 mb-4">{new Date(selectedFilm.date).toLocaleDateString()}</p>
                    
                    {selectedFilm.trailer && (
                      <div className="mb-6 aspect-video">
                        <iframe
                          width="100%"
                          height="100%"
                          src={`https://www.youtube.com/embed/${extractYouTubeId(selectedFilm.trailer)}`}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="rounded-lg"
                        />
                      </div>
                    )}
                    
                    <div className="flex gap-8 mb-6">
                      <div className="text-center">
                        <img src={getRTIcon(selectedFilm.rtScore)} alt="RT" className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-2xl font-bold">{selectedFilm.rtScore}%</p>
                        <p className="text-sm text-gray-500">Tomatometer</p>
                      </div>
                      {selectedFilm.popcornScore && (
                        <div className="text-center">
                          <img src={getPopcornIcon(selectedFilm.popcornScore)} alt="Popcorn" className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-2xl font-bold">{selectedFilm.popcornScore}%</p>
                          <p className="text-sm text-gray-500">Popcornmeter</p>
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-4xl mb-2">🎬</div>
                        <p className="text-2xl font-bold" style={{ color: '#009384' }}>{selectedFilm.bmnScore}</p>
                        <p className="text-sm text-gray-500">BMN Score</p>
                      </div>
                    </div>
                    
                    {tmdbData && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-bold mb-2" style={{ color: '#31394d' }}>Movie Info</h4>
                        {tmdbData.overview && <p className="text-sm text-gray-700 mb-3">{tmdbData.overview}</p>}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {tmdbData.release_date && <div><span className="font-semibold">Release Date:</span> {new Date(tmdbData.release_date).toLocaleDateString()}</div>}
                          {tmdbData.runtime && <div><span className="font-semibold">Runtime:</span> {tmdbData.runtime} min</div>}
                          {tmdbData.genres && tmdbData.genres.length > 0 && <div className="col-span-2"><span className="font-semibold">Genres:</span> {tmdbData.genres.map(g => g.name).join(', ')}</div>}
                          {tmdbData.budget && tmdbData.budget > 0 && <div><span className="font-semibold">Budget:</span> ${(tmdbData.budget / 1000000).toFixed(1)}M</div>}
                          {tmdbData.revenue && tmdbData.revenue > 0 && <div><span className="font-semibold">Revenue:</span> ${(tmdbData.revenue / 1000000).toFixed(1)}M</div>}
                        </div>
                      </div>
                    )}
                    {searchingTmdb && !tmdbData && <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center"><p className="text-sm text-gray-500">Loading movie info from TMDB...</p></div>}
                    {isAdmin && (
                      <button onClick={() => setEditingFilm(selectedFilm)} className="px-4 py-2 rounded-lg text-white font-semibold mb-4" style={{ backgroundColor: '#31394d' }}>
                        <Edit size={16} className="inline mr-2" />Edit Film
                      </button>
                    )}
                  </div>
                </div>
                <div className="mb-8">
                  <h3 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Your Vote</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block mb-2 font-semibold">Score (0-100)</label>
                      <input type="range" min="0" max="100" value={userVote.score} onChange={(e) => setUserVote({ ...userVote, score: parseInt(e.target.value) })} className="w-full" />
                      <p className="text-center text-2xl font-bold mt-2" style={{ color: '#009384' }}>{userVote.score}</p>
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold">Rating</label>
                      <div className="flex gap-4 flex-wrap">
                        {['neutral', 'down', 'double-down'].map(t => (
                          <button key={t} onClick={() => setUserVote({ ...userVote, thumbs: t })} className={`px-6 py-2 rounded-lg ${userVote.thumbs === t ? 'ring-2' : ''}`} style={{ backgroundColor: userVote.thumbs === t ? '#009384' : '#e5e7eb', color: userVote.thumbs === t ? 'white' : 'black' }}>
                            {t === 'neutral' ? '👍 Neutral' : t === 'down' ? '👎 Down' : '👎👎 Double Down'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold">Review (Optional)</label>
                      <textarea value={userVote.text} onChange={(e) => setUserVote({ ...userVote, text: e.target.value })} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} rows="4" placeholder="Share your thoughts..." />
                    </div>
                    <button onClick={() => handleVoteSubmit(selectedFilm.id)} className="w-full py-3 rounded-lg text-white font-semibold text-lg" style={{ backgroundColor: '#009384' }}>Submit Vote</button>
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>All Reviews</h3>
                  <div className="space-y-4">
                    {buzzFeed.filter(item => item.filmId === selectedFilm.id && item.type === 'review').map(review => (
                      <div key={review.id} className="border rounded-lg p-4" style={{ borderColor: '#31394d' }}>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold" style={{ color: '#31394d' }}>{review.memberName}</h4>
                          <div className="flex items-center gap-4">
                            <span className="text-2xl font-bold" style={{ color: '#009384' }}>{review.score}</span>
                            <span className="text-2xl">{review.thumbs === 'down' ? '👎' : review.thumbs === 'double-down' ? '👎👎' : '👍'}</span>
                            {isAdmin && (
                              <button onClick={() => handleDeleteBuzzItem(review.id)} className="text-red-500 hover:text-red-700">
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-700 mb-2">{review.text}</p>
                        <button onClick={() => handleLikeBuzzItem(review.id, review.likes || [])} className="flex items-center gap-2 text-gray-600 hover:text-red-500">
                          <Heart size={20} fill={(review.likes || []).includes(userProfile?.id) ? 'red' : 'none'} color={(review.likes || []).includes(userProfile?.id) ? 'red' : 'currentColor'} />
                          <span>{(review.likes || []).length}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ADMIN PAGE */}
        {page === 'admin' && isAdmin && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Admin Panel</h2>
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded">
                <h3 className="text-xl font-bold mb-4" style={{ color: '#31394d' }}>Database Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold">Films:</p>
                    <p className="text-2xl" style={{ color: '#009384' }}>{films.length}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Members:</p>
                    <p className="text-2xl" style={{ color: '#009384' }}>{members.length}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Submissions:</p>
                    <p className="text-2xl" style={{ color: '#009384' }}>{submissions.length}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Buzz Items:</p>
                    <p className="text-2xl" style={{ color: '#009384' }}>{buzzFeed.length}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded">
                <h3 className="text-xl font-bold mb-4" style={{ color: '#31394d' }}>Admin Actions</h3>
                <button onClick={seedDatabase} className="px-6 py-3 rounded-lg text-white font-semibold" style={{ backgroundColor: '#31394d' }}>
                  Seed Database with Initial Data
                </button>
                <p className="text-sm text-gray-600 mt-2">This will add all initial films and members to Firebase.</p>
              </div>
              <div className="p-4 bg-gray-50 rounded">
                <h3 className="text-xl font-bold mb-4" style={{ color: '#31394d' }}>Email to Member ID Mapping</h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(EMAIL_TO_MEMBER_ID).map(([email, id]) => (
                    <div key={email} className="flex justify-between">
                      <span>{email}</span>
                      <span className="font-mono" style={{ color: '#009384' }}>{id}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ADD FILM MODAL */}
      {showAddFilm && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full my-8">
            <h2 className="text-3xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Add New Film</h2>
            <form onSubmit={handleAddFilm} className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold">Title *</label>
                <input type="text" value={newFilm.title} onChange={(e) => setNewFilm({...newFilm, title: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold">Subtitle</label>
                <input type="text" value={newFilm.subtitle} onChange={(e) => setNewFilm({...newFilm, subtitle: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold">Movie Poster *</label>
                <div className="space-y-2">
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'newfilm', 'default')} className="block" />
                  <div className="text-sm text-gray-500">or</div>
                  <input type="url" placeholder="Image URL" value={newFilm.image} onChange={(e) => setNewFilm({...newFilm, image: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-semibold">BMN Poster</label>
                <div className="space-y-2">
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'newfilm', 'bmnPoster')} className="block" />
                  <div className="text-sm text-gray-500">or</div>
                  <input type="url" placeholder="BMN Poster URL" value={newFilm.bmnPoster} onChange={(e) => setNewFilm({...newFilm, bmnPoster: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-semibold">Event Poster</label>
                <div className="space-y-2">
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'newfilm', 'eventPoster')} className="block" />
                  <div className="text-sm text-gray-500">or</div>
                  <input type="url" placeholder="Event Poster URL" value={newFilm.eventPoster} onChange={(e) => setNewFilm({...newFilm, eventPoster: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                  <button 
                    type="button" 
                    onClick={() => setNewFilm({...newFilm, eventPoster: 'https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2FBMN12b.jpg?alt=media&token=6e20a116-2381-470e-9e86-e6ceb8f19890'})} 
                    className="text-sm px-4 py-2 rounded text-white" 
                    style={{ backgroundColor: '#009384' }}
                  >
                    Use Default Event Poster
                  </button>
                </div>
              </div>
              <div>
                <label className="block mb-2 font-semibold">Trailer URL (YouTube)</label>
                <input type="url" value={newFilm.trailer} onChange={(e) => setNewFilm({...newFilm, trailer: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold">RT Score *</label>
                <input type="number" min="0" max="100" value={newFilm.rtScore} onChange={(e) => setNewFilm({...newFilm, rtScore: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold">Popcornmeter Score</label>
                <input type="number" min="0" max="100" value={newFilm.popcornScore} onChange={(e) => setNewFilm({...newFilm, popcornScore: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold">Date *</label>
                <input type="date" value={newFilm.date} onChange={(e) => setNewFilm({...newFilm, date: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold">Type</label>
                <select value={newFilm.type} onChange={(e) => setNewFilm({...newFilm, type: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }}>
                  <option value="bmn">BMN Screening</option>
                  <option value="offsite-film">Offsite Film</option>
                </select>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 py-2 rounded-lg text-white font-semibold" style={{ backgroundColor: '#009384' }}>Add Film</button>
                <button type="button" onClick={() => setShowAddFilm(false)} className="flex-1 py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBMIT MOVIE MODAL */}
      {showSubmitMovie && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full my-8">
            <h2 className="text-3xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Submit a Movie</h2>
            
            {!showTmdbSearch ? (
              <form onSubmit={handleSubmitMovie} className="space-y-4">
                <div className="mb-4">
                  <button 
                    type="button" 
                    onClick={() => setShowTmdbSearch(true)} 
                    className="w-full py-2 rounded-lg text-white font-semibold flex items-center justify-center gap-2" 
                    style={{ backgroundColor: '#31394d' }}
                  >
                    <Search size={20} />
                    Search TMDB Database
                  </button>
                  <p className="text-sm text-gray-500 mt-2 text-center">or enter details manually below</p>
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Title *</label>
                  <input type="text" value={newSubmission.title} onChange={(e) => setNewSubmission({...newSubmission, title: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Movie Poster *</label>
                  <div className="space-y-2">
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'submissions')} className="block" />
                    <div className="text-sm text-gray-500">or</div>
                    <input type="url" placeholder="Image URL" value={newSubmission.image} onChange={(e) => setNewSubmission({...newSubmission, image: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 font-semibold">YouTube Trailer Link</label>
                  <input type="url" value={newSubmission.youtubeLink} onChange={(e) => setNewSubmission({...newSubmission, youtubeLink: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Description</label>
                  <textarea value={newSubmission.description} onChange={(e) => setNewSubmission({...newSubmission, description: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} rows="4" />
                </div>
                <div className="flex gap-4">
                  <button type="submit" className="flex-1 py-2 rounded-lg text-white font-semibold" style={{ backgroundColor: '#009384' }}>Submit</button>
                  <button type="button" onClick={() => setShowSubmitMovie(false)} className="flex-1 py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400">Cancel</button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={tmdbSearchQuery} 
                    onChange={(e) => setTmdbSearchQuery(e.target.value)} 
                    placeholder="Search for a movie..." 
                    className="flex-1 px-4 py-2 border rounded-lg" 
                    style={{ borderColor: '#31394d' }}
                    onKeyPress={(e) => e.key === 'Enter' && handleTmdbSearch()}
                  />
                  <button onClick={handleTmdbSearch} className="px-6 py-2 rounded-lg text-white font-semibold" style={{ backgroundColor: '#009384' }}>
                    Search
                  </button>
                </div>
                
                {searchingTmdb && <p className="text-center text-gray-500">Searching...</p>}
                
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {tmdbSearchResults.map(movie => (
                    <div key={movie.id} onClick={() => selectTmdbMovie(movie)} className="flex gap-4 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" style={{ borderColor: '#31394d' }}>
                      {movie.poster_path && (
                        <img src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`} alt={movie.title} className="w-16 h-24 object-cover rounded" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-bold" style={{ color: '#31394d' }}>{movie.title}</h4>
                        <p className="text-sm text-gray-600">{movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</p>
                        <p className="text-sm text-gray-700 line-clamp-2">{movie.overview}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button onClick={() => { setShowTmdbSearch(false); setTmdbSearchResults([]); }} className="w-full py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400">
                  Back to Manual Entry
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getInitialFilms() {
  return [
    {id: '1', title: "Beach Kings", type: "bmn", subtitle: "Beach Kings", image: "https://m.media-amazon.com/images/I/91AqeB8kZTL._UF350,350_QL50_.jpg", rtScore: 45, popcornScore: 38, bmnScore: 72, date: "2023-08-31", emoji: "🏐", trailer: "", bmnPoster: "", eventPoster: "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2FBMN12b.jpg?alt=media&token=6e20a116-2381-470e-9e86-e6ceb8f19890"},
    {id: '2', title: "Toxic Shark", type: "bmn", subtitle: "Toxic Shark", image: "https://m.media-amazon.com/images/M/MV5BMmEwNWU5OTEtOWE1Ny00YTE1LWFhY2YtNTYyMDYwNjdjYTQyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg", rtScore: 31, popcornScore: 25, bmnScore: 78, date: "2023-09-26", emoji: "🦈", trailer: "", bmnPoster: "", eventPoster: "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2FBMN12b.jpg?alt=media&token=6e20a116-2381-470e-9e86-e6ceb8f19890"}
  ];
}

function getInitialMembers() {
  return [
    {id: 'matt', name: "Matt Dernlan", title: "District Manager of Video", image: "https://i.pravatar.cc/150?img=33", bio: "Founding member and curator of cinematic disasters.", emojis: ["🏐", "🦈", "❄️", "🎄", "🤖"]},
    {id: 'gabe', name: "Gabe Kovacs", title: "Laughs Engineer", image: "https://i.pravatar.cc/150?img=13", bio: "Engineered precision laughter.", emojis: ["🏐", "🦈", "❄️", "🤖"]},
    {id: 'colin', name: "Colin Sherman", title: "Chief Research Officer", image: "https://i.pravatar.cc/150?img=52", bio: "Researches every disaster film.", emojis: ["🏐", "🦈", "❄️"]},
    {id: 'ryan', name: "Ryan Pfleiderer", title: "Anime Lead", image: "https://i.pravatar.cc/150?img=8", bio: "Brings anime-level dramatic commentary.", emojis: ["🏐", "🦈", "❄️", "🤖"]},
    {id: 'hunter', name: "Hunter Rising", title: "Senior VP of Boardology", image: "https://i.pravatar.cc/150?img=12", bio: "Expert in identifying plot holes.", emojis: ["🏐", "🦈", "❄️", "🎄", "🤖"]},
    {id: 'max', name: "Max Stenstrom", title: "Viticulture Team Lead", image: "https://i.pravatar.cc/150?img=59", bio: "Pairs wine with terrible movies.", emojis: ["🌪️", "🪐"]},
    {id: 'james', name: "James Burg", title: "Quips Lead", image: "https://i.pravatar.cc/150?img=68", bio: "Delivers perfectly timed one-liners.", emojis: ["🏐", "🦈", "❄️"]}
  ];
}

export default App;
