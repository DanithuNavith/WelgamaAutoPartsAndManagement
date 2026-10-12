import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

document.addEventListener('contextmenu', event => event.preventDefault());

const savedTheme = localStorage.getItem('welgama-theme') || 'light';
document.body.classList.toggle('theme-dark', savedTheme === 'dark');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
