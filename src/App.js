import React, { useState, useEffect } from 'react';
import { Star, Film, Calendar, LogIn, LogOut, Edit, Save, X, Upload } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc } from 'firebase/firestore';
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

const initialFilms = [
  {id: 1, title: "Beach Kings", type: "bmn", subtitle: "Beach Kings", image: "https://m.media-amazon.com/images/I/91AqeB8kZTL._UF350,350_QL50_.jpg", rtScore: 45, bmnScore: 72, date: "2023-08-31", attendees: ["Matt", "Ryan", "Gabe", "James", "Colin"], emoji: "🏐"},
  {id: 2, title: "Toxic Shark", type: "bmn", subtitle: "Toxic Shark", image: "https://m.media-amazon.com/images/M/MV5BMmEwNWU5OTEtOWE1Ny00YTE1LWFhY2YtNTYyMDYwNjdjYTQyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg", rtScore: 31, bmnScore: 78, date: "2023-09-26", attendees: ["Matt", "Ryan", "Gabe", "James", "Colin"], emoji: "🦈"},
  {id: 3, title: "Snowmageddon", type: "bmn", subtitle: "Merry Crisis", image: "https://m.media-amazon.com/images/M/MV5BMjQ4NjM0MDQ3NV5BMl5BanBnXkFtZTgwMzU5ODcwMzE@._V1_.jpg", rtScore: 25, bmnScore: 81, date: "2023-12-01", attendees: ["Matt", "Ryan", "Gabe", "James", "Colin"], emoji: "❄️"},
  {id: 4, title: "The Mean One", type: "bmn", subtitle: "Merry Crisis", image: "https://m.media-amazon.com/images/M/MV5BN2RlYzUyNjktMTM0OS00NjY5LThhODItNDBlODAyMDliMDlkXkEyXkFqcGc@._V1_.jpg", rtScore: 38, bmnScore: 85, date: "2023-12-01", attendees: ["Matt", "Hunter"], emoji: "🎄"},
  {id: 5, title: "Debug", type: "bmn", subtitle: "Reboot", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSc3xkOmzfhbsJrts1P4WR0HNmEOu161jonKg&s", rtScore: 15, bmnScore: 68, date: "2024-01-19", attendees: ["Matt", "Ryan", "Hunter", "Gabe"], emoji: "🤖"},
  {id: 6, title: "Miss Meadows", type: "bmn", subtitle: "One Not To Miss", image: "https://cdn11.bigcommerce.com/s-yzgoj/images/stencil/1280x1280/products/373204/4472014/api8j1xri__64799.1625621486.jpg?c=2", rtScore: 62, bmnScore: 71, date: "2024-04-19", attendees: ["Matt", "Hunter", "Colin"], emoji: "👩"},
  {id: 7, title: "Meteor Moon", type: "bmn", subtitle: "Summer Blockbuster", image: "https://m.media-amazon.com/images/M/MV5BZjQ1ZGM3MjgtOTI5MC00ZmZhLWJlNDQtMjhjZTc5ZTgyOTMzXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg", rtScore: 18, bmnScore: 83, date: "2024-08-01", attendees: ["Matt", "Ryan", "Gabe", "James", "Colin"], emoji: "☄️"},
  {id: 8, title: "Dinosaur Prison", type: "bmn", subtitle: "A Prison Like No Other", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1ooD06Jtf6cWYEk87cCdm8M_3uvGmpdUZlA&s", rtScore: 22, bmnScore: 91, date: "2024-09-27", attendees: ["Matt", "Ryan", "Hunter", "James", "Colin", "Max"], emoji: "🦖"},
  {id: 9, title: "Ground Rules", type: "bmn", subtitle: "Even the Score", image: "https://m.media-amazon.com/images/I/51ADQ1glv0L._UF350,350_QL50_.jpg", rtScore: 28, bmnScore: 76, date: "2024-12-06", attendees: ["Matt", "Ryan", "Hunter", "Colin", "James"], emoji: "🏀"},
  {id: 10, title: "Metal Tornado", type: "bmn", subtitle: "Vortex in Paris", image: "https://m.media-amazon.com/images/I/618EYyWPqOL._UF1000,1000_QL80_.jpg", rtScore: 33, bmnScore: 79, date: "2025-02-20", attendees: ["Matt", "Ryan", "Hunter", "Gabe", "James", "Colin", "Max"], emoji: "🌪️"},
  {id: 11, title: "Planet Dune", type: "bmn", subtitle: "Doomed to Fail", image: "https://m.media-amazon.com/images/M/MV5BOTI3ZDZjMzAtZTkyYi00YTc4LWEyNDctYzNlOTc2ODIwMWNhXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg", rtScore: 12, bmnScore: 88, date: "2025-04-25", attendees: ["Matt", "Ryan", "Hunter", "James", "Colin", "Max"], emoji: "🪐"},
  {id: 12, title: "Jurassic Shark", type: "bmn", subtitle: "From The Deep", image: "https://m.media-amazon.com/images/M/MV5BZTdhMDk5ODctZGEwNy00MDNjLWE2YzktZDE4ZjhiMjNhYTY0XkEyXkFqcGc@._V1_.jpg", rtScore: 8, bmnScore: 94, date: "2025-06-12", attendees: ["Matt", "Ryan", "Hunter", "Gabe", "Colin", "Max"], emoji: "🦕"},
  {id: 13, title: "Paintball", type: "bmn", subtitle: "Play to Survive", image: "https://m.media-amazon.com/images/I/91zatIF4IvL._SL1500_.jpg", rtScore: 41, bmnScore: 82, date: "2025-09-25", attendees: ["Matt", "Ryan", "Hunter", "Gabe", "James", "Colin", "Max"], emoji: "🎯"},
  {id: 14, title: "Madame Web", type: "offsite-film", image: "https://m.media-amazon.com/images/M/MV5BODViOTZiOTQtOTc4ZC00ZjUxLWEzMjItY2ExMmNlNDliNjE4XkEyXkFqcGc@._V1_.jpg", rtScore: 11, bmnScore: 89, date: "2024-02-18", attendees: ["Matt", "Ryan", "Hunter", "James"], emoji: "🕷️"},
  {id: 15, title: "Borderlands", type: "offsite-film", image: "https://m.media-amazon.com/images/I/81YSKAxNiDL.jpg", rtScore: 9, bmnScore: 86, date: "2024-08-10", attendees: ["Matt", "Gabe", "Colin"], emoji: "🎮"},
  {id: 16, title: "Red One", type: "offsite-film", image: "https://m.media-amazon.com/images/M/MV5BZmFkMjE4NjQtZTVmZS00MDZjLWE2ZmEtZTkzODljNjhlNWUxXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg", rtScore: 32, bmnScore: 74, date: "2024-11-15", attendees: ["Matt", "Ryan", "Hunter", "James", "Colin"], emoji: "🎅"},
  {id: 17, title: "Kraven the Hunter", type: "offsite-film", image: "https://www.movieposters.com/cdn/shop/files/kraven-the-hunter_4ed9pbow_480x.progressive.jpg?v=1726587613", rtScore: 15, bmnScore: 77, date: "2024-12-19", attendees: ["Colin", "Gabe", "James"], emoji: "🦁"},
  {id: 18, title: "Screamboat", type: "offsite-film", image: "https://m.media-amazon.com/images/M/MV5BMDg3NjJkOTktZWM0NC00MWI3LWEwNTYtYTQ2YWIwNWI3ZmM2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg", rtScore: 42, bmnScore: 69, date: "2025-04-03", attendees: ["Matt", "Hunter", "Colin", "Max"], emoji: "🚢"}
];

const initialMembers = [
  {id: 1, name: "Matt Dernlan", username: "Matt", title: "District Manager of Video", image: "https://i.pravatar.cc/150?img=33", bio: "Founding member and curator of cinematic disasters.", emojis: ["🏐", "🦈", "❄️", "🎄", "🤖", "👩", "☄️", "🦖", "🏀", "🌪️", "🪐", "🦕", "🎯", "🕷️", "🎮", "🎅", "🚢"]},
  {id: 2, name: "Hunter Rising", username: "Hunter", title: "Senior VP of Boardology", image: "https://i.pravatar.cc/150?img=12", bio: "Expert in identifying plot holes.", emojis: ["🏐", "🦈", "❄️", "🎄", "🤖", "👩", "☄️", "🏀", "🌪️", "🪐", "🦕", "🎯", "🕷️", "🎅", "🚢"]},
  {id: 3, name: "Ryan Pfleiderer", username: "Ryan", title: "Anime Lead", image: "https://i.pravatar.cc/150?img=8", bio: "Brings anime-level dramatic commentary.", emojis: ["🏐", "🦈", "❄️", "🤖", "☄️", "🦖", "🏀", "🌪️", "🪐", "🦕", "🎯", "🕷️", "🎅"]},
  {id: 4, name: "Gabe Kovacs", username: "Gabe", title: "Laughs Engineer", image: "https://i.pravatar.cc/150?img=13", bio: "Engineered precision laughter.", emojis: ["🏐", "🦈", "❄️", "🤖", "☄️", "🦖", "🌪️", "🪐", "🦕", "🎯", "🎮", "🦁"]},
  {id: 5, name: "James Burg", username: "James", title: "Quips Lead", image: "https://i.pravatar.cc/150?img=68", bio: "Delivers perfectly timed one-liners.", emojis: ["🏐", "🦈", "❄️", "☄️", "🦖", "🏀", "🌪️", "🪐", "🎯", "🕷️", "🎅", "🦁"]},
  {id: 6, name: "Colin Sherman", username: "Colin", title: "Chief Research Officer", image: "https://i.pravatar.cc/150?img=52", bio: "Researches every disaster film.", emojis: ["🏐", "🦈", "❄️", "👩", "☄️", "🦖", "🏀", "🌪️", "🪐", "🦕", "🎯", "🎮", "🎅", "🦁", "🚢"]},
  {id: 7, name: "Max Stenstrom", username: "Max", title: "Viticulture Team Lead", image: "https://i.pravatar.cc/150?img=59", bio: "Pairs wine with terrible movies.", emojis: ["🌪️", "🪐", "🦕", "🎯", "🚢"]}
];

function App() {
  const [page, setPage] = useState('home');
  const [films, setFilms] = useState(initialFilms);
  const [members, setMembers] = useState(initialMembers);
  const [film, setFilm] = useState(null);
  const [member, setMember] = useState(null);
  const [user, setUser] = useState(null);
  const [login, setLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);
  const bmn = films.filter(f => f.type === 'bmn');
  const off = films.filter(f => f.type === 'offsite-film');

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else setUser(null);
    });
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setLogin(false);
      alert('Login successful!');
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const FilmCard = ({f, showRT = true}) => (
    <div onClick={() => {setFilm(f); setPage('detail');}} className="bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer hover:shadow-2xl transition">
      <div className="relative bg-gray-200 aspect-[2/3] flex items-center justify-center">
        <img src={f.image} alt={f.title} className="w-full h-full object-cover" onError={e => e.target.src = ''} />
      </div>
      <div className="p-4">
        <h3 className="font-bold text-lg mb-1">{f.title}</h3>
        {f.subtitle && <p className="text-sm text-gray-600 mb-3">{f.subtitle}</p>}
        <div className="flex gap-4 justify-center items-center">
          <div className="text-3xl">{f.emoji}</div>
          {showRT && f.rtScore && <div className="flex flex-col items-center"><div className="text-xs text-gray-600">RT</div><div className="flex items-center gap-1"><span className="text-xl">🍅</span><span className="font-bold text-lg">{f.rtScore}%</span></div></div>}
          <div className="flex flex-col items-center"><div className="text-xs text-gray-600">BMN</div><div className="flex items-center gap-1"><Star className="w-5 h-5 fill-yellow-500 text-yellow-500" /><span className="font-bold text-lg">{f.bmnScore}</span></div></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gradient-to-r from-blue-900 via-blue-700 to-yellow-500 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setPage('home')}>
            <Film className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Bad Movie Night</h1>
          </div>
          <div className="flex gap-6 items-center">
            <button onClick={() => setPage('home')} className="hover:text-yellow-300">Home</button>
            <button onClick={() => setPage('members')} className="hover:text-yellow-300">Members</button>
            <button onClick={() => setPage('leaderboard')} className="hover:text-yellow-300">Leaderboard</button>
            {user && <button onClick={() => setPage('profile')} className="hover:text-yellow-300">My Profile</button>}
            {isAdmin && <button onClick={() => setPage('admin')} className="hover:text-yellow-300">Admin</button>}
            {user ? <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1 bg-red-500 rounded-lg"><LogOut className="w-4 h-4" />Logout</button> : <button onClick={() => setLogin(true)} className="flex items-center gap-2 px-3 py-1 bg-yellow-500 text-blue-900 rounded-lg"><LogIn className="w-4 h-4" />Login</button>}
          </div>
        </div>
      </nav>

      {login && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setLogin(false)}><div className="bg-white rounded-lg p-8 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}><h2 className="text-2xl font-bold text-blue-900 mb-6">Login</h2><div className="space-y-4"><div><label className="block text-sm font-semibold mb-2">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border rounded-lg" /></div><div><label className="block text-sm font-semibold mb-2">Password</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full p-3 border rounded-lg" /></div><button onClick={handleLogin} className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800">Sign In</button></div></div></div>}

      {page === 'home' && <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50"><div className="max-w-7xl mx-auto px-4 py-8"><div className="text-center mb-12"><h2 className="text-4xl font-bold text-blue-900 mb-2">Welcome to Bad Movie Night</h2><p className="text-gray-600">Where terrible movies become legendary</p><p className="text-sm text-gray-500 mt-2">Since 2023 • {bmn.length} Screenings • {off.length} Offsite Films</p></div><section className="mb-12"><h3 className="text-2xl font-bold text-blue-900 mb-6">Screenings</h3><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">{bmn.map(f => <FilmCard key={f.id} f={f} />)}</div></section><section><h3 className="text-2xl font-bold text-blue-900 mb-6">Offsite Films</h3><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">{off.map(f => <FilmCard key={f.id} f={f} showRT={true} />)}</div></section></div></div>}

      {page === 'members' && <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50"><div className="max-w-7xl mx-auto px-4 py-8"><h2 className="text-4xl font-bold text-blue-900 mb-8 text-center">Members</h2><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{members.map(m => <div key={m.id} onClick={() => {setMember(m); setPage('member-detail');}} className="bg-white rounded-lg shadow-lg p-4 cursor-pointer hover:shadow-2xl transition"><img src={m.image} alt={m.name} className="w-full aspect-square object-cover rounded-lg mb-3" /><h3 className="font-bold text-center">{m.name}</h3><p className="text-sm text-gray-600 text-center">{m.title}</p><div className="text-center mt-2 text-xs text-blue-700">{m.emojis.length} badges</div></div>)}</div></div></div>}

      {page === 'detail' && film && <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50"><div className="max-w-6xl mx-auto px-4 py-8"><button onClick={() => setPage('home')} className="mb-6 text-blue-700 hover:text-blue-900 font-semibold">← Back</button>{isAdmin && <button onClick={() => {setEditData(film); setEditMode(true);}} className="mb-6 ml-4 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 flex items-center gap-2"><Edit className="w-4 h-4" />Edit Film</button>}<div className="bg-white rounded-lg shadow-2xl p-8"><div className="grid md:grid-cols-2 gap-8"><div className="relative bg-gray-200 rounded-lg aspect-[2/3]"><img src={film.image} alt={film.title} className="w-full h-full object-cover rounded-lg" onError={e => e.target.src = ''} /></div><div><h1 className="text-4xl font-bold text-blue-900 mb-2">{film.title}</h1>{film.subtitle && <p className="text-xl text-gray-600 mb-4">{film.subtitle}</p>}<p className="text-gray-600 mb-6">{new Date(film.date).toLocaleDateString()}</p><div className="flex gap-8 mb-8 items-center"><div className="text-6xl">{film.emoji}</div>{film.rtScore && <div className="text-center"><div className="text-sm text-gray-600 mb-2">RT</div><div className="flex items-center gap-2"><span className="text-4xl">🍅</span><span className="text-3xl font-bold">{film.rtScore}%</span></div></div>}<div className="text-center"><div className="text-sm text-gray-600 mb-2">BMN</div><div className="flex items-center gap-2"><Star className="w-10 h-10 fill-yellow-500 text-yellow-500" /><span className="text-3xl font-bold">{film.bmnScore}</span></div></div></div><div><div className="text-sm font-semibold text-gray-700 mb-2">Attendees</div><div className="flex gap-2 flex-wrap">{film.attendees.map((n, i) => <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">{n}</span>)}</div></div></div></div></div></div></div>}

      {page === 'profile' && user && <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50"><div className="max-w-4xl mx-auto px-4 py-8"><h2 className="text-4xl font-bold text-blue-900 mb-8 text-center">My Profile</h2><div className="bg-white rounded-lg shadow-2xl p-8"><p className="text-center text-gray-600">Profile editing coming soon! You can update your bio, photo, and info here.</p><p className="text-center text-gray-600 mt-4">Logged in as: {user.email}</p></div></div></div>}

      {page === 'admin' && isAdmin && <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50"><div className="max-w-6xl mx-auto px-4 py-8"><h2 className="text-4xl font-bold text-blue-900 mb-8 text-center">Admin Panel</h2><div className="bg-white rounded-lg shadow-2xl p-8"><h3 className="text-2xl font-bold text-blue-900 mb-4">Quick Actions</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><button className="p-6 bg-blue-700 text-white rounded-lg hover:bg-blue-800 font-semibold">Add New Film</button><button className="p-6 bg-green-700 text-white rounded-lg hover:bg-green-800 font-semibold">Manage Members</button></div><p className="text-gray-600 mt-6">Full admin features coming soon!</p></div></div></div>}

      {page === 'leaderboard' && <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50"><div className="max-w-5xl mx-auto px-4 py-8"><h2 className="text-4xl font-bold text-blue-900 mb-2 text-center">Leaderboard</h2><p className="text-center text-gray-600 mb-8">Who's the baddest?</p><div className="bg-white rounded-lg shadow-lg p-6"><div className="space-y-4">{[...members].sort((a,b) => b.emojis.length - a.emojis.length).map((m, i) => <div key={m.id} className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg"><div className="text-3xl font-bold text-blue-900 w-12 text-center">{i === 0 && '🥇'}{i === 1 && '🥈'}{i === 2 && '🥉'}{i > 2 && `#${i + 1}`}</div><img src={m.image} alt={m.name} className="w-16 h-16 rounded-full object-cover" /><div className="flex-1"><div className="font-bold text-lg">{m.name}</div><div className="text-sm text-gray-600">{m.title}</div></div><div className="text-2xl font-bold text-blue-700">{m.emojis.length} badges</div></div>)}</div></div></div></div>}

      {page === 'member-detail' && member && <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50"><div className="max-w-4xl mx-auto px-4 py-8"><button onClick={() => setPage('members')} className="mb-6 text-blue-700 hover:text-blue-900 font-semibold">← Back</button><div className="bg-white rounded-lg shadow-2xl p-8"><div className="flex flex-col md:flex-row gap-8 mb-8"><img src={member.image} alt={member.name} className="w-48 h-48 rounded-lg shadow-lg object-cover" /><div className="flex-1"><h1 className="text-3xl font-bold text-blue-900 mb-2">{member.name}</h1><p className="text-lg text-gray-600 mb-4">{member.title}</p><p className="text-gray-700 mb-6">{member.bio}</p></div></div><div className="mb-8"><h3 className="text-xl font-bold text-blue-900 mb-4">Badge Collection ({member.emojis.length})</h3><div className="flex flex-wrap gap-3">{member.emojis.map((e, i) => <span key={i} className="text-5xl">{e}</span>)}</div></div></div></div></div>}
    </div>
  );
}

export default App;
