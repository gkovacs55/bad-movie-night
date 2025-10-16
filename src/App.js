import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  query,
  orderBy,
  Timestamp,
  setDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';

// CORRECT Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyC3-64R8gqBK4rTTfrX8ziKnY90YoWCJAU",
  authDomain: "bad-movie-night-835d5.firebaseapp.com",
  projectId: "bad-movie-night-835d5",
  storageBucket: "bad-movie-night-835d5.firebasestorage.app",
  messagingSenderId: "154194917027",
  appId: "1:154194917027:web:157f4416ff5b026ea7f116",
  measurementId: "G-70YGK3G3K5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const TMDB_API_KEY = '64458ed9df2d961fa32ee1deabaf1b5d';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedFilm, setSelectedFilm] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [films, setFilms] = useState([]);
  const [members, setMembers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [upcomingScreenings, setUpcomingScreenings] = useState([]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  
  const [showAddFilm, setShowAddFilm] = useState(false);
  const [showEditFilm, setShowEditFilm] = useState(false);
  const [showAddSubmission, setShowAddSubmission] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAddScreening, setShowAddScreening] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);
  
  const [filmForm, setFilmForm] = useState({
    title: '', year: '', genre: '', runtime: '', plot: '',
    posterUrl: '', tmdbId: '', screeningDate: '',
    eventPosterUrl: '', trailerUrl: '', spotifyUrl: '', votes: []
  });
  
  const [submissionForm, setSubmissionForm] = useState({
    title: '', year: '', posterUrl: '', trailerUrl: '', reason: '', tmdbId: ''
  });
  
  const [profileForm, setProfileForm] = useState({
    displayName: '', bio: '', photoURL: ''
  });
  
  const [screeningForm, setScreeningForm] = useState({
    date: '', eventPosterUrl: '', title: ''
  });
  
  const [voteForm, setVoteForm] = useState({
    rating: 5, review: '', badges: []
  });
  
  const [tmdbSearch, setTmdbSearch] = useState('');
  const [tmdbResults, setTmdbResults] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const memberDoc = await getDoc(doc(db, 'members', currentUser.uid));
        if (memberDoc.exists()) {
          const memberData = { id: currentUser.uid, ...memberDoc.data() };
          setCurrentMember(memberData);
          setIsAdmin(memberData.isAdmin || false);
        }
      } else {
        setIsAdmin(false);
        setCurrentMember(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) loadAllData();
  }, [user]);

  useEffect(() => {
    const handlePopState = (e) => {
      if (currentPage !== 'home') {
        e.preventDefault();
        setCurrentPage('home');
        setSelectedFilm(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    if (currentPage !== 'home') {
      window.history.pushState({ page: currentPage }, '', `#${currentPage}`);
    }
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentPage]);

  const loadAllData = async () => {
    try {
      await Promise.all([
        loadFilms(),
        loadMembers(),
        loadSubmissions(),
        loadUpcomingScreenings()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadFilms = async () => {
    const snapshot = await getDocs(query(collection(db, 'films'), orderBy('screeningDate', 'desc')));
    setFilms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const loadMembers = async () => {
    const snapshot = await getDocs(collection(db, 'members'));
    setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const loadSubmissions = async () => {
    const snapshot = await getDocs(collection(db, 'submissions'));
    setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const loadUpcomingScreenings = async () => {
    const snapshot = await getDocs(query(collection(db, 'upcomingScreenings'), orderBy('date', 'asc')));
    setUpcomingScreenings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const calculateBMNScore = (film) => {
    if (!film.votes || film.votes.length === 0) return 0;
    const sum = film.votes.reduce((acc, vote) => acc + vote.rating, 0);
    return (sum / film.votes.length).toFixed(1);
  };

  const getUnreviewedFilms = (memberId) => {
    return films.filter(film => {
      const hasWatched = film.attendees?.includes(memberId);
      const hasVoted = film.votes?.some(vote => vote.memberId === memberId);
      return hasWatched && !hasVoted;
    });
  };

  const isUpcomingScreening = (film) => {
    if (!film.screeningDate) return false;
    const screeningDate = film.screeningDate.toDate ? film.screeningDate.toDate() : new Date(film.screeningDate);
    return screeningDate > new Date();
  };

  const navigateTo = (page, data = null) => {
    setCurrentPage(page);
    if (data && page === 'film') setSelectedFilm(data);
    setMobileMenuOpen(false);
  };

  const goBack = () => window.history.back();

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'members', userCredential.user.uid), {
          email: email,
          displayName: email.split('@')[0],
          joinedAt: Timestamp.now(),
          isAdmin: false,
          photoURL: `https://i.pravatar.cc/150?u=${email}`,
          bio: '',
          badges: []
        });
      }
      setEmail('');
      setPassword('');
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentPage('home');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const searchTMDB = async (searchTerm) => {
    if (!searchTerm.trim()) return;
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchTerm)}`
      );
      const data = await response.json();
      setTmdbResults(data.results || []);
    } catch (error) {
      console.error('TMDB search error:', error);
    }
  };

  const selectTMDBMovie = async (movie) => {
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/movie/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=videos`
      );
      const details = await response.json();
      const trailer = details.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '';
      
      if (showAddFilm || showEditFilm) {
        setFilmForm(prev => ({
          ...prev,
          title: details.title,
          year: details.release_date?.split('-')[0] || '',
          genre: details.genres?.map(g => g.name).join(', ') || '',
          runtime: details.runtime ? `${details.runtime} min` : '',
          plot: details.overview,
          posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '',
          tmdbId: details.id.toString(),
          trailerUrl: trailerUrl
        }));
      } else if (showAddSubmission) {
        setSubmissionForm(prev => ({
          ...prev,
          title: details.title,
          year: details.release_date?.split('-')[0] || '',
          posterUrl: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '',
          tmdbId: details.id.toString(),
          trailerUrl: trailerUrl
        }));
      }
      setTmdbResults([]);
      setTmdbSearch('');
    } catch (error) {
      console.error('Error fetching movie details:', error);
    }
  };

  const handleFileUpload = async (file, fieldName, formSetter) => {
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      formSetter(prev => ({ ...prev, [fieldName]: url }));
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  const handleAddFilm = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'films'), {
        ...filmForm,
        screeningDate: filmForm.screeningDate ? Timestamp.fromDate(new Date(filmForm.screeningDate)) : Timestamp.now(),
        addedAt: Timestamp.now(),
        addedBy: user.uid,
        attendees: [],
        votes: []
      });
      await loadFilms();
      setShowAddFilm(false);
      setFilmForm({
        title: '', year: '', genre: '', runtime: '', plot: '',
        posterUrl: '', tmdbId: '', screeningDate: '',
        eventPosterUrl: '', trailerUrl: '', spotifyUrl: '', votes: []
      });
    } catch (error) {
      console.error('Error adding film:', error);
      alert('Error adding film');
    }
  };

  const handleEditFilm = async (e) => {
    e.preventDefault();
    try {
      const filmRef = doc(db, 'films', selectedFilm.id);
      await updateDoc(filmRef, {
        ...filmForm,
        screeningDate: filmForm.screeningDate ? Timestamp.fromDate(new Date(filmForm.screeningDate)) : selectedFilm.screeningDate
      });
      await loadFilms();
      setShowEditFilm(false);
    } catch (error) {
      console.error('Error updating film:', error);
      alert('Error updating film');
    }
  };

  const handleDeleteFilm = async (filmId) => {
    if (!window.confirm('Delete this film?')) return;
    try {
      await deleteDoc(doc(db, 'films', filmId));
      await loadFilms();
      setCurrentPage('home');
    } catch (error) {
      console.error('Error deleting film:', error);
    }
  };

  const handleAddSubmission = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'submissions'), {
        ...submissionForm,
        submittedBy: user.uid,
        submittedByName: currentMember.displayName,
        submittedAt: Timestamp.now(),
        upvotes: [],
        downvotes: [],
        comments: []
      });
      await loadSubmissions();
      setShowAddSubmission(false);
      setSubmissionForm({
        title: '', year: '', posterUrl: '', trailerUrl: '', reason: '', tmdbId: ''
      });
    } catch (error) {
      console.error('Error adding submission:', error);
      alert('Error adding submission');
    }
  };

  const handleDeleteSubmission = async (submissionId) => {
    if (!window.confirm('Delete this submission?')) return;
    try {
      await deleteDoc(doc(db, 'submissions', submissionId));
      await loadSubmissions();
    } catch (error) {
      console.error('Error deleting submission:', error);
    }
  };

  const handleVoteSubmission = async (submissionId, voteType) => {
    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      const submission = submissions.find(s => s.id === submissionId);
      const hasUpvoted = submission.upvotes?.includes(user.uid);
      const hasDownvoted = submission.downvotes?.includes(user.uid);
      
      if (voteType === 'up') {
        if (hasUpvoted) {
          await updateDoc(submissionRef, { upvotes: arrayRemove(user.uid) });
        } else {
          await updateDoc(submissionRef, { 
            upvotes: arrayUnion(user.uid),
            downvotes: arrayRemove(user.uid)
          });
        }
      } else {
        if (hasDownvoted) {
          await updateDoc(submissionRef, { downvotes: arrayRemove(user.uid) });
        } else {
          await updateDoc(submissionRef, { 
            downvotes: arrayUnion(user.uid),
            upvotes: arrayRemove(user.uid)
          });
        }
      }
      await loadSubmissions();
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleAddComment = async (submissionId, comment) => {
    if (!comment.trim()) return;
    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      await updateDoc(submissionRef, {
        comments: arrayUnion({
          text: comment,
          authorId: user.uid,
          authorName: currentMember.displayName,
          createdAt: new Date().toISOString()
        })
      });
      await loadSubmissions();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleSubmitVote = async (e) => {
    e.preventDefault();
    try {
      const filmRef = doc(db, 'films', selectedFilm.id);
      const vote = {
        memberId: user.uid,
        memberName: currentMember.displayName,
        rating: parseFloat(voteForm.rating),
        review: voteForm.review,
        badges: voteForm.badges,
        createdAt: Timestamp.now()
      };
      await updateDoc(filmRef, {
        votes: arrayUnion(vote)
      });
      await loadFilms();
      setShowVoteModal(false);
      setVoteForm({ rating: 5, review: '', badges: [] });
    } catch (error) {
      console.error('Error submitting vote:', error);
      alert('Error submitting vote');
    }
  };

  const toggleBadge = (badge) => {
    setVoteForm(prev => ({
      ...prev,
      badges: prev.badges.includes(badge)
        ? prev.badges.filter(b => b !== badge)
        : [...prev.badges, badge]
    }));
  };

  const handleEditProfile = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'members', user.uid), profileForm);
      await loadMembers();
      setShowEditProfile(false);
      const memberDoc = await getDoc(doc(db, 'members', user.uid));
      if (memberDoc.exists()) {
        setCurrentMember({ id: user.uid, ...memberDoc.data() });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile');
    }
  };

  const openEditProfile = () => {
    setProfileForm({
      displayName: currentMember.displayName || '',
      bio: currentMember.bio || '',
      photoURL: currentMember.photoURL || ''
    });
    setShowEditProfile(true);
  };

  const handleAddScreening = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'upcomingScreenings'), {
        ...screeningForm,
        date: Timestamp.fromDate(new Date(screeningForm.date)),
        addedBy: user.uid,
        addedAt: Timestamp.now()
      });
      await loadUpcomingScreenings();
      setShowAddScreening(false);
      setScreeningForm({ date: '', eventPosterUrl: '', title: '' });
    } catch (error) {
      console.error('Error adding screening:', error);
      alert('Error adding screening');
    }
  };

  const handleDeleteScreening = async (screeningId) => {
    if (!window.confirm('Delete this screening?')) return;
    try {
      await deleteDoc(doc(db, 'upcomingScreenings', screeningId));
      await loadUpcomingScreenings();
    } catch (error) {
      console.error('Error deleting screening:', error);
    }
  };

  const getMemberStats = (memberId) => {
    const memberFilms = films.filter(f => f.attendees?.includes(memberId));
    const memberVotes = films.flatMap(f => f.votes || []).filter(v => v.memberId === memberId);
    const avgRating = memberVotes.length > 0
      ? (memberVotes.reduce((sum, v) => sum + v.rating, 0) / memberVotes.length).toFixed(1)
      : 0;
    return {
      filmsWatched: memberFilms.length,
      reviewsGiven: memberVotes.length,
      avgRating: avgRating,
      badges: memberVotes.flatMap(v => v.badges || [])
    };
  };

  const getLeaderboard = () => {
    return members.map(member => {
      const stats = getMemberStats(member.id);
      const points = (stats.filmsWatched * 10) + (stats.reviewsGiven * 20) + (stats.badges.length * 5);
      return { ...member, ...stats, points };
    }).sort((a, b) => b.points - a.points);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'TBA';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  const getSpotifyEmbedUrl = (url) => {
    if (!url) return null;
    let playlistId;
    if (url.includes('open.spotify.com/playlist/')) {
      playlistId = url.split('playlist/')[1]?.split('?')[0];
    } else if (url.includes('spotify:playlist:')) {
      playlistId = url.split('spotify:playlist:')[1];
    }
    return playlistId ? `https://open.spotify.com/embed/playlist/${playlistId}` : null;
  };

  const getMemberById = (memberId) => members.find(m => m.id === memberId);

  const getFilmByBadge = (badge, memberId) => {
    for (const film of films) {
      const vote = film.votes?.find(v => v.memberId === memberId && v.badges?.includes(badge));
      if (vote) return film;
    }
    return null;
  };

  const openAddFilm = () => {
    setFilmForm({
      title: '', year: '', genre: '', runtime: '', plot: '',
      posterUrl: '', tmdbId: '', screeningDate: '',
      eventPosterUrl: '', trailerUrl: '', spotifyUrl: '', votes: []
    });
    setShowAddFilm(true);
  };

  const openEditFilm = (film) => {
    setFilmForm({
      title: film.title || '',
      year: film.year || '',
      genre: film.genre || '',
      runtime: film.runtime || '',
      plot: film.plot || '',
      posterUrl: film.posterUrl || '',
      tmdbId: film.tmdbId || '',
      screeningDate: film.screeningDate?.toDate ? film.screeningDate.toDate().toISOString().split('T')[0] : '',
      eventPosterUrl: film.eventPosterUrl || '',
      trailerUrl: film.trailerUrl || '',
      spotifyUrl: film.spotifyUrl || '',
      votes: film.votes || []
    });
    setShowEditFilm(true);
  };

  const openVoteModal = (film) => {
    setSelectedFilm(film);
    setVoteForm({ rating: 5, review: '', badges: [] });
    setShowVoteModal(true);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #f8f9fb 0%, #e8ecf1 100%)'
      }}>
        <div style={{
          fontSize: '48px',
          fontWeight: '900',
          background: 'linear-gradient(135deg, #31394d 0%, #009384 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontFamily: 'Courier New, monospace'
        }}>
          Loading...
        </div>
      </div>
    );
  }

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #f8f9fb; color: #1a1d29; overflow-x: hidden; }
    h1, h2, h3, .logo, .hero-title { font-family: 'Courier New', monospace; font-weight: 700; }
    .blob { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.12; z-index: 0; pointer-events: none; animation: float 25s ease-in-out infinite; }
    .blob-1 { width: 500px; height: 500px; background: #009384; top: -150px; left: -150px; animation-delay: 0s; }
    .blob-2 { width: 600px; height: 600px; background: #31394d; bottom: -200px; right: -200px; animation-delay: 8s; }
    .blob-3 { width: 400px; height: 400px; background: #009384; top: 40%; right: -150px; animation-delay: 16s; }
    @keyframes float { 0%, 100% { transform: translate(0, 0); } 33% { transform: translate(40px, -40px); } 66% { transform: translate(-30px, 30px); } }
    .login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background-image: url('https://firebasestorage.googleapis.com/v0/b/bad-movie-night-835d5.firebasestorage.app/o/members%2Fuploads%2FSPLASH%20SCREEN%20001.png?alt=media&token=0ad0ed4d-8c85-4d4a-87bd-4f133dbb94e8'); background-size: cover; background-position: center; position: relative; }
    .login-page::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(49, 57, 77, 0.75); backdrop-filter: blur(4px); }
    .login-card { position: relative; z-index: 1; background: white; border-radius: 32px; padding: 48px; max-width: 450px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .login-logo { font-size: 64px; text-align: center; margin-bottom: 16px; }
    .login-title { font-size: 36px; text-align: center; margin-bottom: 8px; background: linear-gradient(135deg, #31394d 0%, #009384 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .login-subtitle { text-align: center; color: #6b7280; margin-bottom: 20px; font-size: 15px; }
    .login-badge { text-align: center; color: #009384; font-weight: 700; font-size: 13px; margin-bottom: 32px; text-transform: uppercase; letter-spacing: 1px; }
    .header { background: white; padding: 16px 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 999; }
    .logo { font-size: 24px; font-weight: 900; background: linear-gradient(135deg, #31394d 0%, #009384 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; cursor: pointer; }
    .logo::before { content: '🎬'; -webkit-text-fill-color: initial; margin-right: 8px; }
    .nav-menu { display: flex; gap: 8px; list-style: none; }
    .nav-link { padding: 10px 20px; border-radius: 12px; font-weight: 600; color: #1a1d29; transition: all 0.3s; cursor: pointer; font-size: 14px; }
    .nav-link:hover, .nav-link.active { background: linear-gradient(135deg, rgba(49,57,77,0.1) 0%, rgba(0,147,132,0.1) 100%); color: #009384; }
    .hamburger { display: none; flex-direction: column; gap: 4px; cursor: pointer; padding: 8px; }
    .hamburger span { width: 24px; height: 3px; background: #31394d; border-radius: 2px; }
    .mobile-menu { display: none; position: fixed; top: 70px; left: 0; right: 0; background: white; box-shadow: 0 8px 30px rgba(0,0,0,0.12); padding: 20px; z-index: 998; }
    .mobile-menu.open { display: block; }
    .mobile-menu .nav-link { display: block; padding: 16px; margin-bottom: 8px; }
    .btn { padding: 12px 28px; border: none; border-radius: 50px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.3s; display: inline-flex; align-items: center; gap: 8px; }
    .btn-primary { background: linear-gradient(135deg, #31394d 0%, #009384 100%); color: white; box-shadow: 0 8px 40px rgba(0,147,132,0.25); }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 50px rgba(0,147,132,0.4); }
    .btn-secondary { background: white; color: #31394d; border: 2px solid #31394d; }
    .btn-secondary:hover { background: #31394d; color: white; }
    .btn-danger { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; }
    .btn-small { padding: 8px 16px; font-size: 13px; }
    .card { background: white; border-radius: 20px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 24px; position: relative; }
    .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(135deg, #31394d 0%, #009384 100%); border-radius: 20px 20px 0 0; }
    .form-group { margin-bottom: 24px; }
    .form-label { display: block; font-weight: 600; margin-bottom: 8px; color: #1a1d29; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .form-input, .form-textarea { width: 100%; padding: 14px 18px; border: 2px solid #e5e7eb; border-radius: 14px; font-size: 15px; font-family: 'Inter', sans-serif; transition: all 0.3s; background: white; }
    .form-input:focus, .form-textarea:focus { outline: none; border-color: #009384; box-shadow: 0 0 0 4px rgba(0,147,132,0.1); }
    .form-textarea { min-height: 120px; resize: vertical; }
    .container { max-width: 1400px; margin: 0 auto; padding: 32px 24px; position: relative; z-index: 1; }
    .hero { text-align: center; padding: 60px 20px; margin-bottom: 40px; }
    .hero-title { font-size: 56px; font-weight: 900; margin-bottom: 16px; background: linear-gradient(135deg, #31394d 0%, #009384 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero-subtitle { font-size: 18px; color: #6b7280; max-width: 600px; margin: 0 auto 32px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .stat-card { background: white; border-radius: 18px; padding: 24px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.3s; }
    .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(135deg, #31394d 0%, #009384 100%); }
    .stat-card:hover { transform: translateY(-4px); box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .stat-value { font-size: 42px; font-weight: 900; background: linear-gradient(135deg, #31394d 0%, #009384 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; font-family: 'Courier New', monospace; }
    .stat-label { font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .movie-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 24px; margin-top: 32px; }
    .movie-card { background: white; border-radius: 18px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.4s; cursor: pointer; position: relative; }
    .movie-card:hover { transform: translateY(-8px); box-shadow: 0 8px 30px rgba(0,0,0,0.12); }
    .movie-card.upcoming { border: 3px solid #009384; animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(0,147,132,0.4); } 50% { box-shadow: 0 0 0 10px rgba(0,147,132,0); } }
    .upcoming-badge { position: absolute; top: 12px; right: 12px; background: linear-gradient(135deg, #31394d 0%, #009384 100%); color: white; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; z-index: 2; text-transform: uppercase; }
    .movie-poster { width: 100%; aspect-ratio: 2/3; object-fit: cover; }
    .movie-info { padding: 18px; }
    .movie-title { font-size: 17px; font-weight: 700; margin-bottom: 8px; font-family: 'Courier New', monospace; }
    .movie-meta { display: flex; gap: 10px; font-size: 13px; color: #6b7280; margin-bottom: 12px; }
    .bmn-score { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: linear-gradient(135deg, rgba(49,57,77,0.1) 0%, rgba(0,147,132,0.1) 100%); border-radius: 12px; font-weight: 700; color: #009384; }
    .leaderboard-item { background: white; border-radius: 18px; padding: 24px; margin-bottom: 16px; display: flex; align-items: center; gap: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.3s; }
    .leaderboard-item:hover { transform: translateX(8px); box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .rank { font-size: 28px; font-weight: 900; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(49,57,77,0.1) 0%, rgba(0,147,132,0.1) 100%); border-radius: 14px; color: #009384; font-family: 'Courier New', monospace; }
    .rank-1 { background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: white; }
    .rank-2 { background: linear-gradient(135deg, #C0C0C0 0%, #808080 100%); color: white; }
    .rank-3 { background: linear-gradient(135deg, #CD7F32 0%, #8B4513 100%); color: white; }
    .member-avatar { width: 65px; height: 65px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .member-info { flex: 1; }
    .member-name { font-size: 19px; font-weight: 700; margin-bottom: 6px; font-family: 'Courier New', monospace; }
    .member-stats { display: flex; gap: 12px; flex-wrap: wrap; }
    .stat-badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; background: linear-gradient(135deg, rgba(49,57,77,0.1) 0%, rgba(0,147,132,0.1) 100%); border-radius: 10px; font-weight: 600; color: #009384; font-size: 12px; }
    .badge { display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.3s; }
    .badge:hover { transform: scale(1.05); }
    .badge.active { background: linear-gradient(135deg, #31394d 0%, #009384 100%); color: white; }
    .badge.inactive { background: #f3f4f6; color: #6b7280; }
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px; }
    .modal { background: white; border-radius: 24px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .modal-header { padding: 28px 32px; border-bottom: 2px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; }
    .modal-title { font-size: 26px; font-weight: 900; background: linear-gradient(135deg, #31394d 0%, #009384 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .modal-close { background: none; border: none; font-size: 28px; cursor: pointer; color: #6b7280; }
    .modal-close:hover { color: #1a1d29; }
    .modal-body { padding: 32px; }
    .tmdb-results { max-height: 300px; overflow-y: auto; border: 2px solid #e5e7eb; border-radius: 12px; margin-top: 12px; }
    .tmdb-result { padding: 12px; display: flex; gap: 12px; cursor: pointer; transition: all 0.2s; border-bottom: 1px solid #f3f4f6; }
    .tmdb-result:hover { background: linear-gradient(135deg, rgba(49,57,77,0.05) 0%, rgba(0,147,132,0.05) 100%); }
    .tmdb-poster { width: 50px; height: 75px; object-fit: cover; border-radius: 6px; }
    .tmdb-info { flex: 1; }
    .tmdb-title { font-weight: 600; margin-bottom: 4px; }
    .tmdb-year { font-size: 13px; color: #6b7280; }
    .upload-area { border: 3px dashed #e5e7eb; border-radius: 16px; padding: 32px; text-align: center; transition: all 0.3s; cursor: pointer; background: linear-gradient(135deg, rgba(49,57,77,0.02) 0%, rgba(0,147,132,0.02) 100%); }
    .upload-area:hover { border-color: #009384; }
    .film-header { display: grid; grid-template-columns: 220px 1fr; gap: 32px; margin-bottom: 32px; }
    .film-poster-large { width: 100%; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); }
    .media-embed { aspect-ratio: 16/9; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.12); margin: 24px 0; }
    .media-embed iframe { width: 100%; height: 100%; border: none; }
    .spotify-embed { height: 380px; }
    .submission-card { background: white; border-radius: 18px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.3s; border-left: 4px solid transparent; }
    .submission-card:hover { border-left-color: #009384; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .submission-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px; }
    .submitter { display: flex; align-items: center; gap: 12px; }
    .submitter-avatar { width: 45px; height: 45px; border-radius: 50%; border: 2px solid #009384; }
    .vote-buttons { display: flex; gap: 8px; }
    .vote-btn { padding: 8px 16px; border: 2px solid #e5e7eb; border-radius: 10px; background: white; cursor: pointer; font-weight: 600; transition: all 0.3s; }
    .vote-btn:hover { border-color: #009384; }
    .vote-btn.voted { background: linear-gradient(135deg, #31394d 0%, #009384 100%); color: white; border-color: #009384; }
    .comments-section { margin-top: 16px; padding-top: 16px; border-top: 2px dashed #e5e7eb; }
    .comment { background: #f8f9fb; padding: 12px 16px; border-radius: 10px; margin-bottom: 8px; }
    .comment-author { font-weight: 600; color: #009384; margin-bottom: 4px; font-size: 13px; }
    .divider { height: 2px; background: linear-gradient(90deg, transparent, #e5e7eb, transparent); margin: 32px 0; }
    @media (max-width: 768px) {
      .nav-menu { display: none; }
      .hamburger { display: flex; }
      .hero-title { font-size: 36px; }
      .film-header { grid-template-columns: 1fr; }
      .movie-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `;

  if (!user) {
    return (
      <>
        <style>{styles}</style>
        <div className="login-page">
          <div className="login-card">
            <div className="login-logo">🎬</div>
            <h1 className="login-title">Bad Movie Night</h1>
            <p className="login-subtitle">Where Terrible Movies Become Legendary</p>
            <p className="login-badge">🎬 EXCLUSIVE • INVITE ONLY • MEMBERS ONLY 🎬</p>
            <form onSubmit={handleAuth}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" className="form-input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '24px', color: '#6b7280' }}>
              {authMode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <span onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')} style={{ color: '#009384', fontWeight: '600', cursor: 'pointer' }}>
                {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
              </span>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>

      <div className="header">
        <div className="logo" onClick={() => navigateTo('home')}>Bad Movie Night</div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <ul className="nav-menu">
            <li><div className={`nav-link ${currentPage === 'home' ? 'active' : ''}`} onClick={() => navigateTo('home')}>Home</div></li>
            <li><div className={`nav-link ${currentPage === 'upnext' ? 'active' : ''}`} onClick={() => navigateTo('upnext')}>Up Next</div></li>
            <li><div className={`nav-link ${currentPage === 'leaderboard' ? 'active' : ''}`} onClick={() => navigateTo('leaderboard')}>Leaderboard</div></li>
            <li><div className={`nav-link ${currentPage === 'profile' ? 'active' : ''}`} onClick={() => navigateTo('profile')}>Profile</div></li>
            {isAdmin && <li><div className={`nav-link ${currentPage === 'admin' ? 'active' : ''}`} onClick={() => navigateTo('admin')}>Admin</div></li>}
          </ul>
          <button className="btn btn-secondary btn-small" onClick={handleSignOut}>Sign Out</button>
          <div className="hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <span></span><span></span><span></span>
          </div>
        </nav>
      </div>

      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="nav-link" onClick={() => navigateTo('home')}>Home</div>
        <div className="nav-link" onClick={() => navigateTo('upnext')}>Up Next</div>
        <div className="nav-link" onClick={() => navigateTo('leaderboard')}>Leaderboard</div>
        <div className="nav-link" onClick={() => navigateTo('profile')}>Profile</div>
        {isAdmin && <div className="nav-link" onClick={() => navigateTo('admin')}>Admin</div>}
      </div>

      <div className="container">
       // PASTE THIS AFTER THE CONTAINER DIV IN PART 1

        {currentPage === 'home' && (
          <>
            <div className="hero">
              <h1 className="hero-title">The Archive</h1>
              <p className="hero-subtitle">Every terrible masterpiece we've endured together</p>
              {isAdmin && <button className="btn btn-primary" onClick={openAddFilm}>+ Add Film</button>}
            </div>

            <div className="stats-grid">
              <div className="stat-card" style={{ position: 'relative' }}>
                <div className="stat-value">{films.length}</div>
                <div className="stat-label">Total Films</div>
              </div>
              <div className="stat-card" style={{ position: 'relative' }}>
                <div className="stat-value">
                  {films.length > 0 ? (films.reduce((sum, f) => sum + parseFloat(calculateBMNScore(f)), 0) / films.length).toFixed(1) : 0}
                </div>
                <div className="stat-label">Avg Rating</div>
              </div>
              <div className="stat-card" style={{ position: 'relative' }}>
                <div className="stat-value">{members.length}</div>
                <div className="stat-label">Members</div>
              </div>
              <div className="stat-card" style={{ position: 'relative' }}>
                <div className="stat-value">
                  {films.reduce((sum, f) => sum + (parseInt(f.runtime) || 0), 0)}
                </div>
                <div className="stat-label">Minutes Watched</div>
              </div>
            </div>

            <div className="movie-grid">
              {films.map((film) => {
                const isUpcoming = isUpcomingScreening(film);
                return (
                  <div key={film.id} className={`movie-card ${isUpcoming ? 'upcoming' : ''}`} onClick={() => navigateTo('film', film)}>
                    {isUpcoming && <div className="upcoming-badge">🎬 Upcoming</div>}
                    <img src={isUpcoming ? film.eventPosterUrl || film.posterUrl : film.posterUrl} alt={film.title} className="movie-poster" />
                    <div className="movie-info">
                      <div className="movie-title">{film.title}</div>
                      <div className="movie-meta">
                        <span>{film.year}</span>
                        {film.genre && <><span>•</span><span>{film.genre.split(',')[0]}</span></>}
                      </div>
                      {!isUpcoming && <div className="bmn-score">⭐ {calculateBMNScore(film)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {currentPage === 'film' && selectedFilm && (
          <>
            <button className="btn btn-secondary" onClick={goBack} style={{ marginBottom: '24px' }}>← Back</button>
            <div className="card">
              <div className="film-header">
                <img src={selectedFilm.posterUrl} alt={selectedFilm.title} className="film-poster-large" />
                <div>
                  <h1 style={{ fontSize: '40px', marginBottom: '16px', background: 'linear-gradient(135deg, #31394d 0%, #009384 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {selectedFilm.title}
                  </h1>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <span className="badge active">{selectedFilm.year}</span>
                    {selectedFilm.genre && <span className="badge active">{selectedFilm.genre}</span>}
                    {selectedFilm.runtime && <span className="badge active">{selectedFilm.runtime}</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                    <div>
                      <div className="stat-label">BMN Score</div>
                      <div className="stat-value" style={{ fontSize: '32px' }}>⭐ {calculateBMNScore(selectedFilm)}</div>
                    </div>
                    <div>
                      <div className="stat-label">Screening Date</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '8px' }}>{formatDate(selectedFilm.screeningDate)}</div>
                    </div>
                  </div>
                  {selectedFilm.plot && <p style={{ color: '#6b7280', lineHeight: '1.7', marginBottom: '20px' }}>{selectedFilm.plot}</p>}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {!selectedFilm.votes?.some(v => v.memberId === user.uid) && (
                      <button className="btn btn-primary" onClick={() => openVoteModal(selectedFilm)}>⭐ Rate & Review</button>
                    )}
                    {isAdmin && (
                      <>
                        <button className="btn btn-secondary" onClick={() => openEditFilm(selectedFilm)}>Edit</button>
                        <button className="btn btn-danger" onClick={() => handleDeleteFilm(selectedFilm.id)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {selectedFilm.eventPosterUrl && (
                <>
                  <div className="divider"></div>
                  <h2 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '24px', fontFamily: 'Courier New, monospace' }}>Event Poster</h2>
                  <img src={selectedFilm.eventPosterUrl} alt="Event Poster" style={{ width: '100%', maxWidth: '450px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }} />
                </>
              )}

              {selectedFilm.trailerUrl && getYouTubeEmbedUrl(selectedFilm.trailerUrl) && (
                <>
                  <div className="divider"></div>
                  <h2 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '24px', fontFamily: 'Courier New, monospace' }}>Trailer</h2>
                  <div className="media-embed">
                    <iframe src={getYouTubeEmbedUrl(selectedFilm.trailerUrl)} allowFullScreen></iframe>
                  </div>
                </>
              )}

              {selectedFilm.spotifyUrl && getSpotifyEmbedUrl(selectedFilm.spotifyUrl) && (
                <>
                  <div className="divider"></div>
                  <h2 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '24px', fontFamily: 'Courier New, monospace' }}>Soundtrack Playlist</h2>
                  <div className="media-embed spotify-embed">
                    <iframe src={getSpotifyEmbedUrl(selectedFilm.spotifyUrl)} allowFullScreen allow="encrypted-media"></iframe>
                  </div>
                </>
              )}

              <div className="divider"></div>
              <h2 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '24px', fontFamily: 'Courier New, monospace' }}>
                Member Reviews ({selectedFilm.votes?.length || 0})
              </h2>

              {selectedFilm.votes && selectedFilm.votes.length > 0 ? (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {selectedFilm.votes.map((vote, idx) => {
                    const member = getMemberById(vote.memberId);
                    return (
                      <div key={idx} className="submission-card">
                        <div className="submission-header">
                          <div className="submitter">
                            <img src={member?.photoURL || `https://i.pravatar.cc/150?u=${vote.memberId}`} className="submitter-avatar" />
                            <div>
                              <div style={{ fontWeight: '700' }}>{vote.memberName}</div>
                              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                {vote.createdAt?.toDate ? formatDate(vote.createdAt) : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: '24px', fontWeight: '900', color: '#009384' }}>⭐ {vote.rating}</div>
                        </div>
                        {vote.review && <p style={{ color: '#6b7280', marginBottom: '12px', lineHeight: '1.6' }}>{vote.review}</p>}
                        {vote.badges && vote.badges.length > 0 && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {vote.badges.map((badge, i) => (
                              <span key={i} className="badge active" style={{ fontSize: '13px' }}>{badge}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No reviews yet. Be the first!</p>
              )}
            </div>
          </>
        )}

        {currentPage === 'upnext' && (
          <>
            <div className="hero">
              <h1 className="hero-title">Up Next</h1>
              <p className="hero-subtitle">Vote for the next masterpiece of disaster</p>
              <button className="btn btn-primary" onClick={() => setShowAddSubmission(true)}>+ Submit Film</button>
            </div>

            {upcomingScreenings.length > 0 && (
              <div className="card" style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '24px', fontFamily: 'Courier New, monospace' }}>
                  Scheduled Screenings
                </h2>
                <div style={{ display: 'grid', gap: '16px' }}>
                  {upcomingScreenings.map((screening) => (
                    <div key={screening.id} className="submission-card" style={{ borderLeftColor: '#009384' }}>
                      <div className="submission-header">
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '18px' }}>{screening.title || 'Mystery Movie 🎬'}</div>
                          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                            Screening Date: {formatDate(screening.date)}
                          </div>
                        </div>
                        {isAdmin && (
                          <button className="btn btn-danger btn-small" onClick={() => handleDeleteScreening(screening.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                      {screening.eventPosterUrl && (
                        <img src={screening.eventPosterUrl} alt="Event Poster" style={{ width: '200px', borderRadius: '12px', marginTop: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '24px', fontFamily: 'Courier New, monospace' }}>
                Current Submissions
              </h2>

              {submissions.length > 0 ? (
                submissions.map((submission) => {
                  const hasUpvoted = submission.upvotes?.includes(user.uid);
                  const hasDownvoted = submission.downvotes?.includes(user.uid);
                  const upvoteCount = submission.upvotes?.length || 0;
                  const downvoteCount = submission.downvotes?.length || 0;

                  return (
                    <div key={submission.id} className="submission-card">
                      <div className="submission-header">
                        <div className="submitter">
                          <img src={getMemberById(submission.submittedBy)?.photoURL || `https://i.pravatar.cc/150?u=${submission.submittedBy}`} className="submitter-avatar" />
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '18px' }}>{submission.title}</div>
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                              Submitted by {submission.submittedByName}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <div className="vote-buttons">
                            <button
                              className={`vote-btn ${hasUpvoted ? 'voted' : ''}`}
                              onClick={() => handleVoteSubmission(submission.id, 'up')}
                              title={submission.upvotes?.map(id => getMemberById(id)?.displayName).filter(Boolean).join(', ')}
                            >
                              👍 {upvoteCount}
                            </button>
                            <button
                              className={`vote-btn ${hasDownvoted ? 'voted' : ''}`}
                              onClick={() => handleVoteSubmission(submission.id, 'down')}
                              title={submission.downvotes?.map(id => getMemberById(id)?.displayName).filter(Boolean).join(', ')}
                            >
                              👎 {downvoteCount}
                            </button>
                          </div>
                          {isAdmin && (
                            <button className="btn btn-danger btn-small" onClick={() => handleDeleteSubmission(submission.id)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '20px', marginTop: '16px' }}>
                        {submission.posterUrl && (
                          <img src={submission.posterUrl} alt={submission.title} style={{ width: '100%', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} />
                        )}
                        <div>
                          {submission.reason && (
                            <p style={{ color: '#6b7280', marginBottom: '12px', lineHeight: '1.6' }}>{submission.reason}</p>
                          )}
                          {submission.year && (
                            <div style={{ marginBottom: '16px' }}>
                              <span className="badge inactive">{submission.year}</span>
                            </div>
                          )}
                          {submission.trailerUrl && getYouTubeEmbedUrl(submission.trailerUrl) && (
                            <div className="media-embed">
                              <iframe src={getYouTubeEmbedUrl(submission.trailerUrl)} allowFullScreen></iframe>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="comments-section">
                        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>
                          Comments ({submission.comments?.length || 0})
                        </h3>
                        {submission.comments && submission.comments.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            {submission.comments.map((comment, idx) => (
                              <div key={idx} className="comment">
                                <div className="comment-author">{comment.authorName}</div>
                                <div style={{ color: '#6b7280', fontSize: '14px' }}>{comment.text}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Add a comment..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                              handleAddComment(submission.id, e.target.value);
                              e.target.value = '';
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p style={{ color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '40px' }}>
                  No submissions yet. Be the first!
                </p>
              )}
            </div>
          </>
        )}

        {currentPage === 'leaderboard' && (
          <>
            <div className="hero">
              <h1 className="hero-title">Hall of Shame</h1>
              <p className="hero-subtitle">Ranking our connoisseurs of cinematic catastrophe</p>
            </div>

            <div className="card">
              {getLeaderboard().map((member, index) => (
                <div key={member.id} className="leaderboard-item">
                  <div className={`rank rank-${index + 1 <= 3 ? index + 1 : ''}`}>{index + 1}</div>
                  <img src={member.photoURL || `https://i.pravatar.cc/150?u=${member.id}`} className="member-avatar" />
                  <div className="member-info">
                    <div className="member-name">{member.displayName}</div>
                    <div className="member-stats">
                      <span className="stat-badge">🎬 {member.filmsWatched}</span>
                      <span className="stat-badge">⭐ {member.avgRating}</span>
                      <span className="stat-badge">📝 {member.reviewsGiven}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#009384', fontFamily: 'Courier New, monospace' }}>
                    {member.points}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {currentPage === 'profile' && currentMember && (
          <>
            <div className="card">
              <div style={{ display: 'flex', gap: '32px', alignItems: 'start', marginBottom: '32px', flexWrap: 'wrap' }}>
                <img
                  src={currentMember.photoURL || `https://i.pravatar.cc/200?u=${user.uid}`}
                  style={{ width: '140px', height: '140px', borderRadius: '50%', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '5px solid white' }}
                />
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '8px', fontFamily: 'Courier New, monospace' }}>
                    {currentMember.displayName}
                  </h1>
                  <p style={{ color: '#6b7280', fontSize: '15px', marginBottom: '16px' }}>
                    {currentMember.bio || 'No bio yet'}
                  </p>
                  <button className="btn btn-primary" onClick={openEditProfile}>Edit Profile</button>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card" style={{ position: 'relative' }}>
                  <div className="stat-value">{getMemberStats(user.uid).filmsWatched}</div>
                  <div className="stat-label">Films Watched</div>
                </div>
                <div className="stat-card" style={{ position: 'relative' }}>
                  <div className="stat-value">{getMemberStats(user.uid).avgRating}</div>
                  <div className="stat-label">Avg Rating</div>
                </div>
                <div className="stat-card" style={{ position: 'relative' }}>
                  <div className="stat-value">{getMemberStats(user.uid).reviewsGiven}</div>
                  <div className="stat-label">Reviews</div>
                </div>
                <div className="stat-card" style={{ position: 'relative' }}>
                  <div className="stat-value">{getMemberStats(user.uid).badges.length}</div>
                  <div className="stat-label">Badges</div>
                </div>
              </div>

              {getUnreviewedFilms(user.uid).length > 0 && (
                <>
                  <div className="divider"></div>
                  <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '16px', fontFamily: 'Courier New, monospace' }}>
                    ⚠️ Unreviewed Films
                  </h2>
                  <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                    You watched these but haven't reviewed them yet!
                  </p>
                  <div className="movie-grid">
                    {getUnreviewedFilms(user.uid).map((film) => (
                      <div key={film.id} className="movie-card" onClick={() => navigateTo('film', film)}>
                        <img src={film.posterUrl} alt={film.title} className="movie-poster" />
                        <div className="movie-info">
                          <div className="movie-title">{film.title}</div>
                          <div className="movie-meta"><span>{film.year}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {getMemberStats(user.uid).badges.length > 0 && (
                <>
                  <div className="divider"></div>
                  <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '16px', fontFamily: 'Courier New, monospace' }}>
                    🏆 Your Badges
                  </h2>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {[...new Set(getMemberStats(user.uid).badges)].map((badge, idx) => {
                      const film = getFilmByBadge(badge, user.uid);
                      return (
                        <span
                          key={idx}
                          className="badge active"
                          onClick={() => film && navigateTo('film', film)}
                          title={film ? `${film.title} - Screening Date: ${formatDate(film.screeningDate)}` : badge}
                          style={{ cursor: 'pointer', fontSize: '15px', padding: '10px 16px' }}
                        >
                          {badge}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="divider"></div>
              <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '16px', fontFamily: 'Courier New, monospace' }}>
                Recent Reviews
              </h2>
              {films
                .filter(f => f.votes?.some(v => v.memberId === user.uid))
                .slice(0, 10)
                .map((film) => {
                  const vote = film.votes.find(v => v.memberId === user.uid);
                  return (
                    <div key={film.id} className="submission-card" onClick={() => navigateTo('film', film)} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <img src={film.posterUrl} style={{ width: '80px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ fontWeight: '700', fontSize: '16px', fontFamily: 'Courier New, monospace' }}>
                              {film.title}
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#009384' }}>
                              ⭐ {vote.rating}
                            </div>
                          </div>
                          {vote.review && (
                            <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>{vote.review}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {currentPage === 'admin' && isAdmin && (
          <>
            <div className="hero">
              <h1 className="hero-title">Admin Panel</h1>
              <p className="hero-subtitle">Manage everything</p>
            </div>

            <div className="card">
              <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '24px', fontFamily: 'Courier New, monospace' }}>
                Quick Actions
              </h2>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={openAddFilm}>+ Add Film</button>
                <button className="btn btn-primary" onClick={() => setShowAddScreening(true)}>+ Schedule Screening</button>
              </div>
            </div>

            <div className="card">
              <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '24px', fontFamily: 'Courier New, monospace' }}>
                All Films ({films.length})
              </h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                {films.map((film) => (
                  <div key={film.id} className="submission-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '16px' }}>{film.title}</div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>
                          Screening Date: {formatDate(film.screeningDate)} • {film.votes?.length || 0} reviews
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-small" onClick={() => { setSelectedFilm(film); openEditFilm(film); }}>
                          Edit
                        </button>
                        <button className="btn btn-danger btn-small" onClick={() => handleDeleteFilm(film.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODALS */}
      {showAddFilm && (
        <div className="modal-overlay" onClick={() => setShowAddFilm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Film</h2>
              <button className="modal-close" onClick={() => setShowAddFilm(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Search TMDB</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search movies..."
                  value={tmdbSearch}
                  onChange={(e) => setTmdbSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchTMDB(tmdbSearch)}
                />
                {tmdbResults.length > 0 && (
                  <div className="tmdb-results">
                    {tmdbResults.map((movie) => (
                      <div key={movie.id} className="tmdb-result" onClick={() => selectTMDBMovie(movie)}>
                        {movie.poster_path && (
                          <img src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`} className="tmdb-poster" />
                        )}
                        <div className="tmdb-info">
                          <div className="tmdb-title">{movie.title}</div>
                          <div className="tmdb-year">{movie.release_date?.split('-')[0]}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleAddFilm}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input type="text" className="form-input" value={filmForm.title} onChange={(e) => setFilmForm({ ...filmForm, title: e.target.value })} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Year</label>
                    <input type="text" className="form-input" value={filmForm.year} onChange={(e) => setFilmForm({ ...filmForm, year: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Runtime</label>
                    <input type="text" className="form-input" value={filmForm.runtime} onChange={(e) => setFilmForm({ ...filmForm, runtime: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Genre</label>
                  <input type="text" className="form-input" value={filmForm.genre} onChange={(e) => setFilmForm({ ...filmForm, genre: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Plot</label>
                  <textarea className="form-textarea" value={filmForm.plot} onChange={(e) => setFilmForm({ ...filmForm, plot: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Screening Date *</label>
                  <input type="date" className="form-input" value={filmForm.screeningDate} onChange={(e) => setFilmForm({ ...filmForm, screeningDate: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Poster URL</label>
                  <input type="url" className="form-input" value={filmForm.posterUrl} onChange={(e) => setFilmForm({ ...filmForm, posterUrl: e.target.value })} />
                  <div className="upload-area" style={{ marginTop: '12px' }}>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e.target.files[0], 'posterUrl', setFilmForm)} style={{ display: 'none' }} id="poster-upload" />
                    <label htmlFor="poster-upload" className="btn btn-secondary btn-small">Upload</label>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Event Poster URL</label>
                  <input type="url" className="form-input" value={filmForm.eventPosterUrl} onChange={(e) => setFilmForm({ ...filmForm, eventPosterUrl: e.target.value })} />
                  <div className="upload-area" style={{ marginTop: '12px' }}>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e.target.files[0], 'eventPosterUrl', setFilmForm)} style={{ display: 'none' }} id="event-upload" />
                    <label htmlFor="event-upload" className="btn btn-secondary btn-small">Upload</label>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Trailer URL (YouTube)</label>
                  <input type="url" className="form-input" value={filmForm.trailerUrl} onChange={(e) => setFilmForm({ ...filmForm, trailerUrl: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Spotify Playlist URL</label>
                  <input type="url" className="form-input" value={filmForm.spotifyUrl} onChange={(e) => setFilmForm({ ...filmForm, spotifyUrl: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Add Film'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditFilm && selectedFilm && (
        <div className="modal-overlay" onClick={() => setShowEditFilm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Film</h2>
              <button className="modal-close" onClick={() => setShowEditFilm(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditFilm}>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input type="text" className="form-input" value={filmForm.title} onChange={(e) => setFilmForm({ ...filmForm, title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Screening Date</label>
                  <input type="date" className="form-input" value={filmForm.screeningDate} onChange={(e) => setFilmForm({ ...filmForm, screeningDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Event Poster URL</label>
                  <input type="url" className="form-input" value={filmForm.eventPosterUrl} onChange={(e) => setFilmForm({ ...filmForm, eventPosterUrl: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Trailer URL</label>
                  <input type="url" className="form-input" value={filmForm.trailerUrl} onChange={(e) => setFilmForm({ ...filmForm, trailerUrl: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Spotify URL</label>
                  <input type="url" className="form-input" value={filmForm.spotifyUrl} onChange={(e) => setFilmForm({ ...filmForm, spotifyUrl: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-primary">Save</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAddSubmission && (
        <div className="modal-overlay" onClick={() => setShowAddSubmission(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Submit Film</h2>
              <button className="modal-close" onClick={() => setShowAddSubmission(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Search TMDB</label>
                <input type="text" className="form-input" value={tmdbSearch} onChange={(e) => setTmdbSearch(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && searchTMDB(tmdbSearch)} />
                {tmdbResults.length > 0 && (
                  <div className="tmdb-results">
                    {tmdbResults.map((movie) => (
                      <div key={movie.id} className="tmdb-result" onClick={() => selectTMDBMovie(movie)}>
                        {movie.poster_path && <img src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`} className="tmdb-poster" />}
                        <div className="tmdb-info">
                          <div className="tmdb-title">{movie.title}</div>
                          <div className="tmdb-year">{movie.release_date?.split('-')[0]}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <form onSubmit={handleAddSubmission}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input type="text" className="form-input" value={submissionForm.title} onChange={(e) => setSubmissionForm({ ...submissionForm, title: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Why this film?</label>
                  <textarea className="form-textarea" value={submissionForm.reason} onChange={(e) => setSubmissionForm({ ...submissionForm, reason: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-primary">Submit</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditProfile && (
        <div className="modal-overlay" onClick={() => setShowEditProfile(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Profile</h2>
              <button className="modal-close" onClick={() => setShowEditProfile(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditProfile}>
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input type="text" className="form-input" value={profileForm.displayName} onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Bio</label>
                  <textarea className="form-textarea" value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Photo URL</label>
                  <input type="url" className="form-input" value={profileForm.photoURL} onChange={(e) => setProfileForm({ ...profileForm, photoURL: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-primary">Save</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAddScreening && (
        <div className="modal-overlay" onClick={() => setShowAddScreening(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Schedule Screening</h2>
              <button className="modal-close" onClick={() => setShowAddScreening(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddScreening}>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input type="date" className="form-input" value={screeningForm.date} onChange={(e) => setScreeningForm({ ...screeningForm, date: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Title (optional)</label>
                  <input type="text" className="form-input" value={screeningForm.title} onChange={(e) => setScreeningForm({ ...screeningForm, title: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Event Poster</label>
                  <input type="url" className="form-input" value={screeningForm.eventPosterUrl} onChange={(e) => setScreeningForm({ ...screeningForm, eventPosterUrl: e.target.value })} />
                  <div className="upload-area" style={{ marginTop: '12px' }}>
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e.target.files[0], 'eventPosterUrl', setScreeningForm)} style={{ display: 'none' }} id="screening-upload" />
                    <label htmlFor="screening-upload" className="btn btn-secondary btn-small">Upload</label>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Schedule'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showVoteModal && selectedFilm && (
        <div className="modal-overlay" onClick={() => setShowVoteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Rate & Review</h2>
              <button className="modal-close" onClick={() => setShowVoteModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <h3 style={{ fontSize: '20px', marginBottom: '16px', fontFamily: 'Courier New, monospace' }}>
                {selectedFilm.title}
              </h3>
              <form onSubmit={handleSubmitVote}>
                <div className="form-group">
                  <label className="form-label">Rating (0-10)</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={voteForm.rating}
                    onChange={(e) => setVoteForm({ ...voteForm, rating: e.target.value })}
                    style={{ width: '100%' }}
                  />
                  <div style={{ textAlign: 'center', fontSize: '32px', fontWeight: '900', color: '#009384', marginTop: '12px', fontFamily: 'Courier New, monospace' }}>
                    ⭐ {voteForm.rating}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Review</label>
                  <textarea className="form-textarea" value={voteForm.review} onChange={(e) => setVoteForm({ ...voteForm, review: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Badges</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                    {['🔥 Fire', '😂 Hilarious', '💀 Cringe', '🤯 WTF', '😴 Boring', '🎭 So Bad'].map((badge) => (
                      <div
                        key={badge}
                        className={`badge ${voteForm.badges.includes(badge) ? 'active' : 'inactive'}`}
                        onClick={() => toggleBadge(badge)}
                      >
                        {badge}
                      </div>
                    ))}
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">Submit Review</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
