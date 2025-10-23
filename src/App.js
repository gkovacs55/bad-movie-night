import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Film, LogIn, LogOut, Edit, Save, X, Upload, Plus, ThumbsUp, ThumbsDown, Trash2, Menu, ChevronLeft, Search, Calendar, Shield } from 'lucide-react';
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

const DEFAULT_ADMIN_EMAILS = [
  'mattdernlan@gmail.com',
  'gkovacs55@gmail.com'
];

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
    title: '', subtitle: '', image: '', eventPoster: '', rtScore: '', popcornScore: '',
    bmnScore: 0, date: '', emoji: '🎬', type: 'bmn', trailer: '', isUpcoming: false
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
  const [filmVotes, setFilmVotes] = useState({});
  const [adminEmails, setAdminEmails] = useState(DEFAULT_ADMIN_EMAILS);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const isAdmin = user && adminEmails.includes(user.email);

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
    loadAdminList();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userProfile && films.length > 0) {
      checkPendingVotes();
    }
  }, [userProfile, films, buzzFeed]);

  useEffect(() => {
    if (selectedFilm && selectedFilm.title) {
      setTmdbData(null);
      searchTMDB(selectedFilm.title);
      loadFilmVotes(selectedFilm.id);
    }
  }, [selectedFilm]);

  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state && e.state.page) {
        setPage(e.state.page);
      } else {
        setPage('home');
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const checkPendingVotes = () => {
    const reviewedFilmIds = buzzFeed
      .filter(item => item.type === 'review' && item.memberId === userProfile.id)
      .map(item => item.filmId);
    
    const userEmojis = userProfile.emojis || [];
    
    const pastFilms = films.filter(f => {
      const filmDate = new Date(f.date);
      const today = new Date();
      const isPast = filmDate < today && !f.isUpcoming;
      const userAttended = userEmojis.includes(f.emoji);
      return isPast && userAttended;
    });
    
    const pending = pastFilms.filter(f => !reviewedFilmIds.includes(f.id));
    setPendingVotes(pending);
  };

  const loadFilmVotes = async (filmId) => {
    try {
      const votesSnap = await getDocs(collection(db, 'films', filmId, 'votes'));
      const votes = {};
      votesSnap.docs.forEach(d => {
        votes[d.id] = d.data();
      });
      setFilmVotes(votes);
    } catch (err) {
      console.error('Error loading votes:', err);
    }
  };

  const calculateBMNScore = (filmId) => {
    const reviews = buzzFeed.filter(item => 
      item.type === 'review' && item.filmId === filmId && typeof item.score === 'number'
    );
    
    if (reviews.length === 0) return 0;
    
    const sum = reviews.reduce((acc, review) => acc + review.score, 0);
    return Math.round(sum / reviews.length);
  };

  const loadAdminList = async () => {
    try {
      const adminDoc = await getDoc(doc(db, 'settings', 'admins'));
      if (adminDoc.exists()) {
        setAdminEmails(adminDoc.data().emails || DEFAULT_ADMIN_EMAILS);
      }
    } catch (err) {
      console.error('Error loading admin list:', err);
    }
  };

  const addAdmin = async () => {
    if (!newAdminEmail || !isAdmin) return;
    
    const updatedAdmins = [...adminEmails, newAdminEmail];
    try {
      await setDoc(doc(db, 'settings', 'admins'), { emails: updatedAdmins });
      setAdminEmails(updatedAdmins);
      setNewAdminEmail('');
      alert('Admin added successfully!');
    } catch (err) {
      console.error('Error adding admin:', err);
      alert('Failed to add admin');
    }
  };

  const removeAdmin = async (emailToRemove) => {
    if (!isAdmin || adminEmails.length <= 1) {
      alert('Cannot remove the last admin');
      return;
    }
    
    const updatedAdmins = adminEmails.filter(e => e !== emailToRemove);
    try {
      await setDoc(doc(db, 'settings', 'admins'), { emails: updatedAdmins });
      setAdminEmails(updatedAdmins);
      alert('Admin removed successfully!');
    } catch (err) {
      console.error('Error removing admin:', err);
      alert('Failed to remove admin');
    }
  };const loadData = async () => {
    setLoading(true);
    try {
      const filmsSnap = await getDocs(collection(db, 'films'));
      let filmsData = filmsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const membersSnap = await getDocs(collection(db, 'members'));
      const membersData = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const submissionsSnap = await getDocs(collection(db, 'submissions'));
      const submissionsData = submissionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const buzzSnap = await getDocs(query(collection(db, 'buzzFeed'), orderBy('timestamp', 'desc')));
      const buzzData = buzzSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const commentsData = {};
      for (const sub of submissionsData) {
        const commentsSnap = await getDocs(collection(db, 'submissions', sub.id, 'comments'));
        commentsData[sub.id] = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      
      filmsData.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setFilms(filmsData);
      setMembers(membersData);
      setSubmissions(submissionsData);
      setBuzzFeed(buzzData);
      setSubmissionComments(commentsData);
    } catch (err) {
      console.error('Error loading data:', err);
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowLogin(false);
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowLogin(true);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      alert('Please enter your email address');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent! Check your inbox.');
      setForgotPassword(false);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleImageUpload = async (e, collection, field = 'default') => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `${collection}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      if (collection === 'films') {
        if (field === 'eventPoster') {
          setEditingFilm({ ...editingFilm, eventPoster: url });
        } else {
          setEditingFilm({ ...editingFilm, image: url });
        }
      } else if (collection === 'members') {
        setEditingProfile({ ...editingProfile, image: url });
      } else if (collection === 'submissions') {
        setNewSubmission({ ...newSubmission, image: url });
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed: ' + err.message);
    }
    setUploadingImage(false);
  };

  const handleVoteSubmit = async (filmId) => {
    if (!userProfile) return;
    
    try {
      await addDoc(collection(db, 'buzzFeed'), {
        type: 'review',
        filmId: filmId,
        filmTitle: selectedFilm.title,
        memberId: userProfile.id,
        memberName: userProfile.name,
        score: userVote.score,
        thumbs: userVote.thumbs,
        text: userVote.text,
        timestamp: serverTimestamp(),
        likes: []
      });
      
      setUserVote({ score: 50, text: '', thumbs: 'neutral' });
      await loadData();
      alert('Review submitted!');
    } catch (err) {
      console.error('Vote error:', err);
      alert('Failed to submit vote');
    }
  };

  const handleDeleteBuzzItem = async (itemId) => {
    if (!isAdmin || !confirm('Delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'buzzFeed', itemId));
      await loadData();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleLikeBuzzItem = async (itemId, likes = []) => {
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
    
    const commentData = {
      text: commentText,
      memberName: userProfile.name,
      memberId: userProfile.id,
      timestamp: serverTimestamp()
    };
    
    await addDoc(collection(db, 'submissions', submissionId, 'comments'), commentData);
    
    const submission = submissions.find(s => s.id === submissionId);
    await addDoc(collection(db, 'buzzFeed'), {
      type: 'submission_comment',
      memberId: userProfile.id,
      memberName: userProfile.name,
      submissionId: submissionId,
      submissionTitle: submission?.title || 'Unknown',
      text: commentText,
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
        bmnScore: newFilm.isUpcoming ? 0 : parseInt(newFilm.bmnScore || 0)
      });
      setNewFilm({
        title: '', subtitle: '', image: '', eventPoster: '', rtScore: '', popcornScore: '',
        bmnScore: 0, date: '', emoji: '🎬', type: 'bmn', trailer: '', isUpcoming: false
      });
      setShowAddFilm(false);
      await loadData();
      alert('Film added!');
    } catch (err) {
      alert('Add failed: ' + err.message);
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
    window.history.pushState({ page: newPage }, '', `#${newPage}`);
  };

  const goBack = () => {
    window.history.back();
  };

  const getFilmForBadge = (emoji, memberEmojis) => {
    const emojiIndex = memberEmojis.indexOf(emoji);
    const filmsWithEmoji = films.filter(f => f.emoji === emoji).sort((a, b) => new Date(a.date) - new Date(b.date));
    return filmsWithEmoji[emojiIndex] || filmsWithEmoji[0];
  };

  const handleSaveFilm = async () => {
    if (!isAdmin || !editingFilm) return;
    try {
      const filmRef = doc(db, 'films', editingFilm.id);
      await updateDoc(filmRef, {
        title: editingFilm.title,
        subtitle: editingFilm.subtitle || '',
        image: editingFilm.image,
        eventPoster: editingFilm.eventPoster || '',
        rtScore: parseInt(editingFilm.rtScore),
        popcornScore: parseInt(editingFilm.popcornScore || 0),
        bmnScore: parseInt(editingFilm.bmnScore || 0),
        date: editingFilm.date,
        emoji: editingFilm.emoji,
        type: editingFilm.type,
        trailer: editingFilm.trailer || '',
        isUpcoming: editingFilm.isUpcoming || false
      });
      setEditingFilm(null);
      await loadData();
      alert('Film updated!');
    } catch (err) {
      alert('Update failed: ' + err.message);
    }
  };

  const handleDeleteFilm = async (filmId) => {
    if (!isAdmin || !confirm('Delete this film? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'films', filmId));
      await loadData();
      alert('Film deleted');
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    try {
      const memberRef = doc(db, 'members', editingProfile.id);
      await updateDoc(memberRef, {
        name: editingProfile.name,
        title: editingProfile.title,
        bio: editingProfile.bio,
        image: editingProfile.image
      });
      setEditingProfile(null);
      await loadData();
      
      if (userProfile && userProfile.id === editingProfile.id) {
        setUserProfile({ ...userProfile, name: editingProfile.name, title: editingProfile.title, bio: editingProfile.bio, image: editingProfile.image });
      }
      
      setSelectedMember({ ...selectedMember, name: editingProfile.name, title: editingProfile.title, bio: editingProfile.bio, image: editingProfile.image });
      
      alert('Profile updated!');
    } catch (err) {
      alert('Update failed: ' + err.message);
    }
  };

  const handleDeleteSubmission = async (submissionId) => {
    if (!isAdmin || !confirm('Delete this submission?')) return;
    try {
      await deleteDoc(doc(db, 'submissions', submissionId));
      await loadData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };if (showLogin) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center bg-cover bg-center" 
        style={{ backgroundImage: 'url(https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2FSPLASH%20SCREEN%20001.png?alt=media&token=0ad0ed4d-8c85-4d4a-87bd-4f133dbb94e8)' }}
      >
        <div className="bg-white bg-opacity-95 rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
          <h1 className="text-4xl mb-8 text-center" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
            Bad Movie Night
          </h1>
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-2xl" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
          Loading...
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
            <button onClick={() => navigateTo('home')} className="text-white hover:opacity-80" style={{ fontFamily: 'Courier New, monospace', fontWeight: page === 'home' ? 'bold' : 'normal' }}>Home</button>
            <button onClick={() => navigateTo('leaderboard')} className="text-white hover:opacity-80" style={{ fontFamily: 'Courier New, monospace' }}>Leaderboard</button>
            <button onClick={() => navigateTo('members')} className="text-white hover:opacity-80" style={{ fontFamily: 'Courier New, monospace' }}>Members</button>
            <button onClick={() => navigateTo('buzz')} className="text-white hover:opacity-80" style={{ fontFamily: 'Courier New, monospace' }}>The Buzz</button>
            <button onClick={() => navigateTo('upnext')} className="text-white hover:opacity-80" style={{ fontFamily: 'Courier New, monospace' }}>Up Next</button>
            <button onClick={() => navigateTo('profile', userProfile)} className="text-white hover:opacity-80" style={{ fontFamily: 'Courier New, monospace' }}>Profile</button>
            {isAdmin && <button onClick={() => navigateTo('admin')} className="text-white hover:opacity-80" style={{ fontFamily: 'Courier New, monospace' }}>Admin</button>}
            <button onClick={handleLogout} className="text-white hover:opacity-80"><LogOut size={20} /></button>
          </nav>
        </div>

        {showMobileMenu && (
          <div className="md:hidden bg-white border-t" style={{ borderColor: '#31394d' }}>
            <nav className="flex flex-col">
              <button onClick={() => navigateTo('home')} className="px-4 py-3 text-left hover:bg-gray-100" style={{ fontFamily: 'Courier New, monospace', color: '#31394d', fontWeight: page === 'home' ? 'bold' : 'normal' }}>Home</button>
              <button onClick={() => navigateTo('leaderboard')} className="px-4 py-3 text-left hover:bg-gray-100" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Leaderboard</button>
              <button onClick={() => navigateTo('members')} className="px-4 py-3 text-left hover:bg-gray-100" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Members</button>
              <button onClick={() => navigateTo('buzz')} className="px-4 py-3 text-left hover:bg-gray-100" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>The Buzz</button>
              <button onClick={() => navigateTo('upnext')} className="px-4 py-3 text-left hover:bg-gray-100" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Up Next</button>
              <button onClick={() => navigateTo('profile', userProfile)} className="px-4 py-3 text-left hover:bg-gray-100" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Profile</button>
              {isAdmin && <button onClick={() => navigateTo('admin')} className="px-4 py-3 text-left hover:bg-gray-100" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Admin</button>}
              <button onClick={handleLogout} className="px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}><LogOut size={20} />Logout</button>
            </nav>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {page !== 'home' && (
          <button 
            onClick={goBack} 
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
            style={{ fontFamily: 'Courier New, monospace' }}
          >
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>
        )}

        {page === 'home' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl md:text-4xl" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>BMN Screenings</h2>
              {isAdmin && (
                <button onClick={() => setShowAddFilm(true)} className="px-4 py-2 rounded-lg text-white font-semibold flex items-center gap-2" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}>
                  <Plus size={20} />Add Film
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12">
              {films.filter(f => f.type === 'bmn').map(film => {
                const isUpcoming = film.isUpcoming || new Date(film.date) > new Date();
                const displayImage = isUpcoming && film.eventPoster ? film.eventPoster : film.image;
                
                return (
                  <div key={film.id} onClick={() => navigateTo('film', film)} className="bg-white rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow overflow-hidden relative">
                    {isUpcoming && (
                      <div className="absolute top-2 right-2 z-10 bg-yellow-400 text-black px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1" style={{ fontFamily: 'Courier New, monospace' }}>
                        <Calendar size={12} />
                        UPCOMING
                      </div>
                    )}
                    <div className="relative" style={{ paddingBottom: '150%' }}>
                      <img src={displayImage} alt={film.title} className="absolute inset-0 w-full h-full object-cover" />
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-bold text-center mb-1 line-clamp-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>{film.title}</h3>
                      <p className="text-xs text-gray-600 text-center mb-2" style={{ fontFamily: 'Courier New, monospace' }}>
                        <span className="font-semibold">Screening Date:</span> {new Date(film.date).toLocaleDateString()}
                      </p>
                      {!isUpcoming && (
                        <div className="flex justify-around items-center">
                          <div className="text-center">
                            <img src={getRTIcon(film.rtScore)} alt="RT" className="w-6 h-6 mx-auto mb-1" />
                            <p className="text-xs font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>{film.rtScore}%</p>
                          </div>
                          {film.popcornScore > 0 && (
                            <div className="text-center">
                              <img src={getPopcornIcon(film.popcornScore)} alt="Popcorn" className="w-6 h-6 mx-auto mb-1" />
                              <p className="text-xs font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>{film.popcornScore}%</p>
                            </div>
                          )}
                          <div className="text-center">
                            <div className="text-lg mb-1">🎬</div>
                            <p className="text-xs font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{calculateBMNScore(film.id)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <h2 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Offsite Films</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {films.filter(f => f.type === 'offsite-film').map(film => (
                <div key={film.id} onClick={() => navigateTo('film', film)} className="bg-white rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow overflow-hidden">
                  <div className="relative" style={{ paddingBottom: '150%' }}>
                    <img src={film.image} alt={film.title} className="absolute inset-0 w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-bold text-center mb-1 line-clamp-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>{film.title}</h3>
                    <p className="text-xs text-gray-600 text-center mb-2" style={{ fontFamily: 'Courier New, monospace' }}>
                      <span className="font-semibold">Screening Date:</span> {new Date(film.date).toLocaleDateString()}
                    </p>
                    <div className="flex justify-around items-center">
                      <div className="text-center">
                        <img src={getRTIcon(film.rtScore)} alt="RT" className="w-6 h-6 mx-auto mb-1" />
                        <p className="text-xs font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>{film.rtScore}%</p>
                      </div>
                      {film.popcornScore > 0 && (
                        <div className="text-center">
                          <img src={getPopcornIcon(film.popcornScore)} alt="Popcorn" className="w-6 h-6 mx-auto mb-1" />
                          <p className="text-xs font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>{film.popcornScore}%</p>
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-lg mb-1">🎬</div>
                        <p className="text-xs font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{calculateBMNScore(film.id)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {page === 'members' && (
          <div>
            <h2 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Members</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {members.map(member => (
                <div key={member.id} onClick={() => navigateTo('profile', member)} className="bg-white rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow">
                  <img src={member.image} alt={member.name} className="w-24 h-24 rounded-full object-cover mx-auto mb-4" />
                  <h3 className="text-xl text-center mb-2" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>{member.name}</h3>
                  <p className="text-center mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{member.title}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {member.emojis?.map((emoji, i) => (
                      <span key={i} className="text-2xl">{emoji}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}{page === 'profile' && selectedMember && (
          <div>
            {editingProfile && editingProfile.id === selectedMember.id ? (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-3xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Edit Profile</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Profile Image URL</label>
                    {editingProfile.image && (
                      <div className="mb-2">
                        <img src={editingProfile.image} alt="Profile" className="w-32 h-32 rounded-full object-cover" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'members')} className="block" />
                      <div className="text-sm text-gray-500">or</div>
                      <input type="url" placeholder="Image URL" value={editingProfile.image} onChange={(e) => setEditingProfile({...editingProfile, image: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Name</label>
                    <input type="text" value={editingProfile.name} onChange={(e) => setEditingProfile({...editingProfile, name: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Title</label>
                    <input type="text" value={editingProfile.title} onChange={(e) => setEditingProfile({...editingProfile, title: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Bio</label>
                    <textarea value={editingProfile.bio} onChange={(e) => setEditingProfile({...editingProfile, bio: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} rows="4" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveProfile} className="px-4 py-2 rounded-lg text-white font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }} disabled={uploadingImage}>
                      <Save size={16} className="inline mr-2" />{uploadingImage ? 'Uploading...' : 'Save'}
                    </button>
                    <button onClick={() => setEditingProfile(null)} className="px-4 py-2 bg-gray-300 rounded-lg font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>
                      <X size={16} className="inline mr-2" />Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row gap-8 mb-8">
                  <img src={selectedMember.image} alt={selectedMember.name} className="w-48 h-48 rounded-full object-cover mx-auto md:mx-0" />
                  <div className="flex-1">
                    <h2 className="text-3xl md:text-4xl mb-2" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>{selectedMember.name}</h2>
                    <p className="text-xl mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{selectedMember.title}</p>
                    <p className="text-gray-700 mb-4" style={{ fontFamily: 'Courier New, monospace' }}>{selectedMember.bio}</p>
                    <div className="flex gap-2 flex-wrap mb-4">
                      {selectedMember.emojis?.map((emoji, i) => {
                        const film = getFilmForBadge(emoji, selectedMember.emojis);
                        return (
                          <div key={i} className="relative group">
                            <span 
                              className="text-3xl cursor-pointer transition-transform hover:scale-125"
                              onClick={() => film && navigateTo('film', film)}
                            >
                              {emoji}
                            </span>
                            {film && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10" style={{ fontFamily: 'Courier New, monospace' }}>
                                {film.title}<br />
                                {new Date(film.date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {userProfile && userProfile.id === selectedMember.id && isAdmin && (
                      <button onClick={() => setEditingProfile(selectedMember)} className="px-4 py-2 rounded-lg text-white font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#31394d' }}>
                        <Edit size={16} className="inline mr-2" />Edit Profile
                      </button>
                    )}
                  </div>
                </div>
                
                {userProfile && userProfile.id === selectedMember.id && pendingVotes.length > 0 && (
                  <div className="mb-8 p-6 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
                    <h3 className="text-2xl mb-4 flex items-center gap-2" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                      ⚠️ Pending Reviews
                    </h3>
                    <p className="mb-4 text-gray-700" style={{ fontFamily: 'Courier New, monospace' }}>You need to review the following films you attended:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {pendingVotes.map(film => (
                        <div 
                          key={film.id} 
                          onClick={() => navigateTo('film', film)}
                          className="bg-white rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                        >
                          <div className="relative" style={{ paddingBottom: '150%' }}>
                            <img src={film.image} alt={film.title} className="absolute inset-0 w-full h-full object-cover" />
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-bold text-center line-clamp-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>{film.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <h3 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Recent Reviews</h3>
                <div className="space-y-4">
                  {buzzFeed.filter(item => item.memberId === selectedMember.id && item.type === 'review').slice(0, 10).map(review => (
                    <div key={review.id} className="border rounded-lg p-4" style={{ borderColor: '#31394d' }}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>{review.filmTitle}</h4>
                        <span className="text-sm text-gray-500" style={{ fontFamily: 'Courier New, monospace' }}>{review.timestamp?.toDate ? new Date(review.timestamp.toDate()).toLocaleDateString() : ''}</span>
                      </div>
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{review.score}</span>
                        <span className="text-2xl">{review.thumbs === 'down' ? '👎' : review.thumbs === 'double-down' ? '👎👎' : '👍'}</span>
                      </div>
                      <p className="text-gray-700" style={{ fontFamily: 'Courier New, monospace' }}>{review.text}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}{page === 'film' && selectedFilm && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            {editingFilm && editingFilm.id === selectedFilm.id ? (
              <div className="space-y-4">
                <h2 className="text-3xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Edit Film</h2>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Title</label>
                  <input type="text" value={editingFilm.title} onChange={(e) => setEditingFilm({...editingFilm, title: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Movie Poster Image</label>
                  {editingFilm.image && <img src={editingFilm.image} alt="Poster" className="w-32 h-48 object-cover mb-2 rounded" />}
                  <div className="space-y-2">
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'films', 'default')} className="block" />
                    <div className="text-sm text-gray-500">or</div>
                    <input type="url" placeholder="Image URL" value={editingFilm.image} onChange={(e) => setEditingFilm({...editingFilm, image: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Event Poster (for upcoming screenings)</label>
                  {editingFilm.eventPoster && <img src={editingFilm.eventPoster} alt="Event Poster" className="w-32 h-48 object-cover mb-2 rounded" />}
                  <div className="space-y-2">
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'films', 'eventPoster')} className="block" />
                    <div className="text-sm text-gray-500">or</div>
                    <input type="url" placeholder="Event Poster URL" value={editingFilm.eventPoster || ''} onChange={(e) => setEditingFilm({...editingFilm, eventPoster: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>RT Score</label>
                  <input type="number" value={editingFilm.rtScore} onChange={(e) => setEditingFilm({...editingFilm, rtScore: parseInt(e.target.value)})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Popcornmeter Score</label>
                  <input type="number" value={editingFilm.popcornScore || ''} onChange={(e) => setEditingFilm({...editingFilm, popcornScore: parseInt(e.target.value)})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Trailer URL (YouTube)</label>
                  <input type="url" value={editingFilm.trailer || ''} onChange={(e) => setEditingFilm({...editingFilm, trailer: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Date</label>
                  <input type="date" value={editingFilm.date} onChange={(e) => setEditingFilm({...editingFilm, date: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Emoji</label>
                  <input type="text" value={editingFilm.emoji} onChange={(e) => setEditingFilm({...editingFilm, emoji: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Type</label>
                  <select value={editingFilm.type} onChange={(e) => setEditingFilm({...editingFilm, type: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }}>
                    <option value="bmn">BMN Screening</option>
                    <option value="offsite-film">Offsite Film</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={editingFilm.isUpcoming || false} onChange={(e) => setEditingFilm({...editingFilm, isUpcoming: e.target.checked})} />
                    <span style={{ fontFamily: 'Courier New, monospace' }}>Upcoming Screening (not yet revealed)</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveFilm} className="px-4 py-2 rounded-lg text-white font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }} disabled={uploadingImage}>
                    <Save size={16} className="inline mr-2" />{uploadingImage ? 'Uploading...' : 'Save'}
                  </button>
                  <button onClick={() => setEditingFilm(null)} className="px-4 py-2 bg-gray-300 rounded-lg font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>
                    <X size={16} className="inline mr-2" />Cancel
                  </button>
                  <button onClick={() => handleDeleteFilm(editingFilm.id)} className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold ml-auto" style={{ fontFamily: 'Courier New, monospace' }}>
                    <Trash2 size={16} className="inline mr-2" />Delete Film
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                  <div>
                    <h4 className="text-lg mb-2" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Movie Poster</h4>
                    <div className="relative" style={{ paddingBottom: '150%' }}>
                      <img src={selectedFilm.image} alt={selectedFilm.title} className="absolute inset-0 w-full h-full object-cover rounded-lg shadow-lg" />
                    </div>
                    {selectedFilm.eventPoster && (
                      <div className="mt-4">
                        <h4 className="text-lg mb-2" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Event Poster</h4>
                        <div className="relative" style={{ paddingBottom: '150%' }}>
                          <img src={selectedFilm.eventPoster} alt="Event Poster" className="absolute inset-0 w-full h-full object-cover rounded-lg shadow-lg" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <h2 className="text-3xl md:text-4xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>{selectedFilm.title}</h2>
                    {selectedFilm.subtitle && (
                      <p className="text-xl mb-4 text-gray-600" style={{ fontFamily: 'Courier New, monospace' }}>{selectedFilm.subtitle}</p>
                    )}
                    <p className="mb-4 text-gray-700" style={{ fontFamily: 'Courier New, monospace' }}>
                      <span className="font-semibold">Screening Date:</span> {new Date(selectedFilm.date).toLocaleDateString()}
                    </p>
                    
                    {selectedFilm.trailer && extractYouTubeId(selectedFilm.trailer) && (
                      <div className="mb-6 relative" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          src={`https://www.youtube.com/embed/${extractYouTubeId(selectedFilm.trailer)}`}
                          title="Trailer"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full rounded-lg"
                        />
                      </div>
                    )}
                    
                    <div className="flex gap-8 mb-6">
                      <div className="text-center">
                        <img src={getRTIcon(selectedFilm.rtScore)} alt="RT" className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace' }}>{selectedFilm.rtScore}%</p>
                        <p className="text-sm text-gray-500" style={{ fontFamily: 'Courier New, monospace' }}>Tomatometer</p>
                      </div>
                      {selectedFilm.popcornScore > 0 && (
                        <div className="text-center">
                          <img src={getPopcornIcon(selectedFilm.popcornScore)} alt="Popcorn" className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace' }}>{selectedFilm.popcornScore}%</p>
                          <p className="text-sm text-gray-500" style={{ fontFamily: 'Courier New, monospace' }}>Popcornmeter</p>
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-4xl mb-2">🎬</div>
                        <p className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{calculateBMNScore(selectedFilm.id)}</p>
                        <p className="text-sm text-gray-500" style={{ fontFamily: 'Courier New, monospace' }}>BMN Score</p>
                      </div>
                    </div>
                    
                    {tmdbData && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Movie Info</h4>
                        {tmdbData.overview && <p className="text-sm text-gray-700 mb-3" style={{ fontFamily: 'Courier New, monospace' }}>{tmdbData.overview}</p>}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {tmdbData.release_date && <div style={{ fontFamily: 'Courier New, monospace' }}><span className="font-semibold">Release Date:</span> {new Date(tmdbData.release_date).toLocaleDateString()}</div>}
                          {tmdbData.runtime && <div style={{ fontFamily: 'Courier New, monospace' }}><span className="font-semibold">Runtime:</span> {tmdbData.runtime} min</div>}
                          {tmdbData.genres && tmdbData.genres.length > 0 && <div className="col-span-2" style={{ fontFamily: 'Courier New, monospace' }}><span className="font-semibold">Genres:</span> {tmdbData.genres.map(g => g.name).join(', ')}</div>}
                          {tmdbData.budget && tmdbData.budget > 0 && <div style={{ fontFamily: 'Courier New, monospace' }}><span className="font-semibold">Budget:</span> ${(tmdbData.budget / 1000000).toFixed(1)}M</div>}
                          {tmdbData.revenue && tmdbData.revenue > 0 && <div style={{ fontFamily: 'Courier New, monospace' }}><span className="font-semibold">Revenue:</span> ${(tmdbData.revenue / 1000000).toFixed(1)}M</div>}
                        </div>
                      </div>
                    )}
                    {searchingTmdb && !tmdbData && <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center"><p className="text-sm text-gray-500" style={{ fontFamily: 'Courier New, monospace' }}>Loading movie info from TMDB...</p></div>}
                    {isAdmin && (
                      <button onClick={() => setEditingFilm(selectedFilm)} className="px-4 py-2 rounded-lg text-white font-semibold mb-4" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#31394d' }}>
                        <Edit size={16} className="inline mr-2" />Edit Film
                      </button>
                    )}
                  </div>
                </div>

                {!selectedFilm.isUpcoming && (
                  <>
                    <div className="mb-8 bg-gray-50 rounded-lg p-6 max-w-3xl mx-auto">
                      <h3 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Your Vote</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Score (0-100)</label>
                          <div className="flex items-center gap-4">
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              value={userVote.score} 
                              onChange={(e) => setUserVote({ ...userVote, score: parseInt(e.target.value) })} 
                              className="flex-1" 
                            />
                            <span className="text-3xl font-bold w-16 text-center" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{userVote.score}</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Rating</label>
                          <div className="flex gap-2">
                            {['neutral', 'down', 'double-down'].map(t => (
                              <button 
                                key={t} 
                                onClick={() => setUserVote({ ...userVote, thumbs: t })} 
                                className={`flex-1 px-4 py-2 rounded-lg transition-all ${userVote.thumbs === t ? 'ring-2 ring-offset-2' : ''}`} 
                                style={{ 
                                  fontFamily: 'Courier New, monospace',
                                  backgroundColor: userVote.thumbs === t ? '#009384' : '#e5e7eb', 
                                  color: userVote.thumbs === t ? 'white' : 'black',
                                  ringColor: '#009384'
                                }}
                              >
                                {t === 'neutral' ? '👍 Neutral' : t === 'down' ? '👎 Down' : '👎👎 Double Down'}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Review (Optional)</label>
                          <textarea 
                            value={userVote.text} 
                            onChange={(e) => setUserVote({ ...userVote, text: e.target.value })} 
                            className="w-full px-4 py-2 border rounded-lg" 
                            style={{ fontFamily: 'Courier New, monospace', borderColor: '#31394d' }} 
                            rows="3" 
                            placeholder="Share your thoughts..." 
                          />
                        </div>
                        
                        <button onClick={() => handleVoteSubmit(selectedFilm.id)} className="w-full py-3 rounded-lg text-white font-semibold text-lg" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}>
                          Submit Vote
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>All Reviews</h3>
                      <div className="space-y-4">
                        {buzzFeed.filter(item => item.filmId === selectedFilm.id && item.type === 'review').map(review => (
                          <div key={review.id} className="border rounded-lg p-4" style={{ borderColor: '#31394d' }}>
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>{review.memberName}</h4>
                              <div className="flex items-center gap-4">
                                <span className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{review.score}</span>
                                <span className="text-2xl">{review.thumbs === 'down' ? '👎' : review.thumbs === 'double-down' ? '👎👎' : '👍'}</span>
                                {isAdmin && (
                                  <button onClick={() => handleDeleteBuzzItem(review.id)} className="text-red-500 hover:text-red-700">
                                    <Trash2 size={18} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-700 mb-2" style={{ fontFamily: 'Courier New, monospace' }}>{review.text}</p>
                            <button onClick={() => handleLikeBuzzItem(review.id, review.likes || [])} className="flex items-center gap-2 text-gray-600 hover:text-red-500">
                              <Heart size={20} fill={(review.likes || []).includes(userProfile?.id) ? 'red' : 'none'} color={(review.likes || []).includes(userProfile?.id) ? 'red' : 'currentColor'} />
                              <span style={{ fontFamily: 'Courier New, monospace' }}>{(review.likes || []).length}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}{page === 'buzz' && (
          <div>
            <h2 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>The Buzz</h2>
            <div className="space-y-4">
              {buzzFeed.map(item => (
                <div key={item.id} className="bg-white rounded-lg shadow-lg p-6">
                  {item.type === 'review' && (
                    <>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>{item.memberName} reviewed {item.filmTitle}</h3>
                          <p className="text-sm text-gray-500" style={{ fontFamily: 'Courier New, monospace' }}>{item.timestamp?.toDate ? new Date(item.timestamp.toDate()).toLocaleDateString() : ''}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{item.score}</span>
                          <span className="text-2xl">{item.thumbs === 'down' ? '👎' : item.thumbs === 'double-down' ? '👎👎' : '👍'}</span>
                          {isAdmin && (
                            <button onClick={() => handleDeleteBuzzItem(item.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-700 mb-4" style={{ fontFamily: 'Courier New, monospace' }}>{item.text}</p>
                      <div className="flex gap-4">
                        <button onClick={() => handleLikeBuzzItem(item.id, item.likes || [])} className="flex items-center gap-2 text-gray-600 hover:text-red-500">
                          <Heart size={20} fill={(item.likes || []).includes(userProfile?.id) ? 'red' : 'none'} color={(item.likes || []).includes(userProfile?.id) ? 'red' : 'currentColor'} />
                          <span style={{ fontFamily: 'Courier New, monospace' }}>{(item.likes || []).length}</span>
                        </button>
                        <button onClick={() => setReplyingTo(replyingTo === item.id ? null : item.id)} className="flex items-center gap-2 text-gray-600 hover:opacity-70" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                          <MessageCircle size={20} />Reply
                        </button>
                      </div>
                      {replyingTo === item.id && (
                        <div className="mt-4 flex gap-2">
                          <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." className="flex-1 px-4 py-2 border rounded-lg" style={{ fontFamily: 'Courier New, monospace', borderColor: '#31394d' }} />
                          <button onClick={() => handleReplyToBuzz(item.id)} className="px-4 py-2 rounded-lg text-white font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}>Send</button>
                        </div>
                      )}
                      {buzzFeed.filter(reply => reply.type === 'reply' && reply.replyTo === item.id).map(reply => (
                        <div key={reply.id} className="ml-8 mt-4 p-4 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>{reply.memberName}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500" style={{ fontFamily: 'Courier New, monospace' }}>{reply.timestamp?.toDate ? new Date(reply.timestamp.toDate()).toLocaleDateString() : ''}</span>
                              {isAdmin && (
                                <button onClick={() => handleDeleteBuzzItem(reply.id)} className="text-red-500 hover:text-red-700">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-gray-700" style={{ fontFamily: 'Courier New, monospace' }}>{reply.text}</p>
                        </div>
                      ))}
                    </>
                  )}
                  {item.type === 'submission_comment' && (
                    <>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                            {item.memberName} commented on {item.submissionTitle}
                          </h3>
                          <p className="text-sm text-gray-500" style={{ fontFamily: 'Courier New, monospace' }}>
                            {item.timestamp?.toDate ? new Date(item.timestamp.toDate()).toLocaleDateString() : ''}
                          </p>
                        </div>
                        {isAdmin && (
                          <button onClick={() => handleDeleteBuzzItem(item.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      <p className="text-gray-700" style={{ fontFamily: 'Courier New, monospace' }}>{item.text}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {page === 'leaderboard' && (
          <div>
            <h2 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Leaderboard</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>🏆 Highest BMN Score</h3>
                {(() => {
                  const topFilm = films
                    .filter(f => !f.isUpcoming)
                    .map(f => ({ ...f, bmnScore: calculateBMNScore(f.id) }))
                    .sort((a, b) => b.bmnScore - a.bmnScore)[0];
                  return topFilm ? (
                    <div>
                      <p className="font-bold text-xl" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{topFilm.title}</p>
                      <p className="text-3xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{topFilm.bmnScore}</p>
                    </div>
                  ) : <p>No data yet</p>;
                })()}
              </div>
              
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>💩 Lowest RT Score</h3>
                {(() => {
                  const worstFilm = films
                    .filter(f => !f.isUpcoming)
                    .sort((a, b) => a.rtScore - b.rtScore)[0];
                  return worstFilm ? (
                    <div>
                      <p className="font-bold text-xl" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{worstFilm.title}</p>
                      <p className="text-3xl font-bold text-red-500" style={{ fontFamily: 'Courier New, monospace' }}>{worstFilm.rtScore}%</p>
                    </div>
                  ) : <p>No data yet</p>;
                })()}
              </div>
              
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>📝 Most Reviews</h3>
                {(() => {
                  const topReviewer = members
                    .map(m => ({
                      ...m,
                      reviewCount: buzzFeed.filter(b => b.type === 'review' && b.memberId === m.id).length
                    }))
                    .sort((a, b) => b.reviewCount - a.reviewCount)[0];
                  return topReviewer ? (
                    <div>
                      <p className="font-bold text-xl" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{topReviewer.name}</p>
                      <p className="text-3xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{topReviewer.reviewCount} reviews</p>
                    </div>
                  ) : <p>No data yet</p>;
                })()}
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <table className="w-full">
                <thead style={{ backgroundColor: '#31394d' }}>
                  <tr>
                    <th className="px-6 py-4 text-left text-white" style={{ fontFamily: 'Courier New, monospace' }}>Rank</th>
                    <th className="px-6 py-4 text-left text-white" style={{ fontFamily: 'Courier New, monospace' }}>Member</th>
                    <th className="px-6 py-4 text-center text-white" style={{ fontFamily: 'Courier New, monospace' }}>Badges</th>
                    <th className="px-6 py-4 text-center text-white" style={{ fontFamily: 'Courier New, monospace' }}>Reviews</th>
                  </tr>
                </thead>
                <tbody>
                  {members
                    .map(m => ({
                      ...m,
                      badgeCount: (m.emojis || []).length,
                      reviewCount: buzzFeed.filter(b => b.type === 'review' && b.memberId === m.id).length
                    }))
                    .sort((a, b) => b.badgeCount - a.badgeCount || b.reviewCount - a.reviewCount)
                    .map((member, index) => (
                      <tr key={member.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => navigateTo('profile', member)}>
                        <td className="px-6 py-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#009384' }}>{index + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img src={member.image} alt={member.name} className="w-10 h-10 rounded-full object-cover" />
                            <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold' }}>{member.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center" style={{ fontFamily: 'Courier New, monospace', fontSize: '1.5rem' }}>
                          {member.badgeCount}
                        </td>
                        <td className="px-6 py-4 text-center" style={{ fontFamily: 'Courier New, monospace', fontSize: '1.5rem' }}>
                          {member.reviewCount}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}{page === 'upnext' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl md:text-4xl" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Up Next</h2>
              <button onClick={() => setShowSubmitMovie(true)} className="px-4 py-2 rounded-lg text-white font-semibold flex items-center gap-2" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}>
                <Plus size={20} />Submit Movie
              </button>
            </div>
            <div className="flex gap-6 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
              {submissions.map(sub => {
                const upvotes = Object.values(sub.votes || {}).filter(v => v === 'up').length;
                const downvotes = Object.values(sub.votes || {}).filter(v => v === 'down').length;
                const userVoted = userProfile && sub.votes && sub.votes[userProfile.id];
                const comments = submissionComments[sub.id] || [];
                
                return (
                  <div key={sub.id} className="bg-white rounded-lg shadow-lg overflow-hidden flex-shrink-0" style={{ width: '300px' }}>
                    <div className="relative" style={{ paddingBottom: '120%' }}>
                      <img src={sub.image} alt={sub.title} className="absolute inset-0 w-full h-full object-cover" />
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>{sub.title}</h3>
                      <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Courier New, monospace' }}>Submitted by {sub.submittedBy}</p>
                      {sub.description && <p className="text-sm text-gray-700 mb-3" style={{ fontFamily: 'Courier New, monospace' }}>{sub.description}</p>}
                      {sub.youtubeLink && extractYouTubeId(sub.youtubeLink) && (
                        <div className="mb-3 relative" style={{ paddingBottom: '56.25%' }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${extractYouTubeId(sub.youtubeLink)}`}
                            title="Trailer"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0 w-full h-full rounded"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleVoteOnSubmission(sub.id, 'up')} 
                            className={`px-3 py-1 rounded flex items-center gap-1 ${userVoted === 'up' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
                            style={{ fontFamily: 'Courier New, monospace' }}
                          >
                            <ThumbsUp size={16} />{upvotes}
                          </button>
                          <button 
                            onClick={() => handleVoteOnSubmission(sub.id, 'down')} 
                            className={`px-3 py-1 rounded flex items-center gap-1 ${userVoted === 'down' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
                            style={{ fontFamily: 'Courier New, monospace' }}
                          >
                            <ThumbsDown size={16} />{downvotes}
                          </button>
                        </div>
                        {isAdmin && (
                          <button onClick={() => handleDeleteSubmission(sub.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      
                      <div className="border-t pt-3" style={{ borderColor: '#e5e7eb' }}>
                        <button 
                          onClick={() => setCommentingOn(commentingOn === sub.id ? null : sub.id)} 
                          className="flex items-center gap-2 text-sm mb-2" 
                          style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}
                        >
                          <MessageCircle size={16} />
                          {comments.length} Comment{comments.length !== 1 ? 's' : ''}
                        </button>
                        
                        {commentingOn === sub.id && (
                          <div className="mb-3">
                            <textarea 
                              value={commentText} 
                              onChange={(e) => setCommentText(e.target.value)} 
                              placeholder="Add a comment..." 
                              className="w-full px-3 py-2 border rounded-lg text-sm mb-2" 
                              style={{ fontFamily: 'Courier New, monospace', borderColor: '#31394d' }}
                              rows="2"
                            />
                            <button 
                              onClick={() => handleCommentOnSubmission(sub.id)} 
                              className="px-4 py-1 rounded-lg text-white text-sm font-semibold" 
                              style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                            >
                              Post Comment
                            </button>
                          </div>
                        )}
                        
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {comments.map(comment => (
                            <div key={comment.id} className="bg-gray-50 p-2 rounded text-sm">
                              <p className="font-semibold mb-1" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>{comment.memberName}</p>
                              <p style={{ fontFamily: 'Courier New, monospace' }}>{comment.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {page === 'admin' && isAdmin && (
          <div>
            <h2 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Admin Panel</h2>
            
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                <Shield size={24} />
                Manage Admins
              </h3>
              <div className="mb-4">
                <p className="text-sm mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>
                  Current Admins:
                </p>
                <div className="space-y-2">
                  {adminEmails.map(email => (
                    <div key={email} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                      <span style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        {email}
                      </span>
                      {adminEmails.length > 1 && (
                        <button 
                          onClick={() => removeAdmin(email)}
                          className="px-3 py-1 bg-red-500 text-white rounded text-sm font-semibold"
                          style={{ fontFamily: 'Courier New, monospace' }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input 
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="Enter email to add as admin"
                  className="flex-1 px-4 py-2 border rounded-lg"
                  style={{ borderColor: '#31394d', fontFamily: 'Courier New, monospace' }}
                />
                <button 
                  onClick={addAdmin}
                  className="px-6 py-2 rounded-lg text-white font-semibold"
                  style={{ backgroundColor: '#009384', fontFamily: 'Courier New, monospace' }}
                >
                  Add Admin
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Quick Stats</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{films.length}</p>
                  <p className="text-sm" style={{ fontFamily: 'Courier New, monospace' }}>Total Films</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{members.length}</p>
                  <p className="text-sm" style={{ fontFamily: 'Courier New, monospace' }}>Members</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{buzzFeed.filter(b => b.type === 'review').length}</p>
                  <p className="text-sm" style={{ fontFamily: 'Courier New, monospace' }}>Reviews</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>{submissions.length}</p>
                  <p className="text-sm" style={{ fontFamily: 'Courier New, monospace' }}>Submissions</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>{showAddFilm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Add New Film</h2>
            <form onSubmit={handleAddFilm} className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Title *</label>
                <input type="text" value={newFilm.title} onChange={(e) => setNewFilm({...newFilm, title: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Movie Poster Image URL *</label>
                <input type="url" value={newFilm.image} onChange={(e) => setNewFilm({...newFilm, image: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Event Poster Image URL (for upcoming)</label>
                <input type="url" value={newFilm.eventPoster} onChange={(e) => setNewFilm({...newFilm, eventPoster: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>RT Score *</label>
                <input type="number" value={newFilm.rtScore} onChange={(e) => setNewFilm({...newFilm, rtScore: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Popcornmeter Score</label>
                <input type="number" value={newFilm.popcornScore} onChange={(e) => setNewFilm({...newFilm, popcornScore: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Trailer URL (YouTube)</label>
                <input type="url" value={newFilm.trailer} onChange={(e) => setNewFilm({...newFilm, trailer: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Date *</label>
                <input type="date" value={newFilm.date} onChange={(e) => setNewFilm({...newFilm, date: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Emoji *</label>
                <input type="text" value={newFilm.emoji} onChange={(e) => setNewFilm({...newFilm, emoji: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Type *</label>
                <select value={newFilm.type} onChange={(e) => setNewFilm({...newFilm, type: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }}>
                  <option value="bmn">BMN Screening</option>
                  <option value="offsite-film">Offsite Film</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={newFilm.isUpcoming} onChange={(e) => setNewFilm({...newFilm, isUpcoming: e.target.checked})} />
                  <span style={{ fontFamily: 'Courier New, monospace' }}>Upcoming Screening (not yet revealed)</span>
                </label>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 py-2 rounded-lg text-white font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}>Add Film</button>
                <button type="button" onClick={() => setShowAddFilm(false)} className="flex-1 py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400" style={{ fontFamily: 'Courier New, monospace' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSubmitMovie && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Submit Movie Suggestion</h2>
            {!showTmdbSearch ? (
              <form onSubmit={handleSubmitMovie} className="space-y-4">
                <div className="mb-4">
                  <button 
                    type="button" 
                    onClick={() => setShowTmdbSearch(true)} 
                    className="w-full py-2 rounded-lg text-white font-semibold flex items-center justify-center gap-2" 
                    style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#31394d' }}
                  >
                    <Search size={20} />
                    Search TMDB Database
                  </button>
                  <p className="text-sm text-gray-500 mt-2 text-center">or enter details manually below</p>
                </div>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Title *</label>
                  <input type="text" value={newSubmission.title} onChange={(e) => setNewSubmission({...newSubmission, title: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
                </div>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Movie Poster *</label>
                  <div className="space-y-2">
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'submissions')} className="block" />
                    <div className="text-sm text-gray-500">or</div>
                    <input type="url" placeholder="Image URL" value={newSubmission.image} onChange={(e) => setNewSubmission({...newSubmission, image: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>YouTube Trailer Link</label>
                  <input type="url" value={newSubmission.youtubeLink} onChange={(e) => setNewSubmission({...newSubmission, youtubeLink: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
                <div>
                  <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Description</label>
                  <textarea value={newSubmission.description} onChange={(e) => setNewSubmission({...newSubmission, description: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} rows="4" />
                </div>
                <div className="flex gap-4">
                  <button type="submit" className="flex-1 py-2 rounded-lg text-white font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }} disabled={uploadingImage}>
                    {uploadingImage ? 'Uploading...' : 'Submit'}
                  </button>
                  <button type="button" onClick={() => setShowSubmitMovie(false)} className="flex-1 py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400" style={{ fontFamily: 'Courier New, monospace' }}>Cancel</button>
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
                    style={{ fontFamily: 'Courier New, monospace', borderColor: '#31394d' }}
                    onKeyPress={(e) => e.key === 'Enter' && handleTmdbSearch()}
                  />
                  <button onClick={handleTmdbSearch} className="px-6 py-2 rounded-lg text-white font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}>
                    Search
                  </button>
                </div>
                
                {searchingTmdb && <p className="text-center text-gray-500" style={{ fontFamily: 'Courier New, monospace' }}>Searching...</p>}
                
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {tmdbSearchResults.map(movie => (
                    <div key={movie.id} onClick={() => selectTmdbMovie(movie)} className="flex gap-4 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" style={{ borderColor: '#31394d' }}>
                      {movie.poster_path && (
                        <img src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`} alt={movie.title} className="w-16 h-24 object-cover rounded" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>{movie.title}</h4>
                        <p className="text-sm text-gray-600" style={{ fontFamily: 'Courier New, monospace' }}>{movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</p>
                        <p className="text-sm text-gray-700 line-clamp-2">{movie.overview}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button onClick={() => { setShowTmdbSearch(false); setTmdbSearchResults([]); }} className="w-full py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400" style={{ fontFamily: 'Courier New, monospace' }}>
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

export default App;
