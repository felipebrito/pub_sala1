import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OutputWindow } from './features/Output/OutputWindow.tsx'

const isOutputWindow = new URLSearchParams(window.location.search).get('window') === 'output';

createRoot(document.getElementById('root')!).render(
  isOutputWindow ? <OutputWindow /> : <App />
)
