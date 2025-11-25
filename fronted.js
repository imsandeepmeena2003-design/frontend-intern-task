Install

npx create-next-app frontend
cd frontend
npm i axios react-hook-form zod @hookform/resolvers jwt-decode
# Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p


tailwind.config.js minimal and add @tailwind base; @tailwind components; @tailwind utilities; to globals.css.

frontend/lib/api.js (central axios)

import axios from 'axios';

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' }
});

export function setAuthToken(token) {
  if (token) API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete API.defaults.headers.common['Authorization'];
}

export default API;


frontend/lib/auth.js (auth helpers)

import jwtDecode from 'jwt-decode';
export const saveToken = (token) => localStorage.setItem('token', token);
export const loadToken = () => localStorage.getItem('token');
export const removeToken = () => localStorage.removeItem('token');
export const getUserFromToken = (token) => {
  try { return jwtDecode(token); } catch { return null; }
};


Auth context (simplified) frontend/pages/_app.js wrap app with AuthProvider that stores token & user and provides login/logout.

Login page (key points):

Form via react-hook-form, zod schema client-side

On submit: POST /api/auth/login -> returns token -> saveToken, setAuthToken, redirect to /dashboard

Protected route: client-side check — PrivateRoute checks local token and redirects to /login. For stronger security, call /api/profile on mount to validate token.

Dashboard page (/dashboard)

Fetch profile (/api/profile)

Fetch notes (/api/notes?q=&tag=)

CRUD UI for notes: create form modal, list of notes with edit/delete

Search input bound to query param to call GET /api/notes?q=...

Example: create note

const createNote = async (data) => {
  const res = await API.post('/notes', data);
  setNotes(prev => [res.data, ...prev]);
};


Logout

removeToken(); setAuthToken(null); router.push('/login');

4) Client & Server validation

Client: react-hook-form + zod or yup validating required fields, email format, password min length

Server: express-validator in routes (already in example)

Always check on server too — never trust client validation

5) Postman / API docs (example endpoints)

You can export a Postman collection. Minimal API docs to include in repo:

Auth

POST /api/auth/register — body: {name,email,password} -> returns { token }

POST /api/auth/login — {email,password} -> { token }

Profile

GET /api/profile — Auth header Authorization: Bearer <token> -> user

PUT /api/profile — body { name? , email? }

Notes

GET /api/notes?q=&tag= — list (auth)

POST /api/notes — {title,body,tags} create

PUT /api/notes/:id update

DELETE /api/notes/:id delete

cURL example

curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"pass123"}'

6) Run locally (dev)

Backend

cd backend
npm run dev   # nodemon server.js
# ensure .env has MONGO_URI & JWT_SECRET


Frontend

cd frontend
npm run dev   # Next dev server
# make sure NEXT_PUBLIC_API_URL=http://localhost:4000/api
