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
    bmnScore: 0, date: '', emoji: '🎬', type: 'bmn', trailer: '', isUpcoming: false,
    attendees: [] // NEW: Track attendees during film creation
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
  const [leaderboardView, setLeaderboardView] = useState('members');
  // NEW: Sponsor upload states
  const [showSponsorUpload, setShowSponsorUpload] = useState(false);
  const [newSponsor, setNewSponsor] = useState({ name: '', image: '', altText: '' });
  const [uploadingSponsor, setUploadingSponsor] = useState(false);

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
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state) {
        setPage(e.state.page);
        setSelectedFilm(e.state.selectedFilm || null);
        setSelectedMember(e.state.selectedMember || null);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (user && userProfile) {
      loadData();
    }
  }, [user, userProfile]);

  useEffect(() => {
    if (selectedFilm && selectedFilm.title) {
      searchTMDB(selectedFilm.title);
    }
  }, [selectedFilm]);

  const checkPendingVotes = () => {
    const reviewedFilmIds = buzzFeed
      .filter(item => item.type === 'review' && item.memberId === userProfile.id)
      .map(item => item.filmId);
    
    const userEmojis = userProfile.emojis || [];
    
    const pastFilms = films.filter(f => {
      const filmDate = new Date(f.date);
      const today = new Date();
      return !f.isUpcoming && filmDate <= today && !reviewedFilmIds.includes(f.id) && userEmojis.includes(f.emoji);
    });
    
    setPendingVotes(pastFilms);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [filmsSnap, membersSnap, submissionsSnap, buzzSnap] = await Promise.all([
        getDocs(query(collection(db, 'films'), orderBy('date', 'desc'))),
        getDocs(collection(db, 'members')),
        getDocs(query(collection(db, 'submissions'), orderBy('timestamp', 'desc'))),
        getDocs(query(collection(db, 'buzz'), orderBy('timestamp', 'desc')))
      ]);
      
      const filmsData = filmsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const membersData = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const submissionsData = submissionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const buzzData = buzzSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const commentsBySubmission = {};
      for (const submission of submissionsData) {
        const commentsSnap = await getDocs(query(collection(db, 'submissions', submission.id, 'comments'), orderBy('timestamp', 'asc')));
        commentsBySubmission[submission.id] = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      setFilms(filmsData);
      setMembers(membersData);
      setSubmissions(submissionsData);
      setSubmissionComments(commentsBySubmission);
      setBuzzFeed(buzzData);
      
      if (filmsData.length > 0) {
        checkPendingVotes();
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowLogin(false);
    } catch (error) {
      alert('Login failed: ' + error.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert('Please enter your email address');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent! Check your inbox.');
      setForgotPassword(false);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowLogin(true);
      setPage('home');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const searchTMDB = async (title) => {
    try {
      setSearchingTmdb(true);
      const response = await fetch(
        `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(title)}`,
        { headers: { Authorization: `Bearer ${TMDB_API_TOKEN}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const movie = data.results[0];
          const detailsResponse = await fetch(
            `${TMDB_BASE_URL}/movie/${movie.id}`,
            { headers: { Authorization: `Bearer ${TMDB_API_TOKEN}` } }
          );
          
          if (detailsResponse.ok) {
            const details = await detailsResponse.json();
            setTmdbData(details);
          }
        }
      }
    } catch (error) {
      console.error('TMDB search error:', error);
    } finally {
      setSearchingTmdb(false);
    }
  };

  const handleTmdbSearch = async () => {
    if (!tmdbSearchQuery.trim()) return;
    
    try {
      setSearchingTmdb(true);
      const response = await fetch(
        `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(tmdbSearchQuery)}`,
        { headers: { Authorization: `Bearer ${TMDB_API_TOKEN}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setTmdbSearchResults(data.results || []);
      }
    } catch (error) {
      console.error('TMDB search error:', error);
    } finally {
      setSearchingTmdb(false);
    }
  };

  const selectTmdbMovie = (movie) => {
    setNewSubmission({
      ...newSubmission,
      title: movie.title,
      image: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
      description: movie.overview
    });
    setShowTmdbSearch(false);
    setTmdbSearchResults([]);
    setTmdbSearchQuery('');
  };

  const handleImageUpload = async (e, context) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingImage(true);
    try {
      const timestamp = Date.now();
      const storageRef = ref(storage, `${context}/${timestamp}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      if (context === 'films') {
        setNewFilm({ ...newFilm, image: url });
      } else if (context === 'submissions') {
        setNewSubmission({ ...newSubmission, image: url });
      } else if (context === 'profiles') {
        if (editingProfile) {
          setEditingProfile({ ...editingProfile, image: url });
        }
      } else if (context === 'editFilm') {
        if (editingFilm) {
          setEditingFilm({ ...editingFilm, image: url });
        }
      }
      
      alert('Image uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // NEW: Handle sponsor image upload
  const handleSponsorImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingSponsor(true);
    try {
      const timestamp = Date.now();
      const storageRef = ref(storage, `sponsors/${timestamp}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      setNewSponsor({ ...newSponsor, image: url });
      alert('Sponsor image uploaded successfully!');
    } catch (error) {
      console.error('Sponsor upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploadingSponsor(false);
    }
  };

  // NEW: Add sponsor to film
  const handleAddSponsor = async (e) => {
    e.preventDefault();
    
    if (!newSponsor.image) {
      alert('Please upload a sponsor image');
      return;
    }
    
    try {
      const filmRef = doc(db, 'films', selectedFilm.id);
      const currentSponsors = selectedFilm.sponsors || [];
      
      await updateDoc(filmRef, {
        sponsors: [...currentSponsors, {
          name: newSponsor.name,
          image: newSponsor.image,
          altText: newSponsor.altText || newSponsor.name
        }]
      });
      
      // Refresh film data
      const updatedFilmDoc = await getDoc(filmRef);
      const updatedFilm = { id: updatedFilmDoc.id, ...updatedFilmDoc.data() };
      setSelectedFilm(updatedFilm);
      
      // Update films list
      setFilms(films.map(f => f.id === selectedFilm.id ? updatedFilm : f));
      
      setNewSponsor({ name: '', image: '', altText: '' });
      setShowSponsorUpload(false);
      alert('Sponsor added successfully!');
    } catch (error) {
      console.error('Error adding sponsor:', error);
      alert('Failed to add sponsor: ' + error.message);
    }
  };

  // NEW: Remove sponsor from film
  const handleRemoveSponsor = async (sponsorIndex) => {
    if (!window.confirm('Remove this sponsor?')) return;
    
    try {
      const filmRef = doc(db, 'films', selectedFilm.id);
      const updatedSponsors = selectedFilm.sponsors.filter((_, idx) => idx !== sponsorIndex);
      
      await updateDoc(filmRef, {
        sponsors: updatedSponsors
      });
      
      const updatedFilmDoc = await getDoc(filmRef);
      const updatedFilm = { id: updatedFilmDoc.id, ...updatedFilmDoc.data() };
      setSelectedFilm(updatedFilm);
      setFilms(films.map(f => f.id === selectedFilm.id ? updatedFilm : f));
      
      alert('Sponsor removed!');
    } catch (error) {
      console.error('Error removing sponsor:', error);
      alert('Failed to remove sponsor: ' + error.message);
    }
  };

  const handleAddFilm = async (e) => {
    e.preventDefault();
    
    // FIX #2: Improved validation and error handling for adding new films
    if (!newFilm.title || !newFilm.date || !newFilm.emoji) {
      alert('Please fill in all required fields (Title, Date, Emoji)');
      return;
    }
    
    try {
      const filmData = {
        ...newFilm,
        // FIX #1: Ensure RT and Popcorn scores are properly stored as numbers or empty strings
        rtScore: newFilm.rtScore ? Number(newFilm.rtScore) : '',
        popcornScore: newFilm.popcornScore ? Number(newFilm.popcornScore) : '',
        bmnScore: 0,
        timestamp: serverTimestamp(),
        attendees: newFilm.attendees || [], // NEW: Store attendees
        sponsors: [] // NEW: Initialize empty sponsors array
      };
      
      const docRef = await addDoc(collection(db, 'films'), filmData);
      
      // FIX #3: Add emojis to attendees' profiles when film is created
      if (newFilm.attendees && newFilm.attendees.length > 0) {
        for (const memberId of newFilm.attendees) {
          const memberRef = doc(db, 'members', memberId);
          const memberDoc = await getDoc(memberRef);
          
          if (memberDoc.exists()) {
            const currentEmojis = memberDoc.data().emojis || [];
            if (!currentEmojis.includes(newFilm.emoji)) {
              await updateDoc(memberRef, {
                emojis: arrayUnion(newFilm.emoji)
              });
            }
          }
        }
      }
      
      await loadData();
      
      setNewFilm({
        title: '', subtitle: '', image: '', eventPoster: '', rtScore: '', popcornScore: '',
        bmnScore: 0, date: '', emoji: '🎬', type: 'bmn', trailer: '', isUpcoming: false,
        attendees: []
      });
      setShowAddFilm(false);
      alert('Film added successfully!');
    } catch (error) {
      console.error('Error adding film:', error);
      alert('Failed to add film: ' + error.message);
    }
  };

  const handleEditFilm = async (e) => {
    e.preventDefault();
    
    try {
      const filmRef = doc(db, 'films', editingFilm.id);
      
      // FIX #1: Properly handle RT and Popcorn score updates
      const updateData = {
        ...editingFilm,
        rtScore: editingFilm.rtScore ? Number(editingFilm.rtScore) : '',
        popcornScore: editingFilm.popcornScore ? Number(editingFilm.popcornScore) : ''
      };
      
      // Remove any undefined or null values that might cause issues
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === null) {
          delete updateData[key];
        }
      });
      
      await updateDoc(filmRef, updateData);
      
      // Refresh the data
      const updatedFilmDoc = await getDoc(filmRef);
      const updatedFilm = { id: updatedFilmDoc.id, ...updatedFilmDoc.data() };
      
      setSelectedFilm(updatedFilm);
      setFilms(films.map(f => f.id === editingFilm.id ? updatedFilm : f));
      setEditingFilm(null);
      
      alert('Film updated successfully!');
    } catch (error) {
      console.error('Error updating film:', error);
      alert('Failed to update film: ' + error.message);
    }
  };

  const handleDeleteFilm = async (filmId) => {
    if (!window.confirm('Are you sure you want to delete this film? This will also delete all votes and reviews.')) {
      return;
    }
    
    try {
      const buzzToDelete = buzzFeed.filter(item => item.filmId === filmId);
      for (const item of buzzToDelete) {
        await deleteDoc(doc(db, 'buzz', item.id));
      }
      
      await deleteDoc(doc(db, 'films', filmId));
      await loadData();
      setPage('home');
      alert('Film deleted successfully');
    } catch (error) {
      console.error('Error deleting film:', error);
      alert('Failed to delete film: ' + error.message);
    }
  };

  const handleVote = async (e) => {
    e.preventDefault();
    
    if (!userVote.text.trim()) {
      alert('Please write a review before submitting your vote.');
      return;
    }
    
    try {
      const existingReview = buzzFeed.find(
        item => item.type === 'review' && item.filmId === selectedFilm.id && item.memberId === userProfile.id
      );
      
      if (existingReview) {
        await updateDoc(doc(db, 'buzz', existingReview.id), {
          score: userVote.score,
          text: userVote.text,
          thumbs: userVote.thumbs,
          timestamp: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'buzz'), {
          type: 'review',
          filmId: selectedFilm.id,
          filmTitle: selectedFilm.title,
          memberId: userProfile.id,
          memberName: userProfile.name,
          score: userVote.score,
          text: userVote.text,
          thumbs: userVote.thumbs,
          timestamp: serverTimestamp(),
          likes: []
        });
        
        const memberRef = doc(db, 'members', userProfile.id);
        await updateDoc(memberRef, {
          emojis: arrayUnion(selectedFilm.emoji)
        });
      }
      
      const reviews = buzzFeed.filter(item => item.type === 'review' && item.filmId === selectedFilm.id);
      const allScores = reviews
        .filter(r => r.memberId !== userProfile.id)
        .map(r => r.score);
      allScores.push(userVote.score);
      
      const avgScore = allScores.reduce((sum, s) => sum + s, 0) / allScores.length;
      
      await updateDoc(doc(db, 'films', selectedFilm.id), {
        bmnScore: Math.round(avgScore)
      });
      
      await loadData();
      setUserVote({ score: 50, text: '', thumbs: 'neutral' });
      alert('Vote submitted successfully!');
    } catch (error) {
      console.error('Error submitting vote:', error);
      alert('Failed to submit vote: ' + error.message);
    }
  };

  const handleLike = async (buzzId, currentLikes) => {
    try {
      const buzzRef = doc(db, 'buzz', buzzId);
      if (currentLikes.includes(userProfile.id)) {
        await updateDoc(buzzRef, {
          likes: arrayRemove(userProfile.id)
        });
      } else {
        await updateDoc(buzzRef, {
          likes: arrayUnion(userProfile.id)
        });
      }
      await loadData();
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleReply = async (buzzId) => {
    if (!replyText.trim()) return;
    
    try {
      await addDoc(collection(db, 'buzz'), {
        type: 'comment',
        parentId: buzzId,
        memberId: userProfile.id,
        memberName: userProfile.name,
        text: replyText,
        timestamp: serverTimestamp(),
        likes: []
      });
      
      await loadData();
      setReplyText('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error posting reply:', error);
    }
  };

  const handleSubmissionComment = async (submissionId) => {
    if (!commentText.trim()) return;
    
    try {
      await addDoc(collection(db, 'submissions', submissionId, 'comments'), {
        memberId: userProfile.id,
        memberName: userProfile.name,
        memberImage: userProfile.image,
        text: commentText,
        timestamp: serverTimestamp()
      });
      
      await loadData();
      setCommentText('');
      setCommentingOn(null);
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const handleDeleteSubmission = async (submissionId) => {
    if (!window.confirm('Delete this submission?')) return;
    
    try {
      const commentsSnap = await getDocs(collection(db, 'submissions', submissionId, 'comments'));
      for (const commentDoc of commentsSnap.docs) {
        await deleteDoc(doc(db, 'submissions', submissionId, 'comments', commentDoc.id));
      }
      
      await deleteDoc(doc(db, 'submissions', submissionId));
      await loadData();
      alert('Submission deleted');
    } catch (error) {
      console.error('Error deleting submission:', error);
      alert('Failed to delete submission');
    }
  };

  const handleSubmitMovie = async (e) => {
    e.preventDefault();
    
    try {
      await addDoc(collection(db, 'submissions'), {
        ...newSubmission,
        memberId: userProfile.id,
        memberName: userProfile.name,
        timestamp: serverTimestamp(),
        votes: []
      });
      
      await loadData();
      setNewSubmission({ title: '', image: '', youtubeLink: '', description: '' });
      setShowSubmitMovie(false);
      alert('Movie submitted!');
    } catch (error) {
      console.error('Error submitting movie:', error);
      alert('Failed to submit movie');
    }
  };

  const handleVoteSubmission = async (submissionId, vote) => {
    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionDoc = await getDoc(submissionRef);
      const currentVotes = submissionDoc.data().votes || [];
      
      const existingVoteIndex = currentVotes.findIndex(v => v.memberId === userProfile.id);
      
      if (existingVoteIndex >= 0) {
        currentVotes[existingVoteIndex].vote = vote;
      } else {
        currentVotes.push({ memberId: userProfile.id, vote });
      }
      
      await updateDoc(submissionRef, { votes: currentVotes });
      await loadData();
    } catch (error) {
      console.error('Error voting on submission:', error);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    
    try {
      const memberRef = doc(db, 'members', editingProfile.id);
      await updateDoc(memberRef, {
        name: editingProfile.name,
        title: editingProfile.title,
        bio: editingProfile.bio,
        image: editingProfile.image
      });
      
      await loadData();
      setEditingProfile(null);
      alert('Profile updated!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) {
      alert('Please enter an email address');
      return;
    }
    
    if (adminEmails.includes(newAdminEmail)) {
      alert('This email is already an admin');
      return;
    }
    
    if (!EMAIL_TO_MEMBER_ID[newAdminEmail]) {
      alert('This email is not registered as a member');
      return;
    }
    
    setAdminEmails([...adminEmails, newAdminEmail]);
    setNewAdminEmail('');
    alert(`${newAdminEmail} is now an admin!`);
  };

  const handleRemoveAdmin = (email) => {
    if (email === 'mattdernlan@gmail.com') {
      alert('Cannot remove the primary admin');
      return;
    }
    
    if (window.confirm(`Remove admin access for ${email}?`)) {
      setAdminEmails(adminEmails.filter(e => e !== email));
    }
  };

  const navigateTo = (newPage, film = null, member = null) => {
    setPage(newPage);
    setSelectedFilm(film);
    setSelectedMember(member);
    setShowMobileMenu(false);
    window.history.pushState({ page: newPage, selectedFilm: film, selectedMember: member }, '');
  };

  const sortedMembers = [...members].sort((a, b) => {
    const aEmojis = a.emojis ? a.emojis.length : 0;
    const bEmojis = b.emojis ? b.emojis.length : 0;
    return bEmojis - aEmojis;
  });

  const bmnFilms = films.filter(f => f.type === 'bmn' && !f.isUpcoming);
  const offsiteFilms = films.filter(f => f.type === 'offsite-film' && !f.isUpcoming);
  const upcomingFilms = films.filter(f => f.isUpcoming);

  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return videoId ? `https://www.youtube.com/embed/${videoId[1]}` : null;
  };

  if (showLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #31394d 0%, #1e2530 100%)' }}>
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
              🎬 Bad Movie Night
            </h1>
            <p className="text-gray-600" style={{ fontFamily: 'Courier New, monospace' }}>
              Welcome to the most exclusive bad movie club on Earth. Members only. No good movies allowed.
            </p>
          </div>
          
          {!forgotPassword ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  style={{ fontFamily: 'Courier New, monospace', borderColor: '#31394d' }}
                  required
                />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  style={{ fontFamily: 'Courier New, monospace', borderColor: '#31394d' }}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-lg text-white font-semibold hover:opacity-90"
                style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
              >
                <LogIn className="inline mr-2" size={18} />
                Enter
              </button>
              <button
                type="button"
                onClick={() => setForgotPassword(true)}
                className="w-full text-sm text-gray-600 hover:text-gray-800"
                style={{ fontFamily: 'Courier New, monospace' }}
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  style={{ fontFamily: 'Courier New, monospace', borderColor: '#31394d' }}
                />
              </div>
              <button
                onClick={handleForgotPassword}
                className="w-full py-2 rounded-lg text-white font-semibold hover:opacity-90"
                style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
              >
                Send Reset Link
              </button>
              <button
                onClick={() => setForgotPassword(false)}
                className="w-full text-sm text-gray-600 hover:text-gray-800"
                style={{ fontFamily: 'Courier New, monospace' }}
              >
                Back to login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #31394d 0%, #1e2530 100%)' }}>
        <div className="text-white text-2xl" style={{ fontFamily: 'Courier New, monospace' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f5f7' }}>
      <nav className="shadow-sm sticky top-0 z-40" style={{ backgroundColor: '#31394d' }}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigateTo('home')} className="flex items-center gap-2">
                <span className="text-2xl">🎬</span>
                <span className="text-xl font-bold hidden sm:inline" style={{ fontFamily: 'Courier New, monospace', color: 'white' }}>
                  Bad Movie Night
                </span>
              </button>
            </div>
            
            <div className="hidden md:flex items-center gap-6">
              <button onClick={() => navigateTo('home')} className="font-semibold hover:opacity-80" style={{ fontFamily: 'Courier New, monospace', color: page === 'home' ? '#009384' : 'white' }}>
                Home
              </button>
              <button onClick={() => navigateTo('submissions')} className="font-semibold hover:opacity-80" style={{ fontFamily: 'Courier New, monospace', color: page === 'submissions' ? '#009384' : 'white' }}>
                Submissions
              </button>
              <button onClick={() => navigateTo('buzz')} className="font-semibold hover:opacity-80" style={{ fontFamily: 'Courier New, monospace', color: page === 'buzz' ? '#009384' : 'white' }}>
                The Buzz
              </button>
              <button onClick={() => navigateTo('members')} className="font-semibold hover:opacity-80" style={{ fontFamily: 'Courier New, monospace', color: page === 'members' ? '#009384' : 'white' }}>
                Members
              </button>
              <button onClick={() => navigateTo('leaderboard')} className="font-semibold hover:opacity-80" style={{ fontFamily: 'Courier New, monospace', color: page === 'leaderboard' ? '#009384' : 'white' }}>
                Leaderboard
              </button>
              {isAdmin && (
                <button onClick={() => navigateTo('admin')} className="font-semibold hover:opacity-80 flex items-center gap-1" style={{ fontFamily: 'Courier New, monospace', color: page === 'admin' ? '#009384' : 'white' }}>
                  <Shield size={16} />
                  Admin
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {userProfile && (
                <button onClick={() => navigateTo('profile', null, userProfile)} className="hidden md:flex items-center gap-2 hover:opacity-80">
                  {userProfile.image && (
                    <img src={userProfile.image} alt={userProfile.name} className="w-8 h-8 rounded-full object-cover" />
                  )}
                  <span style={{ fontFamily: 'Courier New, monospace', color: 'white' }}>{userProfile.name}</span>
                </button>
              )}
              <button onClick={handleLogout} className="text-white hover:opacity-80">
                <LogOut size={20} />
              </button>
              <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="md:hidden text-white">
                <Menu size={24} />
              </button>
            </div>
          </div>
          
          {showMobileMenu && (
            <div className="md:hidden mt-4 space-y-2 pb-2">
              <button onClick={() => navigateTo('home')} className="block w-full text-left py-2 font-semibold" style={{ fontFamily: 'Courier New, monospace', color: page === 'home' ? '#009384' : 'white' }}>
                Home
              </button>
              <button onClick={() => navigateTo('submissions')} className="block w-full text-left py-2 font-semibold" style={{ fontFamily: 'Courier New, monospace', color: page === 'submissions' ? '#009384' : 'white' }}>
                Submissions
              </button>
              <button onClick={() => navigateTo('buzz')} className="block w-full text-left py-2 font-semibold" style={{ fontFamily: 'Courier New, monospace', color: page === 'buzz' ? '#009384' : 'white' }}>
                The Buzz
              </button>
              <button onClick={() => navigateTo('members')} className="block w-full text-left py-2 font-semibold" style={{ fontFamily: 'Courier New, monospace', color: page === 'members' ? '#009384' : 'white' }}>
                Members
              </button>
              <button onClick={() => navigateTo('leaderboard')} className="block w-full text-left py-2 font-semibold" style={{ fontFamily: 'Courier New, monospace', color: page === 'leaderboard' ? '#009384' : 'white' }}>
                Leaderboard
              </button>
              {isAdmin && (
                <button onClick={() => navigateTo('admin')} className="block w-full text-left py-2 font-semibold flex items-center gap-2" style={{ fontFamily: 'Courier New, monospace', color: page === 'admin' ? '#009384' : 'white' }}>
                  <Shield size={16} />
                  Admin
                </button>
              )}
              {userProfile && (
                <button onClick={() => navigateTo('profile', null, userProfile)} className="block w-full text-left py-2 font-semibold flex items-center gap-2" style={{ fontFamily: 'Courier New, monospace', color: 'white' }}>
                  {userProfile.image && (
                    <img src={userProfile.image} alt={userProfile.name} className="w-8 h-8 rounded-full object-cover" />
                  )}
                  {userProfile.name}
                </button>
              )}
            </div>
          )}
        </div>
      </nav>

      {pendingVotes.length > 0 && page === 'home' && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
            <h3 className="font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
              🎬 You have {pendingVotes.length} film{pendingVotes.length > 1 ? 's' : ''} to review!
            </h3>
            <div className="space-y-2">
              {pendingVotes.map(film => (
                <button
                  key={film.id}
                  onClick={() => navigateTo('film', film)}
                  className="block w-full text-left px-4 py-2 bg-white rounded hover:bg-gray-50"
                  style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}
                >
                  {film.emoji} {film.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {page === 'home' && (
          <div>
            {isAdmin && (
              <div className="mb-6 flex flex-wrap gap-4">
                <button
                  onClick={() => setShowAddFilm(true)}
                  className="px-6 py-2 rounded-lg text-white font-semibold flex items-center gap-2 hover:opacity-90"
                  style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                >
                  <Plus size={20} />
                  Add Film
                </button>
                <button
                  onClick={() => setShowSubmitMovie(true)}
                  className="px-6 py-2 rounded-lg text-white font-semibold flex items-center gap-2 hover:opacity-90"
                  style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#31394d' }}
                >
                  <Film size={20} />
                  Submit Suggestion
                </button>
              </div>
            )}

            {upcomingFilms.length > 0 && (
              <div className="mb-8">
                <h2 className="text-3xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                  🎟️ Up Next
                </h2>
                <div className="w-full">
                  {upcomingFilms.map(film => (
                    <div key={film.id} className="bg-white rounded-lg shadow-sm overflow-hidden mb-4">
                      <div className="flex flex-col md:flex-row">
                        {film.eventPoster && (
                          <div className="md:w-1/2">
                            <img src={film.eventPoster} alt={film.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="md:w-1/2 p-6 flex flex-col justify-center">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar size={20} style={{ color: '#009384' }} />
                            <span className="text-lg font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                              {new Date(film.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                            {film.title}
                          </h3>
                          {film.subtitle && (
                            <p className="text-gray-600 mb-4" style={{ fontFamily: 'Courier New, monospace' }}>
                              {film.subtitle}
                            </p>
                          )}
                          <p className="text-sm font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                            Film will be revealed at the event! 🎬
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-3xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                🎬 BMN Screenings
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {bmnFilms.map(film => (
                  <button
                    key={film.id}
                    onClick={() => navigateTo('film', film)}
                    className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {film.image && (
                      <img src={film.image} alt={film.title} className="w-full aspect-[2/3] object-cover" />
                    )}
                    <div className="p-3">
                      <h3 className="font-bold mb-1 text-sm line-clamp-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        {film.title}
                      </h3>
                      <div className="flex items-center justify-between text-xs">
                        {film.rtScore && (
                          <div className="flex items-center gap-1">
                            <span>🍅</span>
                            <span style={{ fontFamily: 'Courier New, monospace' }}>{film.rtScore}%</span>
                          </div>
                        )}
                        {film.bmnScore > 0 && (
                          <div className="flex items-center gap-1">
                            <span>🎬</span>
                            <span style={{ fontFamily: 'Courier New, monospace' }}>{film.bmnScore}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {offsiteFilms.length > 0 && (
              <div>
                <h2 className="text-3xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                  🏠 Offsite Films
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {offsiteFilms.map(film => (
                    <button
                      key={film.id}
                      onClick={() => navigateTo('film', film)}
                      className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {film.image && (
                        <img src={film.image} alt={film.title} className="w-full aspect-[2/3] object-cover" />
                      )}
                      <div className="p-3">
                        <h3 className="font-bold mb-1 text-sm line-clamp-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                          {film.title}
                        </h3>
                        <div className="flex items-center justify-between text-xs">
                          {film.rtScore && (
                            <div className="flex items-center gap-1">
                              <span>🍅</span>
                              <span style={{ fontFamily: 'Courier New, monospace' }}>{film.rtScore}%</span>
                            </div>
                          )}
                          {film.bmnScore > 0 && (
                            <div className="flex items-center gap-1">
                              <span>🎬</span>
                              <span style={{ fontFamily: 'Courier New, monospace' }}>{film.bmnScore}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {page === 'film' && selectedFilm && (
          <div>
            <button onClick={() => navigateTo('home')} className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-800">
              <ChevronLeft size={20} />
              <span style={{ fontFamily: 'Courier New, monospace' }}>Back to Home</span>
            </button>

            {isAdmin && !editingFilm && (
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setEditingFilm({...selectedFilm})}
                  className="px-4 py-2 rounded-lg text-white font-semibold flex items-center gap-2"
                  style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                >
                  <Edit size={16} />
                  Edit Film
                </button>
                <button
                  onClick={() => handleDeleteFilm(selectedFilm.id)}
                  className="px-4 py-2 rounded-lg text-white font-semibold flex items-center gap-2 bg-red-500 hover:bg-red-600"
                  style={{ fontFamily: 'Courier New, monospace' }}
                >
                  <Trash2 size={16} />
                  Delete Film
                </button>
              </div>
            )}

            {editingFilm ? (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                  Edit Film
                </h2>
                <form onSubmit={handleEditFilm} className="space-y-4">
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Title *</label>
                    <input
                      type="text"
                      value={editingFilm.title}
                      onChange={(e) => setEditingFilm({...editingFilm, title: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ borderColor: '#31394d' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Subtitle</label>
                    <input
                      type="text"
                      value={editingFilm.subtitle || ''}
                      onChange={(e) => setEditingFilm({...editingFilm, subtitle: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ borderColor: '#31394d' }}
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Movie Poster</label>
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'editFilm')}
                        className="block"
                        disabled={uploadingImage}
                      />
                      <div className="text-sm text-gray-500">or</div>
                      <input
                        type="url"
                        placeholder="Image URL"
                        value={editingFilm.image}
                        onChange={(e) => setEditingFilm({...editingFilm, image: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg"
                        style={{ borderColor: '#31394d' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>RT Score (leave blank to hide)</label>
                    <input
                      type="number"
                      value={editingFilm.rtScore || ''}
                      onChange={(e) => setEditingFilm({...editingFilm, rtScore: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ borderColor: '#31394d' }}
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Popcornmeter Score (leave blank to hide)</label>
                    <input
                      type="number"
                      value={editingFilm.popcornScore || ''}
                      onChange={(e) => setEditingFilm({...editingFilm, popcornScore: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ borderColor: '#31394d' }}
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Trailer URL</label>
                    <input
                      type="url"
                      value={editingFilm.trailer || ''}
                      onChange={(e) => setEditingFilm({...editingFilm, trailer: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ borderColor: '#31394d' }}
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Date *</label>
                    <input
                      type="date"
                      value={editingFilm.date}
                      onChange={(e) => setEditingFilm({...editingFilm, date: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ borderColor: '#31394d' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Emoji *</label>
                    <input
                      type="text"
                      value={editingFilm.emoji}
                      onChange={(e) => setEditingFilm({...editingFilm, emoji: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ borderColor: '#31394d' }}
                      required
                    />
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-lg text-white font-semibold"
                      style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingFilm(null)}
                      className="flex-1 py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400"
                      style={{ fontFamily: 'Courier New, monospace' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    {selectedFilm.image && (
                      <img src={selectedFilm.image} alt={selectedFilm.title} className="w-full rounded-lg shadow-md" />
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h1 className="text-3xl mb-2" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                        {selectedFilm.emoji} {selectedFilm.title}
                      </h1>
                      {selectedFilm.subtitle && (
                        <p className="text-xl text-gray-600" style={{ fontFamily: 'Courier New, monospace' }}>
                          {selectedFilm.subtitle}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-6">
                      {selectedFilm.rtScore && (
                        <div>
                          <div className="text-sm text-gray-600 mb-1" style={{ fontFamily: 'Courier New, monospace' }}>
                            Rotten Tomatoes
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">🍅</span>
                            <span className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                              {selectedFilm.rtScore}%
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {selectedFilm.popcornScore && (
                        <div>
                          <div className="text-sm text-gray-600 mb-1" style={{ fontFamily: 'Courier New, monospace' }}>
                            Popcornmeter
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">🍿</span>
                            <span className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                              {selectedFilm.popcornScore}%
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {selectedFilm.bmnScore > 0 && (
                        <div>
                          <div className="text-sm text-gray-600 mb-1" style={{ fontFamily: 'Courier New, monospace' }}>
                            BMN Score
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">🎬</span>
                            <span className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                              {selectedFilm.bmnScore}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm text-gray-600 mb-1" style={{ fontFamily: 'Courier New, monospace' }}>
                        Date
                      </div>
                      <div className="font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        {new Date(selectedFilm.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>

                    {selectedFilm.trailer && (
                      <div>
                        <div className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Courier New, monospace' }}>
                          Trailer
                        </div>
                        <div className="aspect-video">
                          <iframe
                            src={getYouTubeEmbedUrl(selectedFilm.trailer)}
                            className="w-full h-full rounded-lg"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                  Vote & Review
                </h2>
                
                {(() => {
                  const existingReview = buzzFeed.find(
                    item => item.type === 'review' && item.filmId === selectedFilm.id && item.memberId === userProfile.id
                  );
                  
                  if (existingReview) {
                    return (
                      <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{existingReview.thumbs === 'up' ? '👍' : existingReview.thumbs === 'down' ? '👎' : '😐'}</span>
                            <span className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                              {existingReview.score}
                            </span>
                          </div>
                          <p style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                            {existingReview.text}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setUserVote({
                              score: existingReview.score,
                              text: existingReview.text,
                              thumbs: existingReview.thumbs
                            });
                          }}
                          className="w-full py-2 rounded-lg text-white font-semibold"
                          style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                        >
                          Edit Your Review
                        </button>
                      </div>
                    );
                  }
                  
                  return (
                    <form onSubmit={handleVote} className="space-y-4">
                      <div>
                        <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>
                          Your Score: {userVote.score}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={userVote.score}
                          onChange={(e) => setUserVote({...userVote, score: parseInt(e.target.value)})}
                          className="w-full"
                        />
                      </div>
                      
                      <div>
                        <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>
                          Your Review *
                        </label>
                        <textarea
                          value={userVote.text}
                          onChange={(e) => setUserVote({...userVote, text: e.target.value})}
                          className="w-full px-4 py-2 border rounded-lg"
                          style={{ fontFamily: 'Courier New, monospace', borderColor: '#31394d' }}
                          rows="4"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>
                          Thumbs
                        </label>
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => setUserVote({...userVote, thumbs: 'up'})}
                            className={`flex-1 py-2 rounded-lg border-2 ${userVote.thumbs === 'up' ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
                          >
                            <ThumbsUp className="mx-auto" size={24} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserVote({...userVote, thumbs: 'neutral'})}
                            className={`flex-1 py-2 rounded-lg border-2 ${userVote.thumbs === 'neutral' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300'}`}
                          >
                            <span className="text-2xl">😐</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setUserVote({...userVote, thumbs: 'down'})}
                            className={`flex-1 py-2 rounded-lg border-2 ${userVote.thumbs === 'down' ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                          >
                            <ThumbsDown className="mx-auto" size={24} />
                          </button>
                        </div>
                      </div>
                      
                      <button
                        type="submit"
                        className="w-full py-2 rounded-lg text-white font-semibold"
                        style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                      >
                        Submit Vote
                      </button>
                    </form>
                  );
                })()}
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                  Reviews
                </h2>
                <div className="space-y-4">
                  {buzzFeed
                    .filter(item => item.type === 'review' && item.filmId === selectedFilm.id)
                    .map(review => {
                      const member = members.find(m => m.id === review.memberId);
                      return (
                        <div key={review.id} className="border-b pb-4 last:border-b-0">
                          <div className="flex items-start gap-3">
                            {member?.image && (
                              <img src={member.image} alt={member.name} className="w-10 h-10 rounded-full object-cover" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                                  {review.memberName}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{review.thumbs === 'up' ? '👍' : review.thumbs === 'down' ? '👎' : '😐'}</span>
                                  <span className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                                    {review.score}
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                                {review.text}
                              </p>
                              <div className="flex items-center gap-4 mt-2">
                                <button
                                  onClick={() => handleLike(review.id, review.likes || [])}
                                  className="flex items-center gap-1 text-sm hover:opacity-70"
                                  style={{ color: (review.likes || []).includes(userProfile.id) ? '#009384' : '#6b7280' }}
                                >
                                  <Heart size={16} fill={(review.likes || []).includes(userProfile.id) ? '#009384' : 'none'} />
                                  <span style={{ fontFamily: 'Courier New, monospace' }}>
                                    {(review.likes || []).length}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* NEW: Sponsor Upload Section */}
            {isAdmin && (
              <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                    🎯 Sponsors
                  </h2>
                  <button
                    onClick={() => setShowSponsorUpload(!showSponsorUpload)}
                    className="px-4 py-2 rounded-lg text-white font-semibold flex items-center gap-2"
                    style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                  >
                    <Plus size={16} />
                    Add Sponsor
                  </button>
                </div>

                {showSponsorUpload && (
                  <form onSubmit={handleAddSponsor} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                    <div>
                      <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>
                        Sponsor Name
                      </label>
                      <input
                        type="text"
                        value={newSponsor.name}
                        onChange={(e) => setNewSponsor({...newSponsor, name: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg"
                        style={{ borderColor: '#31394d' }}
                        placeholder="e.g., Coca-Cola"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>
                        Sponsor Logo *
                      </label>
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSponsorImageUpload}
                          className="block"
                          disabled={uploadingSponsor}
                        />
                        {uploadingSponsor && (
                          <p className="text-sm text-gray-500" style={{ fontFamily: 'Courier New, monospace' }}>
                            Uploading...
                          </p>
                        )}
                        {newSponsor.image && (
                          <img src={newSponsor.image} alt="Preview" className="w-32 h-32 object-contain border rounded" />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>
                        Alt Text (optional)
                      </label>
                      <input
                        type="text"
                        value={newSponsor.altText}
                        onChange={(e) => setNewSponsor({...newSponsor, altText: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg"
                        style={{ borderColor: '#31394d' }}
                        placeholder="Description for accessibility"
                      />
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="submit"
                        className="flex-1 py-2 rounded-lg text-white font-semibold"
                        style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                        disabled={!newSponsor.image}
                      >
                        Add Sponsor
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSponsorUpload(false);
                          setNewSponsor({ name: '', image: '', altText: '' });
                        }}
                        className="flex-1 py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400"
                        style={{ fontFamily: 'Courier New, monospace' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {selectedFilm.sponsors && selectedFilm.sponsors.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {selectedFilm.sponsors.map((sponsor, idx) => (
                      <div key={idx} className="relative border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                        <img
                          src={sponsor.image}
                          alt={sponsor.altText || sponsor.name}
                          className="w-full h-24 object-contain mb-2"
                        />
                        {sponsor.name && (
                          <p className="text-sm text-center font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                            {sponsor.name}
                          </p>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleRemoveSponsor(idx)}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4" style={{ fontFamily: 'Courier New, monospace' }}>
                    No sponsors yet
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {page === 'submissions' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                Movie Submissions
              </h1>
              <button
                onClick={() => setShowSubmitMovie(true)}
                className="px-6 py-2 rounded-lg text-white font-semibold flex items-center gap-2"
                style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
              >
                <Plus size={20} />
                Submit Movie
              </button>
            </div>

            <div className="space-y-6">
              {submissions.map(submission => {
                const submittedBy = members.find(m => m.id === submission.memberId);
                const votes = submission.votes || [];
                const upvotes = votes.filter(v => v.vote === 'up').length;
                const downvotes = votes.filter(v => v.vote === 'down').length;
                const userVoted = votes.find(v => v.memberId === userProfile.id);
                const comments = submissionComments[submission.id] || [];

                return (
                  <div key={submission.id} className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      {submission.image && (
                        <div className="md:w-1/3">
                          <img src={submission.image} alt={submission.title} className="w-full rounded-lg" />
                        </div>
                      )}
                      
                      <div className="flex-1 space-y-4">
                        <div>
                          <h2 className="text-2xl mb-2" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                            {submission.title}
                          </h2>
                          <div className="flex items-center gap-2 mb-2">
                            {submittedBy?.image && (
                              <img src={submittedBy.image} alt={submittedBy.name} className="w-6 h-6 rounded-full object-cover" />
                            )}
                            <span className="text-sm text-gray-600" style={{ fontFamily: 'Courier New, monospace' }}>
                              Submitted by {submission.memberName}
                            </span>
                          </div>
                        </div>

                        {submission.description && (
                          <p style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                            {submission.description}
                          </p>
                        )}

                        {submission.youtubeLink && (
                          <div>
                            <div className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Courier New, monospace' }}>
                              Trailer
                            </div>
                            <div className="aspect-video">
                              <iframe
                                src={getYouTubeEmbedUrl(submission.youtubeLink)}
                                className="w-full h-full rounded-lg"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => handleVoteSubmission(submission.id, 'up')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
                              userVoted?.vote === 'up' ? 'border-green-500 bg-green-50' : 'border-gray-300'
                            }`}
                          >
                            <ThumbsUp size={20} />
                            <span style={{ fontFamily: 'Courier New, monospace' }}>{upvotes}</span>
                          </button>
                          <button
                            onClick={() => handleVoteSubmission(submission.id, 'down')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
                              userVoted?.vote === 'down' ? 'border-red-500 bg-red-50' : 'border-gray-300'
                            }`}
                          >
                            <ThumbsDown size={20} />
                            <span style={{ fontFamily: 'Courier New, monospace' }}>{downvotes}</span>
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteSubmission(submission.id)}
                              className="ml-auto px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 flex items-center gap-2"
                              style={{ fontFamily: 'Courier New, monospace' }}
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          )}
                        </div>

                        <div className="border-t pt-4">
                          <h3 className="font-semibold mb-3" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                            Comments ({comments.length})
                          </h3>
                          
                          <div className="space-y-3 mb-4">
                            {comments.map(comment => (
                              <div key={comment.id} className="flex gap-3">
                                {comment.memberImage && (
                                  <img src={comment.memberImage} alt={comment.memberName} className="w-8 h-8 rounded-full object-cover" />
                                )}
                                <div className="flex-1 bg-gray-50 rounded-lg p-3">
                                  <div className="font-semibold text-sm mb-1" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                                    {comment.memberName}
                                  </div>
                                  <p className="text-sm" style={{ fontFamily: 'Courier New, monospace' }}>
                                    {comment.text}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {commentingOn === submission.id ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Add a comment..."
                                className="flex-1 px-4 py-2 border rounded-lg"
                                style={{ fontFamily: 'Courier New, monospace', borderColor: '#31394d' }}
                              />
                              <button
                                onClick={() => handleSubmissionComment(submission.id)}
                                className="px-4 py-2 rounded-lg text-white font-semibold"
                                style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                              >
                                Post
                              </button>
                              <button
                                onClick={() => {
                                  setCommentingOn(null);
                                  setCommentText('');
                                }}
                                className="px-4 py-2 rounded-lg bg-gray-300 font-semibold hover:bg-gray-400"
                                style={{ fontFamily: 'Courier New, monospace' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setCommentingOn(submission.id)}
                              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
                              style={{ fontFamily: 'Courier New, monospace' }}
                            >
                              <MessageCircle size={18} />
                              Add comment
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {page === 'buzz' && (
          <div>
            <h1 className="text-3xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
              The Buzz
            </h1>
            
            <div className="space-y-6">
              {buzzFeed
                .filter(item => item.type === 'review')
                .map(item => {
                  const member = members.find(m => m.id === item.memberId);
                  const film = films.find(f => f.id === item.filmId);
                  const replies = buzzFeed.filter(reply => reply.type === 'comment' && reply.parentId === item.id);
                  
                  return (
                    <div key={item.id} className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-start gap-4">
                        {member?.image && (
                          <img src={member.image} alt={member.name} className="w-12 h-12 rounded-full object-cover" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                                {item.memberName}
                              </span>
                              <span className="text-gray-500 mx-2">reviewed</span>
                              <button
                                onClick={() => navigateTo('film', film)}
                                className="font-semibold hover:underline"
                                style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}
                              >
                                {item.filmTitle}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{item.thumbs === 'up' ? '👍' : item.thumbs === 'down' ? '👎' : '😐'}</span>
                              <span className="text-xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                                {item.score}
                              </span>
                            </div>
                          </div>
                          
                          <p className="mb-4" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                            {item.text}
                          </p>
                          
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => handleLike(item.id, item.likes || [])}
                              className="flex items-center gap-2 hover:opacity-70"
                              style={{ color: (item.likes || []).includes(userProfile.id) ? '#009384' : '#6b7280' }}
                            >
                              <Heart size={18} fill={(item.likes || []).includes(userProfile.id) ? '#009384' : 'none'} />
                              <span style={{ fontFamily: 'Courier New, monospace' }}>
                                {(item.likes || []).length}
                              </span>
                            </button>
                            <button
                              onClick={() => setReplyingTo(replyingTo === item.id ? null : item.id)}
                              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
                              style={{ fontFamily: 'Courier New, monospace' }}
                            >
                              <MessageCircle size={18} />
                              {replies.length > 0 && <span>{replies.length}</span>}
                            </button>
                          </div>
                          
                          {replies.length > 0 && (
                            <div className="mt-4 space-y-3 pl-4 border-l-2" style={{ borderColor: '#31394d' }}>
                              {replies.map(reply => {
                                const replyMember = members.find(m => m.id === reply.memberId);
                                return (
                                  <div key={reply.id} className="flex items-start gap-3">
                                    {replyMember?.image && (
                                      <img src={replyMember.image} alt={replyMember.name} className="w-8 h-8 rounded-full object-cover" />
                                    )}
                                    <div className="flex-1 bg-gray-50 rounded-lg p-3">
                                      <div className="font-semibold text-sm mb-1" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                                        {reply.memberName}
                                      </div>
                                      <p className="text-sm" style={{ fontFamily: 'Courier New, monospace' }}>
                                        {reply.text}
                                      </p>
                                      <button
                                        onClick={() => handleLike(reply.id, reply.likes || [])}
                                        className="flex items-center gap-1 mt-2 text-xs hover:opacity-70"
                                        style={{ color: (reply.likes || []).includes(userProfile.id) ? '#009384' : '#6b7280' }}
                                      >
                                        <Heart size={14} fill={(reply.likes || []).includes(userProfile.id) ? '#009384' : 'none'} />
                                        <span style={{ fontFamily: 'Courier New, monospace' }}>
                                          {(reply.likes || []).length}
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {replyingTo === item.id && (
                            <div className="mt-4 flex gap-2">
                              <input
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a reply..."
                                className="flex-1 px-4 py-2 border rounded-lg"
                                style={{ fontFamily: 'Courier New, monospace', borderColor: '#31394d' }}
                              />
                              <button
                                onClick={() => handleReply(item.id)}
                                className="px-4 py-2 rounded-lg text-white font-semibold"
                                style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                              >
                                Reply
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {page === 'members' && (
          <div>
            <h1 className="text-3xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
              Members
            </h1>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {members.map(member => (
                <button
                  key={member.id}
                  onClick={() => navigateTo('profile', null, member)}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow text-center"
                >
                  {member.image && (
                    <img src={member.image} alt={member.name} className="w-24 h-24 rounded-full object-cover mx-auto mb-4" />
                  )}
                  <h3 className="font-bold mb-1" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                    {member.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: 'Courier New, monospace' }}>
                    {member.title}
                  </p>
                  <div className="text-2xl">
                    {(member.emojis || []).slice(0, 5).join(' ')}
                    {(member.emojis || []).length > 5 && '...'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {page === 'profile' && selectedMember && (
          <div>
            <button onClick={() => navigateTo('members')} className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-800">
              <ChevronLeft size={20} />
              <span style={{ fontFamily: 'Courier New, monospace' }}>Back to Members</span>
            </button>

            {isAdmin && selectedMember.id === userProfile.id && !editingProfile && (
              <div className="mb-4">
                <button
                  onClick={() => setEditingProfile({...selectedMember})}
                  className="px-4 py-2 rounded-lg text-white font-semibold flex items-center gap-2"
                  style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                >
                  <Edit size={16} />
                  Edit Profile
                </button>
              </div>
            )}

            {editingProfile ? (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                  Edit Profile
                </h2>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Name</label>
                    <input
                      type="text"
                      value={editingProfile.name}
                      onChange={(e) => setEditingProfile({...editingProfile, name: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ borderColor: '#31394d' }}
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Title</label>
                    <input
                      type="text"
                      value={editingProfile.title}
                      onChange={(e) => setEditingProfile({...editingProfile, title: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ borderColor: '#31394d' }}
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Bio</label>
                    <textarea
                      value={editingProfile.bio}
                      onChange={(e) => setEditingProfile({...editingProfile, bio: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg"
                      style={{ fontFamily: 'Courier New, monospace', borderColor: '#31394d' }}
                      rows="4"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Profile Picture</label>
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'profiles')}
                        className="block"
                        disabled={uploadingImage}
                      />
                      {editingProfile.image && (
                        <img src={editingProfile.image} alt="Preview" className="w-32 h-32 rounded-full object-cover" />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-lg text-white font-semibold"
                      style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProfile(null)}
                      className="flex-1 py-2 bg-gray-300 rounded-lg font-semibold hover:bg-gray-400"
                      style={{ fontFamily: 'Courier New, monospace' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="md:w-1/3">
                    {selectedMember.image && (
                      <img src={selectedMember.image} alt={selectedMember.name} className="w-full rounded-lg shadow-md" />
                    )}
                  </div>
                  
                  <div className="md:w-2/3 space-y-4">
                    <div>
                      <h1 className="text-3xl mb-2" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                        {selectedMember.name}
                      </h1>
                      <p className="text-xl text-gray-600" style={{ fontFamily: 'Courier New, monospace' }}>
                        {selectedMember.title}
                      </p>
                    </div>
                    
                    {selectedMember.bio && (
                      <p style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        {selectedMember.bio}
                      </p>
                    )}
                    
                    <div>
                      <h3 className="font-semibold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        Badges ({(selectedMember.emojis || []).length})
                      </h3>
                      <div className="text-3xl flex flex-wrap gap-2">
                        {(selectedMember.emojis || []).map((emoji, idx) => {
                          const film = films.find(f => f.emoji === emoji);
                          return (
                            <button
                              key={idx}
                              onClick={() => film && navigateTo('film', film)}
                              className="hover:scale-125 transition-transform"
                              title={film?.title || emoji}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        Films Reviewed
                      </h3>
                      <div className="space-y-2">
                        {buzzFeed
                          .filter(item => item.type === 'review' && item.memberId === selectedMember.id)
                          .map(review => {
                            const film = films.find(f => f.id === review.filmId);
                            return (
                              <button
                                key={review.id}
                                onClick={() => film && navigateTo('film', film)}
                                className="block w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                                    {film?.emoji} {review.filmTitle}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl">{review.thumbs === 'up' ? '👍' : review.thumbs === 'down' ? '👎' : '😐'}</span>
                                    <span className="font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                                      {review.score}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {page === 'leaderboard' && (
          <div>
            <h1 className="text-3xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
              Leaderboard
            </h1>
            
            <div className="mb-6 flex gap-4">
              <button
                onClick={() => setLeaderboardView('members')}
                className={`px-6 py-2 rounded-lg font-semibold ${
                  leaderboardView === 'members' ? 'text-white' : 'bg-gray-200'
                }`}
                style={{
                  fontFamily: 'Courier New, monospace',
                  backgroundColor: leaderboardView === 'members' ? '#009384' : undefined
                }}
              >
                By Member
              </button>
              <button
                onClick={() => setLeaderboardView('films')}
                className={`px-6 py-2 rounded-lg font-semibold ${
                  leaderboardView === 'films' ? 'text-white' : 'bg-gray-200'
                }`}
                style={{
                  fontFamily: 'Courier New, monospace',
                  backgroundColor: leaderboardView === 'films' ? '#009384' : undefined
                }}
              >
                By Film
              </button>
            </div>

            {leaderboardView === 'members' ? (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="grid grid-cols-4 gap-4 p-4 font-semibold" style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#31394d', color: 'white' }}>
                  <div>Rank</div>
                  <div>Member</div>
                  <div>Badges</div>
                  <div>Reviews</div>
                </div>
                {sortedMembers.map((member, idx) => {
                  const reviewCount = buzzFeed.filter(item => item.type === 'review' && item.memberId === member.id).length;
                  return (
                    <button
                      key={member.id}
                      onClick={() => navigateTo('profile', null, member)}
                      className="grid grid-cols-4 gap-4 p-4 hover:bg-gray-50 w-full text-left border-b last:border-b-0"
                    >
                      <div style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#009384' }}>
                        #{idx + 1}
                      </div>
                      <div className="flex items-center gap-2">
                        {member.image && (
                          <img src={member.image} alt={member.name} className="w-8 h-8 rounded-full object-cover" />
                        )}
                        <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                          {member.name}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        {(member.emojis || []).length}
                      </div>
                      <div style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        {reviewCount}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {films
                  .filter(f => !f.isUpcoming && f.bmnScore > 0)
                  .sort((a, b) => b.bmnScore - a.bmnScore)
                  .map((film, idx) => {
                    const reviewCount = buzzFeed.filter(item => item.type === 'review' && item.filmId === film.id).length;
                    return (
                      <button
                        key={film.id}
                        onClick={() => navigateTo('film', film)}
                        className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow w-full text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold" style={{ fontFamily: 'Courier New, monospace', color: '#009384' }}>
                            #{idx + 1}
                          </div>
                          {film.image && (
                            <img src={film.image} alt={film.title} className="w-16 h-24 object-cover rounded" />
                          )}
                          <div className="flex-1">
                            <h3 className="font-bold mb-1" style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                              {film.emoji} {film.title}
                            </h3>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <span>🎬</span>
                                <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold' }}>
                                  {film.bmnScore}
                                </span>
                              </div>
                              {film.rtScore && (
                                <div className="flex items-center gap-1">
                                  <span>🍅</span>
                                  <span style={{ fontFamily: 'Courier New, monospace' }}>
                                    {film.rtScore}%
                                  </span>
                                </div>
                              )}
                              <span style={{ fontFamily: 'Courier New, monospace', color: '#6b7280' }}>
                                {reviewCount} reviews
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {page === 'admin' && isAdmin && (
          <div>
            <h1 className="text-3xl mb-6" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
              Admin Panel
            </h1>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>
                Manage Admins
              </h2>
              
              <div className="mb-6">
                <h3 className="font-semibold mb-2" style={{ fontFamily: 'Courier New, monospace' }}>
                  Current Admins
                </h3>
                <div className="space-y-2">
                  {adminEmails.map(email => (
                    <div key={email} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        {email}
                      </span>
                      {email !== 'mattdernlan@gmail.com' && (
                        <button
                          onClick={() => handleRemoveAdmin(email)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2" style={{ fontFamily: 'Courier New, monospace' }}>
                  Add New Admin
                </h3>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="flex-1 px-4 py-2 border rounded-lg"
                    style={{ fontFamily: 'Courier New, monospace', borderColor: '#31394d' }}
                  />
                  <button
                    onClick={handleAddAdmin}
                    className="px-6 py-2 rounded-lg text-white font-semibold"
                    style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#009384' }}
                  >
                    Add Admin
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2" style={{ fontFamily: 'Courier New, monospace' }}>
                  Note: Email must be registered as a member
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {showAddFilm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl mb-4" style={{ fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: '#31394d' }}>Add Film</h2>
            <form onSubmit={handleAddFilm} className="space-y-4">
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
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'films')} className="block" disabled={uploadingImage} />
                  <div className="text-sm text-gray-500">or</div>
                  <input type="url" placeholder="Image URL" value={newFilm.image} onChange={(e) => setNewFilm({...newFilm, image: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} required />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Event Poster Image URL (for upcoming)</label>
                <input type="url" value={newFilm.eventPoster} onChange={(e) => setNewFilm({...newFilm, eventPoster: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>RT Score (leave blank to hide)</label>
                <input type="number" value={newFilm.rtScore} onChange={(e) => setNewFilm({...newFilm, rtScore: e.target.value})} className="w-full px-4 py-2 border rounded-lg" style={{ borderColor: '#31394d' }} />
              </div>
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Popcornmeter Score (leave blank to hide)</label>
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
              {/* NEW: Attendees multi-select */}
              <div>
                <label className="block mb-2 font-semibold" style={{ fontFamily: 'Courier New, monospace' }}>Mark Attendees</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3" style={{ borderColor: '#31394d' }}>
                  {members.map(member => (
                    <label key={member.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={(newFilm.attendees || []).includes(member.id)}
                        onChange={(e) => {
                          const attendees = newFilm.attendees || [];
                          if (e.target.checked) {
                            setNewFilm({...newFilm, attendees: [...attendees, member.id]});
                          } else {
                            setNewFilm({...newFilm, attendees: attendees.filter(id => id !== member.id)});
                          }
                        }}
                      />
                      <span style={{ fontFamily: 'Courier New, monospace', color: '#31394d' }}>
                        {member.name}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: 'Courier New, monospace' }}>
                  Selected members will receive the {newFilm.emoji} badge
                </p>
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
