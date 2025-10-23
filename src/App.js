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

// UPDATE #2: Multi-admin management - Default admins
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
  // UPDATE #6: Separate score and review state
  const [userScore, setUserScore] = useState(50);
  const [userReview, setUserReview] = useState('');
  const [userThumbs, setUserThumbs] = useState('neutral');
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
  // UPDATE #2: Admin list state
  const [adminEmails, setAdminEmails] = useState(DEFAULT_ADMIN_EMAILS);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // UPDATE #2: Check if user is admin from stored admin list
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

  // BROWSER BACK BUTTON FIX
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

  // UPDATE #2: Load admin list from Firestore
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

  // UPDATE #2: Add new admin
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

  // UPDATE #2: Remove admin
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
  };

  // FIXED: Only show pending reviews for films user attended (has emoji badge)
  const checkPendingVotes = () => {
    // Get films user has already reviewed
    const reviewedFilmIds = buzzFeed
      .filter(item => item.type === 'review' && item.memberId === userProfile.id)
      .map(item => item.filmId);
    
    // Get user's badge emojis
    const userEmojis = userProfile.emojis || [];
    
    // Get past films that user attended (has the emoji badge)
    const pastFilms = films.filter(f => {
      const filmDate = new Date(f.date);
      const today = new Date();
      const isPast = filmDate < today && !f.isUpcoming;
      const userAttended = userEmojis.includes(f.emoji);
      return isPast && userAttended;
    });
    
    // Filter to only films user attended but hasn't reviewed
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

  // BMN SCORE CALCULATION - AVERAGE OF ALL VOTES
  const calculateBMNScore = (filmId) => {
    const reviews = buzzFeed.filter(item => 
      item.type === 'review' && item.filmId === filmId && typeof item.score === 'number'
    );
    
    if (reviews.length === 0) return 0;
    
    const sum = reviews.reduce((acc, review) => acc + review.score, 0);
    return Math.round(sum / reviews.length);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [filmsSnap, membersSnap, submissionsSnap, buzzSnap] = await Promise.all([
        getDocs(collection(db, 'films')),
        getDocs(collection(db, 'members')),
        getDocs(collection(db, 'submissions')),
        getDocs(query(collection(db, 'buzz'), orderBy('timestamp', 'desc')))
      ]);

      const filmsData = filmsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const membersData = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const submissionsData = submissionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const buzzData = buzzSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setFilms(filmsData.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setMembers(membersData);
      setSubmissions(submissionsData);
      setBuzzFeed(buzzData);

      // UPDATE #3: Load submission comments for Buzz feed
      const commentsData = {};
      for (const sub of submissionsData) {
        const commentsSnap = await getDocs(collection(db, 'submissions', sub.id, 'comments'));
        commentsData[sub.id] = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      setSubmissionComments(commentsData);
    } catch (err) {
      console.error('Load error:', err);
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

  const handleForgotPassword = async () => {
    if (!email) {
      alert('Please enter your email address');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent!');
      setForgotPassword(false);
    } catch (err) {
      alert('Error: ' + err.message);
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
        setTmdbData(data.results[0]);
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
      title: movie.title,
      image: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
      youtubeLink: '',
      description: movie.overview || ''
    });
    setShowTmdbSearch(false);
    setTmdbSearchResults([]);
  };

  const handleImageUpload = async (e, category) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `members/uploads/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      if (category === 'film') {
        setNewFilm({ ...newFilm, image: url });
      } else if (category === 'eventPoster') {
        setNewFilm({ ...newFilm, eventPoster: url });
      } else if (category === 'submissions') {
        setNewSubmission({ ...newSubmission, image: url });
      } else if (category === 'editFilm') {
        setEditingFilm({ ...editingFilm, image: url });
      } else if (category === 'editEventPoster') {
        setEditingFilm({ ...editingFilm, eventPoster: url });
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed');
    }
    setUploadingImage(false);
  };

  const addFilm = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const filmId = newFilm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await setDoc(doc(db, 'films', filmId), {
        ...newFilm,
        id: filmId,
        rtScore: Number(newFilm.rtScore),
        popcornScore: Number(newFilm.popcornScore),
        bmnScore: Number(newFilm.bmnScore)
      });

      setShowAddFilm(false);
      setNewFilm({
        title: '', subtitle: '', image: '', eventPoster: '', rtScore: '', popcornScore: '',
        bmnScore: 0, date: '', emoji: '🎬', type: 'bmn', trailer: '', isUpcoming: false
      });
      loadData();
    } catch (err) {
      console.error('Add film error:', err);
      alert('Failed to add film');
    }
  };

  const updateFilm = async (e) => {
    e.preventDefault();
    if (!isAdmin || !editingFilm) return;

    try {
      const updateData = {
        ...editingFilm,
        rtScore: Number(editingFilm.rtScore),
        popcornScore: Number(editingFilm.popcornScore),
        bmnScore: Number(editingFilm.bmnScore)
      };
      delete updateData.id;

      await updateDoc(doc(db, 'films', editingFilm.id), updateData);
      setEditingFilm(null);
      loadData();
    } catch (err) {
      console.error('Update error:', err);
      alert('Failed to update film');
    }
  };

  const deleteFilm = async (filmId) => {
    if (!isAdmin || !confirm('Delete this film?')) return;

    try {
      await deleteDoc(doc(db, 'films', filmId));
      loadData();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete');
    }
  };

  // UPDATE #6: Separate vote submission (score only)
  const submitVote = async (filmId) => {
    if (!user || !userProfile) return;

    try {
      const voteData = {
        authUserId: user.uid,
        authUserEmail: user.email,
        memberId: userProfile.id,
        memberName: userProfile.name,
        score: Number(userScore),
        thumbs: userThumbs,
        timestamp: new Date().toISOString(),
        filmId: filmId,
        filmTitle: selectedFilm.title
      };

      await setDoc(doc(db, 'films', filmId, 'votes', userProfile.id), voteData);

      await addDoc(collection(db, 'buzz'), {
        type: 'vote',
        memberId: userProfile.id,
        memberName: userProfile.name,
        filmId: filmId,
        filmTitle: selectedFilm.title,
        score: Number(userScore),
        thumbs: userThumbs,
        timestamp: new Date().toISOString()
      });

      setUserScore(50);
      setUserThumbs('neutral');
      loadData();
      loadFilmVotes(filmId);
      alert('Vote submitted!');
    } catch (err) {
      console.error('Vote error:', err);
      alert('Failed to submit vote');
    }
  };

  // UPDATE #6: Separate review submission (text only)
  const submitReview = async (filmId) => {
    if (!user || !userProfile || !userReview.trim()) {
      alert('Please write a review');
      return;
    }

    try {
      const reviewData = {
        authUserId: user.uid,
        authUserEmail: user.email,
        memberId: userProfile.id,
        memberName: userProfile.name,
        text: userReview,
        timestamp: new Date().toISOString(),
        filmId: filmId,
        filmTitle: selectedFilm.title
      };

      await addDoc(collection(db, 'buzz'), {
        type: 'review',
        ...reviewData
      });

      setUserReview('');
      loadData();
      alert('Review submitted!');
    } catch (err) {
      console.error('Review error:', err);
      alert('Failed to submit review');
    }
  };

  const likeReview = async (reviewId, currentLikes = []) => {
    if (!userProfile) return;

    try {
      const hasLiked = currentLikes.includes(userProfile.id);
      const buzzRef = doc(db, 'buzz', reviewId);
      
      if (hasLiked) {
        await updateDoc(buzzRef, {
          likes: arrayRemove(userProfile.id)
        });
      } else {
        await updateDoc(buzzRef, {
          likes: arrayUnion(userProfile.id)
        });
      }
      
      loadData();
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const addReply = async (buzzId) => {
    if (!userProfile || !replyText.trim()) return;

    try {
      await addDoc(collection(db, 'buzz', buzzId, 'replies'), {
        memberId: userProfile.id,
        memberName: userProfile.name,
        text: replyText,
        timestamp: new Date().toISOString()
      });

      setReplyText('');
      setReplyingTo(null);
      loadData();
    } catch (err) {
      console.error('Reply error:', err);
    }
  };

  const submitMovieSubmission = async (e) => {
    e.preventDefault();
    if (!userProfile) return;

    try {
      const submissionData = {
        ...newSubmission,
        submittedBy: userProfile.id,
        submitterName: userProfile.name,
        timestamp: new Date().toISOString(),
        votes: { yes: [], no: [] }
      };

      const docRef = await addDoc(collection(db, 'submissions'), submissionData);

      // UPDATE #3: Add submission to Buzz feed
      await addDoc(collection(db, 'buzz'), {
        type: 'submission',
        memberId: userProfile.id,
        memberName: userProfile.name,
        submissionId: docRef.id,
        submissionTitle: newSubmission.title,
        timestamp: new Date().toISOString()
      });

      setShowSubmitMovie(false);
      setNewSubmission({ title: '', image: '', youtubeLink: '', description: '' });
      loadData();
    } catch (err) {
      console.error('Submission error:', err);
      alert('Failed to submit');
    }
  };

  const voteOnSubmission = async (submissionId, voteType) => {
    if (!userProfile) return;

    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionDoc = await getDoc(submissionRef);
      const currentVotes = submissionDoc.data().votes || { yes: [], no: [] };

      const hasVotedYes = currentVotes.yes.includes(userProfile.id);
      const hasVotedNo = currentVotes.no.includes(userProfile.id);

      let newVotes = { ...currentVotes };

      if (voteType === 'yes') {
        if (hasVotedYes) {
          newVotes.yes = newVotes.yes.filter(id => id !== userProfile.id);
        } else {
          newVotes.yes = [...newVotes.yes, userProfile.id];
          newVotes.no = newVotes.no.filter(id => id !== userProfile.id);
        }
      } else {
        if (hasVotedNo) {
          newVotes.no = newVotes.no.filter(id => id !== userProfile.id);
        } else {
          newVotes.no = [...newVotes.no, userProfile.id];
          newVotes.yes = newVotes.yes.filter(id => id !== userProfile.id);
        }
      }

      await updateDoc(submissionRef, { votes: newVotes });
      loadData();
    } catch (err) {
      console.error('Vote error:', err);
    }
  };

  const addSubmissionComment = async (submissionId) => {
    if (!userProfile || !commentText.trim()) return;

    try {
      const commentData = {
        memberId: userProfile.id,
        memberName: userProfile.name,
        text: commentText,
        timestamp: new Date().toISOString()
      };

      await addDoc(collection(db, 'submissions', submissionId, 'comments'), commentData);

      // UPDATE #3: Add submission comment to Buzz feed
      const submission = submissions.find(s => s.id === submissionId);
      await addDoc(collection(db, 'buzz'), {
        type: 'submission_comment',
        memberId: userProfile.id,
        memberName: userProfile.name,
        submissionId: submissionId,
        submissionTitle: submission?.title || 'Unknown',
        text: commentText,
        timestamp: new Date().toISOString()
      });

      setCommentText('');
      setCommentingOn(null);
      loadData();
    } catch (err) {
      console.error('Comment error:', err);
    }
  };

  const deleteSubmission = async (submissionId) => {
    if (!isAdmin || !confirm('Delete this submission?')) return;

    try {
      await deleteDoc(doc(db, 'submissions', submissionId));
      loadData();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete');
    }
  };

  const updateMemberProfile = async (e) => {
    e.preventDefault();
    if (!editingProfile) return;

    try {
      const updateData = { ...editingProfile };
      delete updateData.id;

      await updateDoc(doc(db, 'members', editingProfile.id), updateData);
      setEditingProfile(null);
      loadData();
    } catch (err) {
      console.error('Update error:', err);
      alert('Failed to update profile');
    }
  };

  const getYouTubeEmbedUrl = (url) => {
    if (!url) return '';
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return videoId ? `https://www.youtube.com/embed/${videoId[1]}` : '';
  };

  if (showLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        backgroundImage: 'url(https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2FSPLASH%20SCREEN%20001.png?alt=media&token=0ad0ed4d-8c85-4d4a-87bd-4f133dbb94e8)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}>
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
          <h1 className="text-4xl font-bold mb-6 text-center" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
            Bad Movie Night
          </h1>
          {!forgotPassword ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <button type="submit" className="w-full py-2 rounded-lg text-white font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}>
                Login
              </button>
              <button type="button" onClick={() => setForgotPassword(true)} className="w-full text-sm underline" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                Forgot Password?
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Enter your email to receive a password reset link.</p>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <button onClick={handleForgotPassword} className="w-full py-2 rounded-lg text-white font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}>
                Send Reset Email
              </button>
              <button onClick={() => setForgotPassword(false)} className="w-full text-sm underline" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#31394d' }}>
        <div className="text-2xl" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 rounded-lg" style={{ backgroundColor: '#31394d' }}>
          {showMobileMenu ? <X size={24} color="white" /> : <Menu size={24} color="white" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`${showMobileMenu ? 'fixed inset-0 z-40' : 'hidden'} md:block md:static p-4`} style={{ backgroundColor: '#31394d' }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <button 
            onClick={() => { setPage('home'); setShowMobileMenu(false); window.history.pushState({ page: 'home' }, '', '#home'); }}
            className="text-2xl md:text-3xl font-bold hover:opacity-80"
            style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}
          >
            Bad Movie Night
          </button>
          <div className="flex flex-col md:flex-row gap-2 md:gap-4">
            <button onClick={() => { setPage('home'); setShowMobileMenu(false); window.history.pushState({ page: 'home' }, '', '#home'); }} className={`px-4 py-2 rounded-lg font-bold`} style={{ fontFamily: 'Courier New, monospace', backgroundColor: page === 'home' ? '#009384' : 'transparent', color: 'white' }}>
              Home
            </button>
            <button onClick={() => { setPage('members'); setShowMobileMenu(false); window.history.pushState({ page: 'members' }, '', '#members'); }} className="px-4 py-2 rounded-lg" style={{ fontFamily: 'Courier New, monospace', backgroundColor: page === 'members' ? '#009384' : 'transparent', color: 'white' }}>
              Members
            </button>
            <button onClick={() => { setPage('upnext'); setShowMobileMenu(false); window.history.pushState({ page: 'upnext' }, '', '#upnext'); }} className="px-4 py-2 rounded-lg" style={{ fontFamily: 'Courier New, monospace', backgroundColor: page === 'upnext' ? '#009384' : 'transparent', color: 'white' }}>
              Up Next
            </button>
            <button onClick={() => { setPage('leaderboard'); setShowMobileMenu(false); window.history.pushState({ page: 'leaderboard' }, '', '#leaderboard'); }} className="px-4 py-2 rounded-lg" style={{ fontFamily: 'Courier New, monospace', backgroundColor: page === 'leaderboard' ? '#009384' : 'transparent', color: 'white' }}>
              Leaderboard
            </button>
            <button onClick={() => { setPage('buzz'); setShowMobileMenu(false); window.history.pushState({ page: 'buzz' }, '', '#buzz'); }} className="px-4 py-2 rounded-lg" style={{ fontFamily: 'Courier New, monospace', backgroundColor: page === 'buzz' ? '#009384' : 'transparent', color: 'white' }}>
              The Buzz
            </button>
            {isAdmin && (
              <button onClick={() => { setPage('admin'); setShowMobileMenu(false); window.history.pushState({ page: 'admin' }, '', '#admin'); }} className="px-4 py-2 rounded-lg" style={{ fontFamily: 'Courier New, monospace', backgroundColor: page === 'admin' ? '#009384' : 'transparent', color: 'white' }}>
                Admin
              </button>
            )}
            <button onClick={handleLogout} className="px-4 py-2 rounded-lg flex items-center gap-2" style={{ fontFamily: 'Courier New, monospace', color: 'white' }}>
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        {userProfile && (
          <div className="mb-4 text-right" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
            Hi, {userProfile.name}!
          </div>
        )}

        {/* HOME PAGE */}
        {page === 'home' && (
          <div>
            <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
              Bad Movie Night Screenings
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {films.map(film => (
                <div 
                  key={film.id} 
                  onClick={() => {
                    setSelectedFilm(film);
                    setPage('filmdetail');
                    window.history.pushState({ page: 'filmdetail' }, '', '#filmdetail');
                  }}
                  className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-shadow relative"
                  style={{ border: film.isUpcoming ? '3px solid #009384' : 'none' }}
                >
                  {film.isUpcoming && (
                    <div className="absolute top-2 right-2 px-3 py-1 rounded-full text-white text-sm font-bold z-10" style={{ backgroundColor: '#009384', fontFamily: 'Courier New, monospace' }}>
                      UPCOMING
                    </div>
                  )}
                  {/* UPDATE #1: 2:3 aspect ratio for poster */}
                  <div className="relative" style={{ paddingBottom: '150%' }}>
                    <img 
                      src={film.isUpcoming ? (film.eventPoster || film.image) : film.image} 
                      alt={film.title} 
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-xl font-bold mb-2 text-center" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                      {film.title}
                    </h3>
                    {film.date && (
                      <p className="text-sm mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        <strong>Screening Date:</strong> {new Date(film.date).toLocaleDateString()}
                      </p>
                    )}
                    {/* UPDATE #5: Larger icons and scores */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <img 
                          src={film.rtScore >= 60 
                            ? "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2Frt-fresh.png?alt=media" 
                            : "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2F8-85807_rotten-tomatoes%C2%AE-score-wikimedia-commons.png?alt=media&token=4a975032-aed9-4f51-9809-beeff10084b0"
                          }
                          alt="RT"
                          className="w-8 h-8"
                        />
                        <span className="font-bold text-xl" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                          {film.rtScore}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <img 
                          src={film.popcornScore >= 50
                            ? "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2F158-1588548_open-popcorn-icon-rotten-tomatoes.png?alt=media&token=31b871a7-d2ba-4bd3-a408-b286bf07d16d"
                            : "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2F158-1588925_rotten-tomatoes-negative-audience-rotten-tomatoes-green-splat.png?alt=media&token=6b444b2a-dc46-443f-b3ed-6fd88c814b2a"
                          }
                          alt="Popcorn"
                          className="w-8 h-8"
                        />
                        <span className="font-bold text-xl" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                          {film.popcornScore}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Film size={28} color="#009384" />
                        <span className="font-bold text-xl" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                          {calculateBMNScore(film.id)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FILM DETAIL PAGE */}
        {page === 'filmdetail' && selectedFilm && (
          <div>
            <button 
              onClick={() => { 
                setPage('home'); 
                setSelectedFilm(null);
                window.history.pushState({ page: 'home' }, '', '#home');
              }} 
              className="mb-4 flex items-center gap-2 px-4 py-2 rounded-lg text-white" 
              style={{ backgroundColor: '#31394d', fontFamily: 'Courier New, monospace' }}
            >
              <ChevronLeft size={20} />
              Back to Home
            </button>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* LEFT: Poster Images */}
              <div className="space-y-4">
                {/* UPDATE #1: 2:3 aspect ratio for main poster */}
                <div>
                  <h4 className="font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Movie Poster</h4>
                  <div className="relative" style={{ paddingBottom: '150%' }}>
                    <img 
                      src={selectedFilm.image} 
                      alt={selectedFilm.title}
                      className="absolute inset-0 w-full h-full object-cover rounded-lg shadow-lg"
                    />
                  </div>
                </div>

                {/* UPDATE #1: 2:3 aspect ratio for event poster */}
                {selectedFilm.eventPoster && (
                  <div>
                    <h4 className="font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>BMN Event Poster</h4>
                    <div className="relative" style={{ paddingBottom: '150%' }}>
                      <img 
                        src={selectedFilm.eventPoster} 
                        alt="Event Poster"
                        className="absolute inset-0 w-full h-full object-cover rounded-lg shadow-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* MIDDLE & RIGHT: Details and Voting */}
              <div className="md:col-span-2 space-y-6">
                {/* Film Info */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                    {selectedFilm.title}
                  </h2>
                  {selectedFilm.subtitle && (
                    <p className="text-lg mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>
                      {selectedFilm.subtitle}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <img 
                        src={selectedFilm.rtScore >= 60 
                          ? "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2Frt-fresh.png?alt=media" 
                          : "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2F8-85807_rotten-tomatoes%C2%AE-score-wikimedia-commons.png?alt=media&token=4a975032-aed9-4f51-9809-beeff10084b0"
                        }
                        alt="RT"
                        className="w-16 h-16 mx-auto mb-2"
                      />
                      <p className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        {selectedFilm.rtScore}%
                      </p>
                      <p className="text-sm" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>RT Score</p>
                    </div>
                    <div className="text-center">
                      <img 
                        src={selectedFilm.popcornScore >= 50
                          ? "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2F158-1588548_open-popcorn-icon-rotten-tomatoes.png?alt=media&token=31b871a7-d2ba-4bd3-a408-b286bf07d16d"
                          : "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2F158-1588925_rotten-tomatoes-negative-audience-rotten-tomatoes-green-splat.png?alt=media&token=6b444b2a-dc46-443f-b3ed-6fd88c814b2a"
                        }
                        alt="Popcorn"
                        className="w-16 h-16 mx-auto mb-2"
                      />
                      <p className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        {selectedFilm.popcornScore}%
                      </p>
                      <p className="text-sm" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>Popcornmeter</p>
                    </div>
                    <div className="text-center">
                      <Film size={64} color="#009384" className="mx-auto mb-2" />
                      <p className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                        {calculateBMNScore(selectedFilm.id)}
                      </p>
                      <p className="text-sm" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>BMN Score</p>
                    </div>
                  </div>
                  {selectedFilm.date && (
                    <p className="mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                      <strong>Screening Date:</strong> {new Date(selectedFilm.date).toLocaleDateString()}
                    </p>
                  )}
                  {tmdbData && (
                    <div className="mb-4">
                      <h4 className="font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Overview</h4>
                      <p style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>{tmdbData.overview}</p>
                    </div>
                  )}
                  {selectedFilm.trailer && getYouTubeEmbedUrl(selectedFilm.trailer) && (
                    <div className="mb-4">
                      <h4 className="font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Trailer</h4>
                      <div className="relative" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          className="absolute inset-0 w-full h-full rounded-lg"
                          src={getYouTubeEmbedUrl(selectedFilm.trailer)}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* UPDATE #6: SEPARATED VOTING SECTION */}
                {user && userProfile && (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                      Your Rating & Review
                    </h3>

                    {/* Score Submission */}
                    <div className="mb-6 pb-6 border-b">
                      <label className="block mb-2 font-semibold text-lg" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        How much did you like this movie?
                      </label>
                      <div className="flex items-center gap-4 mb-4">
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={userScore}
                          onChange={(e) => setUserScore(Number(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-3xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                          {userScore}
                        </span>
                      </div>
                      <div className="flex gap-4 mb-4">
                        <button 
                          onClick={() => setUserThumbs('up')}
                          className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 ${userThumbs === 'up' ? 'ring-2 ring-green-500' : ''}`}
                          style={{ backgroundColor: userThumbs === 'up' ? '#22c55e' : '#e5e5e5', color: userThumbs === 'up' ? 'white' : '#31394d', fontFamily: 'Courier New, monospace' }}
                        >
                          <ThumbsUp size={20} />
                          Thumbs Up
                        </button>
                        <button 
                          onClick={() => setUserThumbs('down')}
                          className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 ${userThumbs === 'down' ? 'ring-2 ring-red-500' : ''}`}
                          style={{ backgroundColor: userThumbs === 'down' ? '#ef4444' : '#e5e5e5', color: userThumbs === 'down' ? 'white' : '#31394d', fontFamily: 'Courier New, monospace' }}
                        >
                          <ThumbsDown size={20} />
                          Thumbs Down
                        </button>
                      </div>
                      <button 
                        onClick={() => submitVote(selectedFilm.id)}
                        className="w-full py-2 rounded-lg text-white font-semibold"
                        style={{ backgroundColor: '#009384', fontFamily: 'Courier New, monospace' }}
                      >
                        Submit Score
                      </button>
                    </div>

                    {/* Review Submission */}
                    <div>
                      <label className="block mb-2 font-semibold text-lg" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        Write a Review (Optional)
                      </label>
                      <textarea 
                        value={userReview}
                        onChange={(e) => setUserReview(e.target.value)}
                        placeholder="Share your thoughts about this movie..."
                        className="w-full px-4 py-2 border rounded-lg mb-4"
                        style={{ borderColor: '#31394d', fontFamily: 'Courier New, monospace' }}
                        rows="4"
                      />
                      <button 
                        onClick={() => submitReview(selectedFilm.id)}
                        className="w-full py-2 rounded-lg text-white font-semibold"
                        style={{ backgroundColor: '#31394d', fontFamily: 'Courier New, monospace' }}
                      >
                        Submit Review
                      </button>
                    </div>
                  </div>
                )}

                {/* All Reviews */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                    All Reviews
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(filmVotes).map(([voteId, vote]) => {
                      const member = members.find(m => m.id === vote.memberId);
                      return (
                        <div key={voteId} className="border-b pb-4">
                          <div className="flex items-start gap-3">
                            {member && (
                              <img src={member.image} alt={member.name} className="w-12 h-12 rounded-full" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                                  {vote.memberName}
                                </span>
                                {vote.score !== undefined && (
                                  <span className="text-xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                                    {vote.score}
                                  </span>
                                )}
                                {vote.thumbs === 'up' && <ThumbsUp size={16} color="#22c55e" />}
                                {vote.thumbs === 'down' && <ThumbsDown size={16} color="#ef4444" />}
                              </div>
                              {vote.text && (
                                <p style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>{vote.text}</p>
                              )}
                              {vote.timestamp && (
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(vote.timestamp).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MEMBERS PAGE */}
        {page === 'members' && (
          <div>
            <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
              Members
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {members.map(member => (
                <div 
                  key={member.id} 
                  onClick={() => {
                    setSelectedMember(member);
                    setPage('memberdetail');
                    window.history.pushState({ page: 'memberdetail' }, '', '#memberdetail');
                  }}
                  className="bg-white rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow"
                >
                  <img src={member.image} alt={member.name} className="w-24 h-24 rounded-full mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-center mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                    {member.name}
                  </h3>
                  <p className="text-center mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                    {member.title}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {(member.emojis || []).map((emoji, idx) => (
                      <span key={idx} className="text-2xl">{emoji}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MEMBER DETAIL PAGE */}
        {page === 'memberdetail' && selectedMember && (
          <div>
            <button 
              onClick={() => {
                setPage('members');
                setSelectedMember(null);
                window.history.pushState({ page: 'members' }, '', '#members');
              }}
              className="mb-4 flex items-center gap-2 px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: '#31394d', fontFamily: 'Courier New, monospace' }}
            >
              <ChevronLeft size={20} />
              Back to Members
            </button>

            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-start gap-6">
                <img src={selectedMember.image} alt={selectedMember.name} className="w-32 h-32 rounded-full" />
                <div className="flex-1">
                  <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                    {selectedMember.name}
                  </h2>
                  <p className="text-xl mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                    {selectedMember.title}
                  </p>
                  <p className="mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>
                    {selectedMember.bio}
                  </p>
                  {isAdmin && userProfile?.id === selectedMember.id && (
                    <button 
                      onClick={() => setEditingProfile(selectedMember)}
                      className="px-4 py-2 rounded-lg text-white font-semibold"
                      style={{ backgroundColor: '#009384', fontFamily: 'Courier New, monospace' }}
                    >
                      Edit Profile
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                  Badge Collection
                </h3>
                <div className="flex flex-wrap gap-4">
                  {(selectedMember.emojis || []).map((emoji, idx) => {
                    const film = films.find(f => f.emoji === emoji);
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (film) {
                            setSelectedFilm(film);
                            setPage('filmdetail');
                            window.history.pushState({ page: 'filmdetail' }, '', '#filmdetail');
                          }
                        }}
                        className="text-4xl p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        title={film ? `${film.title} - ${new Date(film.date).toLocaleDateString()}` : ''}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent Reviews */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                Recent Reviews
              </h3>
              <div className="space-y-4">
                {buzzFeed
                  .filter(item => item.type === 'review' && item.memberId === selectedMember.id)
                  .slice(0, 10)
                  .map(review => (
                    <div key={review.id} className="border-b pb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                          {review.filmTitle}
                        </span>
                        <span className="text-lg font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                          {review.score}
                        </span>
                      </div>
                      <p style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>{review.text}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(review.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            {/* Pending Reviews Dashboard */}
            {userProfile?.id === selectedMember.id && pendingVotes.length > 0 && (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6 mt-6">
                <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                  ⚠️ Pending Reviews
                </h3>
                <p className="mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>
                  You attended these screenings but haven't reviewed them yet:
                </p>
                <div className="space-y-2">
                  {pendingVotes.map(film => (
                    <button
                      key={film.id}
                      onClick={() => {
                        setSelectedFilm(film);
                        setPage('filmdetail');
                        window.history.pushState({ page: 'filmdetail' }, '', '#filmdetail');
                      }}
                      className="w-full text-left px-4 py-2 bg-white rounded-lg hover:bg-gray-50 font-semibold"
                      style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}
                    >
                      {film.title} - {new Date(film.date).toLocaleDateString()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* UP NEXT PAGE */}
        {page === 'upnext' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                Up Next - Vote on Submissions
              </h2>
              <button 
                onClick={() => setShowSubmitMovie(true)}
                className="px-4 py-2 rounded-lg text-white font-semibold flex items-center gap-2"
                style={{ backgroundColor: '#009384', fontFamily: 'Courier New, monospace' }}
              >
                <Plus size={20} />
                Submit Movie
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {submissions.map(sub => (
                <div key={sub.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  {/* UPDATE #4: Smaller poster size with 2:3 ratio */}
                  <div className="relative" style={{ paddingBottom: '120%' }}>
                    <img 
                      src={sub.image} 
                      alt={sub.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                      {sub.title}
                    </h3>
                    <p className="text-sm mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>
                      Submitted by: {sub.submitterName}
                    </p>
                    {sub.description && (
                      <p className="text-sm mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>
                        {sub.description}
                      </p>
                    )}
                    {sub.youtubeLink && getYouTubeEmbedUrl(sub.youtubeLink) && (
                      <div className="mb-4 relative" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          className="absolute inset-0 w-full h-full rounded"
                          src={getYouTubeEmbedUrl(sub.youtubeLink)}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}

                    {/* Voting */}
                    <div className="flex gap-2 mb-4">
                      <button 
                        onClick={() => voteOnSubmission(sub.id, 'yes')}
                        className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 ${sub.votes?.yes?.includes(userProfile?.id) ? 'ring-2 ring-green-500' : ''}`}
                        style={{ 
                          backgroundColor: sub.votes?.yes?.includes(userProfile?.id) ? '#22c55e' : '#e5e5e5',
                          color: sub.votes?.yes?.includes(userProfile?.id) ? 'white' : '#31394d',
                          fontFamily: 'Courier New, monospace'
                        }}
                      >
                        <ThumbsUp size={18} />
                        Yes ({sub.votes?.yes?.length || 0})
                      </button>
                      <button 
                        onClick={() => voteOnSubmission(sub.id, 'no')}
                        className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 ${sub.votes?.no?.includes(userProfile?.id) ? 'ring-2 ring-red-500' : ''}`}
                        style={{ 
                          backgroundColor: sub.votes?.no?.includes(userProfile?.id) ? '#ef4444' : '#e5e5e5',
                          color: sub.votes?.no?.includes(userProfile?.id) ? 'white' : '#31394d',
                          fontFamily: 'Courier New, monospace'
                        }}
                      >
                        <ThumbsDown size={18} />
                        No ({sub.votes?.no?.length || 0})
                      </button>
                    </div>

                    {/* Show who voted */}
                    {(sub.votes?.yes?.length > 0 || sub.votes?.no?.length > 0) && (
                      <div className="mb-4 text-sm" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>
                        {sub.votes.yes.length > 0 && (
                          <div className="mb-1">
                            <strong className="text-green-600">Yes:</strong> {sub.votes.yes.map(memberId => members.find(m => m.id === memberId)?.name || memberId).join(', ')}
                          </div>
                        )}
                        {sub.votes.no.length > 0 && (
                          <div>
                            <strong className="text-red-600">No:</strong> {sub.votes.no.map(memberId => members.find(m => m.id === memberId)?.name || memberId).join(', ')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Comments */}
                    <div className="space-y-2">
                      {(submissionComments[sub.id] || []).map(comment => (
                        <div key={comment.id} className="bg-gray-50 p-2 rounded">
                          <p className="font-semibold text-sm" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                            {comment.memberName}
                          </p>
                          <p className="text-sm" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>
                            {comment.text}
                          </p>
                        </div>
                      ))}
                    </div>

                    {commentingOn === sub.id ? (
                      <div className="mt-2">
                        <textarea 
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Add a comment..."
                          className="w-full px-2 py-1 border rounded text-sm"
                          style={{ borderColor: '#31394d', fontFamily: 'Courier New, monospace' }}
                          rows="2"
                        />
                        <div className="flex gap-2 mt-2">
                          <button 
                            onClick={() => addSubmissionComment(sub.id)}
                            className="px-3 py-1 rounded text-white text-sm font-semibold"
                            style={{ backgroundColor: '#009384', fontFamily: 'Courier New, monospace' }}
                          >
                            Post
                          </button>
                          <button 
                            onClick={() => { setCommentingOn(null); setCommentText(''); }}
                            className="px-3 py-1 bg-gray-300 rounded text-sm font-semibold"
                            style={{ fontFamily: 'Courier New, monospace' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setCommentingOn(sub.id)}
                        className="mt-2 text-sm flex items-center gap-1"
                        style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}
                      >
                        <MessageCircle size={16} />
                        Comment
                      </button>
                    )}

                    {isAdmin && (
                      <button 
                        onClick={() => deleteSubmission(sub.id)}
                        className="mt-2 w-full py-1 bg-red-500 text-white rounded text-sm font-semibold flex items-center justify-center gap-1"
                        style={{ fontFamily: 'Courier New, monospace' }}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEADERBOARD PAGE */}
        {page === 'leaderboard' && (
          <div>
            <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
              Leaderboard
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Most Badges */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                  Most Badges
                </h3>
                <div className="space-y-4">
                  {members
                    .map(m => ({ ...m, badgeCount: (m.emojis || []).length }))
                    .sort((a, b) => b.badgeCount - a.badgeCount)
                    .map((member, idx) => (
                      <div key={member.id} className="flex items-center gap-4">
                        <span className="text-2xl font-bold w-8" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                          #{idx + 1}
                        </span>
                        <img src={member.image} alt={member.name} className="w-12 h-12 rounded-full" />
                        <div className="flex-1">
                          <p className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                            {member.name}
                          </p>
                          <p className="text-sm" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>
                            {member.badgeCount} badges
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Most Reviews */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                  Most Reviews
                </h3>
                <div className="space-y-4">
                  {members
                    .map(m => ({
                      ...m,
                      reviewCount: buzzFeed.filter(item => item.type === 'review' && item.memberId === m.id).length
                    }))
                    .sort((a, b) => b.reviewCount - a.reviewCount)
                    .map((member, idx) => (
                      <div key={member.id} className="flex items-center gap-4">
                        <span className="text-2xl font-bold w-8" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                          #{idx + 1}
                        </span>
                        <img src={member.image} alt={member.name} className="w-12 h-12 rounded-full" />
                        <div className="flex-1">
                          <p className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                            {member.name}
                          </p>
                          <p className="text-sm" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>
                            {member.reviewCount} reviews
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* THE BUZZ PAGE - UPDATE #3: Include submission comments */}
        {page === 'buzz' && (
          <div>
            <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
              The Buzz
            </h2>
            <div className="space-y-4">
              {buzzFeed
                .filter(item => ['review', 'submission', 'submission_comment', 'vote'].includes(item.type))
                .map(item => (
                <div key={item.id} className="bg-white rounded-lg shadow-lg p-4">
                  <div className="flex items-start gap-3">
                    {members.find(m => m.id === item.memberId) && (
                      <img 
                        src={members.find(m => m.id === item.memberId).image} 
                        alt={item.memberName}
                        className="w-12 h-12 rounded-full"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                          {item.memberName}
                        </span>
                        {item.type === 'review' && (
                          <>
                            <span style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>reviewed</span>
                            <button
                              onClick={() => {
                                const film = films.find(f => f.id === item.filmId);
                                if (film) {
                                  setSelectedFilm(film);
                                  setPage('filmdetail');
                                  window.history.pushState({ page: 'filmdetail' }, '', '#filmdetail');
                                }
                              }}
                              className="font-bold hover:underline"
                              style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}
                            >
                              {item.filmTitle}
                            </button>
                            {item.score !== undefined && (
                              <span className="text-lg font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                                {item.score}
                              </span>
                            )}
                          </>
                        )}
                        {item.type === 'vote' && (
                          <>
                            <span style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>voted on</span>
                            <button
                              onClick={() => {
                                const film = films.find(f => f.id === item.filmId);
                                if (film) {
                                  setSelectedFilm(film);
                                  setPage('filmdetail');
                                  window.history.pushState({ page: 'filmdetail' }, '', '#filmdetail');
                                }
                              }}
                              className="font-bold hover:underline"
                              style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}
                            >
                              {item.filmTitle}
                            </button>
                            <span className="text-lg font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                              {item.score}
                            </span>
                          </>
                        )}
                        {item.type === 'submission' && (
                          <>
                            <span style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>submitted</span>
                            <span className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                              {item.submissionTitle}
                            </span>
                          </>
                        )}
                        {item.type === 'submission_comment' && (
                          <>
                            <span style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>commented on</span>
                            <span className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                              {item.submissionTitle}
                            </span>
                          </>
                        )}
                      </div>
                      {item.text && (
                        <p className="mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#666' }}>
                          {item.text}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                        {item.type === 'review' && (
                          <button 
                            onClick={() => likeReview(item.id, item.likes || [])}
                            className="flex items-center gap-1 hover:text-red-500"
                          >
                            <Heart 
                              size={16} 
                              fill={(item.likes || []).includes(userProfile?.id) ? '#ef4444' : 'none'}
                              color={(item.likes || []).includes(userProfile?.id) ? '#ef4444' : '#9ca3af'}
                            />
                            <span>{(item.likes || []).length}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ADMIN PAGE - UPDATE #2: Add admin management */}
        {page === 'admin' && isAdmin && (
          <div>
            <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
              Admin Panel
            </h2>

            {/* Admin Management Section */}
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

            {/* Add Film Section */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                Add New Film
              </h3>
              <button 
                onClick={() => setShowAddFilm(true)}
                className="px-6 py-2 rounded-lg text-white font-semibold"
                style={{ backgroundColor: '#009384', fontFamily: 'Courier New, monospace' }}
              >
                Add Film
              </button>
            </div>

            {/* Edit Films */}
            <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
              <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                Edit Films
              </h3>
              <div className="space-y-2">
                {films.map(film => (
                  <div key={film.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                      {film.title}
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingFilm(film)}
                        className="px-3 py-1 rounded text-white text-sm font-semibold"
                        style={{ backgroundColor: '#009384', fontFamily: 'Courier New, monospace' }}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => deleteFilm(film.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded text-sm font-semibold"
                        style={{ fontFamily: 'Courier New, monospace' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ADD FILM MODAL */}
      {showAddFilm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
              Add New Film
            </h3>
            <form onSubmit={addFilm} className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Title *</label>
                <input type="text" value={newFilm.title} onChange={(e) => setNewFilm({...newFilm, title: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Subtitle</label>
                <input type="text" value={newFilm.subtitle} onChange={(e) => setNewFilm({...newFilm, subtitle: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Movie Poster *</label>
                <div className="space-y-2">
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'film')} className="block" />
                  <div className="text-sm text-gray-500">or</div>
                  <input type="url" placeholder="Image URL" value={newFilm.image} onChange={(e) => setNewFilm({...newFilm, image: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>BMN Event Poster</label>
                <div className="space-y-2">
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'eventPoster')} className="block" />
                  <div className="text-sm text-gray-500">or</div>
                  <input type="url" placeholder="Event Poster URL" value={newFilm.eventPoster} onChange={(e) => setNewFilm({...newFilm, eventPoster: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>RT Score</label>
                <input type="number" min="0" max="100" value={newFilm.rtScore} onChange={(e) => setNewFilm({...newFilm, rtScore: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Popcorn Score</label>
                <input type="number" min="0" max="100" value={newFilm.popcornScore} onChange={(e) => setNewFilm({...newFilm, popcornScore: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
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
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Trailer URL (YouTube)</label>
                <input type="url" value={newFilm.trailer} onChange={(e) => setNewFilm({...newFilm, trailer: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={newFilm.isUpcoming} onChange={(e) => setNewFilm({...newFilm, isUpcoming: e.target.checked})} />
                  <span style={{ fontFamily: 'Courier New, monospace' }}>Upcoming Screening (not yet revealed)</span>
                </label>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 py-2 rounded-lg text-white font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }} disabled={uploadingImage}>
                  {uploadingImage ? 'Uploading...' : 'Add Film'}
                </button>
                <button type="button" onClick={() => setShowAddFilm(false)} className="flex-1 py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400" style={{ fontFamily: 'Courier New, monospace' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT FILM MODAL */}
      {editingFilm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
              Edit Film
            </h3>
            <form onSubmit={updateFilm} className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Title *</label>
                <input type="text" value={editingFilm.title} onChange={(e) => setEditingFilm({...editingFilm, title: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Subtitle</label>
                <input type="text" value={editingFilm.subtitle || ''} onChange={(e) => setEditingFilm({...editingFilm, subtitle: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Movie Poster *</label>
                <div className="space-y-2">
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'editFilm')} className="block" />
                  <div className="text-sm text-gray-500">or</div>
                  <input type="url" placeholder="Image URL" value={editingFilm.image} onChange={(e) => setEditingFilm({...editingFilm, image: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>BMN Event Poster</label>
                <div className="space-y-2">
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'editEventPoster')} className="block" />
                  <div className="text-sm text-gray-500">or</div>
                  <input type="url" placeholder="Event Poster URL" value={editingFilm.eventPoster || ''} onChange={(e) => setEditingFilm({...editingFilm, eventPoster: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>RT Score</label>
                <input type="number" min="0" max="100" value={editingFilm.rtScore} onChange={(e) => setEditingFilm({...editingFilm, rtScore: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Popcorn Score</label>
                <input type="number" min="0" max="100" value={editingFilm.popcornScore} onChange={(e) => setEditingFilm({...editingFilm, popcornScore: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>BMN Score</label>
                <input type="number" min="0" max="100" value={editingFilm.bmnScore} onChange={(e) => setEditingFilm({...editingFilm, bmnScore: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Date *</label>
                <input type="date" value={editingFilm.date} onChange={(e) => setEditingFilm({...editingFilm, date: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Emoji *</label>
                <input type="text" value={editingFilm.emoji} onChange={(e) => setEditingFilm({...editingFilm, emoji: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Trailer URL (YouTube)</label>
                <input type="url" value={editingFilm.trailer || ''} onChange={(e) => setEditingFilm({...editingFilm, trailer: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editingFilm.isUpcoming || false} onChange={(e) => setEditingFilm({...editingFilm, isUpcoming: e.target.checked})} />
                  <span style={{ fontFamily: 'Courier New, monospace' }}>Upcoming Screening</span>
                </label>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 py-2 rounded-lg text-white font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }} disabled={uploadingImage}>
                  {uploadingImage ? 'Uploading...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditingFilm(null)} className="flex-1 py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400" style={{ fontFamily: 'Courier New, monospace' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {editingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
              Edit Profile
            </h3>
            <form onSubmit={updateMemberProfile} className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Name *</label>
                <input type="text" value={editingProfile.name} onChange={(e) => setEditingProfile({...editingProfile, name: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Title *</label>
                <input type="text" value={editingProfile.title} onChange={(e) => setEditingProfile({...editingProfile, title: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Bio</label>
                <textarea value={editingProfile.bio || ''} onChange={(e) => setEditingProfile({...editingProfile, bio: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} rows="3" />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Profile Image URL</label>
                <input type="url" value={editingProfile.image} onChange={(e) => setEditingProfile({...editingProfile, image: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 py-2 rounded-lg text-white font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}>Save Changes</button>
                <button type="button" onClick={() => setEditingProfile(null)} className="flex-1 py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400" style={{ fontFamily: 'Courier New, monospace' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBMIT MOVIE MODAL */}
      {showSubmitMovie && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
              Submit a Movie for Voting
            </h3>
            {!showTmdbSearch ? (
              <form onSubmit={submitMovieSubmission} className="space-y-4">
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

// INITIAL DATA FUNCTIONS
function getInitialFilms() {
  return [
    {
      id: '1', 
      title: "Beach Kings", 
      type: "bmn", 
      subtitle: "Beach Kings", 
      image: "https://m.media-amazon.com/images/I/91AqeB8kZTL._UF350,350_QL50_.jpg", 
      rtScore: 45, 
      popcornScore: 38, 
      bmnScore: 0, 
      date: "2023-08-31", 
      emoji: "🏐", 
      trailer: "", 
      eventPoster: "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2FBMN12b.jpg?alt=media&token=6e20a116-2381-470e-9e86-e6ceb8f19890",
      isUpcoming: false
    },
    {
      id: '2', 
      title: "Toxic Shark", 
      type: "bmn", 
      subtitle: "Toxic Shark", 
      image: "https://m.media-amazon.com/images/M/MV5BMmEwNWU5OTEtOWE1Ny00YTE1LWFhY2YtNTYyMDYwNjdjYTQyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg", 
      rtScore: 31, 
      popcornScore: 25, 
      bmnScore: 0, 
      date: "2023-09-26", 
      emoji: "🦈", 
      trailer: "", 
      eventPoster: "https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2FBMN12b.jpg?alt=media&token=6e20a116-2381-470e-9e86-e6ceb8f19890",
      isUpcoming: false
    }
  ];
}

function getInitialMembers() {
  return [
    {
      id: 'matt', 
      name: "Matt Dernlan", 
      title: "District Manager of Video", 
      image: "https://i.pravatar.cc/150?img=33", 
      bio: "Founding member and curator of cinematic disasters.", 
      emojis: ["🏐", "🦈", "❄️", "🎄", "🤖"]
    },
    {
      id: 'gabe', 
      name: "Gabe Kovacs", 
      title: "Laughs Engineer", 
      image: "https://i.pravatar.cc/150?img=13", 
      bio: "Engineered precision laughter.", 
      emojis: ["🏐", "🦈", "❄️", "🤖"]
    },
    {
      id: 'colin', 
      name: "Colin Sherman", 
      title: "Chief Research Officer", 
      image: "https://i.pravatar.cc/150?img=52", 
      bio: "Researches every disaster film.", 
      emojis: ["🏐", "🦈", "❄️"]
    },
    {
      id: 'ryan', 
      name: "Ryan Pfleiderer", 
      title: "Anime Lead", 
      image: "https://i.pravatar.cc/150?img=8", 
      bio: "Brings anime-level dramatic commentary.", 
      emojis: ["🏐", "🦈", "❄️", "🤖"]
    },
    {
      id: 'hunter', 
      name: "Hunter Rising", 
      title: "Senior VP of Boardology", 
      image: "https://i.pravatar.cc/150?img=12", 
      bio: "Expert in identifying plot holes.", 
      emojis: ["🏐", "🦈", "❄️", "🎄", "🤖"]
    },
    {
      id: 'max', 
      name: "Max Stenstrom", 
      title: "Viticulture Team Lead", 
      image: "https://i.pravatar.cc/150?img=59", 
      bio: "Pairs wine with terrible movies.", 
      emojis: ["🌪️", "🪐"]
    },
    {
      id: 'james', 
      name: "James Burg", 
      title: "Quips Lead", 
      image: "https://i.pravatar.cc/150?img=68", 
      bio: "Delivers perfectly timed one-liners.", 
      emojis: ["🏐", "🦈", "❄️"]
    }
  ];
}

export default App;
