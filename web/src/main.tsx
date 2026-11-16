import { createRoot } from 'react-dom/client';
import App from './App';
import SitePreloader from './components/site-preloader';
import '@fontsource-variable/inter';
import './styles.css';
import './documentation.css';
import './responsive.css';
createRoot(document.getElementById('root')!).render(<SitePreloader><App /></SitePreloader>);
