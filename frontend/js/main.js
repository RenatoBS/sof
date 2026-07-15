import { initNav, go } from './nav.js';
import { initAuth } from './auth.js';
import { initCheckout } from './checkout.js';

initNav();
initAuth();
initCheckout();

if (window.location.hash === '#login') go('login');
